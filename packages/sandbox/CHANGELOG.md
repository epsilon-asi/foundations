# Changelog

All notable changes to `@epsilon-asi/sandbox` are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-10-31

The four packages `@epsilon-asi/container-runtime`, `@epsilon-asi/git-manager`, `@epsilon-asi/repo-runner` and
`@epsilon-asi/repo-search` are merged into this single package with one build, one version and one public API.

### Added

- `Sandbox` facade: `Sandbox.create()` makes a git worktree, optionally starts a container mounted on it, and scopes
  `exec`, `installDependencies`, `runTask`, `search`, `status`, `diff`, `changedFiles`, `commit`, `applyPatch` and
  `discardChanges` to it; `dispose()` / `await using` removes the container and the worktree (`SandboxDisposeError`
  reports cleanup failures). If the container cannot start, the worktree is removed again.
- Entry points: a flat root (`@epsilon-asi/sandbox`) exporting every area, plus `/container-runtime`, `/git-manager`,
  `/repo-runner`, `/repo-search` and `/repo-search/lsp`. The `repo-search` bin is kept.
- Shared command layer: one `CommandExecutor` contract (`run`; non-zero exits are returned) with
  `ChildProcessCommandExecutor` (cwd, env with `undefined` = unset, stdin, timeout with SIGKILL escalation,
  `AbortSignal`, `maxOutputBytes`), `ensureSuccess`, `isSuccessfulResult`, `describeOutcome`, `formatCommand` and
  `commandExists`. Every component accepts `executor` (git, container CLI, repository runners, code search).
- `ContainerCommandExecutor`: runs any executor-driven component inside a container, mapping host workspace paths
  to the container mount.
- Error root `SandboxError` with the shared `CommandExecutionError` (a command could not run) and
  `CommandFailedError` (a required command failed; `.result`).
- `RepositorySearchOptions.executor`; `ripgrepAvailable(executor?)`; `DEFAULT_TASK_TIMEOUT_MS` export.

### Changed

- **Breaking — vocabulary.** "Sandbox" now names only the facade and `SandboxError`; areas say worktree, container
  and repo runner:
  - container-runtime: `AbstractSandboxContainerRuntime` → `AbstractContainerRuntime`, `DockerSandboxContainerRuntime`
    → `DockerContainerRuntime`, `ContainerSandboxCreateOptions` → `ContainerCreateOptions`, `ContainerSandboxHandle` →
    `ContainerHandle`, `SandboxCleanupOptions`/`SandboxCleanupError` → `ContainerCleanupOptions`/`ContainerCleanupError`,
    `SandboxExecOptions` → `ContainerCommand`, `runInSandbox`/`withSandbox` → `runInContainer`/`withContainer`,
    `createCodingAgentSandbox`/`listCodingAgentSandboxes`/`captureSandboxSnapshot` →
    `createCodingAgentContainer`/`listCodingAgentContainers`/`captureContainerSnapshot`,
    `build*SandboxOptions` → `build*ContainerOptions`, `*SandboxPresetOptions` → `CodingAgentContainerOptions` /
    `NodeTypescriptContainerOptions`, `DEFAULT_SANDBOX_*` → `DEFAULT_CONTAINER_*`, `SANDBOX_LABELS` →
    `CONTAINER_LABELS`, `SECURE_READONLY_SANDBOX_SECURITY_OPTIONS` → `SECURE_READONLY_SECURITY_OPTIONS`; fields
    `sandboxPath` → `workspacePath`, `mountTargetPath` → `workspaceMountPath`, `stdinText` → `stdin`. Docker label
    values (`sandbox.kind`, ...) are unchanged.
  - git-manager: `GitSandboxManager` → `GitWorktreeManager`; `createSandbox`/`cleanupSandbox`/`pruneSandboxes`/
    `overlayWorkingTreeChangesToSandbox` → `createWorktree`/`removeWorktree`/`pruneWorktrees`/`overlayWorkingChanges`;
    every `sandboxPath` field → `worktreePath`; `GitSandboxError`/`GitSandboxUsageError` → `GitError`/`GitUsageError`;
    types gain a `Git` qualifier (`GitCommitOptions`, `GitDiffOptions`, `GitStatusEntry`, `CreateWorktreeResult`, ...).
  - repo-runner: `*SandboxRepoRunner`/`NodeTypescriptSandboxRunner` → `AbstractRepoRunner`, `NodeTypescriptRepoRunner`,
    `PythonRepoRunner`, `GoRepoRunner`, `TerraformRepoRunner`; `SandboxRepoRunner` → `RepoRunner`; `CommandLine` →
    `RepoCommandLine`; `DEFAULT_TIMEOUT_MS` → `DEFAULT_TASK_TIMEOUT_MS`; constructors and
    `createDefaultRepoRunnerRegistry` take one options object (`{ executor?, defaultTimeoutMs? }`).
  - repo-search: `DocumentStore` → `SearchDocumentStore`, `TextDocument` → `SearchDocument`, `FileEntry` →
    `RepoFileEntry`, `IndexStats` → `RepoSearchIndexStats`, `OpenFile*` → `OpenRepoFile*`, `PathScope` →
    `SearchPathScope`, `StackTraceFrame` → `RepoStackTraceFrame`, `CandidateSet` → `SearchCandidateSet`,
    `ChunkBuildOptions` → `SearchChunkOptions`, `Dependency*`/`extractDependencies` → `SourceDependency*`/
    `extractSourceDependencies`, `DEFAULT_EXCLUDED_DIRECTORIES` → `DEFAULT_SEARCH_EXCLUDED_DIRECTORIES`,
    `DEFAULT_HYBRID_WEIGHTS`/`defaultHybridMethods` → `DEFAULT_HYBRID_SEARCH_WEIGHTS`/`defaultHybridSearchMethods`.
    `LocalRepoSearch`, `PathMentionSchema` and the `PathMention*` types are unchanged.
