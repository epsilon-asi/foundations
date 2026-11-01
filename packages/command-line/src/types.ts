import type {
  ClassDecoratorDefinition,
  DecoratorRegistry,
  PropertyDecoratorDefinition,
} from '@epsilon-asi/foundation';
import type { Command as CommanderCommand } from 'commander';

// ---------------------------------------------------------------------------
// Runtime contracts
// ---------------------------------------------------------------------------

export type Writer = (text: string) => void;

/** Output streams the CLI writes to. Injected so tests can capture output. */
export interface CliIO {
  readonly stdout: Writer;
  readonly stderr: Writer;
}

/** A command's `run()` may return an exit code. Returning nothing means 0. */
export type CommandResult = number | undefined | void;

export interface CommandContext<TRoot extends object = object> {
  readonly io: CliIO;
  /** The user arguments passed to the CLI, before parsing. */
  readonly argv: readonly string[];
  /** The populated root command instance. For the root command itself this is the command. */
  readonly root: TRoot;
  /** Populated ancestor command instances, root first and direct parent last. Empty for the root. */
  readonly ancestors: readonly object[];
  /** The underlying commander command, for anything this system does not expose. */
  readonly command: CommanderCommand;
}

/** Implemented by command classes that do something when invoked. */
export interface CliCommand<TRoot extends object = object> {
  run(context: CommandContext<TRoot>): CommandResult | Promise<CommandResult>;
}

/** The signature `run()` must have when a command class declares one. */
export type RunMethod = (context: CommandContext<any>) => CommandResult | Promise<CommandResult>;

/**
 * Resolves to `TClass` when its instances have no `run`, or one compatible with
 * RunMethod, and to `never` otherwise. `@Command` uses it to reject bad
 * signatures while still accepting classes that only group subcommands.
 */
export type ValidCommandClass<TClass extends abstract new (...args: any[]) => object> =
  InstanceType<TClass> extends { run: infer TRun } ? (TRun extends RunMethod ? TClass : never) : TClass;

/** Command classes are instantiated by the system, so they take no constructor arguments. */
export type CommandClass = new () => object;

// ---------------------------------------------------------------------------
// Decorator metadata
// ---------------------------------------------------------------------------

export interface CommandMetadata {
  /** Defaults to the class name in kebab-case, minus a trailing "Command" or "Cli". */
  name?: string;
  description?: string;
  /** Registers `-V, --version`. Usually only set on the root command. */
  version?: string;
  aliases?: readonly string[];
  /** Hide the command from help output. */
  hidden?: boolean;
  /** Subcommands, in the order they appear in help. */
  commands?: readonly CommandClass[];
}

/** What is stored in the decorator registry: everything except the subcommand classes. */
export type CommandRecordMetadata = Omit<CommandMetadata, 'commands'>;

export interface OptionMetadataBase {
  /** Full commander flags, e.g. `"-f, --format <format>"`. Derived from the property name when omitted. */
  flags?: string;
  /** Single-character short flag, e.g. `"f"`. Only used when `flags` is omitted. */
  short?: string;
  /** Placeholder for the value in help, e.g. `"level"`. Only used when `flags` is omitted. */
  valueName?: string;
  description?: string;
  /** Environment variable that supplies the value when the flag is absent. */
  env?: string;
  /** The option must have a value after parsing, from the flag, the environment or the default. */
  required?: boolean;
  /** Hide the option from help output. */
  hidden?: boolean;
}

export interface StringOptionMetadata extends OptionMetadataBase {
  type: 'string';
  default?: string;
}

export interface NumberOptionMetadata extends OptionMetadataBase {
  type: 'number';
  default?: number;
  integer?: boolean;
  min?: number;
  max?: number;
}

export interface BooleanOptionMetadata extends OptionMetadataBase {
  type: 'boolean';
  default?: boolean;
}

export interface ChoiceOptionMetadata<TChoices extends readonly string[] = readonly string[]>
  extends OptionMetadataBase {
  type: 'choice';
  choices: TChoices;
  default?: TChoices[number];
}

