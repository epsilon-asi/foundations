import { Option as CommanderOption } from 'commander';
import { CliDefinitionError } from '../errors.js';
import { optionFlags, parseFlags } from '../naming.js';
import type { CommandDefinition, OptionDefinition } from '../types.js';
import { isMiddleware } from './define.js';
import type { AnyMiddleware } from './types.js';

/** One flag a middleware owns, ready to be added to a commander command. */
export interface MiddlewareFlag {
  readonly middleware: AnyMiddleware;
  /** The key the middleware reads the value under in `ctx.options`. */
  readonly key: string;
  readonly option: OptionDefinition;
}

/** The middleware of one command, resolved. */
export interface ResolvedCommand {
  /** Every middleware that runs for this command, outermost first, each once. */
  readonly chain: readonly AnyMiddleware[];
  /** The middleware that first appear in the chain at this command, so their flags are added to it. */
  readonly attached: readonly AnyMiddleware[];
  /** The flags of `attached`, in order. */
  readonly flags: readonly MiddlewareFlag[];
}

/** Commander's help and version flags, which every command has. */
const BUILT_IN_FLAGS: readonly FlagEntry[] = [
  { kind: 'built-in', long: 'help', short: 'h', attribute: undefined, label: 'the built-in help option (-h, --help)' },
  {
    kind: 'built-in',
    long: 'version',
    short: 'V',
    attribute: undefined,
    label: 'the built-in version option (-V, --version)',
  },
];

interface FlagEntry {
  readonly kind: 'option' | 'middleware' | 'built-in';
  readonly long: string | undefined;
  readonly short: string | undefined;
  /** The key commander stores the value under, for flags added to the command being checked. */
  readonly attribute: string | undefined;
  readonly label: string;
}

/**
 * Orders the middleware of every command in the tree and checks the flags
 * they own. A command's chain is the `buildCli` middleware, then each command's
 * `use` from the root down to it, with every middleware's own `use` placed just
 * before it. A middleware already in the chain is skipped, so it runs once, at
 * the outermost place it is listed, and its flags are added to that command.
 *
 * A parent command reads its flags from anywhere in argv, including after the
 * subcommand name, so a middleware flag must not clash with any flag on the
 * same command, on an ancestor or on a descendant.
 */
export function resolveMiddleware(
  root: CommandDefinition,
  globalUse: readonly unknown[],
): ReadonlyMap<CommandDefinition, ResolvedCommand> {
  globalUse.forEach((entry, index) => {
    if (!isMiddleware(entry)) {
      throw new CliDefinitionError(
        root.target,
        `buildCli option "use" has item ${index}, which is not a middleware made by defineMiddleware().`,
      );
    }
  });

  const resolved = new Map<CommandDefinition, ResolvedCommand>();
  const rootFlags = root.logging?.flags === undefined ? [] : [builtInLogLevel(root.logging.flags)];

  const visit = (
    definition: CommandDefinition,
    parentChain: readonly AnyMiddleware[],
    leading: readonly AnyMiddleware[],
    inherited: readonly FlagEntry[],
    builtIn: readonly FlagEntry[],
  ): void => {
    const seen = new Set(parentChain);
    const chain = [...parentChain];
    const attached: AnyMiddleware[] = [];

    const add = (middleware: AnyMiddleware): void => {
      if (seen.has(middleware)) return;
      // defineMiddleware only accepts middleware that already exist, so dependencies cannot form a cycle.
      for (const dependency of middleware.use) add(dependency);
      seen.add(middleware);
      chain.push(middleware);
      attached.push(middleware);
    };
    for (const middleware of [...leading, ...definition.use]) add(middleware);

    const flags = attached.flatMap((middleware) =>
      Object.entries(middleware.options).map(([key, metadata]): MiddlewareFlag => ({
        middleware,
        key,
        option: Object.freeze({ propertyName: key, flags: optionFlags(key, metadata), metadata }),
      })),
    );

    const own = [
      ...builtIn,
      ...definition.options.map((option) => optionEntry(definition, option)),
      ...flags.map(middlewareEntry),
    ];
    checkFlags(definition, own, inherited);

    resolved.set(definition, Object.freeze({ chain: Object.freeze(chain), attached: Object.freeze(attached), flags }));

    // Help and version are on every command, so they are checked as each command's own, never inherited.
    const passed = [...inherited, ...own.filter((entry) => !BUILT_IN_FLAGS.includes(entry))];
    for (const child of definition.commands) visit(child, chain, [], passed, BUILT_IN_FLAGS);
  };

  visit(root, [], globalUse as readonly AnyMiddleware[], [], [...BUILT_IN_FLAGS, ...rootFlags]);
  return resolved;
}

/**
 * Rejects a middleware flag that shares a long or short name with another flag
 * on this command or an ancestor, or a commander attribute with another flag on
 * this command. Clashes between plain options are left alone, as before.
 */
function checkFlags(definition: CommandDefinition, own: readonly FlagEntry[], inherited: readonly FlagEntry[]): void {
  own.forEach((entry, index) => {
    const others = [...inherited, ...own.slice(0, index)];

    for (const other of others) {
      if (entry.kind !== 'middleware' && other.kind !== 'middleware') continue;

      const clash =
        entry.long !== undefined && entry.long === other.long
          ? `--${entry.long}`
          : entry.short !== undefined && entry.short === other.short
            ? `-${entry.short}`
            : undefined;

      if (clash !== undefined) {
        throw new CliDefinitionError(
          definition.target,
          `${entry.label} uses ${clash}, which ${other.label} already uses; change the flags of one of them.`,
        );
      }
    }

    for (const other of own.slice(0, index)) {
      if (entry.kind !== 'middleware' && other.kind !== 'middleware') continue;
      if (entry.attribute !== undefined && entry.attribute === other.attribute) {
        throw new CliDefinitionError(
          definition.target,
          `${entry.label} would be stored as "${entry.attribute}", like ${other.label}; change the flags of one of them.`,
        );
      }
    }
  });
}

function optionEntry(definition: CommandDefinition, option: OptionDefinition): FlagEntry {
  return {
    kind: 'option',
    ...parseFlags(option.flags),
    attribute: attributeName(option.flags),
    label: `option "${option.propertyName}" of ${className(definition)} (${option.flags})`,
  };
}

function middlewareEntry(flag: MiddlewareFlag): FlagEntry {
  return {
    kind: 'middleware',
    ...parseFlags(flag.option.flags),
    attribute: attributeName(flag.option.flags),
    label: `middleware "${flag.middleware.name}" option "${flag.key}" (${flag.option.flags})`,
  };
}

function builtInLogLevel(flags: string): FlagEntry {
  return {
    kind: 'built-in',
    ...parseFlags(flags),
    attribute: attributeName(flags),
    label: `the built-in log level option (${flags})`,
  };
}

function attributeName(flags: string): string {
  return new CommanderOption(flags).attributeName();
}

function className(definition: CommandDefinition): string {
  return definition.target.name === '' ? '<anonymous class>' : definition.target.name;
}
