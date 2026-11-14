import { runCli } from '@epsilon-asi/command-line';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AgentEngineer } from '../src/cli.js';
import { GlobalConfigSchema } from '../src/config/global-config.js';
import { CONFIG_FILE_NAME } from '../src/middleware/config.js';
import { captureIO } from './helpers/captureIO.js';
import { useConfigSandbox } from './helpers/configSandbox.js';

const sandbox = useConfigSandbox();

async function printConfig(...flags: string[]): Promise<{ exitCode: number; config: unknown; stderr: string }> {
  const { io, stdout, stderr } = captureIO();
  const exitCode = await runCli(AgentEngineer, ['answer', ...flags], { io });
  return { exitCode, config: exitCode === 0 ? JSON.parse(stdout()) : undefined, stderr: stderr() };
}

describe('config middleware', () => {
  it('provides the schema defaults when no config file exists', async () => {
    const result = await printConfig('-l', 'debug');

    expect(result.exitCode).toBe(0);
    expect(result.config).toEqual(GlobalConfigSchema.parse({}));
    expect(result.stderr).toBe(`[debug] no ${CONFIG_FILE_NAME} found; using the default config\n`);
  });

  it('merges the working directory over its parents over ~/.easi', async () => {
    const local = sandbox.write(join(sandbox.cwd, CONFIG_FILE_NAME), 'model: local\n');
    const parent = sandbox.write(join(sandbox.project, CONFIG_FILE_NAME), 'model: parent\nmaxToolRounds: 5\n');
    const user = sandbox.write(
      join(sandbox.home, '.easi', CONFIG_FILE_NAME),
      'model: user\nmaxToolRounds: 9\nmaxOutputFiles: 3\n',
    );

    const result = await printConfig('-l', 'debug');

    expect(result.exitCode).toBe(0);
    expect(result.config).toMatchObject({ model: 'local', maxToolRounds: 5, maxOutputFiles: 3 });
    expect(result.stderr).toBe(
      `[debug] config merged from ${local} (local), ${parent} (ancestor), ${user} (fallback)\n`,
    );
  });

  it('runs before every command, not only the ones that read the config', async () => {
    sandbox.write(join(sandbox.home, '.easi', CONFIG_FILE_NAME), 'model: user\n');
    const { io, stderr } = captureIO();

    await expect(runCli(AgentEngineer, ['info', '-l', 'debug'], { io })).resolves.toBe(0);
    expect(stderr()).toContain('[debug] config merged from');
  });

  it('fails the command when the config is invalid', async () => {
    const bad = sandbox.write(join(sandbox.cwd, CONFIG_FILE_NAME), 'maxToolRounds: 0\n');
    const { io, stdout, stderr } = captureIO();

    await expect(runCli(AgentEngineer, ['info'], { io })).resolves.toBe(1);
    expect(stdout()).toBe('');
    expect(stderr()).toContain(`error: Validation failed for ${bad}`);
  });
});