export type OptionMetadata =
  | StringOptionMetadata
  | NumberOptionMetadata
  | BooleanOptionMetadata
  | ChoiceOptionMetadata;

export interface ArgumentMetadataBase {
  /** Name shown in help. Defaults to the property name in kebab-case. */
  name?: string;
  description?: string;
  /** Defaults to true, or to false when a default value is given. */
  required?: boolean;
}

export interface StringArgumentMetadata extends ArgumentMetadataBase {
  type: 'string';
  default?: string;
}

export interface NumberArgumentMetadata extends ArgumentMetadataBase {
  type: 'number';
  default?: number;
  integer?: boolean;
  min?: number;
  max?: number;
}

export interface ChoiceArgumentMetadata<TChoices extends readonly string[] = readonly string[]>
  extends ArgumentMetadataBase {
  type: 'choice';
  choices: TChoices;
  default?: TChoices[number];
}

/**
 * Collects every remaining argument into a `string[]`. Must be the last
 * argument. Required by default, meaning at least one value; set
 * `required: false` to allow none.
 */
export interface ListArgumentMetadata extends ArgumentMetadataBase {
  type: 'list';
}

export type ArgumentMetadata =
  | StringArgumentMetadata
  | NumberArgumentMetadata
  | ChoiceArgumentMetadata
  | ListArgumentMetadata;

export type CliDecoratorSchema = {
  class: {
    command: ClassDecoratorDefinition<CommandRecordMetadata>;
  };
  property: {
    option: PropertyDecoratorDefinition<OptionMetadata, unknown>;
    argument: PropertyDecoratorDefinition<ArgumentMetadata, unknown>;
  };
  method: {};
  accessor: {};
};

// ---------------------------------------------------------------------------
// Decorator APIs
// ---------------------------------------------------------------------------

/**
 * A field decorator whose field must be typed exactly `TValue`. The context
 * parameter rejects wider field types and the (never returned) initializer
 * type rejects narrower ones, so the declared field type always matches the
 * value the system assigns.
 */
export type FieldDecorator<TValue> = (
  value: undefined,
  context: ClassFieldDecoratorContext<any, TValue>,
) => void | ((initialValue: TValue) => TValue);

/** Metadata for a typed helper: the discriminant is supplied by the helper. */
export type Spec<TMetadata extends { type: string }> = Omit<TMetadata, 'type'>;

/**
 * The field type an option must declare: `T` when a value is guaranteed after
 * parsing (a default or `required: true`), otherwise `T | undefined`.
 */
export type OptionValue<T, TSpec> = TSpec extends { default: {} }
  ? T
  : TSpec extends { required: true }
    ? T
    : T | undefined;

/** Arguments are required unless declared otherwise, so they default to `T`. */
export type ArgumentValue<T, TSpec> = TSpec extends { required: false }
  ? TSpec extends { default: {} }
    ? T
    : T | undefined
  : T;

export interface CommandDecorator {
  (metadata?: CommandMetadata): <TClass extends new (...args: any[]) => object>(
    value: TClass & ValidCommandClass<TClass>,
    context: ClassDecoratorContext<TClass>,
  ) => void;
}

export interface OptionDecoratorApi {
  /** Generic form. Prefer the typed helpers, which also check the field type. */
  (metadata: StringOptionMetadata): FieldDecorator<string | undefined>;
  (metadata: NumberOptionMetadata): FieldDecorator<number | undefined>;
  (metadata: BooleanOptionMetadata): FieldDecorator<boolean | undefined>;
  (metadata: ChoiceOptionMetadata): FieldDecorator<string | undefined>;

  string<const TSpec extends Spec<StringOptionMetadata>>(
    metadata?: TSpec,
  ): FieldDecorator<OptionValue<string, TSpec>>;

  number<const TSpec extends Spec<NumberOptionMetadata>>(
    metadata?: TSpec,
  ): FieldDecorator<OptionValue<number, TSpec>>;