- **Breaking — failures.** A command that must succeed throws `CommandFailedError` (with `.result`) everywhere — git
  commands (was `GitCommandError`), Docker CLI commands (was `ContainerRuntimeError`), repository tasks (was the
  repo-runner `CommandFailedError`; a timeout now fails even with exit code 0). A command that cannot start rejects
  with `CommandExecutionError` everywhere (repo-runner used to report exit code `-1`; repo-search threw `ProcessError`).
- **Breaking — results.** Command results always include `cwd` and `signal`; `exitCode` is `null` when a process was
  killed by a signal (repo-runner used `-1`). Repository task results are `RepoTaskResult` (`skipped`, `skipReason`).
- All error classes extend `SandboxError` and take `ErrorOptions`.

### Fixed

- Code search's filesystem walk (used outside git repositories) overflowed the call stack on large directory trees
  (`files.push(...subtree)`); it now appends into one accumulator.

### Removed

- Per-area executors and helpers replaced by the shared layer: container-runtime's local `ChildProcessCommandExecutor`
  and command types, repo-runner's `DefaultCommandExecutor` and `CommandExecutor.execute`, git-manager's `GitRunner`,
  `RunGitOptions`, `RunGitResult`, `GitEnvironment`, `createGitRunner`, `GitCommandError`, `GitCommandDetails` and
  the `git` option (use `executor`), repo-search's `ProcessError`.

## Earlier releases (separate packages)

### @epsilon-asi/container-runtime [0.4.0] - 2026-10-31

#### Breaking

- `AbstractSandboxContainerRuntime` no longer owns a command executor: its constructor takes no arguments and the
  protected `executor`, `executable` and `getDefaultExecutable()` members were removed. They now live on
  `DockerSandboxContainerRuntime` (`protected executor` / `protected executable`). Custom runtimes that call
  `super()` are unaffected; ones that called `super(options)` or used `this.executor` must own their executor.
- The protected `captureCleanupError()` helper was removed; `cleanupSandbox()` remains the protected cleanup hook.
- `CommandExecutionError` now extends `ContainerRuntimeError`, the single base class for every error in the package
  (previously it extended `Error` directly).
