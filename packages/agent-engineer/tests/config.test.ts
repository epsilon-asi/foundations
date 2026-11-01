import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CLI, commands, globalOptions } from '../src/config.js';

describe('config', () => {
  it('takes the CLI version from package.json', () => {
    const packageJson: { version: string } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

    expect(CLI.version).toBe(packageJson.version);
  });

  it('creates a fresh Option instance on every factory call', () => {
    expect(globalOptions.logLevel()).not.toBe(globalOptions.logLevel());
    expect(commands.info.options.format()).not.toBe(commands.info.options.format());
  });
});