  boolean<const TSpec extends Spec<BooleanOptionMetadata>>(
    metadata?: TSpec,
  ): FieldDecorator<OptionValue<boolean, TSpec>>;

  choice<const TChoices extends readonly string[], const TSpec extends Spec<ChoiceOptionMetadata<TChoices>>>(
    metadata: TSpec & { choices: TChoices },
  ): FieldDecorator<OptionValue<TChoices[number], TSpec>>;
}

export interface ArgumentDecoratorApi {
  /** Generic form. Prefer the typed helpers, which also check the field type. */
  (metadata: StringArgumentMetadata): FieldDecorator<string | undefined>;
  (metadata: NumberArgumentMetadata): FieldDecorator<number | undefined>;
  (metadata: ChoiceArgumentMetadata): FieldDecorator<string | undefined>;
  (metadata: ListArgumentMetadata): FieldDecorator<string[]>;

  string<const TSpec extends Spec<StringArgumentMetadata>>(
    metadata?: TSpec,
  ): FieldDecorator<ArgumentValue<string, TSpec>>;

  number<const TSpec extends Spec<NumberArgumentMetadata>>(
    metadata?: TSpec,
  ): FieldDecorator<ArgumentValue<number, TSpec>>;

  choice<const TChoices extends readonly string[], const TSpec extends Spec<ChoiceArgumentMetadata<TChoices>>>(
    metadata: TSpec & { choices: TChoices },
  ): FieldDecorator<ArgumentValue<TChoices[number], TSpec>>;

  list(metadata?: Spec<ListArgumentMetadata>): FieldDecorator<string[]>;
}

// ---------------------------------------------------------------------------
// Definitions: the resolved shape of a decorated command tree
// ---------------------------------------------------------------------------

export interface OptionDefinition {
  readonly propertyName: string;
  readonly flags: string;
  readonly metadata: OptionMetadata;
}

export interface ArgumentDefinition {
  readonly propertyName: string;
  readonly name: string;
  readonly required: boolean;
  readonly variadic: boolean;
  readonly metadata: ArgumentMetadata;
}

export interface CommandDefinition {
  readonly target: CommandClass;
  readonly name: string;
  readonly description: string | undefined;
  readonly version: string | undefined;
  readonly aliases: readonly string[];
  readonly hidden: boolean;
  /** Whether the class has a `run()` method. */
  readonly runnable: boolean;
  readonly options: readonly OptionDefinition[];
  readonly arguments: readonly ArgumentDefinition[];
  readonly commands: readonly CommandDefinition[];
}

// ---------------------------------------------------------------------------
// System
// ---------------------------------------------------------------------------

export interface BuildCliOptions {
  /** Defaults to process.stdout / process.stderr. */
  io?: CliIO;
}

export interface Cli {
  readonly definition: CommandDefinition;
  readonly program: CommanderCommand;
  /**
   * Parses `argv` (user arguments only, without the node and script paths),
   * runs the matching command and resolves to the exit code. Never exits the
   * process. A built CLI can be run once; build again to run again.
   */
  run(argv: readonly string[]): Promise<number>;
}

export interface CreateCliSystemOptions {
  /** Registry namespace. Defaults to "cli". */
  namespace?: string;
}

export interface CliSystem {
  readonly registry: DecoratorRegistry<CliDecoratorSchema>;
  readonly Command: CommandDecorator;
  readonly Option: OptionDecoratorApi;
  readonly Argument: ArgumentDecoratorApi;

  /** Resolves the decorated command tree without building anything. Throws CliDefinitionError on mistakes. */
  describeCommand(target: CommandClass): CommandDefinition;

  /** Builds the commander program for a root command class. */
  buildCli(target: CommandClass, options?: BuildCliOptions): Cli;

  /** Builds and runs in one step. Resolves to the exit code. */
  runCli(target: CommandClass, argv: readonly string[], options?: BuildCliOptions): Promise<number>;
}
