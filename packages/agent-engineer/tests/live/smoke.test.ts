import {runCli} from '@epsilon-asi/command-line';
import {beforeEach, describe, expect, it} from 'vitest';
import {AgentEngineer} from '../../src/cli.js';
import {captureIO} from '../helpers/captureIO.js';
import {useConfigSandbox} from '../helpers/configSandbox.js';
import {type GitRepoFixture, initGitRepo} from '../helpers/gitRepo.js';

/**
 * Live smoke tests: the real CLI on the real OpenAI models, against a tiny repository. They check the wiring a
 * scripted model cannot: tool schemas the API accepts, structured intent output, and the Responses API. They cost
 * money, so they run only when asked for: AGENT_ENGINEER_LIVE_TESTS=1 with OPENAI_API_KEY set (npm run test:live).
 */
const LIVE = process.env['AGENT_ENGINEER_LIVE_TESTS'] === '1' && Boolean(process.env['OPENAI_API_KEY']);
const TIMEOUT_MS = 180_000;

describe.skipIf(!LIVE)('live', () => {
    const sandbox = useConfigSandbox();
    let repo: GitRepoFixture;

    beforeEach(() => {
        repo = initGitRepo(sandbox.project, {
            'pkg/src/greet.ts': 'export function greet(name: string): string {\n    return `Hello, ${name}!`;\n}\n',
            'pkg/src/main.ts': "import {greet} from './greet.js';\n\nconsole.log(greet('world'));\n",
        });
    });

    const cli = async (...argv: string[]) => {
        const {io, stdout, stderr} = captureIO();
        const exitCode = await runCli(AgentEngineer, argv, {io});
        return {exitCode, stdout: stdout(), stderr: stderr()};
    };

    it('answers a question from the code', async () => {
        const result = await cli('query', '-f', 'json', 'Which file defines greet, and what does it return for "Ada"?');

        expect(result.exitCode, result.stderr).toBe(0);
        const {answer} = JSON.parse(result.stdout) as { answer: string };
        expect(answer).toMatch(/greet\.ts/);
        expect(answer).toMatch(/Hello, Ada!/);
        expect(repo.git('worktree', 'list').split('\n')).toHaveLength(1);
    }, TIMEOUT_MS);

    it('routes a rename to a change agent, which commits it to a branch', async () => {
        const result = await cli('do', '-f', 'json', 'Rename the greet function to welcome, everywhere it is used.');

        expect(result.exitCode, result.stderr).toBe(0);
        const {intent, changes} = JSON.parse(result.stdout) as { intent: string; changes?: { branch: string; files: string[] } };
        expect(['mini_change', 'component_change']).toContain(intent);
        expect(changes?.files.sort()).toEqual(['pkg/src/greet.ts', 'pkg/src/main.ts']);
        expect(repo.git('show', `${changes!.branch}:pkg/src/main.ts`)).toContain('welcome(');
        expect(repo.git('show', `${changes!.branch}:pkg/src/main.ts`)).not.toContain('greet');
    }, TIMEOUT_MS);
});
