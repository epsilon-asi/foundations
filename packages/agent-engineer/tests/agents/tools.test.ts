import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {afterEach, describe, expect, it} from 'vitest';
import {
    createReadTools,
    createWriteTools,
    DEFAULT_MAX_LISTED_ENTRIES,
    DEFAULT_READ_LINES,
    RepoToolkit,
    UNREADABLE,
    RepoWorkspace,
} from '../../src/agents/index.js';
import {GlobalConfigSchema} from '../../src/config/global-config.js';
import {useGitRepo} from '../helpers/gitRepo.js';

const LONG_FILE = Array.from({length: DEFAULT_READ_LINES + 50}, (_, index) => `line ${index + 1}`).join('\n');
const MANY_FILES = Object.fromEntries(Array.from({length: DEFAULT_MAX_LISTED_ENTRIES + 5}, (_, index) => [`many/f${String(index).padStart(3, '0')}.txt`, 'x\n']));

const repo = useGitRepo({
    'src/greet.ts': 'export function greet() {\n    return greeting;\n}\nconst greeting = "hello";\n',
    'src/main.ts': "import {greet} from './greet.js';\ngreet();\n",
    'docs/guide.md': 'Call greet() to say hello.\n',
    // No final newline: the sandbox counts the empty string after one as a line.
    'src/long.txt': LONG_FILE,
    'logo.png': '\u0000\u0001binary',
    'big.txt': `${'x'.repeat(20_000)}\n`,
    ...MANY_FILES,
});

let workspace: RepoWorkspace | undefined;
afterEach(async () => {
    await workspace?.dispose();
    workspace = undefined;
});

/** Every repo tool by name, over a sandbox of the test repository on a branch. */
async function openTools(config: Record<string, unknown> = {}) {
    const parsed = GlobalConfigSchema.parse({maxContextFileSizeBytes: 10_000, offLimits: ['secrets'], ...config});
    workspace = new RepoWorkspace({config: parsed, cwd: repo.root});
    const sandbox = await workspace.open({branch: 'tools-test'});
    const toolkit = new RepoToolkit({sandbox, config: parsed});
    type Invokable = { name: string; invoke: (input: Record<string, unknown>) => Promise<unknown> };
    const tools = new Map(([...createReadTools(toolkit), ...createWriteTools(toolkit)] as unknown as Invokable[]).map((tool) => [tool.name, tool]));
    const call = async (name: string, input: Record<string, unknown>): Promise<string> => String(await tools.get(name)!.invoke(input));
    return {call, toolkit, sandbox};
}

describe('read tools', () => {
    it('list a directory, truncating long listings', async () => {
        const {call} = await openTools();

        expect((await call('list_directory', {path: ''})).split('\n')).toEqual([`big.txt ${UNREADABLE}`, 'docs/', `logo.png ${UNREADABLE}`, 'many/', 'src/']);
        const many = (await call('list_directory', {path: 'many'})).split('\n');
        expect(many).toHaveLength(DEFAULT_MAX_LISTED_ENTRIES + 1);
        expect(many.at(-1)).toBe('... 5 more');
        expect(await call('list_directory', {path: 'nowhere'})).toBe('No files under nowhere.');
        expect(await call('list_directory', {path: 'secrets'})).toBe('Error: secrets is off limits.');
    });

    it('find files by path', async () => {
        const {call} = await openTools();

        expect(await call('find_files', {query: 'greet'})).toBe('src/greet.ts');
        expect(await call('find_files', {query: 'zzzzqqq'})).toBe('No files found.');
        expect(await call('find_files', {query: 'big'})).toBe(`big.txt ${UNREADABLE}`);
    });

    it('search code, scoped by include globs', async () => {
        const {call} = await openTools();

        const all = await call('search_code', {query: 'greet', method: 'text'});
        expect(all).toContain('docs/guide.md:1');
        expect(all).toContain('src/main.ts:1');
        const scoped = await call('search_code', {query: 'greet', method: 'text', include: ['src/**']});
        expect(scoped).not.toContain('docs/guide.md');
        expect(await call('search_code', {query: 'greet(', method: 'regex'})).toMatch(/^Error: /);
    });

    it('find definitions and references', async () => {
        const {call} = await openTools();

        expect(await call('find_definition', {name: 'greet'})).toMatch(/^src\/greet\.ts:1/);
        expect(await call('find_definition', {name: 'greet', kind: 'class'})).toBe('No results.');
        const references = await call('find_references', {name: 'greeting'});
        expect(references).toContain('src/greet.ts:2');
        expect(references).toContain('src/greet.ts:4');
    });

    it(`read files with line numbers, ${DEFAULT_READ_LINES} lines at a time by default`, async () => {
        const {call} = await openTools();

        const top = await call('read_file', {path: 'src/long.txt'});
        expect(top.split('\n')[0]).toBe(`src/long.txt (lines 1-${DEFAULT_READ_LINES} of ${DEFAULT_READ_LINES + 50})`);
        expect(top.split('\n').at(-1)).toBe('... 50 more lines');
        expect(await call('read_file', {path: 'src/long.txt', startLine: 449})).toBe('src/long.txt (lines 449-450 of 450)\n449 | line 449\n450 | line 450');
        expect(await call('read_file', {path: 'logo.png'})).toMatch(/^Error: logo\.png does not exist, or is ignored, too large or not text\.$/);
        // The sandbox counts the empty string after a final newline as a line, so this 4-line file has "5".
        expect(await call('read_file', {path: 'src/greet.ts', startLine: 2, endLine: 2})).toBe('src/greet.ts (lines 2-2 of 5)\n2 |     return greeting;\n... 3 more lines');
    });

    it('refuse files the search did not index: too large, missing or off limits', async () => {
        const {call} = await openTools();

        expect(await call('read_file', {path: 'big.txt'})).toBe('Error: big.txt does not exist, or is ignored, too large or not text.');
        expect(await call('read_file', {path: 'src/missing.ts'})).toBe('Error: src/missing.ts does not exist, or is ignored, too large or not text.');
        expect(await call('read_file', {path: 'secrets/key'})).toBe('Error: secrets/key is off limits.');
    });
});

