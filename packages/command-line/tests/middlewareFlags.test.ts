import { describe, expect, it, vi } from 'vitest';
import {
  CliDefinitionError,
  Command,
  Option,
  buildCli,
  defineMiddleware,
  runCli,
  type AnyMiddleware,
  type MiddlewareOptionsSpec,
} from '../src/index.js';
import { captureIO } from './helpers/captureIO.js';

/** A middleware that records the options it was given on every run. */
function flagged(name: string, options: MiddlewareOptionsSpec, seen: Record<string, unknown>[] = []): AnyMiddleware {
  return defineMiddleware({
    name,
    options,
    handle: (ctx, next) => {
      seen.push({ ...ctx.options });
      return next();
    },
  });
}

const CLIENT_OPTIONS = {
  endpoint: { type: 'string', short: 'e', env: 'TEST_MIDDLEWARE_ENDPOINT', description: 'service endpoint' },
  retries: { type: 'number', default: 3, integer: true, min: 0 },
  verbose: { type: 'boolean' },
  mode: { type: 'choice', choices: ['fast', 'safe'], default: 'safe' },
} as const satisfies MiddlewareOptionsSpec;

describe('middleware flags', () => {
  function clientCli(seen: Record<string, unknown>[]) {
    @Command({ use: [flagged('client', CLIENT_OPTIONS, seen)] })
    class Root {
      run(): void {}
    }
    return Root;
  }

  it('parses each type of flag and hands the values to the middleware', async () => {
    const seen: Record<string, unknown>[] = [];
    const argv = ['-e', 'http://x', '--retries', '5', '--verbose', '--mode', 'fast'];

    await expect(runCli(clientCli(seen), argv, { io: captureIO().io })).resolves.toBe(0);
    expect(seen).toEqual([{ endpoint: 'http://x', retries: 5, verbose: true, mode: 'fast' }]);
  });

  it('applies defaults and leaves unset flags undefined', async () => {
    const seen: Record<string, unknown>[] = [];

    await runCli(clientCli(seen), [], { io: captureIO().io });
    expect(seen).toEqual([{ endpoint: undefined, retries: 3, verbose: undefined, mode: 'safe' }]);
  });

  it('reads environment variables', async () => {
    vi.stubEnv('TEST_MIDDLEWARE_ENDPOINT', 'http://env');
    const seen: Record<string, unknown>[] = [];

    await runCli(clientCli(seen), [], { io: captureIO().io });
    expect(seen[0]?.['endpoint']).toBe('http://env');
  });

  it('validates values like any other option', async () => {
    const number = captureIO();
    await expect(runCli(clientCli([]), ['--retries', '1.5'], { io: number.io })).resolves.toBe(1);
    expect(number.stderr()).toContain('--retries');

    const choice = captureIO();
    await expect(runCli(clientCli([]), ['--mode', 'slow'], { io: choice.io })).resolves.toBe(1);
    expect(choice.stderr()).toContain('Allowed choices are fast, safe');
  });

  it('enforces required flags', async () => {
    @Command({ use: [flagged('auth', { token: { type: 'string', required: true } })] })
    class Root {
      run(): void {}
    }

    const { io, stderr } = captureIO();
    await expect(runCli(Root, [], { io })).resolves.toBe(1);
    expect(stderr()).toContain("required option '--token <token>' not specified");
  });

  it('lists the flags in help after the command’s own options and before --log-level', async () => {
    @Command({ use: [flagged('client', CLIENT_OPTIONS)] })
    class Root {
      @Option.string({ description: 'own option' })
      own: string | undefined;

      run(): void {}
    }

    const { io, stdout } = captureIO();
    await expect(runCli(Root, ['--help'], { io })).resolves.toBe(0);
    const help = stdout();

    expect(help).toMatch(/-e, --endpoint <endpoint>\s+service endpoint/);
    expect(help.indexOf('--own')).toBeLessThan(help.indexOf('--endpoint'));
    expect(help.indexOf('--mode')).toBeLessThan(help.indexOf('--log-level'));
  });

  it('gives each middleware only its own flags', async () => {
    const first: Record<string, unknown>[] = [];
    const second: Record<string, unknown>[] = [];

    @Command({ use: [flagged('first', { alpha: { type: 'string' } }, first), flagged('second', { beta: { type: 'string' } }, second)] })
    class Root {
      run(): void {}
    }

    await runCli(Root, ['--alpha', 'a', '--beta', 'b'], { io: captureIO().io });
    expect(first).toEqual([{ alpha: 'a' }]);
    expect(second).toEqual([{ beta: 'b' }]);
  });
});

