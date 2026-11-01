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

```ts
import { Argument, Command, Option, runCli, type CliCommand, type CommandContext } from '@epsilon-asi/command-line';

const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
type LogLevel = (typeof LOG_LEVELS)[number];

@Command({ description: 'Greet someone.' })
class GreetCommand implements CliCommand<App> {
  @Argument.string({ description: 'who to greet' })
  name!: string;                                    // greet <name>

  @Option.number({ short: 'n', default: 1, integer: true, min: 1 })
  times!: number;                                   // -n, --times <times>

  @Option.boolean()
  loud?: boolean;                                   // --loud

  run({ io, root }: CommandContext<App>): void {
    if (root.logLevel === 'debug') io.stderr(`greeting ${this.name}\n`);
    io.stdout(`Hello, ${this.name}!\n`.repeat(this.times));
  }
}

@Command({ name: 'app', version: '1.0.0', commands: [GreetCommand] })
class App {
  @Option.choice({ short: 'l', choices: LOG_LEVELS, default: 'info', env: 'APP_LOG_LEVEL' })
  logLevel!: LogLevel;                              // -l, --log-level <log-level>
}

process.exitCode = await runCli(App, process.argv.slice(2));
```

The full version of this, mirroring `packages/agent-engineer`, is in
[examples/agent-engineer](examples/agent-engineer/cli.ts); run it with
`npm run example -- --help`.

## `@Command(metadata?)`

| Field         | Meaning                                                                                      |
| ------------- | -------------------------------------------------------------------------------------------- |
| `name`        | Defaults to the class name in kebab-case minus a trailing `Command` or `Cli` (`SyncReposCommand` → `sync-repos`). |
| `description` | Shown in help.                                                                               |
| `version`     | Registers `-V, --version`. Set it on the root.                                               |
| `aliases`     | Extra names for a subcommand.                                                                |
| `hidden`      | Hide from help.                                                                              |
| `commands`    | Subcommand classes, in help order. Classes must be defined before the parent that lists them. |

A class with a `run()` method is invokable. A class with only `commands` prints
help when invoked without a subcommand (exit code 1). A class with both runs
`run()` when no subcommand is given. A class with neither is a definition error.

`@Command` is not inherited: a subclass is a different command and must be
decorated itself. `@Option` and `@Argument` fields *are* inherited, so shared
options can live on a base class.

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
| `argv`        | The raw user arguments.                                                         |
| `root`        | The populated root command instance, typed via `CommandContext<Root>`.          |
| `ancestors`   | Populated ancestor instances, root first. Empty on the root.                    |
| `command`     | The commander `Command`, for anything not exposed here.                         |

`run()` may be async and may return a number, which becomes the exit code.
Thrown errors are printed as `error: <message>` with exit code 1.

## Running and inspecting

| Function                               | Purpose                                                                            |
| -------------------------------------- | ---------------------------------------------------------------------------------- |
| `runCli(Root, argv, { io? })`          | Build, parse and run. Resolves to the exit code; never calls `process.exit`.       |
| `buildCli(Root, { io? })`              | Returns `{ definition, program, run(argv) }`. A built CLI runs once.               |
| `describeCommand(Root)`                | The validated `CommandDefinition` tree, for docs and tests. No commander involved. |
| `createCliSystem({ namespace? })`      | An isolated system with its own registry.                                          |

Declaration mistakes (a class without `@Command`, a static or doubly decorated
field, duplicate subcommand names, a list argument that is not last, …) throw
`CliDefinitionError` naming the class, at build time rather than when a user
hits the path.

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

## Toolchain notes

- `tsc` compiles standard decorators for every target. `tsx` (esbuild) runs them directly.
- Vite 8's oxc transform only handles legacy decorators, so [vitest.config.ts](vitest.config.ts)
  transforms TypeScript with esbuild, which also emits `Symbol.metadata`. Copy that plugin into
  projects that test decorated classes with vitest.
- Importing this package polyfills `Symbol.metadata` (via foundation) before any class is defined.

## Layout

| Path                     | Purpose                                                               |
| ------------------------ | --------------------------------------------------------------------- |
| `src/types.ts`           | Every public type: metadata, contexts, decorator APIs, definitions    |
| `src/createCliSystem.ts` | Registry, decorators, default instance                                |
| `src/describe.ts`        | Decorators → validated `CommandDefinition` tree                       |
| `src/program.ts`         | `CommandDefinition` → commander program, instance population, `run()` |
| `src/naming.ts`          | Name and flag derivation                                              |
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
