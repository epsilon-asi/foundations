import type { DecorationRecord, DecoratorRegistry } from '@epsilon-asi/foundation';
import { Option as CommanderOption } from 'commander';
import { CliDefinitionError } from './errors.js';
import { isMiddleware } from './middleware/define.js';
import type { AnyMiddleware } from './middleware/types.js';
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
import { DEFAULT_NO_INPUT_FLAGS, DEFAULT_YES_FLAGS, editorEnvName, noInputEnvName } from './prompt/shared.js';
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
  PromptsDefinition,
  PromptsMetadata,
} from './types.js';

export type SubcommandLookup = Pick<WeakMap<Function, readonly CommandClass[]>, 'get'>;
export type MiddlewareLookup = Pick<WeakMap<Function, readonly unknown[]>, 'get'>;

/**
 * Creates the `describeCommand` function for one registry. It turns a decorated
 * class into a validated CommandDefinition tree, which the program builder
 * consumes. All declaration mistakes surface here, with the class named.
 */
export function createDescribeCommand(
  registry: DecoratorRegistry<CliDecoratorSchema>,
  subcommands: SubcommandLookup,
  middleware: MiddlewareLookup,
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
      for (const key of ['package', 'logging', 'prompts'] as const) {
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
      description: metadata.description ?? stringField(packageJson, 'description') ?? "No description given",
      version: metadata.version ?? packageVersion(target, packageJson) ?? '0.0.0-undefined-version',
      aliases: Object.freeze([...(metadata.aliases ?? [])]),
      hidden: metadata.hidden ?? false,
      runnable,
      options: Object.freeze(members.options),
      arguments: Object.freeze(members.arguments),
      commands: Object.freeze(commands),
      package: packageJson,
      logging: isRoot ? describeLogging(target, name, metadata.logging, members.options) : undefined,
      prompts: isRoot ? describePrompts(target, name, metadata.prompts, members.options) : undefined,
      use: describeUse(target, middleware.get(target) ?? []),
    });
  }

  return (target) => describe(target, true);
}

function describeUse(target: CommandClass, use: readonly unknown[]): readonly AnyMiddleware[] {
  use.forEach((entry, index) => {
    if (!isMiddleware(entry)) {
      throw new CliDefinitionError(target, `has use[${index}], which is not a middleware made by defineMiddleware().`);
    }
  });
  return Object.freeze([...(use as readonly AnyMiddleware[])]);
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
  assertNoFlagConflict(target, flags, options, { name: 'log level', remedy: 'set logging: false' });

  return Object.freeze({ level, flags, env, description, hidden: spec.hidden ?? false });
}

function describePrompts(
  target: CommandClass,
  cliName: string,
  metadata: PromptsMetadata | false | undefined,
  options: readonly OptionDefinition[],
): PromptsDefinition {
  const spec: PromptsMetadata =
    metadata === false ? { yes: false, noInput: false, noInputEnv: false, editorEnv: false } : (metadata ?? {});

  const yes = spec.yes === false ? undefined : (spec.yes ?? DEFAULT_YES_FLAGS);
  const noInput = spec.noInput === false ? undefined : (spec.noInput ?? DEFAULT_NO_INPUT_FLAGS);
  if (noInput === undefined && typeof spec.noInputEnv === 'string') {
    throw new CliDefinitionError(target, 'prompts.noInputEnv needs the no-input option; drop it or keep prompts.noInput.');
  }

  for (const [key, flags, name, example] of [
    ['yes', yes, 'yes', DEFAULT_YES_FLAGS],
    ['noInput', noInput, 'no-input', DEFAULT_NO_INPUT_FLAGS],
  ] as const) {
    if (flags === undefined) continue;
    const option = new CommanderOption(flags);
    if (option.required || option.optional) {
      throw new CliDefinitionError(target, `prompts.${key} must be flags without a value, like "${example}", not "${flags}".`);
    }
    // `--no-input` is stored as "input", so an `--input` option would become its opposite.
    assertNoFlagConflict(target, flags, options, { name, remedy: `set prompts.${key}: false`, attributes: true });
  }

  return Object.freeze({
    yes,
    noInput,
    noInputEnv: noInput === undefined || spec.noInputEnv === false ? undefined : (spec.noInputEnv ?? noInputEnvName(cliName)),
    editorEnv: spec.editorEnv === false ? undefined : (spec.editorEnv ?? editorEnvName(cliName)),
  });
}

interface BuiltInOption {
  /** How the option is named in the message: `the built-in <name> option`. */
  readonly name: string;
  /** What to do about a clash. */
  readonly remedy: string;
  /** Also reject an option commander would store under the same name. */
  readonly attributes?: boolean;
}

function assertNoFlagConflict(
  target: CommandClass,
  flags: string,
  options: readonly OptionDefinition[],
  builtIn: BuiltInOption,
): void {
  const reserved = parseFlags(flags);
  const attribute = new CommanderOption(flags).attributeName();
  const remedy = `${builtIn.remedy} or change the flags of one of them.`;

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
        `option "${option.propertyName}" uses ${clash}, which the built-in ${builtIn.name} option already uses; ${remedy}`,
      );
    }
    if (builtIn.attributes === true && new CommanderOption(option.flags).attributeName() === attribute) {
      throw new CliDefinitionError(
        target,
        `option "${option.propertyName}" (${option.flags}) would be stored as "${attribute}", like the built-in ` +
          `${builtIn.name} option (${flags}); ${remedy}`,
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
