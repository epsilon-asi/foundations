import {describe, expect, it, vi} from 'vitest';
import {GlobalConfigSchema} from '../src/config/global-config.js';
import {buildRouterGraph, IntentGraphs, Intents} from '../src/graphs/router.js';
import {useGitRepo} from './helpers/gitRepo.js';
import {ScriptedChatModel} from './helpers/scriptedModel.js';

const parsed = vi.hoisted(() => ({choice: 'answer_question', reasoning: 'it asks a question'}));

// The intent model runs inside @epsilon-asi/langgraph; replace it with a fixed choice.
vi.mock('@epsilon-asi/langgraph', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@epsilon-asi/langgraph')>()),
    createOptionSelectionNode: () => async () => ({messages: [], ...parsed}),
}));

const repo = useGitRepo({'src/index.ts': 'export const answer = 42;\n'});

const invoke = (chatModel: ScriptedChatModel, progress: string[] = []) =>
    buildRouterGraph().invoke(
        {messages: [{role: 'user', content: 'what is the answer?'}]},
        {context: {config: GlobalConfigSchema.parse({}), cwd: repo.root, chatModel, progress: (text: string) => progress.push(text)}},
    );

describe('router graph', () => {
    it('has a graph for every intent', () => {
        expect(Object.keys(IntentGraphs).sort()).toEqual(Object.keys(Intents).sort());
    });

    it('routes a question to the answer agent', async () => {
        Object.assign(parsed, {choice: 'answer_question', reasoning: 'it asks a question'});
        const progress: string[] = [];

        const result = await invoke(new ScriptedChatModel(['42, from src/index.ts:1.']), progress);

        expect(result.choice).toBe('answer_question');
        expect(result.reasoning).toBe('it asks a question');
        expect(result.messages).toEqual([
            {role: 'user', content: 'what is the answer?'},
            {role: 'assistant', content: '42, from src/index.ts:1.'},
        ]);
        expect(result.changes).toBeUndefined();
        expect(progress.slice(0, 2)).toEqual(['parsing the intent', 'routing to answer_question']);
    });

    it('routes a change to a change agent, which commits to a branch', async () => {
        Object.assign(parsed, {choice: 'mini_change', reasoning: 'a one-line edit'});

        const result = await invoke(new ScriptedChatModel([
            [{name: 'edit_file', args: {path: 'src/index.ts', oldText: '42', newText: '43'}}],
            'Changed it to 43.',
        ]));

        expect(result.choice).toBe('mini_change');
        expect(result.changes?.branch).toMatch(/^agent-engineer\/mini-change-/);
        expect(repo.git('show', `${result.changes!.branch}:src/index.ts`)).toBe('export const answer = 43;');
    });

    it('fails clearly without a config in the context', async () => {
        await expect(buildRouterGraph().invoke({messages: [{role: 'user', content: 'q'}]}, {context: {}}))
            .rejects.toThrow('An engineer graph needs the agent-engineer config');
    });
});
