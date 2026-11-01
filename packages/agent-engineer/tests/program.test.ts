import { describe, expect, it, vi } from 'vitest';
import type { RuntimeInfo } from '../src/commands/info.js';
import { CLI, ENV_VARS } from '../src/config.js';
import { run } from '../src/program.js';
import { captureIO } from './helpers/captureIO.js';

describe('run', () => {
  it('prints the package version for --version', async () => {
    const { io, stdout } = captureIO();

    await expect(run(['--version'], io)).resolves.toBe(0);
    expect(stdout()).toBe(`${CLI.version}\n`);
  });

  it('prints help listing the commands for --help', async () => {
    const { io, stdout } = captureIO();

    await expect(run(['--help'], io)).resolves.toBe(0);
    expect(stdout()).toContain(`Usage: ${CLI.name}`);
    expect(stdout()).toContain('info');
  });

  it('prints help to stderr and fails when no command is given', async () => {
    const { io, stdout, stderr } = captureIO();

    await expect(run([], io)).resolves.toBe(1);
    expect(stdout()).toBe('');
    expect(stderr()).toContain(`Usage: ${CLI.name}`);
  });

  it('fails on an unknown command', async () => {
    const { io, stderr } = captureIO();

    await expect(run(['nope'], io)).resolves.toBe(1);
    expect(stderr()).toContain("unknown command 'nope'");
  });

  it('reports errors thrown by a command handler', async () => {
    const { io, stderr } = captureIO();
    const failingIO = {
      ...io,
      stdout: () => {
        throw new Error('stdout closed');
      },
    };

    await expect(run(['info'], failingIO)).resolves.toBe(1);
    expect(stderr()).toBe('error: stdout closed\n');
  });
});

describe('info command', () => {
  it('prints text output by default', async () => {
    const { io, stdout, stderr } = captureIO();

    await expect(run(['info'], io)).resolves.toBe(0);
    expect(stdout()).toMatch(new RegExp(`^name\\s+${CLI.name}$`, 'm'));
    expect(stdout()).toMatch(new RegExp(`^version\\s+${CLI.version}$`, 'm'));
    expect(stderr()).toBe('');
  });

  it('prints JSON output with --format json', async () => {
    const { io, stdout } = captureIO();

    await expect(run(['info', '--format', 'json'], io)).resolves.toBe(0);

    const info: RuntimeInfo = JSON.parse(stdout());
    expect(info).toEqual({
      name: CLI.name,
      version: CLI.version,
      node: process.version,
      platform: `${process.platform}-${process.arch}`,
    });
  });

  it('rejects a format outside the declared choices', async () => {
    const { io, stdout, stderr } = captureIO();

    await expect(run(['info', '-f', 'xml'], io)).resolves.toBe(1);
    expect(stdout()).toBe('');
    expect(stderr()).toContain('Allowed choices are text, json');
  });
});

describe('--log-level', () => {
  it('suppresses debug logs by default', async () => {
    const { io, stderr } = captureIO();

    await run(['info'], io);
    expect(stderr()).not.toContain('[debug]');
  });

  it('emits debug logs to stderr when set to debug', async () => {
    const { io, stdout, stderr } = captureIO();

    await expect(run(['--log-level', 'debug', 'info', '-f', 'json'], io)).resolves.toBe(0);
    expect(stderr()).toBe('[debug] rendering info as json\n');
    expect(() => JSON.parse(stdout())).not.toThrow();
  });

  it(`reads its value from ${ENV_VARS.logLevel}`, async () => {
    vi.stubEnv(ENV_VARS.logLevel, 'debug');
    const { io, stderr } = captureIO();

    await run(['info'], io);
    expect(stderr()).toContain('[debug]');
  });

  it('prefers the flag over the environment variable', async () => {
    vi.stubEnv(ENV_VARS.logLevel, 'debug');
    const { io, stderr } = captureIO();

    await run(['-l', 'error', 'info'], io);
    expect(stderr()).toBe('');
  });

  it('rejects an invalid environment value', async () => {
    vi.stubEnv(ENV_VARS.logLevel, 'loud');
    const { io, stderr } = captureIO();

    await expect(run(['info'], io)).resolves.toBe(1);
    expect(stderr()).toContain(`from env '${ENV_VARS.logLevel}' is invalid`);
  });
});
