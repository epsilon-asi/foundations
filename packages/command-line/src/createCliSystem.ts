import { createDecoratorRegistry } from '@epsilon-asi/foundation';
import { createDescribeCommand } from './describe.js';
import { createBuildCli } from './program.js';
import type {
  ArgumentDecoratorApi,
  ArgumentMetadata,
  BooleanOptionMetadata,
  ChoiceArgumentMetadata,
  ChoiceOptionMetadata,
  CliDecoratorSchema,
  CliSystem,
  CommandClass,
  CommandDecorator,
  CommandMetadata,
  CommandRecordMetadata,
  CreateCliSystemOptions,
  FieldDecorator,
  ListArgumentMetadata,
  NumberArgumentMetadata,
  NumberOptionMetadata,
  OptionDecoratorApi,
  OptionMetadata,
  Spec,
  StringArgumentMetadata,
  StringOptionMetadata,
} from './types.js';

/**
 * Creates an isolated CLI system: its own decorator registry plus the
 * decorators and builders bound to it. Most applications use the default
 * instance exported from this module; create your own to keep registries
 * separate.
 */
export function createCliSystem(options: CreateCliSystemOptions = {}): CliSystem {
  const registry = createDecoratorRegistry<CliDecoratorSchema>({
    namespace: options.namespace ?? 'cli',
  });

  // Subcommand classes are kept out of the registry because it deep-freezes
  // metadata, which would freeze the classes themselves.
  const subcommands = new WeakMap<Function, readonly CommandClass[]>();

  // The run() signature is checked by CommandDecorator's types, so the
  // registry contract is just "a class".
  const RawCommand = registry.for<object>().class('command');

  const Command: CommandDecorator = (metadata: CommandMetadata = {}) => {
    const { commands, package: packageFrom, ...rest } = metadata;
    // The registry deep-clones metadata, which would hollow out a URL; keep its string form.
    const record: CommandRecordMetadata =
      packageFrom === undefined ? rest : { ...rest, package: packageFrom instanceof URL ? packageFrom.href : packageFrom };
    const decorate = RawCommand(record);

    return <TClass extends new (...args: any[]) => object>(
      value: TClass,
      context: ClassDecoratorContext<TClass>,
    ): void => {
      decorate(value, context);
      subcommands.set(value, Object.freeze([...(commands ?? [])]));
    };
  };

  // Broad contract: the typed helpers below enforce the actual field types.
  const Scoped = registry.for<Record<string, unknown>>();
  const RawOption = Scoped.property('option');
  const RawArgument = Scoped.property('argument');

  const option = (metadata: OptionMetadata): FieldDecorator<unknown> => RawOption(metadata);
  const argument = (metadata: ArgumentMetadata): FieldDecorator<unknown> => RawArgument(metadata);

  const Option = option as unknown as OptionDecoratorApi;
  Option.string = ((metadata: Spec<StringOptionMetadata> = {}) =>
    option({ ...metadata, type: 'string' })) as unknown as OptionDecoratorApi['string'];
  Option.number = ((metadata: Spec<NumberOptionMetadata> = {}) =>
    option({ ...metadata, type: 'number' })) as unknown as OptionDecoratorApi['number'];
  Option.boolean = ((metadata: Spec<BooleanOptionMetadata> = {}) =>
    option({ ...metadata, type: 'boolean' })) as unknown as OptionDecoratorApi['boolean'];
  Option.choice = ((metadata: Spec<ChoiceOptionMetadata>) =>
    option({ ...metadata, type: 'choice' })) as unknown as OptionDecoratorApi['choice'];

  const Argument = argument as unknown as ArgumentDecoratorApi;
  Argument.string = ((metadata: Spec<StringArgumentMetadata> = {}) =>
    argument({ ...metadata, type: 'string' })) as unknown as ArgumentDecoratorApi['string'];
  Argument.number = ((metadata: Spec<NumberArgumentMetadata> = {}) =>
    argument({ ...metadata, type: 'number' })) as unknown as ArgumentDecoratorApi['number'];
  Argument.choice = ((metadata: Spec<ChoiceArgumentMetadata>) =>
    argument({ ...metadata, type: 'choice' })) as unknown as ArgumentDecoratorApi['choice'];
  Argument.list = ((metadata: Spec<ListArgumentMetadata> = {}) =>
    argument({ ...metadata, type: 'list' })) as unknown as ArgumentDecoratorApi['list'];

  const describeCommand = createDescribeCommand(registry, subcommands);
  const buildCli = createBuildCli(describeCommand);

  const system: CliSystem = {
    registry,
    Command,
    Option,
    Argument,
    describeCommand,
    buildCli,
    runCli: (target, argv, buildOptions) => buildCli(target, buildOptions).run(argv),
    runMain: async (target, buildOptions) => {
      const exitCode = await buildCli(target, buildOptions).run(process.argv.slice(2));
      process.exitCode = exitCode;
      return exitCode;
    },
  };

  return Object.freeze(system);
}

const defaultCliSystem = createCliSystem();

export const cliRegistry = defaultCliSystem.registry;
export const Command = defaultCliSystem.Command;
export const Option = defaultCliSystem.Option;
export const Argument = defaultCliSystem.Argument;
export const describeCommand = defaultCliSystem.describeCommand;
export const buildCli = defaultCliSystem.buildCli;
export const runCli = defaultCliSystem.runCli;
export const runMain = defaultCliSystem.runMain;
