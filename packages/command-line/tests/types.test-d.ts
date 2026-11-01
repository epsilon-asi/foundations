import { describe, expectTypeOf, it } from 'vitest';
import { AgentEngineer } from '../examples/agent-engineer/cli.js';
import {
  Argument,
  Command,
  Option,
  describeCommand,
  runCli,
  runMain,
  type CliCommand,
  type CliInfo,
  type CommandContext,
  type Logger,
  type LogLevel,
} from '../src/index.js';

// The decorators check the type of the field they are applied to. These tests
// pin down what they accept and reject; the @ts-expect-error lines fail the
// run if a rejection ever stops happening.

const FORMATS = ['text', 'json'] as const;

describe('@Option field types', () => {
  it('requires undefined in the field type unless a value is guaranteed', () => {
    class Options {
      @Option.string()
      maybe: string | undefined;

      @Option.string({ default: 'x' })
      defaulted!: string;

      @Option.string({ required: true })
      mandatory!: string;

      // @ts-expect-error no default and not required, so the field may be undefined
      @Option.string()
      bare!: string;

      @Option.number({ default: 1 })
      count!: number;

      // @ts-expect-error a number option cannot populate a string field
      @Option.number()
      wrongType: string | undefined;

      @Option.boolean({ default: false })
      flag!: boolean;

      // @ts-expect-error a boolean flag is undefined when absent unless defaulted
      @Option.boolean()
      bareFlag!: boolean;

      run(): void {}
    }

    expectTypeOf<Options>().toHaveProperty('maybe');
  });

  it('narrows choice options to the declared choices', () => {
    class Choices {
      @Option.choice({ choices: FORMATS, default: 'text' })
      format!: 'text' | 'json';

      @Option.choice({ choices: FORMATS })
      optional: 'text' | 'json' | undefined;

      // @ts-expect-error string is wider than the choices
      @Option.choice({ choices: FORMATS, default: 'text' })
      wide!: string;

      // @ts-expect-error the default must be one of the choices
      @Option.choice({ choices: FORMATS, default: 'xml' })
      badDefault!: 'text' | 'json';

      run(): void {}
    }

    expectTypeOf<Choices>().toHaveProperty('format');
  });
});

describe('@Argument field types', () => {
  it('is required by default', () => {
    class Arguments {
      @Argument.string()
      source!: string;

      @Argument.string({ required: false })
      maybe: string | undefined;

      @Argument.string({ required: false, default: 'out' })
      defaulted!: string;

      // @ts-expect-error optional without a default may be undefined
      @Argument.string({ required: false })
      bare!: string;

      @Argument.number()
      count!: number;

      @Argument.choice({ choices: FORMATS })
      format!: 'text' | 'json';

      @Argument.list()
      rest!: string[];

      // @ts-expect-error a list fills a string[]
      @Argument.list()
      notAList!: string;

      run(): void {}
    }

    expectTypeOf<Arguments>().toHaveProperty('source');
  });
});

describe('@Command contract', () => {
  it('checks run() signatures and subcommand constructors', () => {
    @Command()
    class Fine implements CliCommand {
      run(): number {
        return 0;
      }
    }

    // @ts-expect-error run() must return an exit code or nothing
    @Command()
    class BadRun {
      run(): string {
        return 'no';
      }
    }

    class NeedsArguments {
      public constructor(public readonly value: string) {}
      run(): void {}
    }

    // @ts-expect-error subcommands must be constructible without arguments
    @Command({ commands: [NeedsArguments] })
    class BadChildren {}

    @Command({ commands: [Fine] })
    class Root {}

    expectTypeOf(describeCommand(Root).name).toEqualTypeOf<string>();
    expectTypeOf(runCli(Root, [])).toEqualTypeOf<Promise<number>>();
    expectTypeOf(runMain(Root)).toEqualTypeOf<Promise<number>>();

    // @ts-expect-error the root must be constructible without arguments
    void runCli(NeedsArguments, []);

    void BadRun;
    void BadChildren;
  });

  it('types package and logging metadata', () => {
    @Command({ package: import.meta.url, logging: { level: 'warn', flags: false } })
    class Configured implements CliCommand {
      run(): void {}
    }

    @Command({ package: new URL(import.meta.url), logging: false })
    class Disabled implements CliCommand {
      run(): void {}
    }

    // @ts-expect-error the level must be a LogLevel
    @Command({ logging: { level: 'loud' } })
    class BadLevel implements CliCommand {
      run(): void {}
    }

    void Configured;
    void Disabled;
    void BadLevel;
  });

  it('types the root, logger and cli on the command context', () => {
    class Child implements CliCommand<AgentEngineer> {
      run({ root, ancestors, logLevel, logger, cli }: CommandContext<AgentEngineer>): void {
        expectTypeOf(root).toEqualTypeOf<AgentEngineer>();
        expectTypeOf(ancestors).toEqualTypeOf<readonly object[]>();
        expectTypeOf(logLevel).toEqualTypeOf<LogLevel>();
        expectTypeOf(logger).toEqualTypeOf<Logger>();
        expectTypeOf(cli).toEqualTypeOf<CliInfo>();
        expectTypeOf(cli.version).toEqualTypeOf<string | undefined>();

        // @ts-expect-error unknown property on the root
        void root.nope;
      }
    }

    expectTypeOf<Child>().toHaveProperty('run');
  });
});
