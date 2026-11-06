import {
  Argument as CommanderArgument,
  Command as CommanderCommand,
  CommanderError,
  Option as CommanderOption,
} from 'commander';
import { processIO } from './io.js';
import { createLiveOutput } from './liveLine.js';
import { DEFAULT_LOG_LEVEL, LOG_LEVELS, defaultLoggerFactory, isLogLevel } from './logging.js';
import { runChain } from './middleware/compose.js';
import { resolveMiddleware, type ResolvedCommand } from './middleware/resolve.js';
import type { AnyMiddleware } from './middleware/types.js';
import { argumentSyntax } from './naming.js';
import { numberParser } from './parsers.js';
import type {
  ArgumentDefinition,
  BuildCliOptions,
  Cli,
  CliIO,
  CliInfo,
  CommandClass,
  CommandDefinition,
  LiveOutput,
  LoggerFactory,
  LoggingDefinition,
  LogLevel,
  OptionDefinition,
  RunMethod,
} from './types.js';

interface RunState {
  argv: readonly string[];
  exitCode: number | undefined;
  started: boolean;
}

/** Where one middleware's flags were added, and the commander attribute of each, by the middleware's key. */
interface MiddlewareOptionSource {
  readonly command: CommanderCommand;
  readonly attributes: Readonly<Record<string, string>>;
}

type MiddlewareOptionSources = ReadonlyMap<AnyMiddleware, MiddlewareOptionSource>;

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
    // Everything is written through the live output, so a live line stays below it.
    const live = createLiveOutput(options.io ?? processIO);
    const { io } = live;
    const definition = describeCommand(target);
    const resolved = resolveMiddleware(definition, options.use ?? []);
    const state: RunState = { argv: [], exitCode: undefined, started: false };

    // exitOverride and configureOutput are set before subcommands exist so they inherit them.
    const program = new CommanderCommand(definition.name)
      .configureOutput({ writeOut: io.stdout, writeErr: io.stderr })
      .exitOverride();

    const env: BuildEnvironment = {
      io,
      live,
      state,
      cli: Object.freeze({
        name: definition.name,
        version: definition.version,
        description: definition.description,
        package: definition.package,
      }),
      loggerFactory: options.logger ?? defaultLoggerFactory,
      logLevel: () => DEFAULT_LOG_LEVEL,
      resolved,
    };

    configure(program, definition, [], new Map(), env);
    // Added last so the built-in option follows the root's own options in help.
    env.logLevel = attachLogging(program, definition.logging);

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
      middleware(path: readonly string[] = []): readonly AnyMiddleware[] {
        return resolvedAt(definition, path, resolved).chain;
      },
    });
  };
}

interface BuildEnvironment {
  readonly io: CliIO;
  readonly live: LiveOutput;
  readonly state: RunState;
  readonly cli: CliInfo;
  readonly loggerFactory: LoggerFactory;
  /** Reads the log level once the root command has been parsed. */
  logLevel: () => LogLevel;
  readonly resolved: ReadonlyMap<CommandDefinition, ResolvedCommand>;
}

/** The resolved middleware of the command at `path`, given as names or aliases from the root. */
function resolvedAt(
  root: CommandDefinition,
  path: readonly string[],
  resolved: ReadonlyMap<CommandDefinition, ResolvedCommand>,
): ResolvedCommand {
  let current = root;
  for (const [index, name] of path.entries()) {
    const child = current.commands.find((command) => command.name === name || command.aliases.includes(name));
    if (child === undefined) {
      throw new Error(`No command "${path.slice(0, index + 1).join(' ')}" under ${root.name}.`);
    }
    current = child;
  }

  const found = resolved.get(current);
  // Every command in the tree is resolved when the CLI is built.
  if (found === undefined) throw new Error(`The middleware of "${path.join(' ')}" were never resolved.`);
  return found;
}

/** Adds the root's log level option to the program and returns a reader for the parsed level. */
function attachLogging(program: CommanderCommand, logging: LoggingDefinition | undefined): () => LogLevel {
  if (logging === undefined) return () => DEFAULT_LOG_LEVEL;
  if (logging.flags === undefined) return () => logging.level;

  const option = new CommanderOption(logging.flags, logging.description).choices([...LOG_LEVELS]).default(logging.level);
  if (logging.env !== undefined) option.env(logging.env);
  if (logging.hidden) option.hideHelp();
  program.addOption(option);

  return () => {
    const value: unknown = program.opts()[option.attributeName()];
    return isLogLevel(value) ? value : logging.level;
  };
}

function configure(
  command: CommanderCommand,
  definition: CommandDefinition,
  lineage: readonly Binding[],
  inheritedSources: MiddlewareOptionSources,
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

  const resolved = env.resolved.get(definition);
  // resolveMiddleware visits every command in the tree.
  if (resolved === undefined) throw new Error(`The middleware of ${definition.name} were never resolved.`);

  // Middleware flags follow the command's own options in help.
  const sources = new Map(inheritedSources);
  for (const middleware of resolved.attached) {
    const attributes: Record<string, string> = {};
    for (const flag of resolved.flags) {
      if (flag.middleware !== middleware) continue;
      const built = buildOption(flag.option);
      command.addOption(built);
      attributes[flag.key] = built.attributeName();
    }
    sources.set(middleware, { command, attributes: Object.freeze(attributes) });
  }

  for (const argument of definition.arguments) {
    command.addArgument(buildArgument(argument));
  }

  const binding: Binding = { definition, command, options };

  for (const subcommand of definition.commands) {
    const child = command.command(subcommand.name, { hidden: subcommand.hidden });
    configure(child, subcommand, [...lineage, binding], sources, env);
  }

  if (!definition.runnable) return;

  command.action(async () => {
    const ancestors = lineage.map(populate);
    const instance = populate(binding) as { run?: RunMethod };
    const root = ancestors[0] ?? instance;
    const logLevel = env.logLevel();
    const logger = env.loggerFactory({ level: logLevel, io: env.io, name: env.cli.name });

    try {
      env.state.exitCode = await runChain({
        chain: resolved.chain,
        base: {
          io: env.io,
          argv: env.state.argv,
          root,
          ancestors,
          command,
          cli: env.cli,
          logLevel,
          logger,
          liveLine: env.live.liveLine,
        },
        instance,
        definition,
        optionsFor: (middleware) => readMiddlewareOptions(sources.get(middleware)),
        // `runnable` guarantees run() exists; the cast types it as optional.
        run: (context) => instance.run?.(context as Parameters<RunMethod>[0]),
      });
    } finally {
      // A line still live keeps its last text, above anything printed after the run.
      env.live.end();
    }
  });
}

/** The parsed values of one middleware's flags, read from the command they were added to. */
function readMiddlewareOptions(source: MiddlewareOptionSource | undefined): Readonly<Record<string, unknown>> {
  if (source === undefined) return Object.freeze({});

  const values = source.command.opts();
  const options: Record<string, unknown> = {};
  for (const [key, attribute] of Object.entries(source.attributes)) {
    options[key] = values[attribute];
  }
  return Object.freeze(options);
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