- Error constructors take `cause` through a standard `ErrorOptions` argument instead of a context field:
  `new CommandExecutionError(message, { binary, args, cwd? }, { cause })`,
  `new ContainerRuntimeError(message, context?, { cause })`, `new ContainerNotFoundError(id, context?, { cause })`,
  `new ContainerParseError(parser, message, payload, { cause })` (was a positional `cause`).
- `DockerSandboxContainerRuntime.createContainer` and `waitForExit` report unparsable CLI output as
  `ContainerParseError` (still a `ContainerRuntimeError`). `waitForExit` now rejects empty output instead of
  returning exit code `0`.

#### Added

- `signal?: AbortSignal` on `CommandExecutionOptions` and `ContainerExecOptions`; aborting kills the process and
  rejects with `CommandExecutionError` (`cause` is the `AbortError`).
- Named types for previously inline shapes: `ContainerCopyOptions` (copy source/target; `ContainerCopySpec` now
  extends it), `ContainerStopOptions`, `ContainerRemoveOptions`, `SandboxExecOptions`, `WorkspaceExecOptions`,
  `WorkspaceHandle`, `DockerSandboxContainerRuntimeOptions`, `NodePackageManager`, `CommandErrorContext`.
  `SandboxCleanupOptions` now extends `ContainerRemoveOptions`.
- Constants `DEFAULT_IMAGE_PULL_POLICY`, `DEFAULT_SANDBOX_CLEANUP`, `SANDBOX_LABELS` and `CODING_AGENT_SANDBOX_KIND`.
- Parsers `parseDockerCreate` and `parseDockerWait`.

#### Changed

- Missing-container and missing-image detection only matches Docker CLI error lines on stderr
  (`Error: …` / `Error response from daemon: …`), so a command run with `exec` that prints "No such container" is no
  longer reported as `ContainerNotFoundError`.
- `DockerSandboxContainerRuntime.listContainers` inspects listed containers in parallel (containers that vanish
  meanwhile are still skipped).
- Examples accept an optional runtime and return their results; the example test suite runs each of them through the
  Docker runtime against a fake Docker CLI.
- Tests renamed from `*.spec.ts` to `*.test.ts`.

#### Fixed

- `withSandbox` treated a work function that threw `undefined` as success and resolved `undefined`; it now rethrows
  after cleanup.
- `createStartedContainer` (and therefore `withSandbox`, `runInSandbox`, `createCodingAgentSandbox`) leaked the
  created container when starting it failed; the container is now force-removed before the error is rethrown.
- Removed a debug `console.log` from the coding-agent profile security-option merge.
- `serviceHealthcheck` example: the Postgres container is started with its server command instead of the keepalive
  default, so it can actually become healthy.
- README referenced the wrong package name, a nonexistent `zod` peer dependency and a nonexistent `validate` script.

### @epsilon-asi/git-manager [0.1.0] - 2026-10-31

First release as a standalone workspace package, built to `dist/` with type declarations.

#### Added

- `GitSandboxManagerOptions.git` and `GitSandboxManagerOptions.filesystem` accept custom `GitRunner` /
  `FilesystemPort` implementations. Combining `git` with `gitBinary` or `env` throws `GitSandboxUsageError`.
- `createGitRunner()` / `CreateGitRunnerOptions` are exported so the default runner can be decorated (e.g. logging).
- Public exports for the port types `GitRunner`, `RunGitOptions`, `RunGitResult`, `FilesystemPort` and
  `GitEnvironment`.
- `GitSandboxError`, the base class of every package error, and `GitOutputParseError` (with the raw `output`) for
  malformed git output.
- `DiscardChangesOptions`, the named options type of `discardUncommittedChanges()`.
- Error constructors accept `ErrorOptions`; a git binary that cannot be started yields a `GitCommandError` whose
  `cause` is the spawn error.
- Typed examples (`examples/*.example.ts`) that are executed by the test suite.

#### Changed

