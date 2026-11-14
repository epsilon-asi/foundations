import {appendFile} from 'node:fs/promises';
import {join} from 'node:path';
import {describe, it} from 'vitest';
import {baselineFrom, metaDifferences, readBaseline, writeBaseline} from './baseline.js';
import {checkThresholds, compareToBaseline, evalFailures} from './judge.js';
import {formatSummary, readReport, writeReport} from './report.js';
import {runEval} from './run.js';
import type {EvalDefinition, EvalReport} from './types.js';

/** Where reports are written, relative to the working directory, unless EVAL_RESULTS_DIR says otherwise. */
export const DEFAULT_RESULTS_DIR = 'eval-results';

/** Where baselines are kept, relative to the working directory. Commit them. */
export const DEFAULT_BASELINE_DIR = 'evals/baselines';

/** How long vitest lets one eval run: long enough for any eval, so the trials' own timeouts are what apply. */
export const EVAL_TEST_TIMEOUT_MS = 6 * 60 * 60 * 1000;

/**
 * How an eval run is set up. Settings that change per run come from the environment, so `npm run eval` takes them
 * without new flags:
 *
 * - `EVAL_TRIALS`, `EVAL_CONCURRENCY`, `EVAL_MAX_TOKENS`: override the eval's own.
 * - `EVAL_FILTER`: only run cases whose id contains it, or that have it as a tag. The baseline is not enforced.
 * - `EVAL_REGRADE=1`: grade the outputs of the last report again instead of running the task.
 * - `EVAL_UPDATE_BASELINE=1`: record this run as the baseline.
 * - `EVAL_RESULTS_DIR`: where reports go. Default: DEFAULT_RESULTS_DIR.
 * - `GITHUB_STEP_SUMMARY`: set by GitHub Actions; the summary is added to the job's.
 */
export interface EvalRunOptions {
    /** Default: EVAL_RESULTS_DIR, else DEFAULT_RESULTS_DIR. */
    resultsDir?: string;
    /** Default: DEFAULT_BASELINE_DIR. */
    baselineDir?: string;
    /** Default: process.env. */
    env?: Readonly<Record<string, string | undefined>>;
    /** Where the summary and progress go. Default: stdout. */
    print?: (text: string) => void;
}

export interface EvalOutcome<Input, Expected, Output> {
    readonly report: EvalReport<Input, Expected, Output>;
    /** Why the eval fails; empty when it passes. */
    readonly failures: readonly string[];
    readonly summary: string;
    readonly reportPath: string;
    readonly baselinePath: string;
}

/** An eval broke a threshold or regressed against its baseline. */
export class EvalFailedError extends Error {
    readonly failures: readonly string[];

    constructor(name: string, failures: readonly string[]) {
        super(`Eval "${name}" failed:\n${failures.map((failure) => `- ${failure}`).join('\n')}`);
        this.name = 'EvalFailedError';
        this.failures = failures;
    }
}

const positiveInteger = (env: Readonly<Record<string, string | undefined>>, key: string): number | undefined => {
    const raw = env[key];
    if (raw === undefined || raw === '') {
        return undefined;
    }
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 1) {
        throw new Error(`${key} must be a whole number above 0; it is "${raw}".`);
    }
    return value;
};

/**
 * Runs an eval, writes its report, compares it with its baseline and thresholds, and prints a summary. Returns why it
 * failed rather than throwing, so callers decide; `defineEval` throws.
 */
