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

Requires Node.js 24 or later (what `@epsilon-asi/sandbox` needs) and standard (TC39) decorators, so `experimentalDecorators`
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
  do [-C] <request...>      parse the request's intent and hand it to that intent's agent
  query|q [-C] <question...> answer a question about the repository
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
and `do` prints the branch and the files it changed. A run that changes nothing, or fails, leaves
no branch behind.

### `-C, --container`

With `-C` (or `AGENT_ENGINEER_CONTAINER=1`), the agent's worktree is also mounted into a Docker
container, and the agent gets `run_task`: it can run the repository's tests, builds, linters and
package scripts there, in the directory you ran from or one it names. Dependencies are installed in
the container the first time a task runs in a directory. Commands run as your user, so files they
write in the worktree are yours. Without `-C` the agent never runs code, so nothing it writes runs
on your machine. The container and the worktree are removed when the run ends.

`container` in `agent-engineer.yaml` sets it up:

```yaml
container:
  image: node:24.15        # needs the repository's toolchain (default: node:24.15)
  network: true            # false cuts the network; dependencies then cannot be installed
  cache: true              # keep npm's download cache in ~/.easi/cache between runs
  taskTimeoutSeconds: 600  # longest one install or task may run
``` Review it with `git diff <branch>~1 <branch>`.

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
| `npm test`              | Run all tests with v8 coverage; fails under the 90% thresholds |
| `npm run test:live`     | Run the live smoke tests on real OpenAI models (needs `OPENAI_API_KEY`; costs money) |
| `npm run test:container` | Run the `--container` tests on real Docker (pulls `node:24.15` on first run) |
| `npm run eval`          | Run the evals on real models (needs `OPENAI_API_KEY`; costs money) |
| `npm run test:watch`    | Run tests in watch mode                              |
| `npm run verify`        | Typecheck, test, and build                           |

## Testing agents

| Tests | What they cover |
| --- | --- |
| `tests/agents/paths.test.ts` | The path guard, with property-based tests (fast-check) |
| `tests/agents/tools.test.ts` | Every read and write tool, called directly on a real sandbox |
| `tests/agents/snapshot.test.ts` | The sandbox has exactly the checkout's files: staged, unstaged, renamed, deleted, untracked, ignored |
| `tests/agents/workspace.test.ts` | Sandbox and branch cleanup, including failures |
| `tests/graphs/lifecycle.test.ts` | Failed, aborted, concurrent and round-limited runs leave nothing behind |
| `tests/commands/*.test.ts` | `do` and `query` end to end through `runCli`, and config from every layer |
| `tests/agents/task.test.ts` | `run_task`: installs, arguments, failures, unknown tasks, directories |
| `tests/container/docker.test.ts` | `--container` on real Docker; skipped unless `AGENT_ENGINEER_CONTAINER_TESTS=1` |
| `tests/evals/intent.test.ts` | The intent dataset is sound, and the intent eval scores scripted models as it should |

Apart from the live tests, no test calls a model or the network. Agents run on `ScriptedChatModel`
([tests/helpers/scriptedModel.ts](tests/helpers/scriptedModel.ts)), which replies with scripted
text, tool calls or errors, against real git repositories from
[tests/helpers/gitRepo.ts](tests/helpers/gitRepo.ts).

- **Graphs** take their models in the run context:
  `withWorkspace(graph).invoke(input, { context: { config, cwd, models: { agent } } })`.
- **The CLI** takes them from the `models` middleware, which a test provides ahead of it:
  `runCli(AgentEngineer, argv, { io, use: [provideModels({ agent })] })`.
- **Trajectories**: pass a `RunRecorder` (from `@epsilon-asi/langgraph`) in `callbacks` to record every tool call (input, output,
  duration) and model call (tokens, duration). The callbacks also reach LangSmith tracing when it is
  switched on.
- **Live smoke tests** in [tests/live](tests/live) run the real CLI on real models. They are
  skipped unless `AGENT_ENGINEER_LIVE_TESTS=1` is set (`npm run test:live` sets it), so a key in
  your environment never costs money on a plain `npm test`.
- **The intent model** is `models.intent`: any LangChain chat model, or in tests
  `ScriptedIntentModel`, which always makes one choice: `provideModels({ agent, intent })`.

## Evals

Tests check that the code is right; evals measure how well the agents do their jobs, on real models.
They are built on `@epsilon-asi/evals`, live in [evals/](evals), and never run in `npm test`:

```bash
OPENAI_API_KEY=... npm run eval
```

| Suite | Measures |
| --- | --- |
| [intent](evals/intent) | How `do` routes 153 labeled requests ([dataset.yaml](evals/intent/dataset.yaml)), 57 of them on the boundary between two intents. `correct` is the share routed to their intent; `readRoutedToWrite` the share of questions and plans sent to an agent that changes code, the costly mistake. The summary has a confusion matrix and accuracy by boundary pair. |

Each run writes `eval-results/<suite>.json` and prints a summary. It fails when a score breaks its
threshold or drops below `evals/baselines/<suite>.json` by more than noise. Useful settings:

- `EVAL_INTENT_MODEL=<model>`: run the intent suite on another OpenAI model, to compare.
- `EVAL_TRIALS=3`: run each case three times, for narrower intervals and to see flaky cases.
- `EVAL_FILTER=boundary`: run only the cases with that tag or id (the baseline is not enforced).
- `EVAL_REGRADE=1`: grade the last report again after changing a grader, without calling the model.
- `EVAL_UPDATE_BASELINE=1`: record the run as the baseline; commit the file.

The **Evals** workflow runs them on GitHub (Actions → Evals → Run workflow), with the summary on the
run's page and the report as an artifact. It needs an `OPENAI_API_KEY` repository secret.

## Toolchain notes

- `tsc` compiles standard decorators for every target. `tsx` (esbuild) runs them directly.
- Vite 8's oxc transform only handles legacy decorators, so [vitest.config.ts](vitest.config.ts)
  uses the `standardDecorators` plugin from `@epsilon-asi/command-line/vitest`, which needs
  `esbuild` as a dev dependency.
- Importing `@epsilon-asi/command-line` polyfills `Symbol.metadata` before any class is defined.