- **Breaking (behaviour):** when git cannot be started, `GitCommandError.details.stderr` holds only the process's
  stderr (usually empty); the spawn error message moved to `message` and `cause`.
- `GitCommandError` and `GitSandboxUsageError` extend `GitSandboxError` (and therefore still `Error`).
- Malformed git output raises `GitOutputParseError` instead of a plain `Error`.
- An overlay entry that is neither a file nor a symlink raises `GitSandboxError` instead of a plain `Error`, before
  the destination is touched.
- `GitCommandError` messages include the exit code or signal and git's trimmed stderr.
- **Breaking (behaviour):** refs, `baseRef`, `startRef`, `branchName` and `sandboxPath` values that start with `-` are
  rejected with `GitSandboxUsageError` before git runs, so agent-supplied input cannot inject git options (for example
  `baseRef: '--output=/tmp/x'`).
- `overlayWorkingTreeChangesToSandbox()` runs the `git apply --check` preflight once instead of twice.
- The default runner ignores `EPIPE` on stdin when git exits before reading a patch; the exit status still reports the
  failure.

#### Removed

- The `.examples-dist` build step and the JavaScript example scripts (replaced by typed examples).

### @epsilon-asi/repo-runner [0.5.0]

#### Added

- `GoSandboxRepoRunner` (`golang`): detects `go.mod`, parses `module`/`go`/`toolchain`, reports `go.sum`;
  install `go mod download`; tasks `test`, `build` (`go build -o <devNull>`, so no binary is written into the
  sandbox), `vet`, `generate` (over `./...`, forwarded flags placed before the pattern) and `tidy`.
- `TerraformSandboxRepoRunner` (`terraform`): detects root `*.tf` files, reports `.terraform.lock.hcl` and
  `required_version`; install `terraform init -input=false -backend=false` (no remote state is touched); tasks
  `build`/`validate`, `test`, `fmt`.
- Both new runners are exported and registered in `createDefaultRepoRunnerRegistry` (after Node and Python).
- `createDefaultRepoRunnerRegistry(commandExecutor?, options?)`: the executor is optional (defaults to
  `DefaultCommandExecutor`) and runner options are passed to every runner.
- Runner constructors accept an optional executor (defaults to `DefaultCommandExecutor`); subclasses no longer need
  to declare a constructor.
- `SandboxRepoRunner.getPreferredInstallPlan()` on every runner; `RepoRunnerRegistry.kinds()`.
- `TaskCommand`, `TaskTable`, `CommandLine` types and the protected hooks `loadRepoConfig`, `resolveTasks`,
  `resolveInstallPlan`, `hasFile` for custom runners.
- Exported config types: `NodeRepoConfig`, `NodePackageManifest`, `NodeVersionSnapshot`, `NodeInstallPlan`,
  `PythonRepoConfig`, `PythonProjectManifest`, `PythonVersionSnapshot`, `UvInstallPlan`, `GoRepoConfig`,
  `GoModFile`, `GoInstallPlan`, `TerraformRepoConfig`, `TerraformInstallPlan`.
- `MissingTaskError.availableTasks` / `repoPath`, `UnsupportedRepositoryError.kind` / `repoPath`; every error accepts
  `ErrorOptions` (`cause`).
- `NodeRepoConfig.kind` (`'node-typescript'`), matching the other config types.
- `pyproject.toml`: PEP 735 `{ include-group = "..." }` entries are accepted (previously a parse error);
  dependency names are compared with full PEP 503 normalization.

#### Changed

- **Breaking:** a skipped result for a missing task now has an empty command (`binary: ''`, `args: []`,
  `command: []`) — nothing was run — and the reason `Task "<name>" is not defined for this <kind> repository.`
  Previously it reported the command that would have run (e.g. `npm run build`).
- **Breaking:** `PythonSandboxRepoRunner.getPreferredInstallPlan()` is now async (it was synchronous), like every
  other runner, and requires a detected repository.
