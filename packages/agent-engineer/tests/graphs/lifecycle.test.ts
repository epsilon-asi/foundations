import {describe, expect, it} from 'vitest';
import {ToolRoundLimitError, withWorkspace} from '../../src/agents/index.js';
import {GlobalConfigSchema} from '../../src/config/global-config.js';
import {buildAnswerQuestionGraph} from '../../src/graphs/answer-question/index.js';
import {buildMiniChangeGraph} from '../../src/graphs/mini-change/index.js';
import {useGitRepo} from '../helpers/gitRepo.js';
import {type ScriptedReply, ScriptedChatModel} from '../helpers/scriptedModel.js';

const repo = useGitRepo({'src/a.ts': 'export const a = 1;\n'});

const leftovers = () => ({worktrees: repo.git('worktree', 'list').split('\n').length, branches: repo.git('branch', '--list', 'agent-engineer/*')});
const CLEAN = {worktrees: 1, branches: ''};

const run = (
    build: typeof buildMiniChangeGraph,
    replies: ScriptedReply[],
    options: { config?: Record<string, unknown>; signal?: AbortSignal; progress?: (text: string) => void } = {},
) => withWorkspace(build()).invoke(
    {messages: [{role: 'user', content: 'the request'}]},
    {
        context: {
            config: GlobalConfigSchema.parse(options.config ?? {}),
            cwd: repo.root,
            models: {agent: new ScriptedChatModel(replies)},
            ...(options.progress ? {progress: options.progress} : {}),
        },
        ...(options.signal ? {signal: options.signal} : {}),
    },
);

const editRound: ScriptedReply = [{name: 'edit_file', args: {path: 'src/a.ts', oldText: '1', newText: '2'}}];
const readRound: ScriptedReply = [{name: 'read_file', args: {path: 'src/a.ts'}}];

describe('a change run', () => {
    it('leaves no worktree or branch when the model fails mid-run', async () => {
        await expect(run(buildMiniChangeGraph, [editRound, new Error('model went away')])).rejects.toThrow('model went away');

        expect(leftovers()).toEqual(CLEAN);
    });

    it('leaves no branch when it changes nothing', async () => {
        const result = await run(buildMiniChangeGraph, ['Nothing to change.']);

        expect(result.changes).toBeUndefined();
        expect(leftovers()).toEqual(CLEAN);
    });

    it('leaves only its branch when it succeeds', async () => {
        const result = await run(buildMiniChangeGraph, [editRound, 'Done.']);

        expect(leftovers()).toEqual({worktrees: 1, branches: result.changes!.branch});
    });
});

describe('maxToolRounds', () => {
    it.each([0, 1, 2, 5])('lets the agent use exactly %i tool rounds and then answer', async (rounds) => {
        const result = await run(buildAnswerQuestionGraph, [...Array.from({length: rounds}, () => readRound), 'answer'], {config: {maxToolRounds: Math.max(rounds, 1)}});

        expect(result.messages.at(-1)?.content).toBe('answer');
    });

    it('stops the agent one round later with an error saying what to do', async () => {
        const failure = run(buildAnswerQuestionGraph, [readRound, readRound, readRound, 'answer'], {config: {maxToolRounds: 2}});

        await expect(failure).rejects.toBeInstanceOf(ToolRoundLimitError);
        await expect(failure).rejects.toThrow(
            'The answer-question agent did not finish within 2 tool rounds. Narrow the request, or raise maxToolRounds in agent-engineer.yaml.',
        );
        expect(leftovers()).toEqual(CLEAN);
    });
});

describe('aborting', () => {
    it('stops the run and cleans up', async () => {
        const controller = new AbortController();
        const progress = (text: string) => {
            if (text.startsWith('reading')) controller.abort(new Error('user pressed ctrl-c'));
        };

        await expect(run(buildMiniChangeGraph, [readRound, editRound, 'Done.'], {signal: controller.signal, progress})).rejects.toThrow();

        expect(leftovers()).toEqual(CLEAN);
    });
});

describe('concurrent runs', () => {
    it('get a sandbox and a branch each, and do not see each other\'s changes', async () => {
        const [first, second] = await Promise.all([
            run(buildMiniChangeGraph, [[{name: 'write_file', args: {path: 'src/first.ts', content: '1\n'}}], 'first']),
            run(buildMiniChangeGraph, [[{name: 'write_file', args: {path: 'src/second.ts', content: '2\n'}}], 'second']),
        ]);

        expect(first.changes?.branch).not.toBe(second.changes?.branch);
        expect(first.changes?.files).toEqual(['src/first.ts']);
        expect(second.changes?.files).toEqual(['src/second.ts']);
        expect(leftovers().worktrees).toBe(1);
    });
});
