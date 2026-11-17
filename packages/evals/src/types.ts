/** One input an eval runs, with what a good output looks like. */
export interface EvalCase<Input, Expected> {
    /** Unique within the eval; reports and `EVAL_FILTER` refer to it. */
    readonly id: string;
    readonly input: Input;
    readonly expected: Expected;
    /** Groups the report breaks scores down by, such as "boundary". */
    readonly tags?: readonly string[];
}

export interface TokenUsage {
    readonly inputTokens: number;
    readonly outputTokens: number;
}

/** What the task gets besides the case's input. */
export interface EvalTaskContext {
    /** 0-based number of this run of the case, when the eval runs each case more than once. */
    readonly trial: number;
    /** Aborted when the trial times out; pass it on to model calls. */
    readonly signal: AbortSignal;
    /** Adds tokens the trial used to its usage, and to the eval's token budget. */
    recordUsage(usage: TokenUsage): void;
}

/** A grader's verdict: a score from 0 to 1 (true and false are 1 and 0), with an optional note saying why. */
export type GradeResult = number | boolean | { readonly score: number | boolean; readonly note?: string };

/** What a grader is given: the case and the task's output for it. */
export interface Graded<Input, Expected, Output> {
    readonly case: EvalCase<Input, Expected>;
    readonly output: Output;
}

export type Grader<Input, Expected, Output> = (graded: Graded<Input, Expected, Output>) => GradeResult | Promise<GradeResult>;

/** Bounds that a score's mean, or a metric, must stay within. */
export interface Threshold {
    readonly min?: number;
    readonly max?: number;
}

/** One run of one case. */
export interface TrialResult<Input, Expected, Output> {
    readonly caseId: string;
    readonly tags: readonly string[];
    readonly trial: number;
    readonly input: Input;
    readonly expected: Expected;
    /** Undefined when the task failed. */
    readonly output: Output | undefined;
    /** Why the task failed, when it did. */
    readonly error: string | undefined;
    /** Each grader's score, from 0 to 1. Every grader scores 0 when the task failed. */
    readonly scores: Readonly<Record<string, number>>;
    /** The notes graders gave, by grader. */
    readonly notes: Readonly<Record<string, string>>;
    readonly durationMs: number;
    readonly usage: TokenUsage;
    /** True when the output came from an earlier report (regrading) rather than a new run. */
    readonly reused: boolean;
}

/** A score's mean over trials, with its 95% confidence interval. */
export interface ScoreSummary {
    readonly mean: number;
    readonly n: number;
    readonly low: number;
    readonly high: number;
}

export type EvalMeta = Readonly<Record<string, string | number | boolean>>;

/** An eval: the cases, the task that runs each one, and how outputs are graded and judged. */
export interface EvalDefinition<Input, Expected, Output> {
    /** Names the eval in reports, baselines and the vitest suite. */
    readonly name: string;
    readonly cases: readonly EvalCase<Input, Expected>[] | (() => readonly EvalCase<Input, Expected>[] | Promise<readonly EvalCase<Input, Expected>[]>);
    /** Runs one case, usually by calling the model or agent under test. */
    readonly task: (input: Input, context: EvalTaskContext) => Output | Promise<Output>;
    /** At least one. The keys name the scores in reports, thresholds and baselines. */
    readonly graders: Readonly<Record<string, Grader<Input, Expected, Output>>>;
    /** Numbers computed over every trial, such as a rate of one kind of mistake. */
    readonly metrics?: (trials: readonly TrialResult<Input, Expected, Output>[]) => Readonly<Record<string, number>>;
    /** Markdown added to the summary, such as a confusion matrix. */
    readonly details?: (report: EvalReport<Input, Expected, Output>) => string;
    /** Bounds for scores (by grader name, on the mean) and metrics (by name). */
    readonly thresholds?: Readonly<Record<string, Threshold>>;
    /** Runs of each case. Default: DEFAULT_TRIALS. */
    readonly trials?: number;
    /** Trials run at once. Default: DEFAULT_CONCURRENCY. */
    readonly concurrency?: number;
    /** Longest one trial may run. Default: DEFAULT_TRIAL_TIMEOUT_MS. */
    readonly timeoutMs?: number;
    /** No trial starts once this many tokens are used. Default: no limit. */
    readonly maxTokens?: number;
    /** Describes the run in its report and baseline, such as the model it used. */
    readonly meta?: EvalMeta;
}

/** Everything one run of an eval produced. Written to `<results dir>/<name>.json`. */
export interface EvalReport<Input = unknown, Expected = unknown, Output = unknown> {
    readonly name: string;
    readonly meta: EvalMeta;
    readonly startedAt: string;
    readonly durationMs: number;
    readonly usage: TokenUsage;
    readonly trials: readonly TrialResult<Input, Expected, Output>[];
    /** By grader. */
    readonly scores: Readonly<Record<string, ScoreSummary>>;
    /** By tag, then grader. */
    readonly byTag: Readonly<Record<string, Readonly<Record<string, ScoreSummary>>>>;
    readonly metrics: Readonly<Record<string, number>>;
    /** Trials whose task failed. */
    readonly errors: number;
    /** Trials not run because the token budget ran out. */
    readonly skipped: number;
}
