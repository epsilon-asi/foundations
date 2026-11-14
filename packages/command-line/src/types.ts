import type {
  ClassDecoratorDefinition,
  DecoratorRegistry,
  PropertyDecoratorDefinition,
} from '@epsilon-asi/foundation';
import type { Command as CommanderCommand } from 'commander';
import type { AnyMiddleware, ProvidedBy } from './middleware/types.js';

// ---------------------------------------------------------------------------
// Runtime contracts
// ---------------------------------------------------------------------------

export type Writer = (text: string) => void;

/** Output streams the CLI writes to. Injected so tests can capture output. */
export interface CliIO {
  readonly stdout: Writer;
  readonly stderr: Writer;
  /**
   * The terminal `stderr` writes to, when it is an interactive one. Live lines
   * are only redrawn in place on a terminal; leave this out for pipes, files
   * and captured output.
   */
  readonly terminal?: CliTerminal | undefined;
}

/** What live lines need to know about the terminal `CliIO.stderr` writes to. */
export interface CliTerminal {
  /** Width in columns, when known. Read before every redraw, so resizing is followed. */
  readonly columns?: number | undefined;
  /** Whether `stdout` writes to the same terminal, so its output is kept clear of live lines too. Defaults to true. */
  readonly stdout?: boolean | undefined;
}

/** The parts of a stream `detectTerminal` reads. `process.stderr` and `process.stdout` have them. */
export interface TerminalStream {
  readonly isTTY?: boolean | undefined;
  /** How wide the terminal is, so a list prompt can keep each row on one line. */
  readonly columns?: number | undefined;
}

