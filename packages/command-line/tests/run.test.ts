import { describe, expect, it, vi } from 'vitest';
import { AgentEngineer } from '../examples/agent-engineer/cli.js';
import {
  Argument,
  Command,
  Option,
  buildCli,
  readPackageJson,
  runCli,
  scriptedPrompter,
  type RunnableCommand,
  type RuntimeInfo,
  type CommandContext,
} from '../src/index.js';
import { captureIO } from './helpers/captureIO.js';

// The example reads its version from the nearest package.json, which is this package's.
const PACKAGE_VERSION = readPackageJson(import.meta.url).version;

describe('runCli with the agent-engineer example', () => {
  it('prints the version read from package.json for --version', async () => {
    const { io, stdout } = captureIO();

    expect(PACKAGE_VERSION).toMatch(/^\d+\.\d+\.\d+/);
    await expect(runCli(AgentEngineer, ['--version'], { io })).resolves.toBe(0);
    expect(stdout()).toBe(`${PACKAGE_VERSION}\n`);
  });

  it('prints help listing the commands and the built-in log level option', async () => {
    const { io, stdout } = captureIO();

    await expect(runCli(AgentEngineer, ['--help'], { io })).resolves.toBe(0);
    expect(stdout()).toContain('Usage: agent-engineer');
    expect(stdout()).toContain('-l, --log-level <level>');
    expect(stdout()).toMatch(/choices:\s+"debug",\s+"info",\s+"warn",\s+"error",\s+"silent"/);
    expect(stdout()).toMatch(/default:\s+"info"/);
    expect(stdout()).toMatch(/env:\s+AGENT_ENGINEER_LOG_LEVEL/);
    expect(stdout()).toMatch(/info \[options\]\s+Print CLI and runtime information\./);
    expect(stdout()).toMatch(/greet \[options\] <name>/);
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
    expect(stdout()).toMatch(new RegExp(`^version\\s+${PACKAGE_VERSION?.replaceAll('.', '\\.')}$`, 'm'));
    expect(stderr()).toBe('');
  });

  it('runs info with --format json', async () => {
    const { io, stdout } = captureIO();

    await expect(runCli(AgentEngineer, ['info', '--format', 'json'], { io })).resolves.toBe(0);

    const info: RuntimeInfo = JSON.parse(stdout());
    expect(info).toEqual({
      name: 'agent-engineer',
      version: PACKAGE_VERSION,
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

  it('gives subcommands a logger at the level set on the root', async () => {
    const { io, stderr } = captureIO();

    await expect(runCli(AgentEngineer, ['--log-level', 'debug', 'info', '-f', 'json'], { io })).resolves.toBe(0);
    expect(stderr()).toBe('[debug] rendering info as json\n');
  });

  it('reads the log level from the environment variable derived from the name', async () => {
    vi.stubEnv('AGENT_ENGINEER_LOG_LEVEL', 'debug');
    const { io, stderr } = captureIO();

    await runCli(AgentEngineer, ['info'], { io });
    expect(stderr()).toContain('[debug]');
  });

  it('prefers the flag over the environment variable', async () => {
    vi.stubEnv('AGENT_ENGINEER_LOG_LEVEL', 'debug');
    const { io, stderr } = captureIO();

    await runCli(AgentEngineer, ['-l', 'error', 'info'], { io });
    expect(stderr()).toBe('');
  });

  it('rejects an invalid environment value', async () => {
    vi.stubEnv('AGENT_ENGINEER_LOG_LEVEL', 'loud');
    const { io, stderr } = captureIO();

    await expect(runCli(AgentEngineer, ['info'], { io })).resolves.toBe(1);
    expect(stderr()).toContain("from env 'AGENT_ENGINEER_LOG_LEVEL' is invalid");
  });

  it('populates arguments and typed options', async () => {
    const { io, stdout } = captureIO();

    await expect(runCli(AgentEngineer, ['greet', 'World', '-n', '2'], { io })).resolves.toBe(0);
    expect(stdout()).toBe('Hello, World!\nHello, World!\n');
  });

  it('populates boolean options', async () => {
    const { io, stdout } = captureIO();

    await expect(runCli(AgentEngineer, ['greet', 'World', '--loud'], { io })).resolves.toBe(0);
    expect(stdout()).toBe('HELLO, WORLD!\n');
  });

  it('fails when a required argument is missing', async () => {
    const { io, stderr } = captureIO();

    await expect(runCli(AgentEngineer, ['greet'], { io })).resolves.toBe(1);
    expect(stderr()).toContain("missing required argument 'name'");
  });

  it.each([
    ['abc', '"abc" is not a number.'],
    ['1.5', '"1.5" is not an integer.'],
    ['0', '0 is less than the minimum of 1.'],
  ])('rejects --times %s', async (value, message) => {
    const { io, stderr } = captureIO();

    await expect(runCli(AgentEngineer, ['greet', 'World', '-n', value], { io })).resolves.toBe(1);
    expect(stderr()).toContain(message);
  });

  it('asks configure for its settings, taking the API key from the environment when set', async () => {
    const prompter = scriptedPrompter([
      { select: 'us-east-1', message: 'Region' },
      { multiselect: ['worker', 'api'], message: 'Services to enable' },
      { secret: 'sk-12345678' },
      { confirm: true, message: 'Save settings for us-east-1?' },
    ]);
    const { io, stdout } = captureIO();

    await expect(runCli(AgentEngineer, ['configure', '-f', 'json'], { io, prompter })).resolves.toBe(0);
    expect(JSON.parse(stdout())).toEqual({ region: 'us-east-1', services: 'api, worker', apiKey: '…5678' });

    vi.stubEnv('AGENT_ENGINEER_API_KEY', 'sk-from-env');
    const quiet = captureIO();
    const answers = scriptedPrompter([{ select: 'eu-west-1' }, { multiselect: ['scheduler'] }]);
    await expect(runCli(AgentEngineer, ['configure', '--yes', '-f', 'json'], { io: quiet.io, prompter: answers })).resolves.toBe(0);
    expect(JSON.parse(quiet.stdout())).toEqual({ region: 'eu-west-1', services: 'scheduler', apiKey: '…-env' });
  });

  it('stops configure when the settings are not confirmed', async () => {
    const prompter = scriptedPrompter([{ select: 'eu-west-1' }, { multiselect: ['api'] }, { secret: 'sk-1' }, { confirm: false }]);
    const { io, stdout } = captureIO();

    await expect(runCli(AgentEngineer, ['configure'], { io, prompter })).resolves.toBe(1);
    expect(stdout()).toBe('');
  });

  it('fails configure without a terminal, naming the question', async () => {
    const { io, stderr } = captureIO();

    await expect(runCli(AgentEngineer, ['configure'], { io })).resolves.toBe(1);
    expect(stderr()).toBe('error: cannot ask "API key": there is no terminal to ask on.\n');
  });

  it('takes a note in the editor', async () => {
    const prompter = scriptedPrompter([{ editor: 'Remember the milk.\n# Write your note above.\n' }]);
    const { io, stdout } = captureIO();

    await expect(runCli(AgentEngineer, ['note'], { io, prompter })).resolves.toBe(0);
    expect(stdout()).toBe('note      Remember the milk.\n');
  });
});

describe('runCli behaviours', () => {
  it('passes the root and ancestors to nested commands', async () => {
    const seen: string[] = [];

    @Command()
    class LeafCommand implements RunnableCommand<Root> {
      run({ root, ancestors }: CommandContext<Root>): void {
        seen.push(root.region, ...ancestors.map((ancestor) => ancestor.constructor.name));
        const group = ancestors[1] as GroupCommand;
        seen.push(group.team);
      }
    }
    @Command({ commands: [LeafCommand] })
    class GroupCommand {
      @Option.string({ default: 'core' })
      team!: string;
    }
    @Command({ commands: [GroupCommand] })
    class Root {
      @Option.string({ default: 'eu' })
      region!: string;
    }

    const { io } = captureIO();
    await expect(runCli(Root, ['--region', 'us', 'group', '--team', 'infra', 'leaf'], { io })).resolves.toBe(0);
    expect(seen).toEqual(['us', 'Root', 'GroupCommand', 'infra']);
  });

  it('gives the root command itself as root', async () => {
    let sameInstance = false;

    @Command()
    class Single implements RunnableCommand<Single> {
      run({ root, ancestors }: CommandContext<Single>): void {
        sameInstance = root === this && ancestors.length === 0;
      }
    }

    await expect(runCli(Single, [], { io: captureIO().io })).resolves.toBe(0);
    expect(sameInstance).toBe(true);
  });

  it('describes the root on context.cli for every command', async () => {
    let seen: CommandContext['cli'] | undefined;

    @Command({ description: 'Child.' })
    class Child implements RunnableCommand {
      run({ cli }: CommandContext): void {
        seen = cli;
      }
    }
    @Command({ name: 'tool', version: '2.0.0', description: 'The tool.', commands: [Child] })
    class Root {}

    await runCli(Root, ['child'], { io: captureIO().io });
    expect(seen).toEqual({ name: 'tool', version: '2.0.0', description: 'The tool.', package: undefined });
    expect(Object.isFrozen(seen)).toBe(true);
  });

  it('runs a root that has both run() and subcommands', async () => {
    const calls: string[] = [];

    @Command()
    class Child implements RunnableCommand {
      run(): void {
        calls.push('child');
      }
    }
    @Command({ commands: [Child] })
    class Root implements RunnableCommand {
      run(): void {
        calls.push('root');
      }
    }

    const { io } = captureIO();
    await runCli(Root, [], { io });
    await runCli(Root, ['child'], { io });
    expect(calls).toEqual(['root', 'child']);
  });

  it('uses the exit code returned by run()', async () => {
    @Command()
    class Exit implements RunnableCommand {
      run(): number {
        return 3;
      }
    }

    await expect(runCli(Exit, [], { io: captureIO().io })).resolves.toBe(3);
  });

  it('reports errors thrown by run()', async () => {
    @Command()
    class Boom implements RunnableCommand {
      async run(): Promise<void> {
        throw new Error('boom');
      }
    }

    const { io, stderr } = captureIO();
    await expect(runCli(Boom, [], { io })).resolves.toBe(1);
    expect(stderr()).toBe('error: boom\n');
  });

  it('keeps a field initializer when no value is supplied', async () => {
    let seen: string | undefined;

    @Command()
    class Fallback implements RunnableCommand {
      @Option.string()
      name: string | undefined = 'fallback';

      run(): void {
        seen = this.name;
      }
    }

    await runCli(Fallback, [], { io: captureIO().io });
    expect(seen).toBe('fallback');
    await runCli(Fallback, ['--name', 'given'], { io: captureIO().io });
    expect(seen).toBe('given');
  });

  it('assigns custom flags to the decorated property', async () => {
    let seen: string | undefined;

    @Command()
    class Custom implements RunnableCommand {
      @Option.string({ flags: '--lvl <value>' })
      level: string | undefined;

      run(): void {
        seen = this.level;
      }
    }

    await runCli(Custom, ['--lvl', 'high'], { io: captureIO().io });
    expect(seen).toBe('high');
  });

  it('collects list arguments and fills argument defaults', async () => {
    const seen: unknown[] = [];

    @Command()
    class Copy implements RunnableCommand {
      @Argument.string()
      first!: string;

      @Argument.string({ default: 'out' })
      destination!: string;

      @Argument.list({ required: false })
      rest!: string[];

      run(): void {
        seen.push(this.first, this.destination, this.rest);
      }
    }

    await runCli(Copy, ['a'], { io: captureIO().io });
    await runCli(Copy, ['a', 'b', 'c', 'd'], { io: captureIO().io });
    expect(seen).toEqual(['a', 'out', [], 'a', 'b', ['c', 'd']]);
  });

  it('parses numeric and choice arguments', async () => {
    const seen: unknown[] = [];

    @Command()
    class Typed implements RunnableCommand {
      @Argument.number({ integer: true })
      count!: number;

      @Argument.choice({ choices: ['up', 'down'], default: 'up' })
      direction!: 'up' | 'down';

      run(): void {
        seen.push(this.count, this.direction);
      }
    }

    const { io, stderr } = captureIO();
    await expect(runCli(Typed, ['4', 'down'], { io })).resolves.toBe(0);
    await expect(runCli(Typed, ['4', 'sideways'], { io })).resolves.toBe(1);
    expect(seen).toEqual([4, 'down']);
    expect(stderr()).toContain('Allowed choices are up, down');
  });

  it('enforces required options', async () => {
    @Command()
    class Needs implements RunnableCommand {
      @Option.string({ required: true })
      token!: string;

      run(): void {}
    }

    const { io, stderr } = captureIO();
    await expect(runCli(Needs, [], { io })).resolves.toBe(1);
    expect(stderr()).toContain("required option '--token <token>' not specified");
  });

  it('exposes the raw argv and commander command on the context', async () => {
    let context: CommandContext | undefined;

    @Command()
    class Inspect implements RunnableCommand {
      @Argument.string({ required: false })
      thing: string | undefined;

      run(given: CommandContext): void {
        context = given;
      }
    }

    await runCli(Inspect, ['x'], { io: captureIO().io });
    expect(context?.argv).toEqual(['x']);
    expect(context?.command.name()).toBe('inspect');
  });

  it('refuses to run a built CLI twice', async () => {
    @Command()
    class Once implements RunnableCommand {
      run(): void {}
    }

    const cli = buildCli(Once, { io: captureIO().io });
    expect(cli.definition.name).toBe('once');
    await expect(cli.run([])).resolves.toBe(0);
    await expect(cli.run([])).rejects.toThrow(/only be run once/);
  });

  it('writes to the process streams by default', async () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    @Command({ version: '9.9.9' })
    class Default implements RunnableCommand {
      run(): void {}
    }

    await expect(runCli(Default, ['--version'])).resolves.toBe(0);
    expect(write).toHaveBeenCalledWith('9.9.9\n');
  });
});
