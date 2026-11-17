import {summarizeScores} from './stats.js';
import type {
    EvalCase,
    EvalDefinition,
    EvalReport,
    GradeResult,
    Graded,
    Grader,
    ScoreSummary,
    TokenUsage,
    TrialResult,
} from './types.js';

/** Runs of each case when the eval does not say. */
export const DEFAULT_TRIALS = 1;

/** Trials run at once when the eval does not say. */
export const DEFAULT_CONCURRENCY = 4;

/** Longest one trial may run when the eval does not say. */
export const DEFAULT_TRIAL_TIMEOUT_MS = 120_000;

export interface RunEvalOptions<Input, Expected, Output> {
    /** Overrides the eval's `trials`. */
    trials?: number | undefined;
    /** Overrides the eval's `concurrency`. */
    concurrency?: number | undefined;
    /** Overrides the eval's `maxTokens`. */
    maxTokens?: number | undefined;
    /** Only run cases whose id contains this text, or that have a tag equal to it. Default: every case. */
    filter?: string | undefined;
    /**
     * An earlier report whose outputs are graded again instead of running the task, for trials it has without an
     * error. Used to change graders without paying for the runs again. Default: run every trial.
     */
    previous?: EvalReport<Input, Expected, Output> | undefined;
    /** Called as each trial finishes, for progress output. */
    onTrial?: ((trial: TrialResult<Input, Expected, Output>, done: number, total: number) => void) | undefined;
}

const NO_USAGE: TokenUsage = {inputTokens: 0, outputTokens: 0};

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** Turns a grader's verdict into a score and note, rejecting scores outside 0 to 1. */
const normalizeGrade = (result: GradeResult): { score: number; note: string | undefined } => {
    const {score, note} = typeof result === 'object' ? {score: result.score, note: result.note} : {score: result, note: undefined};
    const value = typeof score === 'boolean' ? Number(score) : score;
    if (!Number.isFinite(value) || value < 0 || value > 1) {
        throw new Error(`gave the score ${String(score)}; scores go from 0 to 1`);
    }
    return {score: value, note};
};

const resolveCases = async <Input, Expected, Output>(definition: EvalDefinition<Input, Expected, Output>): Promise<readonly EvalCase<Input, Expected>[]> => {
    const cases = typeof definition.cases === 'function' ? await definition.cases() : definition.cases;
    const seen = new Set<string>();
    for (const evalCase of cases) {
        if (seen.has(evalCase.id)) {
            throw new Error(`Eval "${definition.name}" has two cases with the id "${evalCase.id}".`);
        }
        seen.add(evalCase.id);
    }
    return cases;
};

/** Rejects once the signal aborts, so a task that ignores the signal still times out. */
const whenAborted = (signal: AbortSignal): Promise<never> =>
    new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), {once: true});
    });

const summarizeBy = <T>(items: readonly T[], graderNames: readonly string[], score: (item: T, grader: string) => number) =>
    Object.fromEntries(graderNames.map((grader) => [grader, summarizeScores(items.map((item) => score(item, grader)))])) as Record<string, ScoreSummary>;

/**
 * Runs every case of an eval `trials` times, at most `concurrency` at once, grades each output with every grader,
 * and summarizes the scores overall and by tag, with 95% intervals. A task that throws or times out is recorded as
 * an error and scores 0 on every grader; a grader that throws scores 0 for that trial, with a note.
 */
