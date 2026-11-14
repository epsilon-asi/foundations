import {describe, expect, it} from 'vitest';
import {RunRecorder} from '@epsilon-asi/langgraph';
import {withWorkspace} from '../../src/agents/index.js';
import {GlobalConfigSchema} from '../../src/config/global-config.js';
import {buildAnswerQuestionGraph} from '../../src/graphs/answer-question/index.js';
import {useGitRepo} from '../helpers/gitRepo.js';
import {SCRIPTED_USAGE, ScriptedChatModel} from '../helpers/scriptedModel.js';

const repo = useGitRepo({'src/greet.ts': 'export const greet = () => "hi";\n'});

// RunRecorder and its unit tests live in @epsilon-asi/langgraph; this checks it sees an engineer run's nested agent.
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
});
