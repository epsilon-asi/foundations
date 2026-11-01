# @epsilon-asi/sandbox

One package that gives a local coding agent an isolated, disposable place to work on a repository: a **git
worktree**, optionally mounted into a **container**, with the repository's own install/test/build **tasks** and fast
local **code search** — behind one typed API.

## Requirements

- Node.js 24+ and git
- Docker (or a Docker-compatible CLI) for container sandboxes
- The toolchains of the repositories you run tasks for (npm, uv, go, terraform), on the host or in the image
- Optional: ripgrep (`rg`) for faster text search; the built-in engine is used otherwise
- `zod` 4 in the consuming project (peer dependency; code search exports zod schemas)

## Install

Inside the consuming project (ESM, `moduleResolution` `nodenext` or `bundler`):

```json
{ "dependencies": { "@epsilon-asi/sandbox": "file:./sandbox", "zod": "^4.3.6" } }
```

Build once (and after changing the library) with `npm run build` in this directory.

## Quick start

```ts
import { Sandbox } from '@epsilon-asi/sandbox';

await using sandbox = await Sandbox.create({
  repoPath: '/work/my-repo',
  worktreePath: '/work/sandboxes/task-42',
  branchName: 'agent/task-42',
  container: { image: 'node:24-bookworm-slim', preset: 'node-typescript' },
});

await sandbox.installDependencies(); // runs inside the container
const search = await sandbox.search();
const todos = await search.searchText('TODO');
// ... the agent edits files under sandbox.worktreePath ...
const tests = await sandbox.runTask('test', { allowNonZeroExit: true });
if (tests.exitCode === 0) {
  await sandbox.commit({ message: 'agent: fix task 42' });
}
const patch = await sandbox.diff({ baseRef: 'main' });
// leaving the block removes the container and the worktree; branch agent/task-42 keeps the commit
```

Omit `container` to run tasks on the host instead. A runnable version is
[examples/sandbox/agentWorkflow.example.ts](examples/sandbox/agentWorkflow.example.ts).

## The `Sandbox` facade

`Sandbox.create(options)` creates the worktree (new `branchName`, or detached at `startRef`), optionally replays
uncommitted work from `repoPath` (`overlayWorkingChanges`, `includeUntracked`), and starts a container mounted on the
worktree when `container` is given. If the container cannot start, the worktree is removed again.

| Member                                                     | Runs on           | Does                                                                                        |
| ---------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------- |
| `exec(command, options?)`                                  | container or host | Runs a command in the worktree; non-zero exits are returned                                 |
| `installDependencies(options?)`                            | container or host | `npm ci`/`npm install`, `uv sync`, `go mod download`, `terraform init`                      |
| `runTask(name, options?)`                                  | container or host | `test`, `build`, `lint`, package scripts, ... (throws on failure unless `allowNonZeroExit`) |
| `runner()`                                                 | —                 | The detected repository runner (Node/TypeScript, Python + uv, Go, Terraform)                |
| `search({ refresh? })`                                     | host              | `LocalRepoSearch` over the worktree, indexed on first use                                   |
| `status()`, `diff()`, `changedFiles()`                     | host              | Uncommitted changes, unified diff, name-status list                                         |
| `commit()`, `applyPatch()`, `discardChanges()`             | host              | Git operations scoped to the worktree                                                       |
| `git`, `worktree`, `container`, `executor`, `worktreePath` | —                 | The underlying building blocks                                                              |
| `dispose(options?)` / `await using`                        | —                 | Removes the container and the worktree (`keepWorktree`, `keepContainer`)                    |

Git and code search always run on the host against the worktree; the worktree's `.git` link points at the host
repository, so run git through the sandbox rather than inside the container.

## Building blocks

Everything the facade uses is public. Import from the package root, or from an area subpath to load only that area.

| Area             | Subpath                                                                    | Main exports                                                                                                                                   | Guide                                                      |
| ---------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Containers       | `@epsilon-asi/sandbox/container-runtime`                                   | `DockerContainerRuntime`, `AbstractContainerRuntime`, `ContainerCommandExecutor`, `buildCodingAgentContainerOptions`                           | [docs/container-runtime](docs/container-runtime/README.md) |
| Git worktrees    | `@epsilon-asi/sandbox/git-manager`                                         | `GitWorktreeManager`                                                                                                                           | [docs/git-manager](docs/git-manager/README.md)             |
| Repository tasks | `@epsilon-asi/sandbox/repo-runner`                                         | `createDefaultRepoRunnerRegistry`, `AbstractRepoRunner`, `NodeTypescriptRepoRunner`, `PythonRepoRunner`, `GoRepoRunner`, `TerraformRepoRunner` | [docs/repo-runner](docs/repo-runner/README.md)             |
| Code search      | `@epsilon-asi/sandbox/repo-search`, `@epsilon-asi/sandbox/repo-search/lsp` | `LocalRepoSearch`, `PathMentionSchema`, `LocalLspClient`; CLI `repo-search`                                                                    | [docs/repo-search](docs/repo-search/README.md)             |

