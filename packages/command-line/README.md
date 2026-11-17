# @epsilon-asi/command-line

Declare command-line applications as decorated classes. Built on the decorator
factory in `@epsilon-asi/foundation` and shaped like its env system: a
`createCliSystem()` factory returns the decorators plus the functions that read
them, and a default instance is exported for the common case.
[commander](https://github.com/tj/commander.js) does the parsing.

Requires Node.js 22.12 or later and standard (TC39) decorators, so
`experimentalDecorators` must be off in the consuming project.

## Overview

A CLI is a tree of classes. `@Command` marks a class as a command, `@Option`
and `@Argument` fields hold the parsed values, and `run()` does the work. The
system reads the decorators, builds the commander program, and when a command
is invoked it instantiates the class, assigns the parsed values to its fields
and calls `run()`.

The things every CLI needs are built in: the root reads its name, version and
description from package.json, every root gets a `--log-level` option, every
command gets a logger, live lines for progress and prompts for input
(confirm, text, secret and editor), commands extending
`CliCommand` get `--format` and `render()`, and `runMain` is the whole `bin`
entrypoint.

```ts
import { Argument, CliCommand, Command, Option, runMain, type CommandContext } from '@epsilon-asi/command-line';

@Command({ description: 'Greet someone.' })
class GreetCommand extends CliCommand<App> {
  @Argument.string({ description: 'who to greet' })
  name!: string;                                    // greet <name>

  @Option.number({ short: 'n', default: 1, integer: true, min: 1 })
  times!: number;                                   // -n, --times <times>

  @Option.boolean()
  loud?: boolean;                                   // --loud

  run({ io, logger }: CommandContext<App>): void {
    logger.debug(`greeting ${this.name}`);          // shown with -l debug
    io.stdout(`Hello, ${this.name}!\n`.repeat(this.times));
  }
}

@Command({ package: import.meta.url, commands: [GreetCommand] })
class App {}                                        // name, -V and description from package.json

await runMain(App);                                 // parses process.argv, sets process.exitCode
```

The full version of this, mirroring `packages/agent-engineer`, is in
[examples/agent-engineer](examples/agent-engineer/cli.ts); run it with
`npm run example -- --help`.

## `@Command(metadata?)`

| Field         | Meaning                                                                                      |
| ------------- | -------------------------------------------------------------------------------------------- |
| `name`        | Defaults to the package's `bin` name when `package` is given, else the class name in kebab-case minus a trailing `Command` or `Cli` (`SyncReposCommand` → `sync-repos`). |
| `description` | Shown in help. Defaults to the package's `description` when `package` is given.             |
| `version`     | Registers `-V, --version`. Defaults to the package's `version` when `package` is given.      |
| `package`     | `import.meta.url` (or a path): read the nearest package.json. Root only. See [Package metadata](#package-metadata). |
| `logging`     | Overrides for the built-in log level option, or `false`. Root only. See [Logging](#logging). |
| `prompts`     | Overrides for the built-in `--yes` and `--no-input` options, or `false`. Root only. See [Prompts](#prompts). |
| `aliases`     | Extra names for a subcommand.                                                                |
| `hidden`      | Hide from help.                                                                              |
| `commands`    | Subcommand classes, in help order. Classes must be defined before the parent that lists them. |

A class with a `run()` method is invokable. A class with only `commands` prints
help when invoked without a subcommand (exit code 1). A class with both runs
`run()` when no subcommand is given. A class with neither is a definition error.

`@Command` is not inherited: a subclass is a different command and must be
decorated itself. `@Option` and `@Argument` fields *are* inherited, so shared
options can live on a base class.

## `CliCommand`

The base class commands extend. It brings the output format, so a command is
just its `@Command`, its own options and `run()`:

```ts
@Command({ description: 'Print CLI and runtime information.' })
export class InfoCommand extends CliCommand<App> {
  run({ io, cli }: CommandContext<App>): void {
    io.stdout(this.render(this.runtimeInfo(cli)));
  }
}
```

| Member              | Meaning                                                                    |
| ------------------- | -------------------------------------------------------------------------- |
| `format`            | `-f, --format <format>`: `text` (default) or `json`. Do not declare it again. |
| `render(data)`      | `data` in that format, ending in a newline. Text is a `key  value` line per property, keys padded into a column (at least 10 wide); object values are written as JSON. JSON is indented by 2. |
| `runtimeInfo(cli)`  | `{ name, version, node, platform }` for an info command.                   |

Override `render()` to print a command's text differently; `super.render(data)`
keeps the default. The same functions are exported as `renderOutput(data, format)`
and `runtimeInfo(cli)`, and the formats as `OUTPUT_FORMATS`.

A command that should not have `--format` implements `RunnableCommand<Root>`
instead, which is just the `run()` signature.

## Package metadata

Pass `package: import.meta.url` on the root and the system reads the nearest
package.json above that file. It works the same from `src/` under tsx or
vitest and from a compiled `dist/`.

| package.json field | Fills                                                                       |
| ------------------ | --------------------------------------------------------------------------- |
| `version`          | `version`, so `-V` always matches the release. Missing is a definition error. |
| `description`      | `description`                                                               |
| `bin`              | `name`, when there is exactly one bin. Otherwise the unscoped package name.  |

Anything given explicitly in `@Command` wins. The parsed file is on
`definition.package` and `context.cli.package`.

`readPackageJson(from)` and `findPackageJson(from)` are exported for other
uses, as is `cliNameFromPackage(packageJson)`.

## Logging

Every root command gets a log level option, and every command gets
`context.logger` at that level. Nothing has to be declared:

```
-l, --log-level <level>  minimum severity of log output
                         (choices: "debug", "info", "warn", "error", "silent",
                          default: "info", env: AGENT_ENGINEER_LOG_LEVEL)
```

The environment variable is `<NAME>_LOG_LEVEL`, from the root command's name
in SCREAMING_SNAKE_CASE. The flag may appear before or after a subcommand.
`context.logLevel` holds the resolved level.

Override any part of it with `logging` on the root:

| Field         | Meaning                                                                               |
| ------------- | ------------------------------------------------------------------------------------- |
| `level`       | Default level. `info` unless set.                                                     |
| `flags`       | Option flags; `-l, --log-level <level>` unless set. `false` removes the option, fixing the level at `level`. |
| `env`         | Environment variable; `<NAME>_LOG_LEVEL` unless set. `false` disables it.             |
| `description` | Help text.                                                                            |
| `hidden`      | Hide the option from help.                                                            |

`logging: false` removes both the option and the environment variable. A root
option whose flags collide with the log level option is a definition error;
remove the built-in option or change the flags of one of them.

The default logger writes `[level] message` lines to `io.stderr`; `createLogger(level, write)`
builds one anywhere. To use something else, give `buildCli` / `runCli` /
`runMain` a factory, called once per run:

```ts
await runMain(App, { logger: ({ level, io, name }) => myLogger(level) });
```

## Live lines

A live line is a line of output rewritten in place, for progress and status
that keeps changing. Every command can start one with `context.liveLine`:

```ts
async run({ logger, liveLine }: CommandContext): Promise<void> {
  const line = liveLine('Syncing', { spinner: true });  // ⠋ Syncing

  for (const [index, repo] of repos.entries()) {
    line.update(`Syncing ${repo} (${index + 1}/${repos.length})`);
    await sync(repo);
    logger.info(`synced ${repo}`);                       // printed above the line
  }

  line.done(`Synced ${repos.length} repos`);            // left behind as an ordinary line
}
```

| Member         | Meaning                                                             |
| -------------- | ------------------------------------------------------------------- |
| `update(text)` | Replaces the text.                                                  |
| `done(text?)`  | Ends the line, leaving `text`, or else the current text, behind.    |
| `clear()`      | Ends the line, erasing it.                                          |
| `text`         | The text last given to `liveLine()` or `update()`.                  |
| `active`       | False once the line has ended. An ended line ignores every call.    |

The line is drawn on `io.stderr`. On a terminal it is redrawn in place, cut
with `…` to fit on one row, and everything written through `context.io` and
`context.logger` meanwhile appears above it. Output that leaves a row
unfinished (no trailing newline) keeps the line off that row until it ends.

Anywhere else (a pipe, a file, CI, `TERM=dumb`, or a captured `io` in tests)
nothing is redrawn: a line writes only the text it leaves behind, so the output
matches what a terminal would end up showing.

One line is live at a time. Starting another ends the current one with
`done()`, and a line still live when `run()` returns or throws is ended the
same way. `spinner: true` animates `DEFAULT_SPINNER` (`⠋⠙⠹…`) before the text
on a terminal; pass `{ frames, interval }` for your own.

Outside a command, `createLiveOutput(io)` returns `{ io, liveLine, end, suspend }`
for any `CliIO`; write through its `io` while a line is live.
`suspend(fn)` takes the line off the screen while `fn` uses the terminal,
holding writes through `io` until it settles; prompts use it. Whether that is a
terminal comes from `io.terminal`, which `processIO` fills in with
`detectTerminal(process.stderr, process.stdout)`.

## Prompts

`context.prompt` asks the person running the CLI for input:

```ts
async run({ io, prompt }: CommandContext<App>): Promise<number | undefined> {
  if (!(await prompt.confirm('Delete 3 stale branches?', { default: false }))) return 1;

  const branch = await prompt.text('Base branch', { default: 'main' });
  const key = this.apiKey ?? (await prompt.secret('API key', { validate: (v) => v.startsWith('sk-') || 'Keys start with sk-.' }));
  const region = await prompt.select('Region', { choices: ['us-east-1', { value: 'eu-west-1', label: 'Ireland' }] });
  const checks = await prompt.multiselect('Checks to run', { choices: ['lint', 'test', 'build'], default: ['test'] });
  const message = await prompt.editor({
    initial: '\n# Describe the change. Lines starting with # are removed.\n',
    extension: 'md',
    comment: '#',
  });
  // ...
}
```

| Method                      | Shows                                            | Resolves to                                  |
| --------------------------- | ------------------------------------------------ | -------------------------------------------- |
| `confirm(message, options)` | `Delete 3 stale branches? [y/N] `                | `true` for y/yes, `false` for n/no           |
| `text(message, options)`    | `Base branch (main): `                           | the line typed                               |
| `secret(message, options)`  | `API key: ` with `*` for each character typed    | the line typed, never echoed                 |
| `editor(options)`           | the user's editor on a temporary file            | what is left in the file                     |
| `select(message, options)`  | `Region (type to filter): ` above the choices    | the value of the choice picked               |
| `multiselect(message, options)` | `Checks to run (space to pick): ` above the choices, each `[ ]` or `[x]` | the values picked, in the order of the choices |

| Option       | On                       | Meaning                                                                          |
| ------------ | ------------------------ | -------------------------------------------------------------------------------- |
| `default`    | all but secret           | The answer for Enter on its own (confirm, text), where the cursor starts (select), what starts picked (multiselect), and the answer without a terminal. |
| `choices`    | select, multiselect      | Required. Values, or `{ value, label }` to show a label instead. At least one, no value twice. |
| `min`        | multiselect              | How many must be picked before Enter is accepted; 0 unless set.                  |
| `validate`   | text, secret             | `(value) => true \| false \| string`, may be async. A rejected answer prints the message and asks again. |
| `mask`       | secret                   | Drawn per character; `*` unless set. `''` draws nothing, like sudo.               |
| `initial`    | editor                   | What the file holds when it opens.                                               |
| `extension`  | editor                   | `md` or `.md`, so the editor picks the right syntax.                             |
| `comment`    | editor                   | Lines starting with it are removed, as git does with `#`.                         |
| `allowEmpty` | editor                   | Accept an empty result. Otherwise leaving the file empty cancels, like git commit. |

In a list, the arrow keys (or Ctrl+P and Ctrl+N) move, wrapping at either end,
and a long list scrolls seven choices at a time. `select` filters the list by
label or value as you type and picks with Enter; `multiselect` picks and
unpicks with Space and accepts with Enter. Once answered, the list is erased
and the question is left with the answer, like the other prompts. The result
types follow the choices: `select('Region', { choices: ['us', 'eu'] })`
resolves to `'us' | 'eu'`, and a `default` that is not one of them does not
compile. Choices that cannot work (none, a value twice, a default or `min` out
of reach) throw a plain `Error` whether or not anyone could be asked, so the
mistake shows in tests too.

Prompts are drawn on stderr, so stdout stays clean for output: `mycli export >
out.json` can still ask. They are asked one at a time, and a live line is
taken off the screen while one is open; anything written meanwhile is printed
once it is answered.

**Without a terminal.** Prompts are only asked when stdin and stderr are both
TTYs, `TERM` is not `dumb` and `CI` is not set. Otherwise a prompt resolves to
its `default`, or throws `PromptUnavailableError` naming the question
(`kind`, `prompt` and `reason` are on the error). A secret has no default: read
it from an option or environment variable first and prompt only when it is
missing, as above.

**Built-in options.** Every root gets two, after `--log-level` in help:

| Option         | Meaning                                                                         |
| -------------- | ------------------------------------------------------------------------------- |
| `-y, --yes`    | Answers yes to every confirmation without asking. Other prompts are unaffected. |
| `--no-input`   | Turns prompts off, as if there were no terminal; also `<NAME>_NO_INPUT` set to anything. For CI and agents that have a TTY but cannot answer. |

Override them with `prompts` on the root, like `logging`:

| Field        | Meaning                                                                           |
| ------------ | --------------------------------------------------------------------------------- |
| `yes`        | Flags; `-y, --yes` unless set. `false` removes the option.                        |
| `noInput`    | Flags; `--no-input` unless set. `false` removes it and its environment variable. Flags without `--no-`, like `--non-interactive`, work too. |
| `noInputEnv` | `<NAME>_NO_INPUT` unless set. `false` disables it.                                |
| `editorEnv`  | `<NAME>_EDITOR` unless set, checked before `VISUAL` and `EDITOR` as git checks `GIT_EDITOR`. `false` disables it. |

`prompts: false` removes all of them. Because commander stores `--no-input`
as `input`, a root `--input` option is a definition error; give one of them
other flags.

**Cancelling.** Ctrl+C, Ctrl+D on an empty answer (or in a list with nothing
typed), an editor killed by a signal, and an editor left empty reject with
`PromptCancelledError`. A command
can catch it; otherwise the run prints its message (`Cancelled.`) and exits
with code 130.

**The editor** is `<NAME>_EDITOR`, then `VISUAL`, then `EDITOR`, then `vi`.
It runs through `/bin/sh`, so `code --wait` works, and edits a file readable
only by its owner, in a new temporary directory removed afterwards. The resolved command is available as `resolveEditor(env, editorEnv)`.
An editor that exits non-zero fails the prompt, and one that is not installed
fails saying to set `VISUAL` or `EDITOR`.

Outside a command, `terminalPrompter()` returns a `Prompter` on the terminal, or
`undefined` when there is none to ask on. It has no `--yes` or defaults
handling of its own beyond the per-prompt `default` for Enter.

## `@Option.<type>(spec?)`

Options are instance fields. Flags are derived from the property name unless
`flags` is given: `outputDir` becomes `--output-dir <output-dir>`, a boolean
becomes `--output-dir`, `short: 'o'` prepends `-o,`, and `valueName` replaces
the placeholder.

| Spec field    | Meaning                                                                       |
| ------------- | ----------------------------------------------------------------------------- |
| `flags`       | Full commander flags, e.g. `'-f, --format <format>'`. Overrides derivation.     |
| `short`       | Single-character short flag.                                                  |
| `valueName`   | Placeholder in help.                                                          |
| `description` | Shown in help.                                                                |
| `default`     | Used when the flag and `env` are absent; shown in help.                       |
| `env`         | Environment variable consulted when the flag is absent.                       |
| `required`    | The option must end up with a value (flag, env or default).                   |
| `hidden`      | Hide from help.                                                               |
| `choices`     | `choice` only. Values are validated against this list.                        |
| `integer`, `min`, `max` | `number` only. Validated with commander's own usage errors.          |

The field type must match the option's value type exactly, so what `run()`
reads is what the system assigns. A value is guaranteed only with a `default`
or `required: true`; otherwise the field must include `undefined`.

| Declaration                                         | Field type                 |
| --------------------------------------------------- | -------------------------- |
| `@Option.string()`                                  | `string \| undefined`      |
| `@Option.string({ default: 'x' })`                  | `string`                   |
| `@Option.string({ required: true })`                | `string`                   |
| `@Option.number({ default: 1 })`                    | `number`                   |
| `@Option.boolean()`                                 | `boolean \| undefined`     |
| `@Option.boolean({ default: false })`               | `boolean`                  |
| `@Option.choice({ choices: ['a', 'b'] as const })`  | `'a' \| 'b' \| undefined`  |

A field initializer acts as a fallback when nothing supplies a value, but it is
not shown in help; prefer `default` for anything users should see.

## `@Argument.<type>(spec?)`

Positional arguments, in declaration order. They are required unless they have
a `default` or say `required: false`. `Argument.list()` collects the remaining
arguments into a `string[]` and must be declared last; it requires at least one
value unless `required: false`.

| Declaration                                   | Field type              |
| --------------------------------------------- | ----------------------- |
| `@Argument.string()`                          | `string`                |
| `@Argument.string({ required: false })`       | `string \| undefined`   |
| `@Argument.string({ default: 'out' })`        | `string`                |
| `@Argument.number()`                          | `number`                |
| `@Argument.choice({ choices: C })`            | `C[number]`             |
| `@Argument.list()`                            | `string[]`              |

## `run(context)`

| Context field | Meaning                                                                         |
| ------------- | ------------------------------------------------------------------------------- |
| `io`          | `stdout` / `stderr` writers. Write here, not to `console`, so tests can capture. |
| `logger`      | `debug` / `info` / `warn` / `error` at the resolved level. See [Logging](#logging). |
| `logLevel`    | The resolved level.                                                             |
| `liveLine`    | Starts a line redrawn in place on a terminal. See [Live lines](#live-lines).    |
| `prompt`      | Asks for input: `confirm`, `text`, `secret`, `editor`, `select`, `multiselect`. See [Prompts](#prompts). |
| `cli`         | The root's `name`, `version`, `description` and parsed `package`.               |
| `argv`        | The raw user arguments.                                                         |
| `root`        | The populated root command instance, typed via `CommandContext<Root>`.          |
| `ancestors`   | Populated ancestor instances, root first. Empty on the root.                    |
| `command`     | The commander `Command`, for anything not exposed here.                         |

`run()` may be async and may return a number, which becomes the exit code.
Thrown errors are printed as `error: <message>` with exit code 1, except a
cancelled prompt, which exits with 130.

## Running and inspecting

| Function                               | Purpose                                                                            |
| -------------------------------------- | ---------------------------------------------------------------------------------- |
| `runMain(Root, options?)`              | For `bin` entrypoints: runs on `process.argv`, sets `process.exitCode`, resolves to it. |
| `runCli(Root, argv, options?)`         | Build, parse and run. Resolves to the exit code; never calls `process.exit`.       |
| `buildCli(Root, options?)`             | Returns `{ definition, program, run(argv) }`. A built CLI runs once.               |
| `describeCommand(Root)`                | The validated `CommandDefinition` tree, for docs and tests. No commander involved. |
| `createCliSystem({ namespace? })`      | An isolated system with its own registry.                                          |

`options` are `{ io?, logger?, use?, prompter? }`. `prompter` answers prompts
instead of the terminal; without it, prompts use the terminal only when `io` is
not given either, so a run with a captured `io` never waits on the real stdin.

Declaration mistakes (a class without `@Command`, a static or doubly decorated
field, duplicate subcommand names, a list argument that is not last, `package`
or `logging` on a subcommand, …) throw `CliDefinitionError` naming the class,
at build time rather than when a user hits the path.

## Testing a CLI

Pass a capturing `io` and assert on the exit code and output. Nothing touches
the real process:

```ts
const out: string[] = [];
const io = { stdout: (t: string) => void out.push(t), stderr: () => {} };
expect(await runCli(App, ['greet', 'World'], { io })).toBe(0);
expect(out.join('')).toBe('Hello, World!\n');
```

Options with `env` read `process.env`; stub it (`vi.stubEnv`) in tests.

Answer prompts with `scriptedPrompter`. Each answer names the kind of prompt it
answers, and may name the question as a string or a pattern:

```ts
const prompter = scriptedPrompter([
  { confirm: true, message: 'Delete 3 stale branches?' },
  { text: '' },                       // Enter on its own: the default
  { secret: 'sk-test' },
  { editor: 'fix: the thing\n# comment lines are still removed\n' },
  { select: 'eu-west-1' },            // a value, not a label
  { multiselect: ['lint', 'test'] },
  { cancel: true },                   // Ctrl+C on whatever is asked next
]);
expect(await runCli(App, ['prune'], { io, prompter })).toBe(0);
// `prompter.asked` lists every { kind, message }; `remaining` counts what is left.
```

A prompt of another kind or question, one with no answer left, an answer
`validate` rejects and a list answer that is not one of the choices all throw,
so the run fails where the conversation went differently.

**Every answer must be used.** When a run ends with answers left in the
script, `run()` (and so `runCli`) rejects instead of resolving to an exit
code, naming the unused answers, what was asked and, for a failed run, what
ended it. A command that stops asking, or a `--yes` that now answers a
confirmation, fails its test even when the test expects a failing exit code.
To show that nothing is asked, pass `scriptedPrompter([])`. Use a new script
for each run. Without a prompter, a captured `io` runs as if there were no
terminal, which is how to test `default`s, `--yes` and `--no-input`.

A captured `io` has no `terminal`, so live lines write only their final text.
Give it one to see the redraws: `{ stdout, stderr, terminal: { columns: 40 } }`.

Vite 8 transforms TypeScript with oxc, which only implements legacy
decorators, so a project that tests decorated classes with vitest needs the
plugin published at `@epsilon-asi/command-line/vitest`. It transforms
TypeScript with esbuild, which is an optional peer dependency; add it as a dev
dependency alongside vitest:

```ts
// vitest.config.ts
import { standardDecorators } from '@epsilon-asi/command-line/vitest';
import { defineConfig } from 'vitest/config';

export default defineConfig({ plugins: [standardDecorators()], test: { /* ... */ } });
```

## Toolchain notes

- `tsc` compiles standard decorators for every target. `tsx` (esbuild) runs them directly.
- Importing this package polyfills `Symbol.metadata` (via foundation) before any class is defined.
- Add `ESNext.Decorators` to the `lib` of a consuming tsconfig.

## Layout

| Path                     | Purpose                                                               |
| ------------------------ | --------------------------------------------------------------------- |
| `src/types.ts`           | Every public type: metadata, contexts, decorator APIs, definitions    |
| `src/createCliSystem.ts` | Registry, decorators, `runMain`, default instance                     |
| `src/cliCommand.ts`      | The `CliCommand` base class, `renderOutput` and `runtimeInfo`         |
| `src/describe.ts`        | Decorators → validated `CommandDefinition` tree, package and logging resolution |
| `src/program.ts`         | `CommandDefinition` → commander program, instance population, `run()` |
| `src/logging.ts`         | Log levels, `createLogger`, the default logger factory                |
| `src/liveLine.ts`        | Live lines: `createLiveOutput`, redrawing in place, fitting the terminal width |
| `src/io.ts`              | `processIO` and `detectTerminal`                                      |
| `src/prompt/terminal.ts` | `terminalPrompter`: confirm and text with readline, secrets and lists in raw mode |
| `src/prompt/list.ts`     | Drawing `select` and `multiselect` lists and reading their keys       |
| `src/prompt/editor.ts`   | Opening the user's editor on a temporary file, `resolveEditor`        |
| `src/prompt/guard.ts`    | `context.prompt`: `--yes`, defaults without a terminal, one prompt at a time |
| `src/prompt/scripted.ts` | `scriptedPrompter` for tests                                          |
| `src/prompt/shared.ts`   | Prompt defaults, question formatting, validation, choice checks and editor text clean-up |
| `src/package.ts`         | `readPackageJson`, `findPackageJson`, `cliNameFromPackage`            |
| `src/naming.ts`          | Name, flag and environment variable derivation                        |
| `src/vitest.ts`          | The `standardDecorators` vitest plugin (`./vitest` export)            |
| `examples/`              | Runnable examples, exercised by the tests                             |

## Scripts

| Script                     | Description                                   |
| -------------------------- | --------------------------------------------- |
| `npm run build`            | Compile to `dist/`                            |
| `npm run typecheck`        | Type-check `src/`, `examples/` and `tests/`   |
| `npm test`                 | Unit tests and type tests (`*.test-d.ts`)     |
| `npm run test:coverage`    | Tests with v8 coverage (80% thresholds)       |
| `npm run example -- <args>`| Run the agent-engineer example with tsx       |
| `npm run verify`           | Typecheck, test and build                     |
