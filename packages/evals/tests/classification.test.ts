import {describe, expect, it} from 'vitest';
import {classify, formatConfusionMatrix} from '../src/index.js';

describe('classify', () => {
    const report = classify([
        {expected: 'a', actual: 'a'},
        {expected: 'a', actual: 'b'},
        {expected: 'b', actual: 'b'},
        {expected: 'b', actual: 'a', accepted: ['a']},
        {expected: 'c', actual: undefined},
    ]);

    it('counts accepted labels as right, and as the expected label', () => {
        expect(report.accuracy).toBe(0.6);
        expect(report.matrix).toEqual({a: {a: 1, b: 1}, b: {b: 2}, c: {'(none)': 1}});
    });

    it('gives precision, recall and support per label', () => {
        expect(report.labels).toEqual(['a', 'b', 'c']);
        expect(report.perLabel['a']).toEqual({precision: 1, recall: 0.5, support: 2});
        expect(report.perLabel['b']).toEqual({precision: 2 / 3, recall: 1, support: 2});
        expect(report.perLabel['c']).toEqual({precision: 0, recall: 0, support: 1});
    });

    it('takes the labels it is given, including ones never seen', () => {
        const withLabels = classify([{expected: 'a', actual: 'a'}], ['a', 'z']);

        expect(withLabels.perLabel['z']).toEqual({precision: 0, recall: 0, support: 0});
        expect(classify([]).accuracy).toBe(0);
    });

    it('formats the matrix with a column for missing predictions', () => {
        expect(formatConfusionMatrix(report)).toBe([
            '| expected \\ chosen | a | b | c | (none) | recall |',
            '| --- | --- | --- | --- | --- | --- |',
            '| a | 1 | 1 | 0 | 0 | 0.50 |',
            '| b | 0 | 2 | 0 | 0 | 1.00 |',
            '| c | 0 | 0 | 0 | 1 | 0.00 |',
        ].join('\n'));
        expect(formatConfusionMatrix(classify([{expected: 'a', actual: 'a'}]))).not.toContain('(none)');
    });
});
