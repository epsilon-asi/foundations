# @epsilon-asi/agent-engineer

Agent Engineer command-line interface, declared as decorated classes on
[`@epsilon-asi/command-line`](https://www.npmjs.com/package/@epsilon-asi/command-line).
Each command is a class: `@Command` names and describes it, `@Option` fields hold the parsed
values, and `run()` does the work. The command-line package builds the
[commander](https://github.com/tj/commander.js) program and populates the classes.

The root command passes `package: import.meta.url`, so its name, `--version` and description come
from this package.json. The `-l, --log-level` option, the `AGENT_ENGINEER_LOG_LEVEL` variable and
the logger every command receives are built into the command-line package; nothing here declares
them.

Requires Node.js 22.12 or later and standard (TC39) decorators, so `experimentalDecorators`
stays off.

## Usage

```sh
npm run dev -- --help             # run from source with tsx
npm run build && npm start -- info
```

```
agent-engineer [--log-level <level>] <command>

  -l, --log-level <level>   debug | info | warn | error | silent (default: info, env: AGENT_ENGINEER_LOG_LEVEL)
  -V, --version             print the version
  -h, --help                print help

Commands:
  info [--format text|json] print CLI and runtime information
```

## Layout

| Path                  | Purpose                                                                         |
| --------------------- | ------------------------------------------------------------------------------- |
| `src/cli.ts`          | The root `AgentEngineer` command: package metadata and the list of subcommands  |
| `src/commands/*.ts`   | One `@Command` class per subcommand, with its options and `run()`               |
| `src/main.ts`         | `bin` entrypoint: `runMain(AgentEngineer)`                                      |
| `tests/`              | Runs the CLI through `runCli` with captured output; nothing touches the process |

## Adding a command

1. Create `src/commands/<name>.ts` with a class decorated `@Command({ description })` that
   implements `CliCommand<AgentEngineer>`. The command name is derived from the class name
   (`SyncReposCommand` → `sync-repos`).
2. Declare its options and arguments as `@Option.<type>()` / `@Argument.<type>()` fields. The
   field type must match what the decorator produces; see the command-line README.
3. In `run()`, write output through `context.io`, log through `context.logger`, and read the CLI's
   name and version from `context.cli`.
4. Add the class to `commands` in `src/cli.ts`, and cover it in `tests/cli.test.ts`.

## Scripts

| Script                  | Description                                          |
| ----------------------- | ---------------------------------------------------- |
| `npm run dev -- <args>` | Run from source with tsx                             |
| `npm run build`         | Compile to `dist/`                                   |
| `npm start -- <args>`   | Run the compiled CLI                                 |
| `npm run typecheck`     | Type-check `src/`, `tests/` and config               |
| `npm test`              | Run unit tests and type tests (`*.test-d.ts`)        |
| `npm run test:watch`    | Run tests in watch mode                              |
| `npm run test:coverage` | Run tests with v8 coverage (80% thresholds)          |
| `npm run verify`        | Typecheck, test, and build                           |

## Toolchain notes

- `tsc` compiles standard decorators for every target. `tsx` (esbuild) runs them directly.
- Vite 8's oxc transform only handles legacy decorators, so [vitest.config.ts](vitest.config.ts)
  uses the `standardDecorators` plugin from `@epsilon-asi/command-line/vitest`, which needs
  `esbuild` as a dev dependency.
- Importing `@epsilon-asi/command-line` polyfills `Symbol.metadata` before any class is defined.
