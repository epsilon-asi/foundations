import {describe, expect, it} from 'vitest';
import {checkThresholds, compareToBaseline, evalFailures, formatThreshold} from '../src/index.js';
import type {EvalBaseline, EvalReport} from '../src/index.js';

const report = (overrides: Partial<EvalReport> = {}): EvalReport => ({
    name: 'e', meta: {}, startedAt: '2026-01-01T00:00:00.000Z', durationMs: 1, usage: {inputTokens: 0, outputTokens: 0}, trials: [],
    scores: {correct: {mean: 0.8, n: 100, low: 0.71, high: 0.87}}, byTag: {}, metrics: {costly: 0.04}, errors: 0, skipped: 0,
    ...overrides,
});
const baseline = (mean: number): EvalBaseline => ({name: 'e', meta: {}, recordedAt: 'x', scores: {correct: {mean, n: 100, low: mean - 0.08, high: mean + 0.07}}, metrics: {}});

describe('compareToBaseline', () => {
    it('flags a regression only when even the top of the interval is below the baseline', () => {
        expect(compareToBaseline(report(), baseline(0.85))[0]).toMatchObject({regressed: false, delta: expect.closeTo(-0.05)});
        expect(compareToBaseline(report(), baseline(0.9))[0]).toMatchObject({regressed: true});
    });

    it('has nothing to compare without a baseline, or for a score with no trials', () => {
        expect(compareToBaseline(report(), undefined)[0]).toMatchObject({baseline: undefined, delta: undefined, regressed: false});
        expect(compareToBaseline(report({scores: {correct: {mean: 0, n: 0, low: 0, high: 1}}}), baseline(0.9))[0]?.regressed).toBe(false);
    });
});

describe('checkThresholds', () => {
    it('holds score means and metrics to their bounds', () => {
        expect(checkThresholds(report(), {correct: {min: 0.75}, costly: {max: 0.05}})).toEqual([]);
        expect(checkThresholds(report(), {correct: {min: 0.85}, costly: {max: 0.01}}).map((breach) => breach.name)).toEqual(['correct', 'costly']);
    });

    it('reports a threshold on a name the eval does not have', () => {
        expect(checkThresholds(report(), {typo: {min: 1}})).toEqual([{name: 'typo', value: undefined, threshold: {min: 1}}]);
    });
});

describe('evalFailures', () => {
    it('says why the eval fails, one line each', () => {
        const failures = evalFailures(
            report({skipped: 3}),
            checkThresholds(report(), {correct: {min: 0.85}, typo: {max: 1}}),
            compareToBaseline(report(), baseline(0.9)),
        );

        expect(failures).toEqual([
            'correct is 0.800, outside ≥ 0.85',
            'typo: there is no score or metric by that name to hold to ≤ 1',
            "correct regressed: 0.800 (95% interval up to 0.870) is below the baseline's 0.900",
            '3 trials did not run because the token budget ran out',
        ]);
    });

    it('formats thresholds', () => {
        expect(formatThreshold({min: 0.1, max: 0.9})).toBe('≥ 0.1 and ≤ 0.9');
        expect(formatThreshold({})).toBe('none');
    });
});
