import {runCli} from '@epsilon-asi/command-line';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {CONTAINER_LABEL} from '../../src/agents/index.js';
import {AgentEngineer} from '../../src/cli.js';
import {CONFIG_FILE_NAME} from '../../src/middleware/config.js';
import {provideModels} from '../../src/middleware/models.js';
import {captureIO} from '../helpers/captureIO.js';
import {useConfigSandbox} from '../helpers/configSandbox.js';
import {type GitRepoFixture, initGitRepo} from '../helpers/gitRepo.js';
import {type ScriptedReply, ScriptedChatModel} from '../helpers/scriptedModel.js';

/**
 * `--container` on real Docker: the agent's tasks run inside a container mounted on its worktree. They need a Docker
 * daemon and pull the default image on first run, so they run only when asked for:
 * AGENT_ENGINEER_CONTAINER_TESTS=1 (npm run test:container).
 */
const ENABLED = process.env['AGENT_ENGINEER_CONTAINER_TESTS'] === '1';
const TIMEOUT_MS = 600_000;

const parsed = vi.hoisted(() => ({choice: 'mini_change', reasoning: 'a small edit'}));
vi.mock('@epsilon-asi/langgraph', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@epsilon-asi/langgraph')>()),
    createOptionSelectionNode: () => async () => ({messages: [], ...parsed}),
}));

const script = (code: string) => `node -e ${JSON.stringify(code)}`;

const PACKAGE = {
    name: 'fixture',
    version: '1.0.0',
    private: true,
    scripts: {
        // No template literals: npm runs scripts through sh, which would expand ${...} itself.
        where: script("console.log('platform=' + process.platform + ' cwd=' + process.cwd() + ' uid=' + process.getuid()); require('fs').writeFileSync('made-in-container.txt', 'x')"),
        fail: script("console.error('it broke'); process.exit(3)"),
        net: script("fetch('https://registry.npmjs.org/').then(() => console.log('online'), () => console.log('offline'))"),
        test: script("const fs = require('fs'); if (!fs.existsSync('src/added.ts')) { console.error('src/added.ts is missing'); process.exit(1); } console.log('tests pass')"),
    },
};
const LOCKFILE = {name: 'fixture', version: '1.0.0', lockfileVersion: 3, requires: true, packages: {'': {name: 'fixture', version: '1.0.0'}}};

const containers = () => execFileSync('docker', ['ps', '-a', '-q', '--filter', `label=${CONTAINER_LABEL}=true`], {encoding: 'utf8'}).trim();

describe.skipIf(!ENABLED)('--container', () => {
    const sandbox = useConfigSandbox();
    let repo: GitRepoFixture;

    beforeEach(() => {
        repo = initGitRepo(sandbox.project, {
            'pkg/package.json': `${JSON.stringify(PACKAGE, null, 2)}\n`,
            'pkg/package-lock.json': `${JSON.stringify(LOCKFILE, null, 2)}\n`,
            'pkg/src/index.ts': 'export {};\n',
        });
    });

    async function cli(argv: string[], replies: ScriptedReply[]) {
        const agent = new ScriptedChatModel(replies);
        const {io, stdout, stderr} = captureIO();
        const exitCode = await runCli(AgentEngineer, argv, {io, use: [provideModels({agent})]});
        return {exitCode, stdout: stdout(), stderr: stderr(), results: agent.toolResults().map((result) => result.content), tools: agent.boundTools};
    }

    it('runs tasks inside the container, in the run directory, as the host user', async () => {
        const before = containers();

        const result = await cli(['query', '-C', 'where', 'do', 'tasks', 'run?'], [
            [
                {name: 'run_task', args: {task: 'where'}},
                {name: 'run_task', args: {task: 'fail'}},
                {name: 'run_task', args: {task: 'nope'}},
            ],
            'In a Linux container.',
        ]);

        expect(result.exitCode, result.stderr).toBe(0);
        expect(result.tools).toContain('run_task');
        const [where, fail, missing] = result.results;
        expect(where).toContain(`platform=linux cwd=/workspace/pkg uid=${process.getuid!()}`);
        expect(where).toMatch(/^\$ npm run where (.*)\(exit code 0\)/);
        expect(fail).toMatch(/\(exit code 3\)\n[\s\S]*it broke/);
        expect(missing).toBe('There is no task named nope in pkg. Its tasks: where, fail, net, test.');
        // The container, the worktree and the file the task wrote are all gone.
        expect(containers()).toBe(before);
        expect(repo.git('worktree', 'list').split('\n')).toHaveLength(1);
        expect(repo.git('status', '--porcelain')).toBe('');
    }, TIMEOUT_MS);

    it('cuts the network when the config says so', async () => {
        sandbox.write(join(sandbox.cwd, CONFIG_FILE_NAME), 'container:\n  network: false\n');

        const result = await cli(['query', '--container', 'is', 'there', 'network?'], [[{name: 'run_task', args: {task: 'net'}}], 'No.']);

        expect(result.exitCode, result.stderr).toBe(0);
        expect(result.results[0]).toContain('offline');
    }, TIMEOUT_MS);

    it('lets a change agent test its change before it is committed', async () => {
        const result = await cli(['do', '-C', '-f', 'json', 'add', 'src/added.ts'], [
            [{name: 'run_task', args: {task: 'test'}}],
            [{name: 'write_file', args: {path: 'pkg/src/added.ts', content: 'export const added = true;\n'}}],
            [{name: 'run_task', args: {task: 'test'}}],
            'Added it; the tests pass.',
        ]);

        expect(result.exitCode, result.stderr).toBe(0);
        const [failing, , passing] = result.results;
        expect(failing).toContain('src/added.ts is missing');
        expect(passing).toContain('tests pass');
        const {changes} = JSON.parse(result.stdout) as { changes: { branch: string; files: string[] } };
        expect(changes.files).toEqual(['pkg/src/added.ts']);
        expect(repo.git('show', `${changes.branch}:pkg/src/added.ts`)).toBe('export const added = true;');
    }, TIMEOUT_MS);
});
