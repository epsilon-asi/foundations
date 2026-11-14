import {runCli} from '@epsilon-asi/command-line';
import {join} from 'node:path';
import {beforeEach, describe, expect, it} from 'vitest';
import {AgentEngineer} from '../../src/cli.js';
import {CONFIG_FILE_NAME} from '../../src/middleware/config.js';
import {provideModels} from '../../src/middleware/models.js';
import {captureIO} from '../helpers/captureIO.js';
import {useConfigSandbox} from '../helpers/configSandbox.js';
import {initGitRepo} from '../helpers/gitRepo.js';
import {ScriptedChatModel} from '../helpers/scriptedModel.js';

const sandbox = useConfigSandbox();

beforeEach(() => {
    initGitRepo(sandbox.project, {
        'pkg/src/app.ts': 'export const app = true;\n',
        'pkg/secrets/key.txt': 'secret\n',
        'pkg/app.log': 'log\n',
        'pkg/big.txt': `${'x'.repeat(500)}\n`,
        'docs/RULES.md': '# Rules\n',
    });
});

/** Runs `query` with an agent that reads `paths`, and returns what each read gave it and its system prompt. */
async function readThroughCli(paths: string[]) {
    const agent = new ScriptedChatModel([paths.map((path) => ({name: 'read_file', args: {path}})), 'done']);
    const {io, stderr} = captureIO();
    const exitCode = await runCli(AgentEngineer, ['query', 'read', 'them'], {io, use: [provideModels({agent})]});
    expect(exitCode, stderr()).toBe(0);
    return {results: agent.toolResults().map((result) => result.content), prompt: agent.calls[0]?.[0]?.text ?? ''};
}

describe('config from agent-engineer.yaml', () => {
    it('reaches the tools from every layer: offLimits, ignore and maxContextFileSizeBytes', async () => {
        // The repository root's config sets the limits; the package's adds to them; ~/.easi adds the file size.
        sandbox.write(join(sandbox.project, CONFIG_FILE_NAME), 'offLimits: [secrets]\n');
        sandbox.write(join(sandbox.cwd, CONFIG_FILE_NAME), "ignore: ['*.log']\n");
        sandbox.write(join(sandbox.home, '.easi', CONFIG_FILE_NAME), 'maxContextFileSizeBytes: 100\n');

        const {results} = await readThroughCli(['pkg/secrets/key.txt', 'pkg/app.log', 'pkg/big.txt', 'pkg/src/app.ts']);

        expect(results).toEqual([
            'Error: pkg/secrets/key.txt is off limits.',
            'Error: pkg/app.log is off limits.',
            'Error: pkg/big.txt does not exist, or is ignored, too large or not text.',
            'pkg/src/app.ts (lines 1-2 of 2)\n1 | export const app = true;\n2 | ',
        ]);
    });

    it('puts the default context in the system prompt', async () => {
        sandbox.write(join(sandbox.cwd, CONFIG_FILE_NAME), [
            'defaultContext:',
            '  - kind: path',
            '    path: ../docs/RULES.md',
            '    description: House rules',
            '    required: true',
        ].join('\n'));

        const {prompt} = await readThroughCli([]);

        expect(prompt).toContain('- path docs/RULES.md (required: read it before you answer): House rules');
    });
});
