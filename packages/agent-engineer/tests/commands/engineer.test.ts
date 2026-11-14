import {runCli} from '@epsilon-asi/command-line';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {AgentEngineer} from '../../src/cli.js';
import {provideModels} from '../../src/middleware/models.js';
import {captureIO} from '../helpers/captureIO.js';
import {useConfigSandbox} from '../helpers/configSandbox.js';
import {type GitRepoFixture, initGitRepo} from '../helpers/gitRepo.js';
import {type ScriptedReply, ScriptedChatModel} from '../helpers/scriptedModel.js';

const parsed = vi.hoisted(() => ({choice: 'answer_question', reasoning: 'it asks a question'}));

// The intent model runs inside @epsilon-asi/langgraph; replace it with a fixed choice until it can be injected.
vi.mock('@epsilon-asi/langgraph', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@epsilon-asi/langgraph')>()),
    createOptionSelectionNode: () => async () => ({messages: [], ...parsed}),
}));

const sandbox = useConfigSandbox();
let repo: GitRepoFixture;

beforeEach(() => {
    // The CLI runs in project/pkg, a package inside the repository.
    repo = initGitRepo(sandbox.project, {'pkg/src/greet.ts': 'export const greet = () => "hello";\n'});
});

async function cli(argv: string[], replies?: ScriptedReply[]) {
    const agent = replies === undefined ? undefined : new ScriptedChatModel(replies);
    const {io, stdout, stderr} = captureIO();
    const exitCode = await runCli(AgentEngineer, argv, {io, ...(agent === undefined ? {} : {use: [provideModels({agent})]})});
    return {exitCode, stdout: stdout(), stderr: stderr(), agent};
}

describe('query', () => {
    it('prints the agent\'s answer', async () => {
        const result = await cli(['query', 'where', 'is', 'greet?'], [[{name: 'find_files', args: {query: 'greet'}}], 'In pkg/src/greet.ts:1.']);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toBe('In pkg/src/greet.ts:1.\n');
        expect(result.stderr).not.toContain('intent:');
        expect(result.agent?.calls[0]?.[1]?.text).toBe('where is greet?');
    });

    it('tells the agent which directory it was run from', async () => {
        const result = await cli(['q', 'what', 'is', 'here?'], ['A greeting.']);

        expect(result.agent?.calls[0]?.[0]?.text).toContain('The user ran you from pkg/');
    });

    it('prints JSON with --format json', async () => {
        const result = await cli(['query', '-f', 'json', 'what?'], ['An answer.']);

        expect(JSON.parse(result.stdout)).toEqual({request: 'what?', answer: 'An answer.'});
    });

    it('fails on a blank request, before any model is used', async () => {
        const result = await cli(['query', '   ']);

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('Missing request: agent-engineer query <request>');
    });

    it('fails, and removes its sandbox, when the model fails', async () => {
        const worktrees = repo.git('worktree', 'list');

        const result = await cli(['query', 'what?'], [new Error('model unavailable')]);

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('model unavailable');
        expect(repo.git('worktree', 'list')).toBe(worktrees);
    });

    it('fails clearly outside a git repository', async () => {
        vi.mocked(process.cwd).mockReturnValue(sandbox.home);

        const result = await cli(['query', 'what?'], ['unused']);

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('not a git repository');
    });
});

describe('do', () => {
    it('routes the request and prints the intent and the answer', async () => {
        Object.assign(parsed, {choice: 'answer_question', reasoning: 'it asks a question'});

        const result = await cli(['do', 'what', 'does', 'greet', 'return?'], ['"hello".']);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toBe('"hello".\n');
        expect(result.stderr).toContain('intent: answer_question (it asks a question)');
    });

    it('prints the branch and files a change agent committed', async () => {
        Object.assign(parsed, {choice: 'mini_change', reasoning: 'a one-word edit'});

        const result = await cli(['do', 'say', 'hi', 'instead'], [
            [{name: 'edit_file', args: {path: 'pkg/src/greet.ts', oldText: 'hello', newText: 'hi'}}],
            'Changed the greeting.',
        ]);

        expect(result.exitCode).toBe(0);
        const branch = /to branch (\S+)/.exec(result.stdout)?.[1];
        expect(branch).toMatch(/^agent-engineer\/mini-change-/);
        expect(result.stdout).toMatch(/^Changed the greeting\.\n\ncommitted [0-9a-f]{12} to branch \S+\n {2}pkg\/src\/greet\.ts\n$/);
        expect(repo.git('show', `${branch}:pkg/src/greet.ts`)).toBe('export const greet = () => "hi";');
    });

    it('prints the intent, reasoning and changes as JSON', async () => {
        Object.assign(parsed, {choice: 'mini_change', reasoning: 'a one-word edit'});

        const result = await cli(['do', '--format', 'json', 'say', 'hi'], [
            [{name: 'edit_file', args: {path: 'pkg/src/greet.ts', oldText: 'hello', newText: 'hi'}}],
            'Done.',
        ]);

        expect(JSON.parse(result.stdout)).toEqual({
            request: 'say hi',
            intent: 'mini_change',
            reasoning: 'a one-word edit',
            answer: 'Done.',
            changes: {branch: expect.stringMatching(/^agent-engineer\/mini-change-/), commit: expect.stringMatching(/^[0-9a-f]{40}$/), files: ['pkg/src/greet.ts']},
        });
    });
});
