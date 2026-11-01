# Test Matrix

Tests live in `test/repo-runner/**/*.test.ts` and import everything (including `describe`/`it`/`expect`) explicitly,
so they run under this package's Vitest config and under the parent project's Vitest without globals. The shared
executor, error classes, and filesystem/object helpers are tested in `test/shared/`.

| Directory                      | Scope                                                                                                            |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `test/repo-runner/unit`        | Pure helpers and narrow classes: config readers, parsers, task-table builders, errors, registry, public API.     |
| `test/repo-runner/integration` | Runners against fixture repositories with a `RecordingCommandExecutor` (exact argv/options asserted).            |
| `test/repo-runner/examples`    | The `examples/repo-runner/` modules, run with the recording executor.                                            |
| `test/repo-runner/smoke`       | Real npm / uv / go / terraform against temporary repositories; skipped unless `REPO_RUNNER_SMOKE=1`.             |
| `test/repo-runner/helpers`     | `fixturePath`, `copyFixture`, `makeTempDir`, `RecordingCommandExecutor`, `commandResult`, `withProcessPlatform`. |

## Coverage by layer

- **Filesystem/config** — JSON, JSONC (comments, trailing commas, error code + offset), TOML, missing file vs.
  invalid file, zod issue paths in messages, `listFiles`.
- **Base runner** — detection assertion, config memoization and retry after failure, task listing, forwarding,
  per-call option overrides, missing task error/skip, install plan + `additionalArgs`, runner-only options never
  reaching the executor.
- **Result policy** — `CommandFailedError` naming the task or install step for non-zero exits, signal kills, and
  timeouts (also with exit code 0); `allowNonZeroExit` returning those results; `trimStdout` (also on the error's
  result); `CommandExecutionError` propagating unchanged; the same policy end-to-end with the real executor
  (`node -e` tasks, including a real timeout).
- **Runners** — detection, config shape, install plan, every task's argv, missing tasks; plus the cross-runner
  contract that `getTaskDefinitions()` and `runNamedTask()` agree for every fixture.
- **Registry** — registration order, replacement, explicit creation, detection, built-in kinds, shared executor
  and options.

## Fixtures

| Fixture                | Shape it models                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| `node-basic`           | test/build/lint/typecheck/hello scripts, all dependency buckets, JSONC `tsconfig.json`, no lockfile. |
| `node-with-lockfile`   | `package-lock.json` → `npm ci`.                                                                      |
| `node-no-build-script` | Only a `test` script → missing `build` (error / skip).                                               |
| `node-no-tsconfig`     | No tsconfig and no TypeScript signals → `isTypescriptRepo: false`.                                   |
| `python-uv-basic`      | Packaged uv project with `uv.lock`, an entry point, and pytest/ruff/mypy dev tools.                  |
| `python-uv-no-build`   | `tool.uv.package = false`, no build system → no `build`, no entry-point tasks.                       |
| `python-uv-scripted`   | Entry points named test/lint/typecheck overriding conventions; pyright.                              |
| `python-non-uv`        | Plain `pyproject.toml` without uv markers → not detected.                                            |
| `go-basic`             | Library module with `go`/`toolchain` directives, an (empty) `go.sum`, and a test.                    |
| `terraform-basic`      | Root module with `required_version`, no providers, and a `terraform test` file.                      |

The smoke tests also generate a failing npm script and a dependency-free uv project in temporary directories.
