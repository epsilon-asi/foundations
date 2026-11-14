import {rmSync} from 'node:fs';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {createReadTools, RepoToolkit, RepoWorkspace, UNREADABLE} from '../../src/agents/index.js';
import {GlobalConfigSchema} from '../../src/config/global-config.js';
import {useGitRepo} from '../helpers/gitRepo.js';

const repo = useGitRepo({
    '.gitignore': '*.log\nbuild/\n',
    'src/keep.ts': 'keep\n',
    'src/modified.ts': 'before\n',
    'src/staged.ts': 'before\n',
    'src/both.ts': 'committed\n',
    'src/deleted.ts': 'gone soon\n',
    'src/old-name.ts': 'renamed\n',
    'image.bin': '\u0000\u0001\u0002\n',
});

let workspace: RepoWorkspace;
let read: (path: string) => Promise<string>;
let list: (path: string) => Promise<string>;
let statusBefore: string;

beforeEach(async () => {
    repo.write('src/modified.ts', 'after\n');
    repo.write('src/staged.ts', 'staged\n');
    repo.git('add', 'src/staged.ts');
    repo.write('src/both.ts', 'staged\n');
    repo.git('add', 'src/both.ts');
    repo.write('src/both.ts', 'staged, then edited\n');
    rmSync(join(repo.root, 'src/deleted.ts'));
    repo.git('mv', 'src/old-name.ts', 'src/new-name.ts');
    repo.write('src/untracked.ts', 'new\n');
    repo.write('src/staged-new.ts', 'added\n');
    repo.git('add', 'src/staged-new.ts');
    repo.write('debug.log', 'ignored\n');
    repo.write('build/out.js', 'ignored\n');
    statusBefore = repo.git('status', '--porcelain');

    const config = GlobalConfigSchema.parse({});
    workspace = new RepoWorkspace({config, cwd: repo.root});
    const toolkit = new RepoToolkit({sandbox: await workspace.open(), config});
    const tools = new Map((createReadTools(toolkit) as unknown as { name: string; invoke: (input: object) => Promise<unknown> }[]).map((tool) => [tool.name, tool]));
    read = async (path) => String(await tools.get('read_file')!.invoke({path}));
    list = async (path) => String(await tools.get('list_directory')!.invoke({path}));
});

afterEach(async () => {
    await workspace.dispose();
});

const contents = (text: string) => text.split('\n')[1]?.replace(/^\d+ \| /, '');
const MISSING = /^Error: .* does not exist, or is ignored, too large or not text\.$/;

describe('the sandbox snapshot', () => {
    it.each([
        ['src/keep.ts', 'keep'],
        ['src/modified.ts', 'after'],
        ['src/staged.ts', 'staged'],
        ['src/both.ts', 'staged, then edited'],
        ['src/new-name.ts', 'renamed'],
        ['src/untracked.ts', 'new'],
        ['src/staged-new.ts', 'added'],
    ])('has %s as the checkout has it', async (path, expected) => {
        expect(contents(await read(path))).toBe(expected);
    });

    it.each(['src/deleted.ts', 'src/old-name.ts', 'debug.log', 'build/out.js'])('does not have %s', async (path) => {
        expect(await read(path)).toMatch(MISSING);
    });

    it('lists exactly the files the checkout has, marking binaries unreadable', async () => {
        expect((await list('')).split('\n')).toEqual(['.gitignore', `image.bin ${UNREADABLE}`, 'src/']);
        expect((await list('src')).split('\n')).toEqual([
            'both.ts', 'keep.ts', 'modified.ts', 'new-name.ts', 'staged-new.ts', 'staged.ts', 'untracked.ts',
        ]);
    });

    it('leaves the checkout exactly as it was', async () => {
        await workspace.dispose();

        expect(repo.git('status', '--porcelain')).toBe(statusBefore);
    });
});
