import {existsSync, mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {defineEval, EvalFailedError, runAndJudgeEval} from '../src/index.js';
import type {EvalDefinition} from '../src/index.js';

let dir = '';
beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'evals-define-'));
});
afterEach(() => {
    rmSync(dir, {recursive: true, force: true});
});

/** An eval whose task passes the cases listed in `passing`. */
const parity = (passing: readonly string[], overrides: Partial<EvalDefinition<string, true, boolean>> = {}): EvalDefinition<string, true, boolean> => ({
    name: 'parity',
    cases: ['a', 'b', 'c', 'd'].map((id) => ({id, input: id, expected: true as const, tags: [id === 'a' ? 'first' : 'rest']})),
    task: (input) => passing.includes(input),
    graders: {pass: ({output}) => output},
    ...overrides,
});

async function judge(definition: EvalDefinition<string, true, boolean>, env: Record<string, string> = {}) {
    const printed: string[] = [];
    const outcome = await runAndJudgeEval(definition, {
        resultsDir: join(dir, 'results'),
        baselineDir: join(dir, 'baselines'),
        env,
        print: (text) => printed.push(text),
    });
    return {...outcome, printed: printed.join('')};
}

describe('runAndJudgeEval', () => {
    it('writes the report, prints the summary, and warns there is no baseline yet', async () => {
        const {failures, reportPath, printed} = await judge(parity(['a', 'b', 'c', 'd']));

        expect(failures).toEqual([]);
        expect(existsSync(reportPath)).toBe(true);
        expect(printed).toContain('parity: 4/4 trials');
        expect(printed).toContain('## Eval: parity');
        expect(printed).toContain('there is no baseline at');
    });

    it('fails on a threshold, and records and then enforces a baseline', async () => {
        expect((await judge(parity(['a', 'b']), {}).then((outcome) => outcome.failures))).toEqual([]);
        expect((await judge(parity(['a', 'b'], {thresholds: {pass: {min: 0.9}}}))).failures).toEqual(['pass is 0.500, outside ≥ 0.9']);

        const recorded = await judge(parity(Array.from('abcd')), {EVAL_UPDATE_BASELINE: '1'});
        expect(recorded.printed).toContain('Baseline recorded at');
        expect(JSON.parse(readFileSync(recorded.baselinePath, 'utf8'))).toMatchObject({scores: {pass: {mean: 1}}});

        // Every case failing is well beyond noise against a perfect baseline.
        const worse = await judge(parity([]));
        expect(worse.failures).toEqual([expect.stringMatching(/^pass regressed: 0\.000/)]);
    });

    it('does not enforce the baseline on a filtered run, and refuses to record one from it', async () => {
        await judge(parity(Array.from('abcd')), {EVAL_UPDATE_BASELINE: '1'});

        const filtered = await judge(parity([]), {EVAL_FILTER: 'first'});
        expect(filtered.report.trials.map((trial) => trial.caseId)).toEqual(['a']);
        expect(filtered.failures).toEqual([]);
        expect(filtered.printed).toContain('only cases matching "first" ran');
        await expect(judge(parity([]), {EVAL_FILTER: 'a', EVAL_UPDATE_BASELINE: '1'})).rejects.toThrow('cannot be used with EVAL_FILTER');
    });

    it('regrades the last report without running the task', async () => {
        await expect(judge(parity([]), {EVAL_REGRADE: '1'})).rejects.toThrow('there is none at');
        await judge(parity(['a']));
        let ran = false;

        const regraded = await judge(parity([], {task: () => {
            ran = true;
            return true;
        }}), {EVAL_REGRADE: '1'});

        expect(ran).toBe(false);
        expect(regraded.report.scores['pass']?.mean).toBe(0.25);
        expect(regraded.printed).toContain('outputs were regraded');
    });

    it('takes trials from the environment, rejects bad numbers, and adds to the GitHub job summary', async () => {
        const stepSummary = join(dir, 'step-summary.md');
        const {report} = await judge(parity(['a']), {EVAL_TRIALS: '2', EVAL_CONCURRENCY: '1', GITHUB_STEP_SUMMARY: stepSummary});

        expect(report.trials).toHaveLength(8);
        expect(readFileSync(stepSummary, 'utf8')).toContain('## Eval: parity');
        await expect(judge(parity([]), {EVAL_TRIALS: 'two'})).rejects.toThrow('EVAL_TRIALS must be a whole number above 0; it is "two".');
    });

    it('notes when the run differs from its baseline', async () => {
        await judge(parity(Array.from('abcd'), {meta: {model: 'a'}}), {EVAL_UPDATE_BASELINE: '1'});

        const {printed} = await judge(parity(Array.from('abcd'), {meta: {model: 'b'}}));
        expect(printed).toContain('this run differs from the baseline in model: a in the baseline, b now');
    });
});

describe('EvalFailedError', () => {
    it('lists the failures', () => {
        expect(new EvalFailedError('x', ['one', 'two']).message).toBe('Eval "x" failed:\n- one\n- two');
    });
});

// defineEval registers a real suite in this file; it passes, so this file's run shows the whole path works.
defineEval(parity(Array.from('abcd'), {name: 'defined-parity', thresholds: {pass: {min: 1}}}), {
    resultsDir: join(tmpdir(), 'evals-define-suite', 'results'),
    baselineDir: join(tmpdir(), 'evals-define-suite', 'baselines'),
    env: {},
    print: () => undefined,
});