- **Breaking:** `AbstractSandboxRepoRunner` is now a template-method base. Subclasses implement `detect`,
  `loadRepoConfig`, `resolveTasks` and `resolveInstallPlan`; `getRepoConfig`, `getTaskDefinitions`,
  `installDependencies`, `runTest`, `runBuild` and `runNamedTask` are implemented by the base class.
  `makeSkippedResult()` was removed. The constructor is public, with an optional executor.
- **Breaking:** `RepoRunnerFactory` defaults its type parameter and `RepoRunnerRegistryContract.register()` is no
  longer generic; the contract gains `kinds()`.
- **Breaking:** `RepoTaskDefinitions` is a `Readonly<Record<string, string>>` type alias instead of an interface.
- Python tasks come from a single task table: explicit `[project.scripts]` entry points (packaged projects only)
  override dev-tool conventions consistently for listing and running; `build` is always `uv build`.
- `runNamedTask('test')` on Node repositories runs `npm test` (same as `runTest()`).
- Runner-only options (`args`, `missingTaskBehavior`, `additionalArgs`) are no longer passed to the executor.
- `CommandFailedError` messages state the cause (`exit code N`, `signal SIG…`, or `timed out`).
- `package.json` and `pyproject.toml` are both validated with zod; validation errors name the failing field path.
- `getRepoConfig()` retries after a failed load instead of caching the rejection.
- `tsconfig.json` is parsed with `jsonc-parser`; `typescript` is no longer a runtime dependency.
- `src/index.ts` uses explicit named exports.

#### Removed

- `NODE_LIFECYCLE_TASKS` / `NodeLifecycleTask` (unused).
- The placeholder Go/Terraform/Python example runners (replaced by the built-in runners and one cargo example).

#### Fixed

- Writing `stdin` to a child that exits without reading it no longer crashes the process with an unhandled `EPIPE`.
- Runtime dependencies (`zod`, `smol-toml`, `jsonc-parser`) are declared.

### @epsilon-asi/repo-search [0.3.0] - 2026-10-31

Package renamed from `@local-agents/repo-search` to `@epsilon-asi/repo-search`, rebuilt on strict TypeScript
(`exactOptionalPropertyTypes`, `erasableSyntaxOnly`, no `any`) with one shared implementation of result construction,
ranking, path filtering, and document lookup.

#### Added

- `LocalRepoSearch.search(method, query, options)` runs any query channel (`text`, `regex`, `path`, `bm25`, `similarity`,
  `symbol`, `dependency`) or `hybrid` by name; the CLI and hybrid search use the same dispatch table.
- `DocumentStore`: the indexed documents with O(1) lookup by path, shared by every engine.
- Error hierarchy: `RepoSearchError` (base) with `ProcessError`, `RipgrepError`, and `LspError` (from `./lsp`). All
  support `cause`.
- `@epsilon-asi/repo-search/lsp` entry point (`LocalLspClient`, `LspError`, LSP types). `LocalLspClient` implements
  `AsyncDisposable`, so `await using` shuts the server down.
- Exported `DEFAULT_EXCLUDED_DIRECTORIES` and the types `QuerySearchMethod`, `QuerySearchOptions`, `PathScope`,
  `CallGraphSearchOptions`, `StackTraceSearchOptions`, `SearchChunk`, `ChunkBuildOptions`, `CandidateSet`,
  `VectorSearchOptions`, `LspRange`.