export async function runAndJudgeEval<Input, Expected, Output>(
    definition: EvalDefinition<Input, Expected, Output>,
    options: EvalRunOptions = {},
): Promise<EvalOutcome<Input, Expected, Output>> {
    const {env = process.env, print = (text: string) => void process.stdout.write(text)} = options;
    const resultsDir = options.resultsDir ?? env['EVAL_RESULTS_DIR'] ?? DEFAULT_RESULTS_DIR;
    const reportPath = join(resultsDir, `${definition.name}.json`);
    const baselinePath = join(options.baselineDir ?? DEFAULT_BASELINE_DIR, `${definition.name}.json`);
    const filter = env['EVAL_FILTER'] || undefined;
    const updateBaseline = env['EVAL_UPDATE_BASELINE'] === '1';
    if (updateBaseline && filter !== undefined) {
        throw new Error('EVAL_UPDATE_BASELINE=1 records a baseline from every case, so it cannot be used with EVAL_FILTER.');
    }

    let previous: EvalReport<Input, Expected, Output> | undefined;
    if (env['EVAL_REGRADE'] === '1') {
        previous = await readReport<Input, Expected, Output>(reportPath);
        if (previous === undefined) {
            throw new Error(`EVAL_REGRADE=1 grades an earlier report again, and there is none at ${reportPath}.`);
        }
    }

    let reported = 0;
    const report = await runEval(definition, {
        trials: positiveInteger(env, 'EVAL_TRIALS'),
        concurrency: positiveInteger(env, 'EVAL_CONCURRENCY'),
        maxTokens: positiveInteger(env, 'EVAL_MAX_TOKENS'),
        filter,
        previous,
        onTrial: (_trial, done, total) => {
            // About ten progress lines per run.
            if (done === total || done - reported >= Math.max(1, Math.ceil(total / 10))) {
                reported = done;
                print(`${definition.name}: ${done}/${total} trials\n`);
            }
        },
    });
    await writeReport(report, resultsDir);

    const baseline = await readBaseline(baselinePath);
    // A filtered run or a new baseline is not held to the old baseline: the first covers other cases, the second replaces it.
    const comparisons = compareToBaseline(report, baseline).map((comparison) =>
        filter !== undefined || updateBaseline ? {...comparison, regressed: false} : comparison);
    const failures = evalFailures(report, checkThresholds(report, definition.thresholds), comparisons);
    const warnings = [
        ...(baseline === undefined
            ? [`there is no baseline at ${baselinePath} yet; run with EVAL_UPDATE_BASELINE=1 to record one`]
            : metaDifferences(report.meta, baseline).map((difference) => `this run differs from the baseline in ${difference}`)),
        ...(filter === undefined ? [] : [`only cases matching "${filter}" ran, so the baseline was not enforced`]),
        ...(previous === undefined ? [] : [`outputs were regraded from ${reportPath}, not run again`]),
    ];
    const summary = formatSummary(report, {
        comparisons,
        failures,
        warnings,
        ...(definition.thresholds === undefined ? {} : {thresholds: definition.thresholds}),
        ...(definition.details === undefined ? {} : {details: definition.details(report)}),
    });
    print(summary);
    const stepSummary = env['GITHUB_STEP_SUMMARY'];
    if (stepSummary) {
        await appendFile(stepSummary, summary);
    }
    if (updateBaseline) {
        await writeBaseline(baselinePath, baselineFrom(report));
        print(`Baseline recorded at ${baselinePath}.\n`);
    }
    return {report, failures, summary, reportPath, baselinePath};
}

/**
 * Declares an eval as a vitest suite with one test, which runs the eval (see `runAndJudgeEval`) and fails when a
 * score or metric breaks its threshold or a score regresses beyond noise against the baseline. Put evals in files
 * of their own (`*.eval.ts`) with a vitest config of their own, so `npm test` never runs them.
 *
 * @example
 * defineEval({
 *     name: 'intent',
 *     cases: () => loadDataset('evals/intent/dataset.yaml', parseCase),
 *     task: (request) => classify(request),
 *     graders: {correct: ({case: c, output}) => output === c.expected},
 *     thresholds: {correct: {min: 0.85}},
 * });
 */
export function defineEval<Input, Expected, Output>(definition: EvalDefinition<Input, Expected, Output>, options: EvalRunOptions = {}): void {
    describe(definition.name, () => {
        it('meets its thresholds and does not regress', async () => {
            const {failures} = await runAndJudgeEval(definition, options);
            if (failures.length > 0) {
                throw new EvalFailedError(definition.name, failures);
            }
        }, EVAL_TEST_TIMEOUT_MS);
    });
}
