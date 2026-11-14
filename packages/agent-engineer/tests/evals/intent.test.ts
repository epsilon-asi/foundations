import {checkThresholds, loadDataset, runEval} from '@epsilon-asi/evals';
import type {StructuredOutputModel} from '@epsilon-asi/langgraph';
import {describe, expect, it} from 'vitest';
import {createIntentEval, INTENT_DATASET, INTENT_THRESHOLDS, intentPromptVersion, parseIntentCase} from '../../evals/intent/intent.js';
import {type Intent, intentAccess, Intents} from '../../src/graphs/router.js';

const cases = await loadDataset(INTENT_DATASET, parseIntentCase);
const byRequest = new Map(cases.map((evalCase) => [evalCase.input, evalCase.expected.intent]));

/** An intent model that answers each request with `choose(request)`, the way ParseIntentNode asks it. */
const modelThat = (choose: (request: string) => Intent): StructuredOutputModel => ({
    withStructuredOutput: () => ({
        invoke: async (messages: { content: string }[]) => ({parsed: {choice: choose(messages[0]!.content), reasoning: 'scripted'}}),
    }),
});

describe('the intent dataset', () => {
    it('has unique ids, valid intents, and every intent well covered', () => {
        expect(new Set(cases.map((evalCase) => evalCase.id)).size).toBe(cases.length);
        for (const intent of Object.keys(Intents)) {
            expect(cases.filter((evalCase) => evalCase.expected.intent === intent).length, intent).toBeGreaterThanOrEqual(15);
        }
    });

    it('is at least a third boundary cases, each naming the pair it sits between', () => {
        const boundary = cases.filter((evalCase) => evalCase.tags?.includes('boundary'));
        expect(boundary.length / cases.length).toBeGreaterThanOrEqual(1 / 3);
        for (const evalCase of boundary) {
            const pair = evalCase.tags?.find((tag) => tag.startsWith('pair:'));
            expect(pair, evalCase.id).toBeDefined();
            expect(pair!.slice('pair:'.length).split('/'), evalCase.id).toContain(evalCase.expected.intent);
        }
        expect(cases.filter((evalCase) => !evalCase.tags?.includes('boundary')).every((evalCase) => evalCase.tags?.includes('clear'))).toBe(true);
    });

    it('rejects records with unknown intents or missing fields', () => {
        expect(() => parseIntentCase({id: 'x', request: 'r', intent: 'deploy'})).toThrow('x has the intent deploy, which is not one of');
        expect(() => parseIntentCase({id: 'x', request: 'r', intent: 'bug_fix', also: ['nope']})).toThrow('x has an also that is not a list of intents');
        expect(() => parseIntentCase({request: 'r', intent: 'bug_fix'})).toThrow('needs an id');
        expect(() => parseIntentCase({id: 'x', request: ' ', intent: 'bug_fix'})).toThrow('x needs a request');
        expect(() => parseIntentCase({id: 'x', request: 'r', intent: 'bug_fix', tags: [1]})).toThrow('x has tags that are not a list of strings');
    });
});

describe('the intent eval', () => {
    it('scores a model that routes every request right as perfect', async () => {
        const report = await runEval(createIntentEval({model: modelThat((request) => byRequest.get(request)!), modelName: 'oracle'}), {concurrency: 16});

        expect(report.scores['correct']?.mean).toBe(1);
        expect(report.metrics).toEqual({readRoutedToWrite: 0, writeRoutedToRead: 0, macroRecall: 1});
        expect(report.meta).toEqual({intentModel: 'oracle', prompt: intentPromptVersion()});
        expect(checkThresholds(report, INTENT_THRESHOLDS)).toEqual([]);
    });

    it('catches a model that sends everything to a change agent, and shows it in the confusion matrix', async () => {
        const definition = createIntentEval({model: modelThat(() => 'mini_change'), modelName: 'reckless'});
        const report = await runEval(definition, {concurrency: 16});

        expect(report.metrics['readRoutedToWrite']).toBe(1);
        expect(report.metrics['writeRoutedToRead']).toBe(0);
        expect(report.scores['correct']?.mean).toBeLessThan(0.25);
        expect(checkThresholds(report, INTENT_THRESHOLDS).map((breach) => breach.name)).toEqual(['correct', 'readRoutedToWrite']);
        expect(report.trials.find((trial) => trial.caseId === 'aq-01')?.notes['correct']).toBe('chose mini_change: scripted');
        const matrix = definition.details!(report);
        expect(matrix).toContain('### Confusion matrix');
        expect(matrix).toMatch(/\| answer_question \| 0 \| (\d+ \| )*0\.00 \|/);
    });

    it('accepts an also intent as right', async () => {
        // aq-14 lists component_planner as just as good.
        const report = await runEval(createIntentEval({model: modelThat(() => 'component_planner')}), {filter: 'aq-14'});

        expect(report.scores['correct']?.mean).toBe(1);
        expect(intentAccess('component_planner')).toBe('read');
    });

    it('fingerprints the routing prompt', () => {
        expect(intentPromptVersion()).toMatch(/^[0-9a-f]{12}$/);
    });
});
