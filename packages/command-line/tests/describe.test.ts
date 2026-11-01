import { describe, expect, it } from 'vitest';
import {
  Argument,
  CliDefinitionError,
  Command,
  Option,
  createCliSystem,
  describeCommand,
} from '../src/index.js';

describe('describeCommand', () => {
  it('derives the command name from the class name', () => {
    @Command()
    class SyncReposCommand {
      run(): void {}
    }
    @Command()
    class AgentEngineerCli {
      run(): void {}
    }
    @Command({ name: 'custom' })
    class Whatever {
      run(): void {}
    }

    expect(describeCommand(SyncReposCommand).name).toBe('sync-repos');
    expect(describeCommand(AgentEngineerCli).name).toBe('agent-engineer');
    expect(describeCommand(Whatever).name).toBe('custom');
  });

  it('derives option flags from property names unless flags are given', () => {
    @Command()
    class Flags {
      @Option.string()
      outputDir: string | undefined;

      @Option.string({ short: 'n', valueName: 'count' })
      retries: string | undefined;

      @Option.boolean()
      dryRun: boolean | undefined;

      @Option.string({ flags: '--custom <c>' })
      ignored: string | undefined;

      run(): void {}
    }

    expect(describeCommand(Flags).options.map((option) => [option.propertyName, option.flags])).toEqual([
      ['outputDir', '--output-dir <output-dir>'],
      ['retries', '-n, --retries <count>'],
      ['dryRun', '--dry-run'],
      ['ignored', '--custom <c>'],
    ]);
  });

  it('makes arguments required unless they have a default or say otherwise', () => {
    @Command()
    class Args {
      @Argument.string()
      source!: string;

      @Argument.string({ default: 'out' })
      destination!: string;

      @Argument.number({ required: false })
      limit: number | undefined;

      @Argument.list({ name: 'extra' })
      rest!: string[];

      run(): void {}
    }

    expect(
      describeCommand(Args).arguments.map((argument) => [argument.name, argument.required, argument.variadic]),
    ).toEqual([
      ['source', true, false],
      ['destination', false, false],
      ['limit', false, false],
      ['extra', true, true],
    ]);
  });

  it('inherits options from base classes but not @Command itself', () => {
    abstract class WithVerbose {
      @Option.boolean({ default: false })
      verbose!: boolean;
    }

    @Command()
    class Child extends WithVerbose {
      @Option.string()
      name: string | undefined;

      run(): void {}
    }

    class Grandchild extends Child {}

    expect(describeCommand(Child).options.map((option) => option.propertyName)).toEqual(['verbose', 'name']);
    expect(() => describeCommand(Grandchild)).toThrow(/Grandchild: is not decorated with @Command/);
  });

  it('resolves subcommand trees', () => {
    @Command({ aliases: ['ls'], description: 'List things.' })
    class ListCommand {
      run(): void {}
    }
    @Command({ hidden: true })
    class SecretCommand {
      run(): void {}
    }
    @Command({ name: 'root', version: '1.2.3', commands: [ListCommand, SecretCommand] })
    class Root {}

    const definition = describeCommand(Root);

    expect(definition.runnable).toBe(false);
    expect(definition.version).toBe('1.2.3');
    expect(definition.commands.map((command) => [command.name, command.aliases, command.hidden, command.runnable])).toEqual([
      ['list', ['ls'], false, true],
      ['secret', [], true, true],
    ]);
    expect(definition.commands[0]?.description).toBe('List things.');
  });

  it('returns frozen definitions', () => {
    @Command()
    class Frozen {
      @Option.string()
      value: string | undefined;

      run(): void {}
    }

    const definition = describeCommand(Frozen);

    expect(Object.isFrozen(definition)).toBe(true);
    expect(Object.isFrozen(definition.options)).toBe(true);
    expect(Object.isFrozen(definition.options[0])).toBe(true);
  });
});

describe('describeCommand definition errors', () => {
  it('rejects a class without @Command', () => {
    class Plain {
      run(): void {}
    }

    expect(() => describeCommand(Plain)).toThrow(CliDefinitionError);
    expect(() => describeCommand(Plain)).toThrow('Plain: is not decorated with @Command.');
  });

  it('rejects an anonymous class without an explicit name', () => {
    const Anonymous = (() =>
      (
        @Command()
        class {
          run(): void {}
        }
      ))();

    expect(() => describeCommand(Anonymous)).toThrow(/<anonymous class>: needs a name/);
  });

  it('rejects a property decorated twice', () => {
    @Command()
    class Twice {
      @Option.string({ default: 'x' })
      @Argument.string()
      value!: string;

      run(): void {}
    }

    expect(() => describeCommand(Twice)).toThrow(/property "value" is decorated more than once/);
  });

  it('rejects static properties', () => {
    @Command()
    class Static {
      @Option.string()
      static value: string | undefined;

      run(): void {}
    }

    expect(() => describeCommand(Static)).toThrow(/@Option property "value" must not be static/);
  });

  it('rejects a short flag longer than one character', () => {
    @Command()
    class Short {
      @Option.string({ short: 'ab' })
      value: string | undefined;

      run(): void {}
    }

    expect(() => describeCommand(Short)).toThrow(/short flag "ab"; it must be a single letter or digit/);
  });

  it('rejects a list argument that is not last', () => {
    @Command()
    class ListFirst {
      @Argument.list()
      files!: string[];

      @Argument.string()
      destination!: string;

      run(): void {}
    }

    expect(() => describeCommand(ListFirst)).toThrow(/list argument "files" must be the last argument/);
  });

  it('rejects sibling commands that share a name or alias', () => {
    @Command({ name: 'dup' })
    class First {
      run(): void {}
    }
    @Command({ name: 'other', aliases: ['dup'] })
    class Second {
      run(): void {}
    }
    @Command({ commands: [First, Second] })
    class Root {}

    expect(() => describeCommand(Root)).toThrow(/Root: subcommands First and Second both answer to "dup"/);
  });

  it('rejects a command with nothing to do', () => {
    @Command()
    class Empty {}

    expect(() => describeCommand(Empty)).toThrow(/Empty: has neither a run\(\) method nor subcommands/);
  });

  it('surfaces errors from subcommands with the subcommand named', () => {
    @Command()
    class Broken {
      @Option.string({ short: 'xx' })
      value: string | undefined;

      run(): void {}
    }
    @Command({ commands: [Broken] })
    class Root {}

    expect(() => describeCommand(Root)).toThrow(/^Broken: /);
  });
});

describe('createCliSystem', () => {
  it('keeps registries isolated', () => {
    const other = createCliSystem({ namespace: 'other' });

    @other.Command()
    class Elsewhere {
      run(): void {}
    }

    expect(other.describeCommand(Elsewhere).name).toBe('elsewhere');
    expect(() => describeCommand(Elsewhere)).toThrow(/is not decorated with @Command/);
    expect(other.registry.namespace).toBe('other');
  });
});
