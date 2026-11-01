# Repo runner

Detects a repository's toolchain and runs its install / test / build / named tasks through one typed API. Part of
`@epsilon-asi/sandbox`; import from the package root or the `@epsilon-asi/sandbox/repo-runner` subpath. Every command
runs through an injected `CommandExecutor` (default: the shared `ChildProcessCommandExecutor`, no shell) and is
reported as a `RepoTaskResult`.

| Kind              | Detected by                                                         | Install                                      | Tasks                                                                                            |
| ----------------- | ------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `node-typescript` | `package.json`                                                      | `npm ci` with a lockfile, else `npm install` | every `package.json` script (`npm test`, `npm run <name>`; forwarded args after `--`)            |
| `python-uv`       | `pyproject.toml` + (`uv.lock` \| `[tool.uv]` \| `uv_build` backend) | `uv sync`                                    | `build` + entry points (packaged projects), `test`/`lint`/`typecheck` + tool names from dev deps |
| `golang`          | `go.mod`                                                            | `go mod download`                            | `test`, `build` (output discarded), `vet`, `generate` (over `./...`), `tidy`                     |
| `terraform`       | a `*.tf` file in the root                                           | `terraform init -input=false -backend=false` | `build`/`validate`, `test`, `fmt` (`-check -recursive`)                                          |

`terraform init` runs with `-backend=false`: providers and modules are downloaded, but no remote state is read,
written, or locked. `plan`/`apply` are deliberately not tasks. The toolchains (`npm`, `uv`, `go`, `terraform`) must be
on `PATH` wherever the executor runs commands.

## Usage

```ts
import { CommandFailedError, createDefaultRepoRunnerRegistry } from '@epsilon-asi/sandbox/repo-runner';

const registry = createDefaultRepoRunnerRegistry(); // optional: { executor, defaultTimeoutMs }
const runner = await registry.detect('/sandbox/checkout');

console.log(runner.kind, await runner.getTaskDefinitions());
await runner.installDependencies({ additionalArgs: ['--ignore-scripts'] }); // throws CommandFailedError on failure

const test = await runner.runTest({ args: ['--reporter=dot'], allowNonZeroExit: true });
console.log(test.exitCode, test.timedOut, test.stdout);

// Missing tasks throw MissingTaskError by default, or can be reported as skipped:
const lint = await runner.runNamedTask('lint', { missingTaskBehavior: 'skip' });
if (lint.skipped) console.log(lint.skipReason);
```

Runners can also be used directly: `new GoRepoRunner(repoPath)` or
`new NodeTypescriptRepoRunner(repoPath, { executor, defaultTimeoutMs: 600_000 })`. Pass your own `CommandExecutor` to
log, fake, or redirect execution (e.g. into a container).

Typechecked examples, exercised by `test/repo-runner/examples/`:

- [`node-usage.ts`](../../examples/repo-runner/node-usage.ts) — install, then lint/test/build a Node repo, skipping
  missing scripts.
- [`registry-usage.ts`](../../examples/repo-runner/registry-usage.ts) — detect any repo and summarise its install plan
  and tasks.
- [`custom-runner/cargoRepoRunner.ts`](../../examples/repo-runner/custom-runner/cargoRepoRunner.ts) — add a Rust/cargo
  runner and register it.

## Public API

**Runners** — `NodeTypescriptRepoRunner`, `PythonRepoRunner`, `GoRepoRunner`, `TerraformRepoRunner`; all extend
`AbstractRepoRunner` and implement `RepoRunner<TConfig, TInstallPlan>`. Constructor: `(repoPath, options?)` with
`RepoRunnerOptions` `{ executor?, defaultTimeoutMs? }` (default timeout `DEFAULT_TASK_TIMEOUT_MS`, 120 s).

