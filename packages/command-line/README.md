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
command gets a logger, and `runMain` is the whole `bin` entrypoint.

```ts
import { Argument, Command, Option, runMain, type CliCommand, type CommandContext } from '@epsilon-asi/command-line';

@Command({ description: 'Greet someone.' })
class GreetCommand implements CliCommand<App> {
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
| `aliases`     | Extra names for a subcommand.                                                                |
| `hidden`      | Hide from help.                                                                              |
| `commands`    | Subcommand classes, in help order. Classes must be defined before the parent that lists them. |

A class with a `run()` method is invokable. A class with only `commands` prints
help when invoked without a subcommand (exit code 1). A class with both runs
`run()` when no subcommand is given. A class with neither is a definition error.

`@Command` is not inherited: a subclass is a different command and must be
decorated itself. `@Option` and `@Argument` fields *are* inherited, so shared
options can live on a base class.

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
| `cli`         | The root's `name`, `version`, `description` and parsed `package`.               |
| `argv`        | The raw user arguments.                                                         |
| `root`        | The populated root command instance, typed via `CommandContext<Root>`.          |
| `ancestors`   | Populated ancestor instances, root first. Empty on the root.                    |
| `command`     | The commander `Command`, for anything not exposed here.                         |

`run()` may be async and may return a number, which becomes the exit code.
Thrown errors are printed as `error: <message>` with exit code 1.

## Running and inspecting

| Function                               | Purpose                                                                            |
| -------------------------------------- | ---------------------------------------------------------------------------------- |
| `runMain(Root, { io?, logger? })`      | For `bin` entrypoints: runs on `process.argv`, sets `process.exitCode`, resolves to it. |
| `runCli(Root, argv, { io?, logger? })` | Build, parse and run. Resolves to the exit code; never calls `process.exit`.       |
| `buildCli(Root, { io?, logger? })`     | Returns `{ definition, program, run(argv) }`. A built CLI runs once.               |
| `describeCommand(Root)`                | The validated `CommandDefinition` tree, for docs and tests. No commander involved. |
| `createCliSystem({ namespace? })`      | An isolated system with its own registry.                                          |

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
| `src/describe.ts`        | Decorators → validated `CommandDefinition` tree, package and logging resolution |
| `src/program.ts`         | `CommandDefinition` → commander program, instance population, `run()` |
| `src/logging.ts`         | Log levels, `createLogger`, the default logger factory                |
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