The root entry exports every name from every area (names are unique across the package).

## Running commands

Every component runs external commands through one interface and accepts it as an `executor` option:

```ts
interface CommandExecutor {
  run(binary: string, args: readonly string[], options?: CommandExecutionOptions): Promise<CommandExecutionResult>;
}
```

- `ChildProcessCommandExecutor` (the default) spawns without a shell and supports `cwd`, `env` (an `undefined` value
  unsets a variable), `stdin`, `timeoutMs` (SIGTERM, then SIGKILL), `signal` (`AbortSignal`) and `maxOutputBytes`.
  Non-zero exits are returned, never thrown.
- `ContainerCommandExecutor` runs the same calls inside a container, mapping host worktree paths to the container
  workspace — the facade uses it for `exec` and tasks.
- Wrap either to log, audit, or fake command execution:

```ts
import { ChildProcessCommandExecutor, GitWorktreeManager, type CommandExecutor } from '@epsilon-asi/sandbox';

const host = new ChildProcessCommandExecutor();
const logging: CommandExecutor = {
  run: async (binary, args, options) => {
    console.log('$', binary, ...args);
    return await host.run(binary, args, options);
  },
};
const git = new GitWorktreeManager({ repoPath: '/work/my-repo', executor: logging });
```

## Errors

Every error extends `SandboxError`.

| Error                                                                                        | When                                                                                                |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `CommandExecutionError`                                                                      | A command could not run: binary missing, aborted, or over `maxOutputBytes` (`cause` holds why)      |
| `CommandFailedError`                                                                         | A command that had to succeed exited non-zero, was killed, or timed out (`result` holds the output) |
| `ContainerRuntimeError` and subclasses                                                       | Container domain errors: not found, unparsable CLI output, image unavailable, unhealthy, cleanup    |
| `GitError` (`GitUsageError`, `GitOutputParseError`)                                          | Invalid git options (rejected before git runs), unexpected git output                               |
| `RepoRunnerError` (`UnsupportedRepositoryError`, `MissingTaskError`, `RepoConfigParseError`) | Repository detection, unknown tasks, invalid manifests                                              |
| `RepoSearchError` (`RipgrepError`, `LspError`)                                               | Forced ripgrep backend failures, language-server failures                                           |
| `SandboxDisposeError`                                                                        | Removing a sandbox's container or worktree failed (`errors` lists every failure)                    |

## Development

```bash
npm install
```

```bash
npm run verify
```

| Script                                | Purpose                                                                          |
| ------------------------------------- | -------------------------------------------------------------------------------- |
| `build` / `clean`                     | Compile `src/` to `dist/` (ESM + `.d.ts` + source maps) / remove build output    |
| `typecheck`                           | Typecheck sources, tests, examples and scripts                                   |
| `test` / `coverage`                   | Vitest (coverage thresholds: 90% lines/statements/functions, 85% branches)       |
| `lint` / `format`                     | ESLint (type-aware) / Prettier (`*:check` variants for CI)                       |
| `check:package`                       | Build, then `publint` and `@arethetypeswrong/cli` (types for nodenext + bundler) |
| `smoke -- <repo> [--install] [task…]` | Run the detected repository runner against a real repository                     |
| `verify`                              | Everything above except `smoke`                                                  |

Opt-in integration tests: `SANDBOX_CONTAINER_RUNTIME_INTEGRATION=1` (real Docker), `REPO_RUNNER_SMOKE=1` (real npm,
uv, go, terraform); real-ripgrep tests run when `rg` is on `PATH`.

Layout: `src/<area>/` with tests in `test/<area>/`, examples in `examples/<area>/`, and guides in `docs/<area>/`;
`src/shared/` holds the command layer and errors every area uses; `src/sandbox/` is the facade. Contributor rules are
in [AGENT.md](AGENT.md).
