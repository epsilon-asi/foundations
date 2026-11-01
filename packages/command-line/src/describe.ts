import type { DecorationRecord, DecoratorRegistry } from '@epsilon-asi/foundation';
import { CliDefinitionError } from './errors.js';
import {
  DEFAULT_LOG_LEVEL,
  DEFAULT_LOG_LEVEL_DESCRIPTION,
  DEFAULT_LOG_LEVEL_FLAGS,
  LOG_LEVELS,
  isLogLevel,
  logLevelEnvName,
} from './logging.js';
import { commandNameFromClass, optionFlags, parseFlags, toKebabCase } from './naming.js';
import { cliNameFromPackage, readPackageJson } from './package.js';
import type {
  ArgumentDefinition,
  ArgumentMetadata,
  CliDecoratorSchema,
  CommandClass,
  CommandDefinition,
  CommandRecordMetadata,
  LoggingDefinition,
  LoggingMetadata,
  OptionDefinition,
  OptionMetadata,
  PackageJson,
} from './types.js';

export type SubcommandLookup = Pick<WeakMap<Function, readonly CommandClass[]>, 'get'>;

/**
 * Creates the `describeCommand` function for one registry. It turns a decorated
 * class into a validated CommandDefinition tree, which the program builder
 * consumes. All declaration mistakes surface here, with the class named.
 */
export function createDescribeCommand(
  registry: DecoratorRegistry<CliDecoratorSchema>,
  subcommands: SubcommandLookup,
): (target: CommandClass) => CommandDefinition {
  function describe(target: CommandClass, isRoot: boolean): CommandDefinition {
    // @Command itself is not inherited: a subclass is a different command and must say so.
    const ownRecords = registry.read(target, { includeInherited: false }).classRecords('command');
    const ownRecord = ownRecords[ownRecords.length - 1];
    if (ownRecord === undefined) {
      throw new CliDefinitionError(target, 'is not decorated with @Command.');
    }
    const metadata = ownRecord.metadata as CommandRecordMetadata;

    if (!isRoot) {
      for (const key of ['package', 'logging'] as const) {
        if (metadata[key] !== undefined) {
          throw new CliDefinitionError(target, `"${key}" can only be set on the root command.`);
        }
      }
    }

    const packageJson = metadata.package === undefined ? undefined : loadPackage(target, metadata.package);

    const name =
      metadata.name ??
      (packageJson === undefined ? undefined : cliNameFromPackage(packageJson)) ??
      (target.name === '' ? undefined : commandNameFromClass(target.name));
    if (name === undefined || name.trim() === '') {
      throw new CliDefinitionError(target, 'needs a name: pass one to @Command or give the class a name.');
    }

    // Options and arguments are inherited, so shared options can live on a base class.
    const members = collectMembers(target, registry.read(target).propertyRecords());
    const commands = (subcommands.get(target) ?? []).map((subcommand) => describe(subcommand, false));
    assertUniqueNames(target, commands);

    const runnable = typeof (target.prototype as { run?: unknown }).run === 'function';
    if (!runnable && commands.length === 0) {
      throw new CliDefinitionError(target, 'has neither a run() method nor subcommands.');
    }

    return Object.freeze({
      target,
      name,
      description: metadata.description ?? stringField(packageJson, 'description'),
      version: metadata.version ?? packageVersion(target, packageJson),
      aliases: Object.freeze([...(metadata.aliases ?? [])]),
      hidden: metadata.hidden ?? false,
      runnable,
      options: Object.freeze(members.options),
      arguments: Object.freeze(members.arguments),
      commands: Object.freeze(commands),
      package: packageJson,
      logging: isRoot ? describeLogging(target, name, metadata.logging, members.options) : undefined,
    });
  }

  return (target) => describe(target, true);
}

function loadPackage(target: CommandClass, from: string | URL): PackageJson {
  try {
    return readPackageJson(from);
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new CliDefinitionError(target, `could not read its package.json: ${reason}`);
  }
}

function stringField(packageJson: PackageJson | undefined, key: 'description' | 'version'): string | undefined {
  const value = packageJson?.[key];
  return typeof value === 'string' ? value : undefined;
}

/** A command declared with `package` is expected to have a version, so a missing one is a mistake. */
function packageVersion(target: CommandClass, packageJson: PackageJson | undefined): string | undefined {
  if (packageJson === undefined) return undefined;

  const version = stringField(packageJson, 'version');
  if (version === undefined) {
    throw new CliDefinitionError(target, 'its package.json has no "version"; pass one to @Command instead.');
  }
  return version;
}

