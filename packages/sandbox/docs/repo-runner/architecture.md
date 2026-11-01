# Architecture

```
src/repo-runner/
  index.ts                 public API of the subpath (explicit named exports, plus the shared symbols it needs)
  contracts/               pure types: runner contract, options, RepoTaskResult, registry contract
  errors/                  RepoRunnerError (extends SandboxError) and subclasses
  filesystem/              file primitives + config readers (JSON, JSONC, TOML, schema validation)
  runners/
    AbstractRepoRunner.ts  template-method base class; result policy
    taskCommand.ts         argv construction / description for a TaskCommand
    node-typescript/ python/ golang/ terraform/   one directory per ecosystem
  registry/                RepoRunnerRegistry + createDefaultRepoRunnerRegistry
```

## Layers

1. **shared** (`src/shared`, owned by the package) — `CommandExecutor` / `ChildProcessCommandExecutor` spawn
   processes (no shell, UTF-8 capture, `cwd`/`env`/`stdin`, SIGTERM→SIGKILL timeouts) and _return_ non-zero exits;
   spawn failures, aborts, and output overflow reject with `CommandExecutionError`. `ensureSuccess` turns a failed
   result into `CommandFailedError`. The repo runner never spawns processes itself and reuses `fileExists`,
   `isMissingPathError`, and `omitUndefined` from here.
2. **contracts** — types only; safe to import from anywhere.
3. **filesystem** — `readConfigFile(path, parse)` reads a file and turns any parse failure into a
   `RepoConfigParseError`; `readJsonFile`, `readJsoncFile` (via `jsonc-parser`, comments and trailing commas allowed)
   and `readTomlFile` (via `smol-toml`) are thin wrappers. `parseWithSchema(schema, value, path)` validates with zod
   and maps every issue to `path.to.field: message`. Missing files surface as the underlying `ENOENT`, so callers can
   tell "absent" from "invalid".
4. **runners** — ecosystem logic on top of the base class (below).
5. **registry** — maps kinds to factories; detection asks each runner in registration order.

## The base class (template method)

`AbstractRepoRunner<TConfig, TInstallPlan>` implements the whole `RepoRunner` contract. A concrete runner supplies four
hooks:

| Hook                         | Responsibility                                                    |
| ---------------------------- | ----------------------------------------------------------------- |
| `detect()`                   | Cheap marker-file check.                                          |
| `loadRepoConfig()`           | Parse the ecosystem's config files (only called after detection). |
| `resolveTasks(config)`       | The `TaskTable`: every runnable task and the command it runs.     |
| `resolveInstallPlan(config)` | The install command, without caller `additionalArgs`.             |

The base class provides, once for every ecosystem:

- `getRepoConfig()` — `assertDetected()` + `loadRepoConfig()`, memoized; a failed attempt is retried next call.
- `getTaskDefinitions()` — derived from the task table (`description`, or the command line).
- `runNamedTask()` — looks the task up in the same table; a missing task throws `MissingTaskError` (listing the
  available tasks) or, with `missingTaskBehavior: 'skip'`, returns a skipped result with an empty `command`.
  `runTest()` / `runBuild()` are `runNamedTask('test' | 'build')`.
- `getPreferredInstallPlan()` / `installDependencies()` — plan plus `additionalArgs`, then run it.
- `runCommand()` — the one path to the executor (see result policy).
- Helpers for subclasses: `resolvePath()`, `hasFile()`, and the injected `executor`.

Because listing and running read the same table, "every advertised task is runnable and every runnable task is
advertised" holds by construction (asserted by `test/repo-runner/integration/taskContract.test.ts`).

## Result policy

`runCommand(binary, args, options, failureMessage?)`:

1. Strips runner-only options (`args`, `missingTaskBehavior`, `additionalArgs`, `allowNonZeroExit`, `trimStdout`) in
   one place (`toExecutionOptions`) and calls `executor.run()` with `cwd` = repository root and `timeoutMs` = the
   runner default, both overridable per call.
2. Builds the `RepoTaskResult` (`skipped: false`, stdout trimmed when `trimStdout`).
3. Unless `allowNonZeroExit`, calls `ensureSuccess(result, failureMessage)`: a non-zero exit, a signal kill, or a
   timeout throws `CommandFailedError` whose message starts with `Running task "<name>"` or `Installing dependencies`
   and whose `result` is the full `RepoTaskResult`.

Executor rejections (`CommandExecutionError`) propagate unchanged, whatever `allowNonZeroExit` says.

## Task commands

A `TaskCommand` is data, not code:

```ts
{ binary, args, argsSeparator?, trailingArgs?, description? }
// argv = [...args, (argsSeparator if forwarded args), ...forwardedArgs, ...trailingArgs]
```

This captures each ecosystem's forwarding rule without overrides: npm needs `--` before script args
(`argsSeparator: '--'`), Go needs flags before the `./...` package pattern (`trailingArgs: ['./...']`), uv and
Terraform simply append.

## Ecosystem notes

- **node-typescript** — tasks are the `package.json` scripts (`npm test` for `test`, `npm run <name>` otherwise,
  described by the script body). `package.json` is validated with zod; `tsconfig.json` is parsed as JSONC on demand.
  `isTypescriptRepo` combines tsconfig presence, TypeScript tool dependencies, and scripts invoking `tsc`/`tsx`/`ts-node`.
- **python-uv** — one resolver (`buildUvTaskTable`) builds the table: for buildable projects `build` → `uv build` and
  every `[project.scripts]` entry point (entry points are only installed when uv builds the project), then
  conventional tasks for declared dev tools (`test` → pytest, `lint` → `ruff check`, `typecheck` → mypy or pyright,
  and each tool under its own name). The first entry for a name wins, so explicit scripts override conventions.
- **golang** — `go.mod` is read by a small pure parser (`module`, `go`, `toolchain`); `go.sum` is the lockfile.
- **terraform** — root `*.tf` files, `.terraform.lock.hcl`, and the first `required_version` (line-based scan, not
  a full HCL parser).

## Error policy

`RepoRunnerError` extends the package root `SandboxError`; its subclasses accept `ErrorOptions` (`cause`) and are named
after their class. Command failures are the shared `CommandFailedError` (carrying the complete result: cwd, argv, exit
code, signal, timeout flag, stdout, stderr) and `CommandExecutionError`.