describe('where middleware flags are added', () => {
  it('adds them where the middleware first appears, and reads them after the subcommand name', async () => {
    const seen: Record<string, unknown>[] = [];
    const client = flagged('client', CLIENT_OPTIONS, seen);

    @Command({ use: [client] })
    class Leaf {
      run(): void {}
    }

    @Command({ use: [client], commands: [Leaf] })
    class Root {}

    await expect(runCli(Root, ['leaf', '-e', 'http://x'], { io: captureIO().io })).resolves.toBe(0);
    expect(seen).toEqual([{ endpoint: 'http://x', retries: 3, verbose: undefined, mode: 'safe' }]);

    const root = captureIO();
    await runCli(Root, ['--help'], { io: root.io });
    expect(root.stdout()).toContain('--endpoint');

    const leaf = captureIO();
    await runCli(Root, ['leaf', '--help'], { io: leaf.io });
    expect(leaf.stdout()).not.toContain('--endpoint');
  });

  it('adds buildCli middleware flags to the root', async () => {
    @Command()
    class Root {
      run(): void {}
    }

    const { io, stdout } = captureIO();
    await runCli(Root, ['--help'], { io, use: [flagged('client', CLIENT_OPTIONS)] });
    expect(stdout()).toContain('-e, --endpoint <endpoint>');
  });

  it('adds them to each sibling that uses the middleware on its own', async () => {
    const seen: Record<string, unknown>[] = [];
    const client = flagged('client', { endpoint: { type: 'string' } }, seen);

    @Command({ use: [client] })
    class First {
      run(): void {}
    }

    @Command({ use: [client] })
    class Second {
      run(): void {}
    }

    @Command({ commands: [First, Second] })
    class Root {}

    await runCli(Root, ['first', '--endpoint', 'one'], { io: captureIO().io });
    await runCli(Root, ['second', '--endpoint', 'two'], { io: captureIO().io });
    expect(seen).toEqual([{ endpoint: 'one' }, { endpoint: 'two' }]);

    const root = captureIO();
    await runCli(Root, ['--help'], { io: root.io });
    expect(root.stdout()).not.toContain('--endpoint');
  });
});

describe('middleware flag conflicts', () => {
  const client = flagged('client', { endpoint: { type: 'string', short: 'e' } });

  it('rejects a clash with an option of the same command', () => {
    @Command({ use: [client] })
    class Root {
      @Option.string({ short: 'e' })
      env: string | undefined;

      run(): void {}
    }

    expect(() => buildCli(Root)).toThrow(CliDefinitionError);
    expect(() => buildCli(Root)).toThrow(
      'Root: middleware "client" option "endpoint" (-e, --endpoint <endpoint>) uses -e, which option "env" of Root (-e, --env <env>) already uses; change the flags of one of them.',
    );
  });

  it('rejects a clash with an option of a command below it', () => {
    @Command()
    class Leaf {
      @Option.string()
      endpoint: string | undefined;

      run(): void {}
    }

    @Command({ use: [client], commands: [Leaf] })
    class Root {}

    expect(() => buildCli(Root)).toThrow(/^Leaf: option "endpoint" of Leaf .* uses --endpoint, which middleware "client"/);
  });

  it('rejects a clash with an option of a command above it', () => {
    @Command({ use: [client] })
    class Leaf {
      run(): void {}
    }

    @Command({ commands: [Leaf] })
    class Root {
      @Option.boolean({ short: 'e' })
      everything: boolean | undefined;
    }

    expect(() => buildCli(Root)).toThrow(/^Leaf: middleware "client" .* uses -e, which option "everything" of Root/);
  });

  it('rejects a clash with the log level option, anywhere in the tree', () => {
    const level = flagged('level', { location: { type: 'string', short: 'l' } });

    @Command({ use: [level] })
    class Leaf {
      run(): void {}
    }

    @Command({ commands: [Leaf] })
    class Root {}

    expect(() => buildCli(Root)).toThrow('which the built-in log level option (-l, --log-level <level>) already uses');
  });

  it('rejects a clash with help or version on any command', () => {
    @Command({ use: [flagged('help', { helpful: { type: 'boolean', short: 'h' } })] })
    class Leaf {
      run(): void {}
    }

    @Command({ commands: [Leaf] })
    class Root {}

    @Command({ use: [flagged('version', { version: { type: 'string' } })] })
    class Versioned {
      run(): void {}
    }

    expect(() => buildCli(Root)).toThrow('which the built-in help option (-h, --help) already uses');
    expect(() => buildCli(Versioned)).toThrow('which the built-in version option (-V, --version) already uses');
  });

  it('rejects two middleware with the same flag on one command', () => {
    @Command({ use: [client, flagged('other', { else: { type: 'string', short: 'e' } })] })
    class Root {
      run(): void {}
    }

    expect(() => buildCli(Root)).toThrow(/middleware "other" option "else" .* uses -e, which middleware "client"/);
  });

  it('rejects flags that commander would store under the same name', () => {
    @Command({ use: [flagged('dry', { dryRun: { type: 'boolean' } })] })
    class Root {
      @Option.boolean({ flags: '--dryRun' })
      dry: boolean | undefined;

      run(): void {}
    }

    expect(() => buildCli(Root)).toThrow(/would be stored as "dryRun", like option "dry" of Root/);
  });

  it('leaves clashes between ordinary options alone', () => {
    @Command()
    class Leaf {
      @Option.string({ short: 'x' })
      x: string | undefined;

      run(): void {}
    }

    @Command({ use: [client], commands: [Leaf] })
    class Root {
      @Option.string({ short: 'x' })
      x: string | undefined;
    }

    expect(() => buildCli(Root)).not.toThrow();
  });
});