function describeLogging(
  target: CommandClass,
  cliName: string,
  metadata: LoggingMetadata | false | undefined,
  options: readonly OptionDefinition[],
): LoggingDefinition {
  const spec: LoggingMetadata = metadata === false ? { flags: false, env: false } : (metadata ?? {});

  const level = spec.level ?? DEFAULT_LOG_LEVEL;
  if (!isLogLevel(level)) {
    throw new CliDefinitionError(target, `logging.level "${String(level)}" is not one of ${LOG_LEVELS.join(', ')}.`);
  }
  const description = spec.description ?? DEFAULT_LOG_LEVEL_DESCRIPTION;

  if (spec.flags === false) {
    if (typeof spec.env === 'string') {
      throw new CliDefinitionError(target, 'logging.env needs the log level option; drop it or keep logging.flags.');
    }
    return Object.freeze({ level, flags: undefined, env: undefined, description, hidden: false });
  }

  const flags = spec.flags ?? DEFAULT_LOG_LEVEL_FLAGS;
  const env = spec.env === false ? undefined : (spec.env ?? logLevelEnvName(cliName));
  assertNoFlagConflict(target, flags, options);

  return Object.freeze({ level, flags, env, description, hidden: spec.hidden ?? false });
}

function assertNoFlagConflict(target: CommandClass, flags: string, options: readonly OptionDefinition[]): void {
  const reserved = parseFlags(flags);

  for (const option of options) {
    const own = parseFlags(option.flags);
    const clash =
      reserved.long !== undefined && own.long === reserved.long
        ? `--${reserved.long}`
        : reserved.short !== undefined && own.short === reserved.short
          ? `-${reserved.short}`
          : undefined;

    if (clash !== undefined) {
      throw new CliDefinitionError(
        target,
        `option "${option.propertyName}" uses ${clash}, which the built-in log level option already uses; ` +
          'set logging: false or change the flags of one of them.',
      );
    }
  }
}

interface Members {
  options: OptionDefinition[];
  arguments: ArgumentDefinition[];
}

function collectMembers(target: CommandClass, records: readonly DecorationRecord[]): Members {
  const members: Members = { options: [], arguments: [] };
  const seen = new Set<string>();

  for (const record of records) {
    const propertyName = memberName(target, record);

    if (seen.has(propertyName)) {
      throw new CliDefinitionError(target, `property "${propertyName}" is decorated more than once.`);
    }
    seen.add(propertyName);

    if (record.decorator === 'option') {
      members.options.push(describeOption(target, propertyName, record.metadata as OptionMetadata));
    } else {
      members.arguments.push(describeArgument(propertyName, record.metadata as ArgumentMetadata));
    }
  }

  const variadicIndex = members.arguments.findIndex((argument) => argument.variadic);
  if (variadicIndex !== -1 && variadicIndex !== members.arguments.length - 1) {
    const argument = members.arguments[variadicIndex];
    throw new CliDefinitionError(target, `list argument "${argument?.propertyName}" must be the last argument.`);
  }

  return members;
}

function memberName(target: CommandClass, record: DecorationRecord): string {
  const decorator = record.decorator === 'option' ? '@Option' : '@Argument';

  if (typeof record.memberName !== 'string') {
    throw new CliDefinitionError(target, `${decorator} does not support symbol-named properties.`);
  }
  if (record.static) {
    throw new CliDefinitionError(target, `${decorator} property "${record.memberName}" must not be static.`);
  }
  if (record.private) {
    throw new CliDefinitionError(target, `${decorator} property "${record.memberName}" must not be private.`);
  }

  return record.memberName;
}

function describeOption(target: CommandClass, propertyName: string, metadata: OptionMetadata): OptionDefinition {
  if (metadata.short !== undefined && !/^[A-Za-z0-9]$/.test(metadata.short)) {
    throw new CliDefinitionError(
      target,
      `option "${propertyName}" has short flag "${metadata.short}"; it must be a single letter or digit.`,
    );
  }

  return Object.freeze({ propertyName, flags: optionFlags(propertyName, metadata), metadata });
}

function describeArgument(propertyName: string, metadata: ArgumentMetadata): ArgumentDefinition {
  const hasDefault = 'default' in metadata && metadata.default !== undefined;

  return Object.freeze({
    propertyName,
    name: metadata.name ?? toKebabCase(propertyName),
    required: metadata.required ?? !hasDefault,
    variadic: metadata.type === 'list',
    metadata,
  });
}

function assertUniqueNames(target: CommandClass, commands: readonly CommandDefinition[]): void {
  const seen = new Map<string, string>();

  for (const command of commands) {
    for (const alias of [command.name, ...command.aliases]) {
      const existing = seen.get(alias);
      if (existing !== undefined) {
        throw new CliDefinitionError(
          target,
          `subcommands ${existing} and ${command.target.name} both answer to "${alias}".`,
        );
      }
      seen.set(alias, command.target.name);
    }
  }
}
