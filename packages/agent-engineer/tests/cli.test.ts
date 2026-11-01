import { readPackageJson, runCli } from '@epsilon-asi/command-line';
import { describe, expect, it, vi } from 'vitest';
import { AgentEngineer } from '../src/cli.js';
import type { RuntimeInfo } from '../src/commands/info.js';
import { captureIO } from './helpers/captureIO.js';

const PACKAGE = readPackageJson(import.meta.url);
const ENV = 'AGENT_ENGINEER_LOG_LEVEL';

describe('agent-engineer', () => {
  it('prints the package version for --version', async () => {
    const { io, stdout } = captureIO();

    expect(PACKAGE.version).toMatch(/^\d+\.\d+\.\d+/);
    await expect(runCli(AgentEngineer, ['--version'], { io })).resolves.toBe(0);
    expect(stdout()).toBe(`${PACKAGE.version}\n`);
  });

  it('takes its name and description from package.json', async () => {
    const { io, stdout } = captureIO();

    await expect(runCli(AgentEngineer, ['--help'], { io })).resolves.toBe(0);
    expect(stdout()).toContain('Usage: agent-engineer');
    expect(stdout()).toContain(PACKAGE.description);
  });

  it('prints help listing the log level option and commands', async () => {
    const { io, stdout } = captureIO();

    await expect(runCli(AgentEngineer, ['--help'], { io })).resolves.toBe(0);
    expect(stdout()).toContain('-l, --log-level <level>');
    expect(stdout()).toMatch(new RegExp(`env:\\s+${ENV}`));
    expect(stdout()).toMatch(/info \[options\]\s+Print CLI and runtime information\./);
  });

  it('prints help to stderr and fails when no command is given', async () => {
    const { io, stdout, stderr } = captureIO();

    await expect(runCli(AgentEngineer, [], { io })).resolves.toBe(1);
    expect(stdout()).toBe('');
    expect(stderr()).toContain('Usage: agent-engineer');
  });

  it('fails on an unknown command', async () => {
    const { io, stderr } = captureIO();

    await expect(runCli(AgentEngineer, ['nope'], { io })).resolves.toBe(1);
    expect(stderr()).toContain("unknown command 'nope'");
  });

  it('runs info with the default text format', async () => {
    const { io, stdout, stderr } = captureIO();

    await expect(runCli(AgentEngineer, ['info'], { io })).resolves.toBe(0);
    expect(stdout()).toMatch(/^name\s+agent-engineer$/m);
    expect(stdout()).toMatch(new RegExp(`^version\\s+${PACKAGE.version?.replaceAll('.', '\\.')}$`, 'm'));
    expect(stderr()).toBe('');
  });

  it('runs info with --format json', async () => {
    const { io, stdout } = captureIO();

    await expect(runCli(AgentEngineer, ['info', '--format', 'json'], { io })).resolves.toBe(0);

    const info: RuntimeInfo = JSON.parse(stdout());
    expect(info).toEqual({
      name: 'agent-engineer',
      version: PACKAGE.version,
      node: process.version,
      platform: `${process.platform}-${process.arch}`,
    });
  });

  it('rejects a format outside the declared choices', async () => {
    const { io, stdout, stderr } = captureIO();

    await expect(runCli(AgentEngineer, ['info', '-f', 'xml'], { io })).resolves.toBe(1);
    expect(stdout()).toBe('');
    expect(stderr()).toContain('Allowed choices are text, json');
  });

  it('logs at the level given on the root', async () => {
    const { io, stderr } = captureIO();

    await expect(runCli(AgentEngineer, ['--log-level', 'debug', 'info', '-f', 'json'], { io })).resolves.toBe(0);
    expect(stderr()).toBe('[debug] rendering info as json\n');
  });

  it('accepts the log level after the subcommand too', async () => {
    const { io, stderr } = captureIO();

    await expect(runCli(AgentEngineer, ['info', '-l', 'debug'], { io })).resolves.toBe(0);
    expect(stderr()).toBe('[debug] rendering info as text\n');
  });

  it('reads the log level from the environment', async () => {
    vi.stubEnv(ENV, 'debug');
    const { io, stderr } = captureIO();

    await expect(runCli(AgentEngineer, ['info'], { io })).resolves.toBe(0);
    expect(stderr()).toBe('[debug] rendering info as text\n');
  });

  it('prefers the flag over the environment variable', async () => {
    vi.stubEnv(ENV, 'debug');
    const { io, stderr } = captureIO();

    await expect(runCli(AgentEngineer, ['-l', 'error', 'info'], { io })).resolves.toBe(0);
    expect(stderr()).toBe('');
  });

  it('rejects an invalid environment value', async () => {
    vi.stubEnv(ENV, 'loud');
    const { io, stderr } = captureIO();

    await expect(runCli(AgentEngineer, ['info'], { io })).resolves.toBe(1);
    expect(stderr()).toContain(`from env '${ENV}' is invalid`);
  });
});
