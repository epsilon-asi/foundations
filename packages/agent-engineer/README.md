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
  do <request...>           parse the request's intent and hand it to that intent's agent
  query|q <question...>     answer a question about the repository
```

`do` and `query` need `OPENAI_API_KEY`. Their agents work in a sandbox: a git worktree of the
repository in a temporary directory, with your uncommitted and untracked files copied in, so they
see the repository as it is and never touch your checkout. Agents read it through code-search
tools from `@epsilon-asi/sandbox`; `offLimits` and `ignore` paths and files over
`maxContextFileSizeBytes` stay out of reach.

`do` routes the request to one of the intents in [router.ts](src/graphs/router.ts). Questions and
the three planners only read. `mini_change`, `bug_fix`, `component_change` and `feature_change`
also edit files, at most `maxOutputFiles` of them, and commit to a new branch
`agent-engineer/<intent>-<id>`. Your working changes go in a commit of their own before the agent's,
and `do` prints the branch and the files it changed. Review it with `git diff <branch>~1 <branch>`.

## Layout

| Path                  | Purpose                                                                         |
| --------------------- | ------------------------------------------------------------------------------- |
| `src/cli.ts`          | The root `AgentEngineer` command: package metadata and the list of subcommands  |
| `src/commands/*.ts`   | One `@Command` class per subcommand, with its options and `run()`               |
| `src/main.ts`         | `bin` entrypoint: `runMain(AgentEngineer)`                                      |
| `src/graphs/router.ts` | The root graph: intent parsing, then the graph of each intent                  |
| `src/graphs/<intent>/` | One graph per intent, each a `createAgentGraph()` with its own instructions    |
| `src/agents/`         | The repo agent node, its sandbox tools, and the per-run `RepoWorkspace`         |
| `tests/`              | Runs the CLI through `runCli` with captured output; nothing touches the process |

## Adding a command

1. Create `src/commands/<name>.ts` with a class decorated `@Command({ description })` that
   extends `CliCommand<AgentEngineer>`, as [info.ts](src/commands/info.ts) does. The command
   name is derived from the class name (`SyncReposCommand` → `sync-repos`), and the base class
   gives it `-f, --format text|json`.
2. Declare any options and arguments of its own as `@Option.<type>()` / `@Argument.<type>()`
   fields. The field type must match what the decorator produces; see the command-line README.
3. In `run()`, print data with `io.stdout(this.render(data))`, log through `context.logger`, and
   read the CLI's name and version from `context.cli`.
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