- ripgrep results now include `contextAfter` (from ripgrep's context events).
- CLI: `--help`/`-h`, `--` before queries starting with `-`, validated `--max`/`--context`, and exit codes 0 (success),
  1 (search failed), 2 (invalid usage).

#### Changed

- **Breaking:** engine constructors take a `DocumentStore`: `new TextSearchEngine(store)`, `new SymbolIndex(store)`,
  `new DependencyIndex(store)`, `new CallGraphIndex(store, symbols)`. `RankedIndex` builds its own chunks:
  `new RankedIndex(store, { chunkLines, chunkOverlap })` (was `new RankedIndex(chunks, documentsByPath)`).
- **Breaking:** `searchTextForPaths(text, files, options)` no longer takes a fourth `indexes` argument (its type was
  never exported). Reuse lookup tables through `PathSearchEngine` instead.
- **Breaking:** `LocalRepoSearch.buildCallGraph()` and `CallGraphIndex.build()` return `readonly CallGraphEdge[]`
  (results are cached per option set and shared).
- **Breaking:** `LocalRepoSearch.files`, `.documents`, and `.chunks` are readonly arrays and `.stats` is
  `Readonly<IndexStats>`. `ResolvedRepositorySearchOptions` is `Required<RepositorySearchOptions>` (readonly arrays).
- **Breaking:** `SearchChunk.tokens` was removed; use `termFrequency` (it held the same terms and doubled memory).
- **Breaking:** `LocalLspClient.initialize()` is no longer public; `start()` (called on demand by every request)
  performs the handshake. A server that exited is restarted by the next request.
- `ripgrepAvailable()` scans `PATH` instead of spawning a login shell and is no longer cached module-wide; each
  `LocalRepoSearch` checks once.
- Through `LocalRepoSearch`, ripgrep results are limited to indexed files, so both backends honour the repository's
  include/exclude, hidden-file, default-directory, extension, and size rules.
- Symbol, dependency, BM25, and similarity results honour `contextBefore`/`contextAfter` (defaults unchanged: 2 lines
  for symbols and dependencies, none for ranked chunks).
- `paths` options are normalized (`./src/a.ts` matches `src/a.ts`) in every engine.
- `hybridSearch` runs its channels concurrently; channels that throw are still skipped.
- `IndexStats.buildMs` now includes index construction, not just discovery and reading.
- CLI options are parsed strictly with `node:util` `parseArgs`: unknown options are errors instead of becoming part of
  the query, and a missing query is an error.

#### Fixed

- Call-graph results for `findCallees` point at the call site: `absolutePath` and `language` now come from the
  caller's file (they came from the callee's file while `path` and `line` came from the caller's).
- Call-graph construction scans each caller body once (was once per known callable), and `$`-prefixed names such as
  `$query()` are recognized as calls.
- Symbols named after control-flow keywords (`if (x) {` parsed as a method named `if`) are no longer indexed, which
  also removes bogus call-graph edges.
- Symbol and dependency columns use the exact capture position (`function f` reported the `f` of `function`;
  `import fs from 'fs'` pointed at the binding instead of the specifier).
- Go single-line aliased imports (`import f "fmt"`) are extracted; Go names starting with `_` are not exported.
- Node regex search reports correct positions in CRLF files; `\r` line breaks are handled consistently with line
  splitting; offset-to-position lookups are a binary search (were a linear scan per match).
- Literal search `matches[].text` is the matched document text rather than the query.
- ripgrep: `contextBefore` returns the whole requested window (was at most one line); multi-line matches report the
  right `endLine`; columns are UTF-16 based like the Node backend (were UTF-8 byte offsets); queries starting with `-`
  are passed after `--`; malformed JSON events are ignored instead of producing results with an empty path.
- Nested `.gitignore` files: rules apply only to their own directory tree, patterns without a slash match at any depth
  below it, and `!` negations work (they were prefixed with the directory and lost their meaning).
- Globs starting with `/` anchor basename patterns to the root (`/README.md` no longer matches `docs/README.md`).
- Stack traces: `a.ts:12:3` yields one frame instead of an extra `a.ts:12` frame from the looser pattern.
- `structuralSearch` with a global (`/g`) name pattern gives stable results.
- `LocalLspClient`: pending requests are rejected when the process emits `error` (for example a missing executable) as
  well as `exit`; malformed messages and headers are skipped instead of throwing; server-to-client requests are answered
  with "method not found" and are no longer mistaken for responses that share their id; concurrent `start()` calls share
  one launch; `shutdown()` waits for the process to exit before killing it.

#### Removed

- Internal helpers that were never exported from the package entry point: `execFileText`, `spawnText`, `shellQuote`,
  `realPathToRepoPath`, `readTextDocument`, `lineColumnFromOffset`, `offsetFromLineColumn`, `unique`, `pathDepth`.
