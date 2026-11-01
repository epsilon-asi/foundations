import { afterEach, describe, expect, it } from 'vitest';
import { Command, Option, runMain, type CliCommand } from '../src/index.js';
import { captureIO } from './helpers/captureIO.js';

const originalArgv = process.argv;

afterEach(() => {
  process.argv = originalArgv;
  process.exitCode = undefined;
});

describe('runMain', () => {
  it('runs on process.argv without the node and script paths and stores the exit code', async () => {
    let seen: number | undefined;

    @Command()
    class Tool implements CliCommand {
      @Option.number({ default: 1 })
      count!: number;

      run(): number {
        seen = this.count;
        return 3;
      }
    }

    process.argv = ['/usr/bin/node', '/app/dist/main.js', '--count', '2'];

    await expect(runMain(Tool, { io: captureIO().io })).resolves.toBe(3);
    expect(seen).toBe(2);
    expect(process.exitCode).toBe(3);
  });

  it('stores 0 on success', async () => {
    @Command()
    class Tool implements CliCommand {
      run(): void {}
    }

    process.argv = ['node', 'main.js'];
    process.exitCode = 7;

    await expect(runMain(Tool, { io: captureIO().io })).resolves.toBe(0);
    expect(process.exitCode).toBe(0);
  });
});
