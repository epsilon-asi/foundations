import {describe, expect, it} from 'vitest';
import {summarizeScores, wilsonInterval} from '../src/index.js';

describe('summarizeScores', () => {
    it('gives the Wilson interval for pass/fail scores', () => {
        const summary = summarizeScores([1, 1, 1, 1, 1, 0, 0, 0, 0, 0]);

        expect(summary.mean).toBe(0.5);
        expect(summary.low).toBeCloseTo(0.2366, 3);
        expect(summary.high).toBeCloseTo(0.7634, 3);
    });

    it('keeps the interval inside [0, 1], and wide for few trials', () => {
        expect(summarizeScores([1])).toMatchObject({mean: 1, high: 1});
        expect(summarizeScores([1]).low).toBeCloseTo(0.2065, 3);
        expect(summarizeScores([0, 0]).low).toBe(0);
    });

    it('uses the normal approximation for partial scores', () => {
        const summary = summarizeScores([0.5, 0.7, 0.9]);

        expect(summary.mean).toBeCloseTo(0.7);
        expect(summary.low).toBeCloseTo(0.7 - 1.96 * 0.2 / Math.sqrt(3), 2);
        expect(summarizeScores([0.5])).toMatchObject({mean: 0.5, low: 0.5, high: 0.5});
    });

    it('knows nothing from no scores', () => {
        expect(summarizeScores([])).toEqual({mean: 0, n: 0, low: 0, high: 1});
    });

    it('narrows the Wilson interval as trials grow', () => {
        const few = wilsonInterval(0.9, 10);
        const many = wilsonInterval(0.9, 1000);
        expect(many.high - many.low).toBeLessThan(few.high - few.low);
    });
});
