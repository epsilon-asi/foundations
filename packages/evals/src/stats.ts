import type {ScoreSummary} from './types.js';

/** The normal quantile of a two-sided 95% interval. */
const Z95 = 1.959963984540054;

/** The Wilson 95% interval of a proportion `p` over `n` trials, which stays sensible near 0 and 1 and for small n. */
export const wilsonInterval = (p: number, n: number): { low: number; high: number } => {
    const z2 = Z95 * Z95;
    const denominator = 1 + z2 / n;
    const center = (p + z2 / (2 * n)) / denominator;
    const half = (Z95 * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denominator;
    return {low: Math.max(0, center - half), high: Math.min(1, center + half)};
};

/**
 * The mean of scores from 0 to 1 and its 95% interval: Wilson's when every score is 0 or 1, and otherwise the normal
 * approximation, clipped to [0, 1]. With no scores, nothing is known: mean 0 in an interval of [0, 1].
 */
export const summarizeScores = (scores: readonly number[]): ScoreSummary => {
    const n = scores.length;
    if (n === 0) {
        return {mean: 0, n: 0, low: 0, high: 1};
    }
    const mean = scores.reduce((total, score) => total + score, 0) / n;
    if (scores.every((score) => score === 0 || score === 1)) {
        return {mean, n, ...wilsonInterval(mean, n)};
    }
    const variance = n > 1 ? scores.reduce((total, score) => total + (score - mean) ** 2, 0) / (n - 1) : 0;
    const half = Z95 * Math.sqrt(variance / n);
    return {mean, n, low: Math.max(0, mean - half), high: Math.min(1, mean + half)};
};