| Member                                                | Description                                                                                            |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `kind`, `repoPath`                                    | Runner kind and absolute repository root.                                                              |
| `detect()` / `assertDetected()`                       | Ecosystem check; `assertDetected` throws `UnsupportedRepositoryError`.                                 |
| `getRepoConfig()`                                     | Parsed, memoized config (`NodeRepoConfig`, `PythonRepoConfig`, `GoRepoConfig`, `TerraformRepoConfig`). |
| `getTaskDefinitions()`                                | `{ taskName: description }` — exactly the tasks `runNamedTask` accepts.                                |
| `getPreferredInstallPlan(options?)`                   | The `{ binary, args, mode }` that `installDependencies` will run.                                      |
| `installDependencies(options?)`                       | Runs the install plan (`additionalArgs` appended).                                                     |
| `runNamedTask(name, options?)`, `runTest`, `runBuild` | Runs a task; `args` are forwarded, `missingTaskBehavior: 'skip'` returns a skipped result.             |

Ecosystem extras: `NodeTypescriptRepoRunner` adds `runLint`, `runTypecheck`, `getScriptDefinitions`, `hasScript`,
`getVersionSnapshot`, `getDeclaredDependencyVersion`, `getTypescriptConfig`; `PythonRepoRunner` adds
`getVersionSnapshot`.

**Options and results** — `RunTaskOptions` and `InstallDependenciesOptions` extend `RepoCommandOptions`, which is the
shared `CommandExecutionOptions` (`cwd`, `env`, `stdin`, `timeoutMs`, `signal`, `maxOutputBytes`) plus the runner's
result policy:

- `allowNonZeroExit` (default `false`): a command that exits non-zero, is killed by a signal, or times out throws the
  shared `CommandFailedError` (message names the task, e.g. `Running task "test": npm test failed (exit code 1)`,
  `error.result` holds the result). With `true`, the result is returned; check it with `isSuccessfulResult`.
- `trimStdout`: trims the captured stdout.

Commands run in the repository root with the runner's default timeout unless the call overrides `cwd`/`timeoutMs`;
runner-only options never reach the executor. A binary that cannot be spawned (or an aborted `signal`) rejects with the
executor's `CommandExecutionError`, unchanged. `RepoTaskResult` is `CommandExecutionResult` (`exitCode: number | null`,
`signal`, `timedOut`, …) plus `skipped` / `skipReason`; a skipped task has an empty `command`, `exitCode: 0`, and the
repository root as `cwd`.

**Registry** — `RepoRunnerRegistry` (`register`, `has`, `kinds`, `create`, `detect`; registration order is detection
priority) and `createDefaultRepoRunnerRegistry(options?: RepoRunnerOptions)` with the four built-in runners sharing
one executor.

**Errors** — `RepoRunnerError` (extends `SandboxError`) and its subclasses `UnsupportedRepositoryError`,
`MissingTaskError` (with `availableTasks`), `RepoConfigParseError` (with `filePath`; schema errors name the offending
field path). Command failures use the shared `CommandFailedError` / `CommandExecutionError`.

**Extension** — `AbstractRepoRunner` plus the `TaskCommand`, `TaskTable`, `InstallPlan`, `RepoCommandLine` types. See
[runner-extension-guide.md](runner-extension-guide.md).

The subpath also re-exports the shared `CommandExecutor`, `CommandExecutionOptions`, `CommandExecutionResult`,
`EnvironmentOverrides`, `ChildProcessCommandExecutor`, `SandboxError`, `CommandFailedError`, `CommandExecutionError`,
`ensureSuccess`, and `isSuccessfulResult`.

## Manual smoke check

`npm run smoke -- <repoPath> [--install] [task ...]` (from the project root, script `scripts/repo-runner-smoke.ts`)
detects the runner, prints config, install plan and tasks, then runs the install and tasks for real, stopping at the
first failure. `REPO_RUNNER_SMOKE=1 npx vitest run test/repo-runner/smoke` runs the real-toolchain tests.

## Documentation

- [architecture.md](architecture.md) — layers, the template-method base class, task tables, result policy.
- [runner-extension-guide.md](runner-extension-guide.md) — adding a new ecosystem.
- [test-matrix.md](test-matrix.md) — what the tests cover and why each fixture exists.
- [CHANGELOG.md](../../CHANGELOG.md) — package changelog