export async function runEval<Input, Expected, Output>(
    definition: EvalDefinition<Input, Expected, Output>,
    options: RunEvalOptions<Input, Expected, Output> = {},
): Promise<EvalReport<Input, Expected, Output>> {
    const {
        trials = definition.trials ?? DEFAULT_TRIALS,
        concurrency = definition.concurrency ?? DEFAULT_CONCURRENCY,
        maxTokens = definition.maxTokens,
        filter,
        previous,
        onTrial,
    } = options;
    const timeoutMs = definition.timeoutMs ?? DEFAULT_TRIAL_TIMEOUT_MS;
    const graderEntries = Object.entries(definition.graders) as [string, Grader<Input, Expected, Output>][];
    if (graderEntries.length === 0) {
        throw new Error(`Eval "${definition.name}" has no graders.`);
    }

    const all = await resolveCases(definition);
    const cases = filter === undefined ? all : all.filter((evalCase) => evalCase.id.includes(filter) || (evalCase.tags ?? []).includes(filter));
    if (cases.length === 0) {
        throw new Error(filter === undefined ? `Eval "${definition.name}" has no cases.` : `No case of eval "${definition.name}" matches "${filter}".`);
    }

    const work = cases.flatMap((evalCase) => Array.from({length: trials}, (_, trial) => ({evalCase, trial})));
    const reusable = new Map((previous?.trials ?? []).filter((trial) => trial.error === undefined).map((trial) => [`${trial.caseId}#${trial.trial}`, trial]));
    const results: (TrialResult<Input, Expected, Output> | undefined)[] = new Array(work.length);
    const usage = {inputTokens: 0, outputTokens: 0};
    const startedAt = new Date();
    let next = 0;
    let done = 0;
    let skipped = 0;

    const runTrial = async ({evalCase, trial}: (typeof work)[number]): Promise<TrialResult<Input, Expected, Output>> => {
        const started = performance.now();
        const prior = reusable.get(`${evalCase.id}#${trial}`);
        const trialUsage = {inputTokens: 0, outputTokens: 0};
        let output: Output | undefined;
        let error: string | undefined;

        if (prior !== undefined) {
            output = prior.output;
        } else {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(new Error(`timed out after ${timeoutMs} ms`)), timeoutMs);
            const context = {
                trial,
                signal: controller.signal,
                recordUsage: (recorded: TokenUsage) => {
                    trialUsage.inputTokens += recorded.inputTokens;
                    trialUsage.outputTokens += recorded.outputTokens;
                    usage.inputTokens += recorded.inputTokens;
                    usage.outputTokens += recorded.outputTokens;
                },
            };
            try {
                output = await Promise.race([Promise.resolve().then(() => definition.task(evalCase.input, context)), whenAborted(controller.signal)]);
            } catch (thrown) {
                error = messageOf(thrown);
            } finally {
                clearTimeout(timer);
            }
        }

        const scores: Record<string, number> = {};
        const notes: Record<string, string> = {};
        for (const [name, grader] of graderEntries) {
            if (error !== undefined) {
                scores[name] = 0;
                continue;
            }
            try {
                const graded: Graded<Input, Expected, Output> = {case: evalCase, output: output as Output};
                const {score, note} = normalizeGrade(await grader(graded));
                scores[name] = score;
                if (note !== undefined) notes[name] = note;
            } catch (thrown) {
                scores[name] = 0;
                notes[name] = `grader failed: ${messageOf(thrown)}`;
            }
        }

        return {
            caseId: evalCase.id,
            tags: evalCase.tags ?? [],
            trial,
            input: evalCase.input,
            expected: evalCase.expected,
            output,
            error,
            scores,
            notes,
            durationMs: prior?.durationMs ?? performance.now() - started,
            usage: prior?.usage ?? trialUsage,
            reused: prior !== undefined,
        };
    };

    const worker = async () => {
        while (next < work.length) {
            const index = next++;
            if (maxTokens !== undefined && usage.inputTokens + usage.outputTokens >= maxTokens) {
                skipped += 1;
                continue;
            }
            const result = await runTrial(work[index]!);
            results[index] = result;
            done += 1;
            onTrial?.(result, done, work.length);
        }
    };
    await Promise.all(Array.from({length: Math.max(1, Math.min(concurrency, work.length))}, worker));

    const finished = results.filter((result): result is TrialResult<Input, Expected, Output> => result !== undefined);
    const graderNames = graderEntries.map(([name]) => name);
    const tags = [...new Set(finished.flatMap((result) => result.tags))].sort();
    const report: EvalReport<Input, Expected, Output> = {
        name: definition.name,
        meta: definition.meta ?? {},
        startedAt: startedAt.toISOString(),
        durationMs: Date.now() - startedAt.getTime(),
        usage: finished.reduce((total, result) => ({
            inputTokens: total.inputTokens + result.usage.inputTokens,
            outputTokens: total.outputTokens + result.usage.outputTokens,
        }), NO_USAGE),
        trials: finished,
        scores: summarizeBy(finished, graderNames, (result, grader) => result.scores[grader] ?? 0),
        byTag: Object.fromEntries(tags.map((tag) => [
            tag,
            summarizeBy(finished.filter((result) => result.tags.includes(tag)), graderNames, (result, grader) => result.scores[grader] ?? 0),
        ])),
        metrics: definition.metrics?.(finished) ?? {},
        errors: finished.filter((result) => result.error !== undefined).length,
        skipped,
    };
    return report;
}
