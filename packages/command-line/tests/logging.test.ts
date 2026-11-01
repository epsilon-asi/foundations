import { describe, expect, it, vi } from 'vitest';
import {
  Command,
  DEFAULT_LOG_LEVEL_DESCRIPTION,
  LOG_LEVELS,
  Option,
  buildCli,
  createLogger,
  describeCommand,
  isLogLevel,
  logLevelEnvName,
  runCli,
  type CliCommand,
  type CommandContext,
  type Logger,
  type LoggerOptions,
  type LogLevel,
} from '../src/index.js';
import { captureIO } from './helpers/captureIO.js';

describe('createLogger', () => {
  it('writes messages at or above its level as [level] lines', () => {
    const lines: string[] = [];
    const logger = createLogger('warn', (text) => void lines.push(text));

    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e');

    expect(logger.level).toBe('warn');
    expect(lines).toEqual(['[warn] w\n', '[error] e\n']);
  });

  it('writes nothing when silent', () => {
    const write = vi.fn();
    const logger = createLogger('silent', write);

    logger.error('nope');

    expect(write).not.toHaveBeenCalled();
  });

  it('is frozen', () => {
    expect(Object.isFrozen(createLogger('info', () => {}))).toBe(true);
  });
});

describe('log level helpers', () => {
  it('lists the levels least to most severe', () => {
    expect(LOG_LEVELS).toEqual(['debug', 'info', 'warn', 'error', 'silent']);
  });

  it('recognises levels', () => {
    expect(isLogLevel('debug')).toBe(true);
    expect(isLogLevel('loud')).toBe(false);
    expect(isLogLevel(undefined)).toBe(false);
  });

  it('derives the environment variable from the CLI name', () => {
    expect(logLevelEnvName('agent-engineer')).toBe('AGENT_ENGINEER_LOG_LEVEL');
    expect(logLevelEnvName('my tool')).toBe('MY_TOOL_LOG_LEVEL');
  });
});

describe('the built-in log level option', () => {
  it('is added to the root with a default of info and a derived environment variable', async () => {
    const seen: string[] = [];

    @Command({ name: 'my-tool' })
    class Tool implements CliCommand {
      run({ logLevel, logger }: CommandContext): void {
        seen.push(logLevel);
        logger.info('shown');
        logger.debug('hidden');
      }
    }

    expect(describeCommand(Tool).logging).toEqual({
      level: 'info',
      flags: '-l, --log-level <level>',
      env: 'MY_TOOL_LOG_LEVEL',
      description: DEFAULT_LOG_LEVEL_DESCRIPTION,
      hidden: false,
    });

    const { io, stderr } = captureIO();
    await expect(runCli(Tool, [], { io })).resolves.toBe(0);
    expect(seen).toEqual(['info']);
    expect(stderr()).toBe('[info] shown\n');
  });

  it('reads the flag, then the environment variable, then the default', async () => {
    const seen: LogLevel[] = [];

    @Command({ name: 'tool' })
    class Tool implements CliCommand {
      run({ logLevel }: CommandContext): void {
        seen.push(logLevel);
      }
    }

    const { io } = captureIO();
    await runCli(Tool, [], { io });
    vi.stubEnv('TOOL_LOG_LEVEL', 'error');
    await runCli(Tool, [], { io });
    await runCli(Tool, ['-l', 'silent'], { io });

    expect(seen).toEqual(['info', 'error', 'silent']);
  });

  it('rejects a level outside the choices', async () => {
    @Command()
    class Tool implements CliCommand {
      run(): void {}
    }

    const { io, stderr } = captureIO();
    await expect(runCli(Tool, ['--log-level', 'loud'], { io })).resolves.toBe(1);
    expect(stderr()).toContain('Allowed choices are debug, info, warn, error, silent');
  });

  it('lists the option after the root options in help', async () => {
    @Command()
    class Tool implements CliCommand {
      @Option.boolean({ description: 'be careful' })
      dryRun: boolean | undefined;

      run(): void {}
    }

    const { io, stdout } = captureIO();
    await runCli(Tool, ['--help'], { io });

    const dryRun = stdout().indexOf('--dry-run');
    const logLevel = stdout().indexOf('--log-level');
    const help = stdout().indexOf('--help');
    expect(dryRun).toBeGreaterThan(-1);
    expect(logLevel).toBeGreaterThan(dryRun);
    expect(help).toBeGreaterThan(logLevel);
  });

  it('lives on the root but is accepted after a subcommand too', async () => {
    let seen: LogLevel | undefined;

    @Command()
    class Child implements CliCommand {
      run({ logLevel }: CommandContext): void {
        seen = logLevel;
      }
    }
    @Command({ commands: [Child] })
    class Root {}

    expect(describeCommand(Root).commands[0]?.logging).toBeUndefined();

    const { io } = captureIO();
    await expect(runCli(Root, ['child', '--log-level', 'debug'], { io })).resolves.toBe(0);
    expect(seen).toBe('debug');
  });
});