/** Log levels, least to most severe. `silent` turns logging off. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

/** What every command receives as `context.logger`. */
export interface Logger {
  /** The minimum level this logger writes. */
  readonly level: LogLevel;
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export interface LoggerOptions {
  /** The level resolved from the flag, the environment or the root's `logging.level`. */
  readonly level: LogLevel;
  readonly io: CliIO;
  /** The root command's name. */
  readonly name: string;
}

/** Builds the logger for one run. The default writes `[level] message` lines to stderr. */
export type LoggerFactory = (options: LoggerOptions) => Logger;

/** Frames drawn in turn before a live line's text. */
export interface LiveLineSpinner {
  readonly frames: readonly string[];
  /** Milliseconds each frame is shown. */
  readonly interval: number;
}

export interface LiveLineOptions {
  /** Animates a spinner before the text while the line is drawn: `true` for DEFAULT_SPINNER, or your own. */
  readonly spinner?: boolean | LiveLineSpinner;
}

/**
 * A line of output rewritten in place, for progress and status. On a terminal
 * it is redrawn on every change, cut to the terminal's width; elsewhere
 * nothing is written until it ends, so logs only get what it leaves behind.
 */
export interface LiveLine {
  /** The text last given to `liveLine()` or `update()`, without the spinner. */
  readonly text: string;
  /** False once the line has ended, after which every call is ignored. */
  readonly active: boolean;
  /** Replaces the text. */
  update(text: string): void;
  /** Ends the line, leaving `text`, or else the current text, behind as an ordinary line. */
  done(text?: string): void;
  /** Ends the line, erasing it. */
  clear(): void;
}

/** Output that can show a live line below everything written through it. */
export interface LiveOutput {
  /**
   * Writes through this io appear above the live line rather than breaking it.
   * It is the io given to createLiveOutput when that has no terminal.
   */
  readonly io: CliIO;
  /** Starts a live line on `io.stderr`, first ending the current one with `done()`. */
  liveLine(text?: string, options?: LiveLineOptions): LiveLine;
  /** Ends the current live line, if there is one, with `done()`. */
  end(): void;
  /**
   * Takes the live line off the screen while `during` runs, so something else
   * can use the terminal: a prompt, or an editor. Writes through `io` in the
   * meantime are held, then printed, and the line drawn again, once it settles.
   */
  suspend<T>(during: () => T | Promise<T>): Promise<T>;
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

/** The kinds of prompt `context.prompt` can show. */
export type PromptKind = 'confirm' | 'text' | 'secret' | 'editor' | 'select' | 'multiselect';

/**
 * Checks an answer. Return `true` to accept it, a message saying what is
 * wrong to reject it, or `false` to reject it with a generic message.
 */
export type PromptValidator = (value: string) => boolean | string | Promise<boolean | string>;

export interface ConfirmOptions {
  /**
   * The answer when Enter is pressed on its own, and when there is no terminal
   * to ask on. Without one, y or n must be typed, and without a terminal the
   * prompt throws PromptUnavailableError.
   */
  readonly default?: boolean | undefined;
}

export interface TextOptions {
  /**
   * The answer when Enter is pressed on its own, and when there is no terminal
   * to ask on. It is used as given, never validated. Without one, an empty
   * answer is an answer, and without a terminal the prompt throws.
   */
  readonly default?: string | undefined;
  /** Checks what is typed. A rejected answer prints the reason and asks again. */
  readonly validate?: PromptValidator | undefined;
}

export interface SecretOptions {
  /**
   * Drawn for each character typed, instead of the character. Defaults to
   * `*`; `''` draws nothing, like sudo, so not even the length shows.
   */
  readonly mask?: string | undefined;
  /** Checks what is typed. A rejected answer prints the reason and asks again. */
  readonly validate?: PromptValidator | undefined;
}

export interface EditorOptions {
  /** What the file holds when the editor opens. */
  readonly initial?: string | undefined;
  /** The file's extension, so the editor picks the right syntax: `md` or `.md`. */
  readonly extension?: string | undefined;
  /** Lines starting with this are removed from the result, as git does with `#`. */
  readonly comment?: string | undefined;
  /** Accept a file left empty. Otherwise an empty result cancels, like an empty git commit message. */
  readonly allowEmpty?: boolean | undefined;
  /** The result when there is no terminal to open an editor on. Without one, the prompt throws there. */
  readonly default?: string | undefined;
}

/** One entry in a list to choose from: the value a prompt resolves to, and what is shown for it. */
export interface PromptChoice<T extends string = string> {
  readonly value: T;
  /** Shown in the list instead of the value. */
  readonly label?: string | undefined;
}

/** What a list prompt offers: values, shown as they are, or choices with labels. */
export type PromptChoices<T extends string = string> = readonly (T | PromptChoice<T>)[];

export interface SelectOptions<T extends string = string> {
  /** What to choose from, in the order shown. At least one, and no value twice. */
  readonly choices: PromptChoices<T>;
  /**
   * Where the cursor starts, and the answer when there is no terminal to ask
   * on. Without one, the cursor starts on the first choice and without a
   * terminal the prompt throws.
   */
  readonly default?: NoInfer<T> | undefined;
}

export interface MultiselectOptions<T extends string = string> {
  /** What to choose from, in the order shown. At least one, and no value twice. */
  readonly choices: PromptChoices<T>;
  /**
   * The choices already picked when the list opens, and the answer when there
   * is no terminal to ask on. Without one, nothing starts picked and without
   * a terminal the prompt throws.
   */
  readonly default?: readonly NoInfer<T>[] | undefined;
  /** How many must be picked before Enter is accepted. Defaults to 0. */
  readonly min?: number | undefined;
}

/**
 * Asks the person running the CLI for input. Every command gets one as
 * `context.prompt`; `terminalPrompter()` asks on the terminal and
 * `scriptedPrompter()` answers from a script, for tests.
 *
 * Cancelling (Ctrl+C, or Ctrl+D on an empty answer) rejects with
 * PromptCancelledError.
 */
export interface Prompter {
  /** Asks a yes or no question. */
  confirm(message: string, options?: ConfirmOptions): Promise<boolean>;
  /** Asks for a line of text. */
  text(message: string, options?: TextOptions): Promise<string>;
  /** Asks for a line of text without showing it as it is typed: a password, a token or an API key. */
  secret(message: string, options?: SecretOptions): Promise<string>;
  /**
   * Opens a file in the user's editor and resolves to what they leave in it,
   * without comment lines and blank lines at either end.
   */
  editor(options?: EditorOptions): Promise<string>;
  /**
   * Asks for one of a list of choices: arrow keys move, typing filters the
   * list, Enter picks.
   */
  select<T extends string>(message: string, options: SelectOptions<T>): Promise<T>;
  /**
   * Asks for any number of a list of choices: arrow keys move, Space picks or
   * unpicks, Enter accepts. Resolves to the picked values in the order of the
   * choices.
   */
  multiselect<T extends string>(message: string, options: MultiselectOptions<T>): Promise<T[]>;
}

/** The parts of a stream `terminalPrompter` reads keys from. `process.stdin` has them. */
export interface PromptInputStream extends NodeJS.ReadableStream {
  readonly isTTY?: boolean | undefined;
  readonly isRaw?: boolean | undefined;
  setRawMode?(mode: boolean): unknown;
}

/** The parts of a stream `terminalPrompter` draws on. `process.stderr` has them. */
export interface PromptOutputStream extends NodeJS.WritableStream {
  readonly isTTY?: boolean | undefined;
  readonly columns?: number | undefined;
}

export interface TerminalPrompterOptions {
  /** Where keys are read from. Defaults to `process.stdin`. */
  readonly input?: PromptInputStream | undefined;
  /** Where prompts are drawn. Defaults to `process.stderr`, so stdout stays clean for output. */
  readonly output?: PromptOutputStream | undefined;
  /** Read for `TERM`, `CI` and the editor. Defaults to `process.env`. */
  readonly env?: NodeJS.ProcessEnv | undefined;
  /** A variable naming the editor, checked before `VISUAL` and `EDITOR`, like `GIT_EDITOR`. */
  readonly editorEnv?: string | undefined;
}

/** Whether a scripted answer expects a particular question: the exact message, or a pattern it matches. */
interface ScriptedQuestion {
  readonly message?: string | RegExp | undefined;
}

/**
 * One answer `scriptedPrompter` gives, naming the kind of prompt it answers.
 * An `editor` answer is what is left in the file, so comment lines are still
 * removed from it. A `select` answer is one value and a `multiselect` answer
 * a list of them, each one of the prompt's choices. `{ cancel: true }`
 * cancels whatever is asked.
 */
export type ScriptedAnswer =
  | (ScriptedQuestion & { readonly confirm: boolean })
  | (ScriptedQuestion & { readonly text: string })
  | (ScriptedQuestion & { readonly secret: string })
  | (ScriptedQuestion & { readonly editor: string })
  | (ScriptedQuestion & { readonly select: string })
  | (ScriptedQuestion & { readonly multiselect: readonly string[] })
  | (ScriptedQuestion & { readonly cancel: true });

/** A prompt a scripted prompter was asked. */
export interface AskedPrompt {
  readonly kind: PromptKind;
  /** The question asked. Undefined for `editor`, which has none. */
  readonly message: string | undefined;
}

/**
 * A prompter that answers from a script and records what it was asked. Given
 * to `buildCli` or `runCli`, it is checked when the run ends: answers left
 * unused make `run()` reject, so a command that stops asking fails its test.
 */
export interface ScriptedPrompter extends Prompter {
  /** Every prompt asked so far, in order. */
  readonly asked: readonly AskedPrompt[];
  /** How many answers are left unused. */
  readonly remaining: number;
}

/** The fields of package.json a CLI cares about. Everything else is kept as `unknown`. */
export interface PackageJson {
  readonly name?: string;
  readonly version?: string;
  readonly description?: string;
  readonly bin?: string | Readonly<Record<string, string>>;
  readonly [key: string]: unknown;
}

/** Identity of the root command, available to every command as `context.cli`. */
export interface CliInfo {
  readonly name: string;
  readonly version: string;
  readonly description: string;
  /** The package.json read for `@Command({ package })`, when one was given. */
  readonly package: PackageJson | undefined;
}

/** A command's `run()` may return an exit code. Returning nothing means 0. */
export type CommandResult = number | undefined | void;

/** What every command receives, before anything middleware provides. */
export interface BaseCommandContext<TRoot extends object = object> {
  readonly io: CliIO;
  /** The user arguments passed to the CLI, before parsing. */
  readonly argv: readonly string[];
  /** The populated root command instance. For the root command itself this is the command. */
  readonly root: TRoot;
  /** Populated ancestor command instances, root first and direct parent last. Empty for the root. */
  readonly ancestors: readonly object[];
  /** The underlying commander command, for anything this system does not expose. */
  readonly command: CommanderCommand;
  /** Name, version and description of the root command. */
  readonly cli: CliInfo;
  /** The log level in effect for this run. */
  readonly logLevel: LogLevel;
  /** A logger at `logLevel`, writing to `io.stderr` unless `buildCli` was given another factory. */
  readonly logger: Logger;
  /**
   * Starts a live line on `io.stderr`. On a terminal it is redrawn in place
   * while `io` and `logger` output appears above it. A line still live when
   * `run()` returns or throws is ended with `done()`.
   */
  readonly liveLine: (text?: string, options?: LiveLineOptions) => LiveLine;
  /**
   * Asks the person running the CLI: `confirm`, `text`, `secret` and `editor`.
   * Prompts are drawn on stderr, with any live line taken off the screen
   * meanwhile. Without a terminal, or with `--no-input`, a prompt resolves to
   * its `default` or throws PromptUnavailableError; `--yes` answers yes to
   * every confirmation without asking.
   */
  readonly prompt: Prompter;
}

/**
 * What a command's `run()` receives: the base context plus `TExtra`, the
 * values its middleware provide. Declare them with `Provided`:
 * `CommandContext<App, Provided<typeof client>>`.
 */
export type CommandContext<TRoot extends object = object, TExtra extends object = {}> = BaseCommandContext<TRoot> &
  Readonly<TExtra>;

/**
 * What a command class that does something when invoked implements. Most
 * commands extend the CliCommand base class instead, which adds `--format`
 * and `render()`; implement this directly for a command without them.
 */
export interface RunnableCommand<TRoot extends object = object, TExtra extends object = {}> {
  run(context: CommandContext<TRoot, TExtra>): CommandResult | Promise<CommandResult>;
}

/** The values of the `-f, --format` option every CliCommand has. */
export type OutputFormat = 'text' | 'json';

/** The CLI and runtime facts `runtimeInfo()` reports. */
export interface RuntimeInfo {
  readonly name: string;
  readonly version: string;
  readonly node: string;
  readonly platform: string;
}

/** The signature `run()` must have when a command class declares one. */
export type RunMethod = (context: CommandContext<any>) => CommandResult | Promise<CommandResult>;

/**
 * Resolves to `TClass` when its instances have no `run`, or one that accepts
 * the context `@Command` gives it (the base context plus `TProvided`, what its
 * own `use` provides), and to `never` otherwise. `@Command` uses it to reject
 * bad signatures, including a `run()` that reads values no middleware in its
 * `use` provides, while still accepting classes that only group subcommands.
 */
export type ValidCommandClass<TClass extends abstract new (...args: any[]) => object, TProvided extends object = {}> =
  InstanceType<TClass> extends { run: infer TRun }
    ? TRun extends (context: CommandContext<any, TProvided>) => CommandResult | Promise<CommandResult>
      ? TClass
      : never
    : TClass;

/** Command classes are instantiated by the system, so they take no constructor arguments. */
export type CommandClass = new () => object;

// ---------------------------------------------------------------------------
// Decorator metadata
// ---------------------------------------------------------------------------

/**
 * How the root command's log level is chosen. Everything has a default, so
 * most CLIs never set this: they get `-l, --log-level <level>` with an
 * `<NAME>_LOG_LEVEL` environment variable and a default of `info`.
 */
export interface LoggingMetadata {
  /** The level when neither the flag nor the environment variable is set. Defaults to `info`. */
  level?: LogLevel;
  /**
   * Flags of the log level option. Defaults to `-l, --log-level <level>`.
   * `false` removes the option (and the environment variable); the level is then fixed at `level`.
   */
  flags?: string | false;
  /** Environment variable consulted when the flag is absent. Defaults to `<NAME>_LOG_LEVEL`; `false` disables it. */
  env?: string | false;
  /** Help text of the option. */
  description?: string;
  /** Hide the option from help output. */
  hidden?: boolean;
}

/**
 * The root command's built-in prompt options. Every root gets them unless it
 * says otherwise: `-y, --yes` answers yes to every confirmation, and
 * `--no-input` (or an `<NAME>_NO_INPUT` environment variable) turns prompts
 * off, so they resolve to their defaults or fail instead of waiting.
 */
export interface PromptsMetadata {
  /** Flags of the option that answers yes to every confirmation. Defaults to `-y, --yes`; `false` removes it. */
  yes?: string | false;
  /** Flags of the option that turns prompts off. Defaults to `--no-input`; `false` removes it and its environment variable. */
  noInput?: string | false;
  /** Environment variable that turns prompts off when set. Defaults to `<NAME>_NO_INPUT`; `false` disables it. */
  noInputEnv?: string | false;
  /**
   * Environment variable naming the editor for `prompt.editor()`, checked
   * before `VISUAL` and `EDITOR`, as git checks `GIT_EDITOR`. Defaults to
   * `<NAME>_EDITOR`; `false` disables it.
   */
  editorEnv?: string | false;
}

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
  /**
   * Middleware that run before this command and every command below it, after
   * those of its ancestors. List every middleware whose values `run()` reads:
   * a middleware already listed further up runs only once.
   */
  use?: readonly AnyMiddleware[];
  /**
   * Where to find the package.json that describes this CLI: usually
   * `import.meta.url`, or a path to a file or directory. Its `version` fills
   * `version`, its `description` fills `description` and its single `bin`
   * (or unscoped name) fills `name`, each unless given here. Root only.
   */
  package?: string | URL;
  /** Overrides for the built-in log level option, or `false` to remove it. Root only. */
  logging?: LoggingMetadata | false;
  /** Overrides for the built-in `--yes` and `--no-input` options, or `false` to remove them. Root only. */
  prompts?: PromptsMetadata | false;
}

/** What is stored in the decorator registry: everything except the subcommand classes. */
export type CommandRecordMetadata = Omit<CommandMetadata, 'commands' | 'use'>;

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
  <const TUse extends readonly AnyMiddleware[] = []>(
    metadata?: CommandMetadata & { use?: TUse },
  ): <TClass extends new (...args: any[]) => object>(
    value: TClass & ValidCommandClass<TClass, ProvidedBy<TUse>>,
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

/** The resolved log level option of a root command. */
export interface LoggingDefinition {
  /** The level when nothing else sets one. */
  readonly level: LogLevel;
  /** Flags of the option, or undefined when the option was removed. */
  readonly flags: string | undefined;
  readonly env: string | undefined;
  readonly description: string;
  readonly hidden: boolean;
}

/** The resolved prompt options of a root command. */
export interface PromptsDefinition {
  /** Flags of the option that answers yes to every confirmation, or undefined when it was removed. */
  readonly yes: string | undefined;
  /** Flags of the option that turns prompts off, or undefined when it was removed. */
  readonly noInput: string | undefined;
  readonly noInputEnv: string | undefined;
  readonly editorEnv: string | undefined;
}

export interface CommandDefinition {
  readonly target: CommandClass;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly aliases: readonly string[];
  readonly hidden: boolean;
  /** Whether the class has a `run()` method. */
  readonly runnable: boolean;
  readonly options: readonly OptionDefinition[];
  readonly arguments: readonly ArgumentDefinition[];
  readonly commands: readonly CommandDefinition[];
  /** The package.json read for `@Command({ package })`. Root only. */
  readonly package: PackageJson | undefined;
  /** The log level option. Always set on the root, never on subcommands. */
  readonly logging: LoggingDefinition | undefined;
  /** The prompt options. Always set on the root, never on subcommands. */
  readonly prompts: PromptsDefinition | undefined;
  /** The middleware listed in this command's own `use`, before ordering and dedupe. */
  readonly use: readonly AnyMiddleware[];
}

// ---------------------------------------------------------------------------
// System
// ---------------------------------------------------------------------------

export interface BuildCliOptions {
  /** Defaults to process.stdout / process.stderr. */
  io?: CliIO;
  /** Replaces the default logger. Receives the resolved level and `io` on every run. */
  logger?: LoggerFactory;
  /** Middleware that run first, before those of the root command, for every command. */
  use?: readonly AnyMiddleware[];
  /**
   * Answers `context.prompt` instead of the terminal: `scriptedPrompter([...])`
   * in tests. Defaults to `terminalPrompter()` when `io` is not given. With a
   * custom `io` and no prompter, commands run as if there were no terminal, so
   * tests never wait on the real stdin. A scripted prompter with answers left
   * unused when the run ends makes `run()` reject, whatever the exit code.
   */
  prompter?: Prompter;
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
  /**
   * The middleware that run, in order, for the command at `path`: names or
   * aliases from the root down, `[]` for the root itself. Throws for a path
   * that names no command.
   */
  middleware(path?: readonly string[]): readonly AnyMiddleware[];
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

  /**
   * For `bin` entrypoints: runs the CLI on `process.argv`, stores the exit
   * code in `process.exitCode` and resolves to it. The process then exits on
   * its own once nothing is pending.
   */
  runMain(target: CommandClass, options?: BuildCliOptions): Promise<number>;
}
