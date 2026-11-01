import {
  Argument as CommanderArgument,
  Command as CommanderCommand,
  CommanderError,
  Option as CommanderOption,
} from 'commander';
import { processIO } from './io.js';
import { argumentSyntax } from './naming.js';
import { numberParser } from './parsers.js';
import type {
  ArgumentDefinition,
  BuildCliOptions,
  Cli,
  CliIO,
  CommandClass,
  CommandDefinition,
  OptionDefinition,
  RunMethod,
} from './types.js';

interface RunState {
  argv: readonly string[];
  exitCode: number | undefined;
  started: boolean;
}

/** A command definition wired to its commander command, able to produce a populated instance. */
interface Binding {
  readonly definition: CommandDefinition;
  readonly command: CommanderCommand;
  readonly options: readonly CommanderOption[];
}

/**
 * Creates the `buildCli` function for one `describeCommand`. The builder
 * translates a CommandDefinition tree into a commander program whose actions
 * instantiate the decorated classes, assign the parsed values to their fields
 * and call `run()`.
 */
export function createBuildCli(
  describeCommand: (target: CommandClass) => CommandDefinition,
): (target: CommandClass, options?: BuildCliOptions) => Cli {
  return (target, options = {}) => {
    const io = options.io ?? processIO;
    const definition = describeCommand(target);
    const state: RunState = { argv: [], exitCode: undefined, started: false };

    // exitOverride and configureOutput are set before subcommands exist so they inherit them.
    const program = new CommanderCommand(definition.name)
      .configureOutput({ writeOut: io.stdout, writeErr: io.stderr })
      .exitOverride();

    configure(program, definition, [], { io, state });

    return Object.freeze({
      definition,
      program,
      async run(argv: readonly string[]): Promise<number> {
        if (state.started) {
          throw new Error('A built CLI can only be run once. Call buildCli() again to run it again.');
        }
        state.started = true;
        state.argv = argv;

        try {
          await program.parseAsync(argv, { from: 'user' });
          return state.exitCode ?? 0;
        } catch (error: unknown) {
          // Commander has already written its own message, or the help/version text.
          if (error instanceof CommanderError) return error.exitCode;

          io.stderr(`error: ${error instanceof Error ? error.message : String(error)}\n`);
          return 1;
        }
      },
    });
  };
}

interface BuildEnvironment {
  readonly io: CliIO;
  readonly state: RunState;
}

function configure(
  command: CommanderCommand,
  definition: CommandDefinition,
  lineage: readonly Binding[],
  env: BuildEnvironment,
): void {
  if (definition.description !== undefined) command.description(definition.description);
  if (definition.version !== undefined) command.version(definition.version);
  if (definition.aliases.length > 0) command.aliases([...definition.aliases]);

  const options = definition.options.map((option) => {
    const built = buildOption(option);
    command.addOption(built);
    return built;
  });

  for (const argument of definition.arguments) {
    command.addArgument(buildArgument(argument));
  }

  const binding: Binding = { definition, command, options };

  for (const subcommand of definition.commands) {
    const child = command.command(subcommand.name, { hidden: subcommand.hidden });
    configure(child, subcommand, [...lineage, binding], env);
  }

  if (!definition.runnable) return;

  command.action(async () => {
    const ancestors = lineage.map(populate);
    const instance = populate(binding) as { run?: RunMethod };
    const root = ancestors[0] ?? instance;

    // `runnable` guarantees run() exists; the cast types it as optional.
    const result = await instance.run?.({ io: env.io, argv: env.state.argv, root, ancestors, command });
    if (typeof result === 'number') env.state.exitCode = result;
  });
}

function buildOption(definition: OptionDefinition): CommanderOption {
  const { metadata } = definition;
  const option = new CommanderOption(definition.flags, metadata.description);

  if (metadata.default !== undefined) option.default(metadata.default);
  if (metadata.env !== undefined) option.env(metadata.env);
  if (metadata.required === true) option.makeOptionMandatory();
  if (metadata.hidden === true) option.hideHelp();

  switch (metadata.type) {
    case 'choice':
      option.choices([...metadata.choices]);
      break;
    case 'number':
      option.argParser(numberParser(metadata));
      break;
    case 'string':
    case 'boolean':
      break;
  }

  return option;
}

function buildArgument(definition: ArgumentDefinition): CommanderArgument {
  const { metadata } = definition;
  const argument = new CommanderArgument(
    argumentSyntax(definition.name, definition.required, definition.variadic),
    metadata.description,
  );

  switch (metadata.type) {
    case 'choice':
      argument.choices([...metadata.choices]);
      if (metadata.default !== undefined) argument.default(metadata.default);
      break;
    case 'number':
      argument.argParser(numberParser(metadata));
      if (metadata.default !== undefined) argument.default(metadata.default);
      break;
    case 'string':
      if (metadata.default !== undefined) argument.default(metadata.default);
      break;
    case 'list':
      break;
  }

  return argument;
}

/**
 * Instantiates the command class and assigns parsed values to its decorated
 * fields. Undefined values are skipped so a field initializer acts as a
 * fallback.
 */
function populate(binding: Binding): object {
  const { definition, command, options } = binding;
  const instance = new definition.target() as unknown as Record<string, unknown>;
  const values = command.opts();

  definition.options.forEach((option, index) => {
    const built = options[index];
    if (built === undefined) return;
    const value = values[built.attributeName()];
    if (value !== undefined) instance[option.propertyName] = value;
  });

  definition.arguments.forEach((argument, index) => {
    const value: unknown = command.processedArgs[index];
    if (value !== undefined) instance[argument.propertyName] = value;
  });

  return instance;
}