describe('@Command({ logging })', () => {
  it('overrides the level, flags, environment variable, description and visibility', async () => {
    const seen: LogLevel[] = [];

    @Command({
      name: 'tool',
      logging: { level: 'warn', flags: '-v, --verbosity <v>', env: 'TOOL_VERBOSITY', description: 'how chatty', hidden: true },
    })
    class Tool implements CliCommand {
      run({ logLevel }: CommandContext): void {
        seen.push(logLevel);
      }
    }

    expect(describeCommand(Tool).logging).toEqual({
      level: 'warn',
      flags: '-v, --verbosity <v>',
      env: 'TOOL_VERBOSITY',
      description: 'how chatty',
      hidden: true,
    });

    const { io, stdout } = captureIO();
    await runCli(Tool, [], { io });
    await runCli(Tool, ['-v', 'debug'], { io });
    vi.stubEnv('TOOL_VERBOSITY', 'error');
    await runCli(Tool, [], { io });
    await runCli(Tool, ['--help'], { io });

    expect(seen).toEqual(['warn', 'debug', 'error']);
    expect(stdout()).not.toContain('--verbosity');
    expect(stdout()).not.toContain('--log-level');
  });

  it('removes the option and fixes the level with flags: false', async () => {
    const seen: LogLevel[] = [];

    @Command({ logging: { flags: false, level: 'debug' } })
    class Tool implements CliCommand {
      run({ logLevel, logger }: CommandContext): void {
        seen.push(logLevel);
        logger.debug('on');
      }
    }

    expect(describeCommand(Tool).logging).toEqual({
      level: 'debug',
      flags: undefined,
      env: undefined,
      description: DEFAULT_LOG_LEVEL_DESCRIPTION,
      hidden: false,
    });

    const { io, stderr } = captureIO();
    await expect(runCli(Tool, [], { io })).resolves.toBe(0);
    await expect(runCli(Tool, ['--log-level', 'info'], { io })).resolves.toBe(1);
    expect(seen).toEqual(['debug']);
    expect(stderr()).toContain('[debug] on\n');
    expect(stderr()).toContain("unknown option '--log-level'");
  });

  it('removes the option and the environment variable with logging: false', async () => {
    let seen: LogLevel | undefined;

    @Command({ name: 'tool', logging: false })
    class Tool implements CliCommand {
      run({ logLevel }: CommandContext): void {
        seen = logLevel;
      }
    }

    vi.stubEnv('TOOL_LOG_LEVEL', 'debug');
    const { io } = captureIO();
    await expect(runCli(Tool, [], { io })).resolves.toBe(0);
    expect(seen).toBe('info');
    expect(describeCommand(Tool).logging?.flags).toBeUndefined();
  });

  it('rejects an environment variable without the option', () => {
    @Command({ logging: { flags: false, env: 'TOOL_LOG_LEVEL' } })
    class Tool implements CliCommand {
      run(): void {}
    }

    expect(() => describeCommand(Tool)).toThrow(/Tool: logging\.env needs the log level option/);
  });

  it('rejects an unknown level', () => {
    @Command({ logging: { level: 'loud' as LogLevel } })
    class Tool implements CliCommand {
      run(): void {}
    }

    expect(() => describeCommand(Tool)).toThrow(/logging\.level "loud" is not one of debug, info, warn, error, silent/);
  });

  it('rejects logging on a subcommand', () => {
    @Command({ logging: { level: 'debug' } })
    class Child implements CliCommand {
      run(): void {}
    }
    @Command({ commands: [Child] })
    class Root {}

    expect(() => describeCommand(Root)).toThrow(/Child: "logging" can only be set on the root command/);
  });

  it('rejects a root option that reuses the long flag', () => {
    @Command()
    class Tool implements CliCommand {
      @Option.string()
      logLevel: string | undefined;

      run(): void {}
    }

    expect(() => describeCommand(Tool)).toThrow(
      /Tool: option "logLevel" uses --log-level, which the built-in log level option already uses/,
    );
  });

  it('rejects a root option that reuses the short flag', () => {
    @Command()
    class Tool implements CliCommand {
      @Option.boolean({ short: 'l' })
      list: boolean | undefined;

      run(): void {}
    }

    expect(() => describeCommand(Tool)).toThrow(/option "list" uses -l, which the built-in log level option/);
  });

  it('allows the flags once the built-in option is removed', async () => {
    let seen: string | undefined;

    @Command({ logging: false })
    class Tool implements CliCommand {
      @Option.string({ short: 'l' })
      logLevel: string | undefined;

      run(): void {
        seen = this.logLevel;
      }
    }

    await expect(runCli(Tool, ['-l', 'mine'], { io: captureIO().io })).resolves.toBe(0);
    expect(seen).toBe('mine');
  });
});

describe('buildCli({ logger })', () => {
  it('replaces the logger for every command', async () => {
    const received: LoggerOptions[] = [];
    const lines: string[] = [];
    const custom: Logger = Object.freeze({
      level: 'debug' as const,
      debug: (message: string) => void lines.push(`D ${message}`),
      info: (message: string) => void lines.push(`I ${message}`),
      warn: () => {},
      error: () => {},
    });

    @Command()
    class Child implements CliCommand {
      run({ logger }: CommandContext): void {
        logger.debug('from child');
      }
    }
    @Command({ name: 'tool', commands: [Child] })
    class Root implements CliCommand {
      run({ logger }: CommandContext): void {
        logger.info('from root');
      }
    }

    const { io, stderr } = captureIO();
    const logger = (options: LoggerOptions): Logger => {
      received.push(options);
      return custom;
    };

    await runCli(Root, ['-l', 'error'], { io, logger });
    await runCli(Root, ['child'], { io, logger });

    expect(lines).toEqual(['I from root', 'D from child']);
    expect(stderr()).toBe('');
    expect(received.map((options) => [options.name, options.level, options.io === io])).toEqual([
      ['tool', 'error', true],
      ['tool', 'info', true],
    ]);
  });

  it('builds the logger once per run', async () => {
    const logger = vi.fn(() => createLogger('info', () => {}));

    @Command()
    class Tool implements CliCommand {
      run(): void {}
    }

    const cli = buildCli(Tool, { io: captureIO().io, logger });
    await cli.run([]);
    expect(logger).toHaveBeenCalledTimes(1);
  });
});
