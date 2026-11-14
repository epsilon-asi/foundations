import {describe, expect, it} from 'vitest';
import {RunRecorder, withWorkspace} from '../../src/agents/index.js';
import {GlobalConfigSchema} from '../../src/config/global-config.js';
import {buildAnswerQuestionGraph} from '../../src/graphs/answer-question/index.js';
import {useGitRepo} from '../helpers/gitRepo.js';
import {SCRIPTED_USAGE, ScriptedChatModel} from '../helpers/scriptedModel.js';

const repo = useGitRepo({'src/greet.ts': 'export const greet = () => "hi";\n'});

describe('RunRecorder', () => {
    it('records the tool calls and model calls of a graph run', async () => {
        const recorder = new RunRecorder();
        const agent = new ScriptedChatModel([
            [{name: 'find_files', args: {query: 'greet'}}, {name: 'read_file', args: {path: 'secrets.txt'}}],
            'greet is in src/greet.ts:1.',
        ]);

        await withWorkspace(buildAnswerQuestionGraph()).invoke(
            {messages: [{role: 'user', content: 'where is greet?'}]},
            {context: {config: GlobalConfigSchema.parse({offLimits: ['secrets.txt']}), cwd: repo.root, models: {agent}}, callbacks: [recorder]},
        );

        expect(recorder.toolCalls.map(({name, input, output}) => ({name, input, output}))).toEqual([
            {name: 'find_files', input: {query: 'greet'}, output: 'src/greet.ts'},
            {name: 'read_file', input: {path: 'secrets.txt'}, output: 'Error: secrets.txt is off limits.'},
        ]);
        expect(recorder.toolCalls.every((call) => typeof call.durationMs === 'number')).toBe(true);
        expect(recorder.modelCalls).toHaveLength(2);
        expect(recorder.summary()).toEqual({
            toolCalls: 2,
            toolErrors: 1,
            modelCalls: 2,
            inputTokens: 2 * SCRIPTED_USAGE.input_tokens,
            outputTokens: 2 * SCRIPTED_USAGE.output_tokens,
            toolsUsed: {find_files: 1, read_file: 1},
        });
    });

    it('records errors and durations, and ignores events for runs it did not see start', () => {
        let now = 0;
        const recorder = new RunRecorder({now: () => now});
        recorder.handleToolStart({lc: 1, type: 'not_implemented', id: ['tools', 'grep']}, 'not json', 'tool-1');
        recorder.handleChatModelStart({lc: 1, type: 'constructor', id: ['ChatOpenAI'], kwargs: {model: 'gpt-x'}}, [], 'model-1');
        now = 25;
        recorder.handleToolError(new Error('boom'), 'tool-1');
        recorder.handleLLMError(new Error('rate limited'), 'model-1');
        recorder.handleToolEnd('late', 'unknown-run');
        recorder.handleLLMEnd({generations: []}, 'unknown-run');

        expect(recorder.toolCalls).toEqual([{name: 'grep', input: 'not json', output: undefined, error: 'boom', durationMs: 25}]);
        expect(recorder.modelCalls).toEqual([{model: 'gpt-x', inputTokens: undefined, outputTokens: undefined, error: 'rate limited', durationMs: 25}]);
        expect(recorder.summary()).toMatchObject({toolErrors: 1, inputTokens: 0, outputTokens: 0});
    });

    it('takes the model name from the invocation parameters first, and leaves usage unset when none is reported', () => {
        const recorder = new RunRecorder();
        recorder.handleChatModelStart({lc: 1, type: 'constructor', id: ['X'], kwargs: {model: 'from-kwargs'}}, [], 'm', undefined, {invocation_params: {model: 'from-call'}});
        recorder.handleChatModelStart({lc: 1, type: 'not_implemented', id: ['X']}, [], 'n');
        recorder.handleLLMEnd({generations: [[{text: 'hi'}]]}, 'm');
        recorder.handleToolStart({lc: 1, type: 'not_implemented', id: []}, '{}', 't');
        recorder.handleToolEnd({content: [{type: 'text', text: 'x'}]}, 't');

        expect(recorder.modelCalls.map((call) => call.model)).toEqual(['from-call', undefined]);
        expect(recorder.modelCalls[0]?.inputTokens).toBeUndefined();
        expect(recorder.toolCalls[0]).toMatchObject({name: 'unknown', output: '[{"type":"text","text":"x"}]'});
    });
});
