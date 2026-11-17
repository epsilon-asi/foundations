import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {
    baselineFrom,
    formatSummary,
    loadDataset,
    metaDifferences,
    readBaseline,
    readReport,
    runEval,
    writeBaseline,
    writeReport,
    compareToBaseline,
} from '../src/index.js';

let dir = '';
beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'evals-test-'));
});
afterEach(() => {
    rmSync(dir, {recursive: true, force: true});
});

const evalOf = (scores: Record<string, number>) => ({
    name: 'toy',
    meta: {model: 'small'},
    cases: Object.keys(scores).map((id) => ({id, input: id, expected: scores[id]!, tags: ['all']})),
    task: (input: string) => input,
    graders: {score: ({case: c}: { case: { expected: number } }) => c.expected},
});

describe('reports and baselines', () => {
    it('write and read back as JSON, and read as undefined when missing', async () => {
        const report = await runEval(evalOf({a: 1, b: 0}));
        const reportPath = await writeReport(report, join(dir, 'results'));
        await writeBaseline(join(dir, 'baselines', 'toy.json'), baselineFrom(report));

        expect(reportPath).toBe(join(dir, 'results', 'toy.json'));
        expect(await readReport(reportPath)).toEqual(report);
        expect(await readBaseline(join(dir, 'baselines', 'toy.json'))).toMatchObject({name: 'toy', meta: {model: 'small'}, scores: report.scores});
        expect(readFileSync(reportPath, 'utf8').endsWith('}\n')).toBe(true);
        expect(await readReport(join(dir, 'missing.json'))).toBeUndefined();
        expect(await readBaseline(join(dir, 'missing.json'))).toBeUndefined();
    });

    it('fail loudly on a file that is not JSON', async () => {
        writeFileSync(join(dir, 'bad.json'), '{');
        await expect(readReport(join(dir, 'bad.json'))).rejects.toThrow();
        await expect(readBaseline(join(dir, 'bad.json'))).rejects.toThrow();
    });

    it('say which meta differs from the baseline', async () => {
        const report = await runEval(evalOf({a: 1}));
        const baseline = {...baselineFrom(report), meta: {model: 'large', prompt: 'v1'}};

        expect(metaDifferences({model: 'small'}, baseline)).toEqual([
            'model: large in the baseline, small now',
            'prompt: v1 in the baseline, (unset) now',
        ]);
    });
});

describe('formatSummary', () => {
    it('shows scores with intervals, thresholds, the baseline, metrics, tags, failed trials and the verdict', async () => {
        const report = await runEval({...evalOf({a: 1, b: 0, c: 1}), metrics: () => ({rate: 0.25})});
        const baseline = {...baselineFrom(report), scores: {score: {mean: 0.9, n: 3, low: 0.5, high: 1}}};

        const summary = formatSummary(report, {
            comparisons: compareToBaseline(report, baseline),
            thresholds: {score: {min: 0.5}, rate: {max: 0.3}},
            failures: [],
            warnings: ['the baseline is old'],
            details: '### Extra\n\ntable here',
        });

        expect(summary).toContain('## Eval: toy');
        expect(summary).toMatch(/3 cases × 1 trial · 0 errors · [\d.]+s · 0 input \/ 0 output tokens · model=small/);
        expect(summary).toContain('| score | 0.667 | 0.208–0.939 | 3 | ≥ 0.5 | 0.900 | -0.233 |');
        expect(summary).toContain('| rate | 0.250 | ≤ 0.3 |');
        expect(summary).toContain('| all | 0.667 (0.208–0.939) | 3 |');
        expect(summary).toContain('### Extra');
        expect(summary).toContain('- b: score 0.000');
        expect(summary).toContain('> Warning: the baseline is old');
        expect(summary.trimEnd().endsWith('**Passed.**')).toBe(true);
    });

    it('lists errors, caps the failed trials, and lists failures', async () => {
        const report = await runEval({...evalOf({a: 0, b: 0, c: 0}), trials: 2, task: (input: string) => {
            if (input === 'a') throw new Error('boom');
            return input;
        }});

        const summary = formatSummary(report, {failures: ['score is too low'], listedFailures: 2});

        expect(summary).toContain('3 cases × 2 trials · 2 errors');
        expect(summary).toContain('Trials that did not score 1 on every grader (6, first 2):');
        expect(summary).toContain('- a: error: boom');
        expect(summary).toContain('- a (trial 1): error: boom');
        expect(summary).toContain('**Failed:**\n- score is too low');
    });
});

describe('loadDataset', () => {
    const parse = (record: unknown) => {
        const {id} = record as { id?: unknown };
        if (typeof id !== 'string') throw new Error('needs an id');
        return id;
    };
    const write = (name: string, text: string) => {
        writeFileSync(join(dir, name), text);
        return join(dir, name);
    };

    it('reads YAML, JSON and JSON Lines, as a list or a "cases" list', async () => {
        expect(await loadDataset(write('a.yaml', '- id: one\n- id: two\n'), parse)).toEqual(['one', 'two']);
        expect(await loadDataset(write('b.yml', 'cases:\n  - id: three\n'), parse)).toEqual(['three']);
        expect(await loadDataset(write('c.json', '[{"id": "four"}]'), parse)).toEqual(['four']);
        expect(await loadDataset(write('d.jsonl', '{"id": "five"}\n\n{"id": "six"}\n'), parse)).toEqual(['five', 'six']);
    });

    it('names the file and record that is wrong', async () => {
        await expect(loadDataset(write('e.yaml', '- id: ok\n- name: no id\n'), parse)).rejects.toThrow(/e\.yaml: record 2: needs an id$/);
        await expect(loadDataset(write('f.jsonl', '{"id": "ok"}\n{nope\n'), parse)).rejects.toThrow(/f\.jsonl: line 2 is not JSON/);
        await expect(loadDataset(write('g.yaml', 'just: a map\n'), parse)).rejects.toThrow(/expected a list of records/);
        await expect(loadDataset(write('h.txt', ''), parse)).rejects.toThrow(/datasets are \.json, \.jsonl, \.yaml or \.yml files/);
    });
});
