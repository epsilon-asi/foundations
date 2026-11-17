import {describe, expect, it} from 'vitest';
import {runEval} from '../src/index.js';
import type {EvalCase, EvalDefinition} from '../src/index.js';

const cases: EvalCase<number, number>[] = [
    {id: 'one', input: 1, expected: 2, tags: ['small']},
    {id: 'two', input: 2, expected: 4, tags: ['small']},
    {id: 'ten', input: 10, expected: 20, tags: ['big']},
];

const doubling = (overrides: Partial<EvalDefinition<number, number, number>> = {}): EvalDefinition<number, number, number> => ({
    name: 'doubling',
    cases,
    task: (input) => input * 2,
    graders: {exact: ({case: c, output}) => output === c.expected},
    ...overrides,
});

describe('runEval', () => {
    it('grades every case and summarizes the scores overall and by tag', async () => {
        const report = await runEval(doubling({meta: {model: 'x'}}));

        expect(report.trials.map((trial) => [trial.caseId, trial.output, trial.scores['exact']])).toEqual([['one', 2, 1], ['two', 4, 1], ['ten', 20, 1]]);
        expect(report.scores['exact']).toMatchObject({mean: 1, n: 3});
        expect(Object.keys(report.byTag)).toEqual(['big', 'small']);
        expect(report.byTag['small']?.['exact']).toMatchObject({mean: 1, n: 2});
        expect(report).toMatchObject({name: 'doubling', meta: {model: 'x'}, errors: 0, skipped: 0});
    });

    it('takes numbers, booleans and notes from graders, and loads cases from a function', async () => {
        const report = await runEval(doubling({
            cases: async () => cases,
            graders: {
                half: () => 0.5,
                flag: ({output}) => output > 5,
                noted: ({output}) => ({score: output > 5 ? 1 : 0, note: `got ${output}`}),
            },
        }));

        expect(report.scores['half']?.mean).toBe(0.5);
        expect(report.trials.map((trial) => trial.scores['flag'])).toEqual([0, 0, 1]);
        expect(report.trials[0]?.notes).toEqual({noted: 'got 2'});
    });

    it('scores 0 on every grader when the task throws, and counts it as an error', async () => {
        const report = await runEval(doubling({task: (input) => {
            if (input === 2) throw new Error('model down');
            return input * 2;
        }}));

        const failed = report.trials.find((trial) => trial.caseId === 'two');
        expect(failed).toMatchObject({error: 'model down', output: undefined, scores: {exact: 0}});
        expect(report.errors).toBe(1);
    });

    it('scores 0 with a note when a grader throws or gives a score outside 0 to 1', async () => {
        const report = await runEval(doubling({graders: {
            broken: () => {
                throw new Error('bug');
            },
            wild: () => 3,
        }}));

        expect(report.trials[0]?.scores).toEqual({broken: 0, wild: 0});
        expect(report.trials[0]?.notes).toEqual({broken: 'grader failed: bug', wild: 'grader failed: gave the score 3; scores go from 0 to 1'});
    });

    it('times out a trial that runs too long, even when the task ignores the signal', async () => {
        const report = await runEval(doubling({
            timeoutMs: 20,
            task: (input, {signal}) => input === 10 ? new Promise<number>(() => signal) : input * 2,
        }));

        expect(report.trials.find((trial) => trial.caseId === 'ten')?.error).toBe('timed out after 20 ms');
    });

    it('runs each case `trials` times, at most `concurrency` at once', async () => {
        let running = 0;
        let most = 0;
        const report = await runEval(doubling({
            trials: 3,
            concurrency: 2,
            task: async (input) => {
                most = Math.max(most, ++running);
                await new Promise((resolve) => setTimeout(resolve, 5));
                running -= 1;
                return input * 2;
            },
        }));

        expect(report.trials).toHaveLength(9);
        expect(report.trials.filter((trial) => trial.caseId === 'one').map((trial) => trial.trial)).toEqual([0, 1, 2]);
        expect(most).toBe(2);
    });

    it('lets options override trials and concurrency', async () => {
        const report = await runEval(doubling({trials: 5}), {trials: 1, concurrency: 1});

        expect(report.trials).toHaveLength(3);
    });

    it('runs only the cases a filter matches, by id or tag', async () => {
        expect((await runEval(doubling(), {filter: 'tw'})).trials.map((trial) => trial.caseId)).toEqual(['two']);
        expect((await runEval(doubling(), {filter: 'small'})).trials.map((trial) => trial.caseId)).toEqual(['one', 'two']);
        await expect(runEval(doubling(), {filter: 'nothing'})).rejects.toThrow('No case of eval "doubling" matches "nothing".');
    });

    it('rejects evals without cases or graders, or with two cases of one id', async () => {
        await expect(runEval(doubling({cases: []}))).rejects.toThrow('Eval "doubling" has no cases.');
        await expect(runEval(doubling({graders: {}}))).rejects.toThrow('Eval "doubling" has no graders.');
        await expect(runEval(doubling({cases: [cases[0]!, cases[0]!]}))).rejects.toThrow('two cases with the id "one"');
    });

    it('adds up the tokens tasks record, and starts no trial once the budget is used', async () => {
        const report = await runEval(doubling({
            concurrency: 1,
            maxTokens: 25,
            task: (input, {recordUsage}) => {
                recordUsage({inputTokens: 10, outputTokens: 5});
                return input * 2;
            },
        }));

        expect(report.trials).toHaveLength(2);
        expect(report.skipped).toBe(1);
        expect(report.usage).toEqual({inputTokens: 20, outputTokens: 10});
        expect(report.trials[0]?.usage).toEqual({inputTokens: 10, outputTokens: 5});
    });

    it('regrades the outputs of an earlier report instead of running the task again', async () => {
        const first = await runEval(doubling({task: (input) => input === 2 ? Promise.reject(new Error('flaky')) : input * 2}));
        let calls = 0;

        const second = await runEval(doubling({
            task: (input) => {
                calls += 1;
                return input * 2;
            },
            graders: {big: ({output}) => output >= 4},
        }), {previous: first});

        // Only the trial that failed before runs again.
        expect(calls).toBe(1);
        expect(second.trials.map((trial) => [trial.caseId, trial.reused, trial.scores['big']])).toEqual([['one', true, 0], ['two', false, 1], ['ten', true, 1]]);
    });

    it('computes the eval\'s own metrics and reports progress', async () => {
        const progress: string[] = [];
        const report = await runEval(doubling({metrics: (trials) => ({mistakes: trials.filter((trial) => trial.scores['exact'] === 0).length})}), {
            onTrial: (trial, done, total) => progress.push(`${trial.caseId} ${done}/${total}`),
        });

        expect(report.metrics).toEqual({mistakes: 0});
        expect(progress).toHaveLength(3);
        expect(progress.at(-1)).toMatch(/ 3\/3$/);
    });
});
