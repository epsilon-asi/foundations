import {afterEach, describe, expect, it} from 'vitest';
import {createTaskTools, RepoToolkit, RepoWorkspace} from '../../src/agents/index.js';
import {GlobalConfigSchema} from '../../src/config/global-config.js';
import {useGitRepo} from '../helpers/gitRepo.js';

// run_task is offered only in containers (tests/container covers that on Docker). The tool itself runs through
// whatever executor the sandbox has, so these tests call it on the host, with harmless scripts.
const node = (code: string) => `node -e ${JSON.stringify(code)}`;
const pkg = (name: string, scripts: Record<string, string>) => `${JSON.stringify({name, version: '1.0.0', private: true, scripts}, null, 2)}\n`;
const lock = (name: string) => `${JSON.stringify({name, version: '1.0.0', lockfileVersion: 3, requires: true, packages: {'': {name, version: '1.0.0'}}}, null, 2)}\n`;

const repo = useGitRepo({
    'pkg/package.json': pkg('pkg', {
        hello: node("console.log('hello from ' + require('path').basename(process.cwd()))"),
        args: node("console.log(process.argv.slice(1).join(' '))"),
        fail: node("console.error('broken'); process.exit(2)"),
    }),
    'pkg/package-lock.json': lock('pkg'),
    'other/package.json': pkg('other', {hello: node("console.log('hello from other')")}),
    'other/package-lock.json': lock('other'),
    // An unparseable lockfile, so `npm ci` cannot install.
    'broken/package.json': pkg('broken', {hello: node("console.log('never')")}),
    'broken/package-lock.json': '{ this is not json\n',
    'docs/README.md': '# no toolchain here\n',
    'secrets/package.json': pkg('secrets', {}),
});

let workspace: RepoWorkspace | undefined;
afterEach(async () => {
    await workspace?.dispose();
    workspace = undefined;
});

async function openRunTask(runDirectory = 'pkg') {
    const config = GlobalConfigSchema.parse({offLimits: ['secrets']});
    workspace = new RepoWorkspace({config, cwd: repo.root});
    const progress: string[] = [];
    const toolkit = new RepoToolkit({sandbox: await workspace.open(), config, runDirectory, progress: (text) => progress.push(text)});
    const [runTask] = createTaskTools(toolkit) as unknown as { invoke: (input: object) => Promise<unknown> }[];
    return {run: async (input: object) => String(await runTask!.invoke(input)), progress};
}

describe('run_task', () => {
    it('runs a task in the run directory, installing dependencies there once', async () => {
        const {run, progress} = await openRunTask();

        expect(await run({task: 'hello'})).toMatch(/^\$ npm run hello \(exit code 0\)\n[\s\S]*hello from pkg$/);
        await run({task: 'hello'});
        expect(progress.filter((text) => text.startsWith('installing'))).toEqual(['installing dependencies in pkg']);
        expect(progress).toContain('running hello in pkg');
    });

    it('runs in another directory when asked, including the root', async () => {
        const {run} = await openRunTask('');

        expect(await run({task: 'hello', directory: 'other'})).toContain('hello from other');
        expect(await run({task: 'hello', directory: '.'})).toMatch(/^Error: /);
    });

    it('passes arguments on, and reports failures with their exit code and output', async () => {
        const {run} = await openRunTask();

        expect(await run({task: 'args', args: ['--watch=false', 'a.test.ts']})).toContain('--watch=false a.test.ts');
        expect(await run({task: 'fail'})).toMatch(/\(exit code 2\)\n[\s\S]*broken/);
    });

    it('lists the tasks there are when asked for one that does not exist', async () => {
        const {run} = await openRunTask();

        expect(await run({task: 'deploy'})).toBe('There is no task named deploy in pkg. Its tasks: hello, args, fail.');
    });

    it('says so when dependencies cannot be installed, and tries again next time', async () => {
        const {run, progress} = await openRunTask('broken');

        expect(await run({task: 'hello'})).toMatch(/^Installing dependencies failed, so hello did not run\.\n\$ npm ci \(exit code [1-9]/);
        await run({task: 'hello'});
        expect(progress.filter((text) => text.startsWith('installing'))).toHaveLength(2);
    });

    it('refuses directories without a toolchain, off limits or outside the repository', async () => {
        const {run} = await openRunTask();

        expect(await run({task: 'hello', directory: 'docs'})).toMatch(/^Error: /);
        expect(await run({task: 'hello', directory: 'secrets'})).toBe('Error: secrets is off limits.');
        expect(await run({task: 'hello', directory: '../elsewhere'})).toBe('Error: ../elsewhere is outside the repository.');
    });
});
