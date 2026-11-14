import {existsSync, readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {globToRegExp, offLimitsGlobs, withWorkspace} from '../../src/agents/index.js';
import {GlobalConfigSchema} from '../../src/config/global-config.js';
import {buildAnswerQuestionGraph} from '../../src/graphs/answer-question/index.js';
import {buildMiniChangeGraph} from '../../src/graphs/mini-change/index.js';
import {useGitRepo} from '../helpers/gitRepo.js';
import {ScriptedChatModel, type ScriptedReply} from '../helpers/scriptedModel.js';

const FILES = {
    'README.md': '# Demo\n',
    'src/greet.ts': 'export function greet(name: string) {\n    return `Hello, ${name}`;\n}\n',
    'src/main.ts': "import {greet} from './greet.js';\n\nconsole.log(greet('world'));\n",
    'secrets/key.txt': 'do not read\n',
};

const repo = useGitRepo(FILES);

async function run(
    build: () => ReturnType<typeof buildAnswerQuestionGraph>,
    replies: ScriptedReply[],
    config: Record<string, unknown> = {},
) {
    const chatModel = new ScriptedChatModel(replies);
    const progress: string[] = [];
    const result = await withWorkspace(build()).invoke(
        {messages: [{role: 'user', content: 'the request'}]},
        {context: {config: GlobalConfigSchema.parse({offLimits: ['secrets'], ...config}), cwd: repo.root, models: {agent: chatModel}, progress: (text: string) => progress.push(text)}},
    );
    return {result, chatModel, progress};
}

describe('read agents', () => {
    it('answer from the repository through the read tools', async () => {
        repo.write('src/draft.ts', 'export const draft = true;\n');

        const {result, chatModel, progress} = await run(buildAnswerQuestionGraph, [
            [
                {name: 'list_directory', args: {path: 'src'}},
                {name: 'search_code', args: {query: 'greet', method: 'text'}},
                {name: 'find_definition', args: {name: 'greet'}},
                {name: 'read_file', args: {path: '/src/greet.ts', startLine: 2, endLine: 2}},
                {name: 'read_file', args: {path: 'src/draft.ts'}},
            ],
            'greet is defined in src/greet.ts:1.',
        ]);

        expect(result.messages).toEqual([
            {role: 'user', content: 'the request'},
            {role: 'assistant', content: 'greet is defined in src/greet.ts:1.'},
        ]);
        const [listing, search, definition, line, draft] = chatModel.toolResults();
        expect(listing?.content.split('\n')).toEqual(['draft.ts', 'greet.ts', 'main.ts']);
        expect(search?.content).toContain('src/main.ts:1');
        expect(search?.content).toContain('src/greet.ts:1');
        expect(definition?.content).toMatch(/^src\/greet\.ts:1/);
        expect(line?.content).toBe('src/greet.ts (lines 2-2 of 4)\n2 |     return `Hello, ${name}`;\n... 2 more lines');
        // Untracked working changes are part of the snapshot.
        expect(draft?.content).toContain('export const draft = true;');
        expect(progress).toEqual(expect.arrayContaining(['listing src', 'searching: greet', 'reading src/draft.ts']));
    });

    it('keep off-limits files and paths outside the repository out of reach', async () => {
        const {chatModel} = await run(buildAnswerQuestionGraph, [
            [
                {name: 'read_file', args: {path: 'secrets/key.txt'}},
                {name: 'read_file', args: {path: '../outside.txt'}},
                {name: 'search_code', args: {query: 'do not read', method: 'text'}},
                {name: 'read_file', args: {path: 'src/missing.ts'}},
            ],
            'done',
        ]);

        expect(chatModel.toolResults().map((result) => result.content)).toEqual([
            'Error: secrets/key.txt is off limits.',
            'Error: ../outside.txt is outside the repository.',
            'No results.',
            'Error: src/missing.ts does not exist, or is ignored, too large or not text.',
        ]);
    });

    it('remove the sandbox worktree when the run ends', async () => {
        const before = repo.git('worktree', 'list');
        await run(buildAnswerQuestionGraph, [[{name: 'list_directory', args: {path: ''}}], 'done']);

        expect(repo.git('worktree', 'list')).toBe(before);
        expect(repo.git('branch', '--list')).toBe('* main');
    });

    it('name the run directory in the system prompt', async () => {
        const chatModel = new ScriptedChatModel(['done']);
        await withWorkspace(buildAnswerQuestionGraph()).invoke(
            {messages: [{role: 'user', content: 'q'}]},
            {context: {config: GlobalConfigSchema.parse({}), cwd: `${repo.root}/src`, models: {agent: chatModel}}},
        );

        expect(chatModel.calls[0]?.[0]?.text).toContain('The user ran you from src/');
    });
});

describe('change agents', () => {
    it('commit their changes to a branch of their own and leave the checkout alone', async () => {
        repo.write('README.md', '# Demo, edited by the user\n');

        const {result} = await run(buildMiniChangeGraph, [
            [{name: 'edit_file', args: {path: 'src/greet.ts', oldText: 'Hello', newText: 'Hi'}}],
            'Changed the greeting to Hi.',
        ]);

        const {changes} = result;
        expect(changes?.branch).toMatch(/^agent-engineer\/mini-change-[0-9a-f]{8}$/);
        expect(changes?.files).toEqual(['src/greet.ts']);
        expect(result.messages.at(-1)).toEqual({role: 'assistant', content: 'Changed the greeting to Hi.'});

        // The checkout is untouched; the branch holds the user's working changes, then the agent's commit.
        expect(readFileSync(`${repo.root}/src/greet.ts`, 'utf8')).toBe(FILES['src/greet.ts']);
        expect(repo.git('show', `${changes!.branch}:src/greet.ts`)).toContain('`Hi, ${name}`');
        expect(repo.git('show', `${changes!.branch}:README.md`)).toBe('# Demo, edited by the user');
        expect(repo.git('log', '--format=%s', changes!.branch).split('\n')).toEqual([
            'agent-engineer (mini-change): the request',
            'agent-engineer: working changes the agent started from',
            'initial',
        ]);
        expect(repo.git('rev-parse', changes!.branch)).toBe(changes!.commit);
    });

    it('report no changes when the agent changed nothing', async () => {
        const {result} = await run(buildMiniChangeGraph, ['Nothing needed changing.']);

        expect(result.changes).toBeUndefined();
    });

    it('stop at maxOutputFiles files and refuse off-limits paths', async () => {
        const {chatModel, result} = await run(buildMiniChangeGraph, [
            [
                {name: 'write_file', args: {path: 'src/a.ts', content: 'a\n'}},
                {name: 'write_file', args: {path: 'src/b.ts', content: 'b\n'}},
                {name: 'edit_file', args: {path: 'src/a.ts', oldText: 'missing', newText: 'x'}},
                {name: 'delete_file', args: {path: 'secrets/key.txt'}},
            ],
            'done',
        ], {maxOutputFiles: 1});

        expect(chatModel.toolResults().map((r) => r.content)).toEqual([
            'Wrote src/a.ts.',
            'Error: This run may change at most 1 files; it has changed src/a.ts.',
            'Error: oldText was not found in src/a.ts. Read the file again and copy the text exactly.',
            'Error: secrets/key.txt is off limits.',
        ]);
        expect(result.changes?.files).toEqual(['src/a.ts']);
        expect(existsSync(`${repo.root}/src/a.ts`)).toBe(false);
    });

    it('see their own new files in later searches', async () => {
        const {chatModel} = await run(buildMiniChangeGraph, [
            [{name: 'write_file', args: {path: 'src/fresh.ts', content: 'export const fresh = 1;\n'}}],
            [{name: 'search_code', args: {query: 'fresh', method: 'text'}}],
            'done',
        ]);

        expect(chatModel.toolResults()[1]?.content).toContain('src/fresh.ts:1');
    });
});

describe('off-limits patterns', () => {
    it('match the path and everything inside it', () => {
        expect(globToRegExp('.dust').test('.dust')).toBe(true);
        expect(globToRegExp('.dust').test('pkg/.dust/cache.json')).toBe(true);
        expect(globToRegExp('.dust').test('pkg/.dusty')).toBe(false);
        expect(globToRegExp('/build').test('pkg/build/x')).toBe(false);
        expect(globToRegExp('**/*.pem').test('a/b/c.pem')).toBe(true);
        expect(globToRegExp('*.pem').test('a/b/c.pem')).toBe(true);
    });

    it('become search excludes that cover directories', () => {
        expect(offLimitsGlobs({ignore: ['dist/'], offLimits: ['.dust']})).toEqual(['dist', 'dist/**', '.dust', '.dust/**']);
    });
});
