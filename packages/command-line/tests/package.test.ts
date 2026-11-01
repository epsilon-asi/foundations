import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CliDefinitionError,
  Command,
  cliNameFromPackage,
  describeCommand,
  findPackageJson,
  readPackageJson,
  runCli,
  type CliCommand,
  type CommandContext,
} from '../src/index.js';
import { captureIO } from './helpers/captureIO.js';

const fixtures = new URL('./fixtures/', import.meta.url);
const fixture = (name: string): URL => new URL(`${name}/package.json`, fixtures);

describe('findPackageJson and readPackageJson', () => {
  it('find the nearest package.json above a file URL, even one that does not exist', () => {
    const from = new URL('cli-package/src/deep/main.js', fixtures);

    expect(findPackageJson(from)).toBe(fileURLToPath(fixture('cli-package')));
    expect(readPackageJson(from).name).toBe('@example/tool');
  });

  it('accept a file: URL string, a file path and a directory path', () => {
    const directory = fileURLToPath(new URL('scoped-package', fixtures));

    expect(readPackageJson(fixture('scoped-package').href).name).toBe('@example/plain');
    expect(readPackageJson(join(directory, 'package.json')).name).toBe('@example/plain');
    expect(readPackageJson(directory).name).toBe('@example/plain');
  });

  it('read this package from import.meta.url', () => {
    expect(readPackageJson(import.meta.url).name).toBe('@epsilon-asi/command-line');
  });

  it('throw when no package.json is found', () => {
    const directory = mkdtempSync(join(tmpdir(), 'command-line-'));

    try {
      expect(() => findPackageJson(directory)).toThrow(/No package\.json found in .* or any directory above it/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('reject a package.json that is not an object', () => {
    expect(() => readPackageJson(fixture('not-object'))).toThrow(/does not contain a JSON object/);
  });
});

describe('cliNameFromPackage', () => {
  it('uses the single bin name', () => {
    expect(cliNameFromPackage({ name: '@example/tool', bin: { tool: 'x.js' } })).toBe('tool');
  });

  it('falls back to the unscoped package name', () => {
    expect(cliNameFromPackage({ name: '@example/plain' })).toBe('plain');
    expect(cliNameFromPackage({ name: 'plain', bin: 'x.js' })).toBe('plain');
  });

  it('gives up on several bins or no name', () => {
    expect(cliNameFromPackage({ name: 'multi', bin: { a: 'a.js', b: 'b.js' } })).toBeUndefined();
    expect(cliNameFromPackage({})).toBeUndefined();
  });
});

describe('@Command({ package })', () => {
  it('fills the name, version and description from package.json', async () => {
    let seen: CommandContext['cli'] | undefined;

    @Command({ package: fixture('cli-package') })
    class Whatever implements CliCommand {
      run({ cli }: CommandContext): void {
        seen = cli;
      }
    }

    const definition = describeCommand(Whatever);
    expect([definition.name, definition.version, definition.description]).toEqual(['tool', '3.2.1', 'A tool.']);
    expect(definition.package?.name).toBe('@example/tool');

    const { io, stdout } = captureIO();
    await expect(runCli(Whatever, ['--version'], { io })).resolves.toBe(0);
    expect(stdout()).toBe('3.2.1\n');

    await runCli(Whatever, [], { io });
    expect(seen?.name).toBe('tool');
    expect(seen?.package).toEqual(definition.package);
  });

  it('lets explicit metadata win', () => {
    @Command({ package: fixture('cli-package'), name: 'other', version: '0.0.0', description: 'Mine.' })
    class Whatever implements CliCommand {
      run(): void {}
    }

    const definition = describeCommand(Whatever);
    expect([definition.name, definition.version, definition.description]).toEqual(['other', '0.0.0', 'Mine.']);
  });

  it('derives the env variable of the log level option from the package name', () => {
    @Command({ package: fixture('cli-package') })
    class Whatever implements CliCommand {
      run(): void {}
    }

    expect(describeCommand(Whatever).logging?.env).toBe('TOOL_LOG_LEVEL');
  });

  it('falls back to the class name when the package has several bins', () => {
    @Command({ package: fixture('multi-bin') })
    class FirstCli implements CliCommand {
      run(): void {}
    }

    expect(describeCommand(FirstCli).name).toBe('first');
  });

  it('accepts a path string', () => {
    @Command({ package: fileURLToPath(new URL('scoped-package', fixtures)) })
    class Whatever implements CliCommand {
      run(): void {}
    }

    const definition = describeCommand(Whatever);
    expect([definition.name, definition.version, definition.description]).toEqual(['plain', '0.1.0', undefined]);
  });

  it('rejects a package without a version', () => {
    @Command({ package: fixture('no-version') })
    class Whatever implements CliCommand {
      run(): void {}
    }

    expect(() => describeCommand(Whatever)).toThrow(CliDefinitionError);
    expect(() => describeCommand(Whatever)).toThrow(/Whatever: its package\.json has no "version"/);
  });

  it('rejects a package that cannot be read', () => {
    @Command({ package: fixture('not-object') })
    class Whatever implements CliCommand {
      run(): void {}
    }

    expect(() => describeCommand(Whatever)).toThrow(/Whatever: could not read its package\.json: .*not contain a JSON object/);
  });

  it('rejects package on a subcommand', () => {
    @Command({ package: fixture('cli-package') })
    class Child implements CliCommand {
      run(): void {}
    }
    @Command({ commands: [Child] })
    class Root {}

    expect(() => describeCommand(Root)).toThrow(/Child: "package" can only be set on the root command/);
  });
});
