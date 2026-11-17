import type {EvalBaseline} from './baseline.js';
import type {EvalReport, ScoreSummary, Threshold} from './types.js';

/** A score's change against the baseline. */
export interface ScoreComparison {
    readonly name: string;
    readonly current: ScoreSummary;
    readonly baseline: ScoreSummary | undefined;
    /** Current mean minus the baseline's, when there is a baseline for this score. */
    readonly delta: number | undefined;
    /**
     * True when the score is worse beyond noise: even the top of its 95% interval is below the baseline's mean. A
     * drop smaller than that could be chance, so it does not fail the eval.
     */
    readonly regressed: boolean;
}

/** Compares each score of a report with the baseline's, when there is one. */
export const compareToBaseline = (report: EvalReport, baseline: EvalBaseline | undefined): ScoreComparison[] =>
    Object.entries(report.scores).map(([name, current]) => {
        const before = baseline?.scores[name];
        return {
            name,
            current,
            baseline: before,
            delta: before === undefined ? undefined : current.mean - before.mean,
            regressed: before !== undefined && current.n > 0 && current.high < before.mean,
        };
    });

/** A score or metric outside its threshold. */
export interface ThresholdBreach {
    readonly name: string;
    /** Undefined when the eval has no score or metric by that name. */
    readonly value: number | undefined;
    readonly threshold: Threshold;
}

/** Checks scores (by their mean) and metrics against the eval's thresholds. */
export const checkThresholds = (report: EvalReport, thresholds: Readonly<Record<string, Threshold>> = {}): ThresholdBreach[] =>
    Object.entries(thresholds).flatMap(([name, threshold]) => {
        const value = report.scores[name]?.mean ?? report.metrics[name];
        const outside = value === undefined || (threshold.min !== undefined && value < threshold.min) || (threshold.max !== undefined && value > threshold.max);
        return outside ? [{name, value, threshold}] : [];
    });

export const formatThreshold = ({min, max}: Threshold): string =>
    [min === undefined ? undefined : `≥ ${min}`, max === undefined ? undefined : `≤ ${max}`].filter(Boolean).join(' and ') || 'none';

/** Why the eval fails, one line each: threshold breaches, regressions against the baseline, and a used-up budget. */
export const evalFailures = (report: EvalReport, breaches: readonly ThresholdBreach[], comparisons: readonly ScoreComparison[]): string[] => [
    ...breaches.map(({name, value, threshold}) => value === undefined
        ? `${name}: there is no score or metric by that name to hold to ${formatThreshold(threshold)}`
        : `${name} is ${value.toFixed(3)}, outside ${formatThreshold(threshold)}`),
    ...comparisons.filter((comparison) => comparison.regressed).map(({name, current, baseline}) =>
        `${name} regressed: ${current.mean.toFixed(3)} (95% interval up to ${current.high.toFixed(3)}) is below the baseline's ${baseline!.mean.toFixed(3)}`),
    ...(report.skipped > 0 ? [`${report.skipped} trials did not run because the token budget ran out`] : []),
];