describe('write tools', () => {
    it('replace text exactly once, keeping replacement patterns literal', async () => {
        const {call, sandbox} = await openTools();

        expect(await call('edit_file', {path: 'src/greet.ts', oldText: '"hello"', newText: '"$& and $1"'})).toBe('Replaced 1 occurrence in src/greet.ts.');
        expect(readFileSync(join(sandbox.worktreePath, 'src/greet.ts'), 'utf8')).toContain('const greeting = "$& and $1";');
    });

    it('refuse an ambiguous edit unless replaceAll is set', async () => {
        const {call, sandbox} = await openTools();

        expect(await call('edit_file', {path: 'src/greet.ts', oldText: 'greet', newText: 'welcome'}))
            .toBe('Error: oldText occurs 3 times in src/greet.ts. Include more context, or set replaceAll.');
        expect(await call('edit_file', {path: 'src/greet.ts', oldText: 'greet', newText: 'welcome', replaceAll: true}))
            .toBe('Replaced 3 occurrences in src/greet.ts.');
        expect(readFileSync(join(sandbox.worktreePath, 'src/greet.ts'), 'utf8')).not.toContain('greet');
    });

    it('create files in new directories, and delete files', async () => {
        const {call, sandbox, toolkit} = await openTools();

        expect(await call('write_file', {path: 'src/new/deep/file.ts', content: 'export {};\n'})).toBe('Wrote src/new/deep/file.ts.');
        expect(readFileSync(join(sandbox.worktreePath, 'src/new/deep/file.ts'), 'utf8')).toBe('export {};\n');
        expect(await call('delete_file', {path: 'docs/guide.md'})).toBe('Deleted docs/guide.md.');
        expect([...toolkit.changedFiles]).toEqual(['src/new/deep/file.ts', 'docs/guide.md']);
        // Listings follow the writes.
        expect(await call('list_directory', {path: 'docs'})).toBe('No files under docs.');
        expect(await call('list_directory', {path: 'src/new/deep'})).toBe('file.ts');
    });

    it('say plainly when the file to edit or delete does not exist', async () => {
        const {call} = await openTools();

        expect(await call('edit_file', {path: 'nope.ts', oldText: 'a', newText: 'b'})).toBe('Error: nope.ts does not exist.');
        expect(await call('delete_file', {path: 'nope.ts'})).toBe('Error: nope.ts does not exist.');
    });

    it('keep changing files already changed once maxOutputFiles is reached', async () => {
        const {call} = await openTools({maxOutputFiles: 1});

        expect(await call('write_file', {path: 'a.ts', content: '1'})).toBe('Wrote a.ts.');
        expect(await call('write_file', {path: 'a.ts', content: '2'})).toBe('Wrote a.ts.');
        expect(await call('write_file', {path: 'b.ts', content: '1'})).toBe('Error: This run may change at most 1 files; it has changed a.ts.');
    });

    it('refuse to write off limits, outside the repository, or into .git', async () => {
        const {call} = await openTools();

        expect(await call('write_file', {path: 'secrets/x', content: ''})).toBe('Error: secrets/x is off limits.');
        expect(await call('write_file', {path: '../escape.ts', content: ''})).toBe('Error: ../escape.ts is outside the repository.');
        expect(await call('write_file', {path: '.git/hooks/pre-commit', content: ''})).toBe('Error: .git/hooks/pre-commit is off limits.');
    });
});
