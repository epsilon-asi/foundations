// Public API of @epsilon-asi/evals.
export {defineEval, runAndJudgeEval, EvalFailedError, DEFAULT_BASELINE_DIR, DEFAULT_RESULTS_DIR, EVAL_TEST_TIMEOUT_MS} from './define.js';
export type {EvalOutcome, EvalRunOptions} from './define.js';
export {runEval, DEFAULT_CONCURRENCY, DEFAULT_TRIALS, DEFAULT_TRIAL_TIMEOUT_MS} from './run.js';
export type {RunEvalOptions} from './run.js';
export {summarizeScores, wilsonInterval} from './stats.js';
export {baselineFrom, metaDifferences, readBaseline, writeBaseline} from './baseline.js';
export type {EvalBaseline} from './baseline.js';
export {checkThresholds, compareToBaseline, evalFailures, formatThreshold} from './judge.js';
export type {ScoreComparison, ThresholdBreach} from './judge.js';
export {formatSummary, readReport, writeReport, DEFAULT_LISTED_FAILURES} from './report.js';
export type {SummaryOptions} from './report.js';
export {loadDataset} from './dataset.js';
export {classify, formatConfusionMatrix, NO_PREDICTION} from './classification.js';
export type {ClassificationReport, LabeledPrediction, LabelMetrics} from './classification.js';
export type * from './types.js';
