# Container runtime

Disposable containers for coding agents. You already have a checkout on disk; the container runtime mounts it into a
long-lived container as the **workspace**, runs commands inside it, captures logs and filesystem changes, and tears
everything down deterministically.

```ts
import { DockerContainerRuntime } from '@epsilon-asi/sandbox/container-runtime';
// or, from the flat root entry:
import { DockerContainerRuntime } from '@epsilon-asi/sandbox';
```

It provides:

- `AbstractContainerRuntime`, a backend-agnostic base that implements the workflows once;
- `DockerContainerRuntime`, a Docker CLI implementation (works with any Docker-compatible CLI);
- `ContainerCommandExecutor`, a shared `CommandExecutor` that runs commands **inside** a container, so anything
  that accepts an executor (repository runners, code search, git) works in the container unchanged;
- pure Docker argv builders and output parsers;
- coding-agent profiles (secure read-only, Node/TypeScript with package-manager caches).

Commands are always argument arrays — nothing goes through a shell unless you call `execShellInWorkspace`. Requires
Node `>=24`; the Docker runtime needs a reachable Docker CLI and daemon.

## Quick start

```ts
import { DockerContainerRuntime, buildNodeTypescriptContainerOptions, isSuccessfulResult } from '@epsilon-asi/sandbox';

const runtime = new DockerContainerRuntime();

const options = buildNodeTypescriptContainerOptions({
  image: 'node:24.15.0-bookworm-slim',
  workspacePath: '/tmp/my-repo',
  packageManager: 'npm',
  installCachePath: '/tmp/npm-cache',
});

const results = await runtime.withContainer(options, async (container) => {
  await runtime.configureGitSafeDirectory(container);
  return await runtime.runCommandSequence(container, [
    { command: ['npm', 'ci'], cwd: container.workspaceMountPath },
    { command: ['npm', 'test'], cwd: container.workspaceMountPath },
  ]);
});

const last = results.at(-1);
if (last === undefined || !isSuccessfulResult(last)) {
  throw new Error(last?.stderr || 'command failed');
}
```

`withContainer` creates and starts the container, runs your callback, then stops and force-removes it. If the
callback throws, that error is rethrown after cleanup; if only cleanup fails, a `ContainerCleanupError` is thrown. A
container that is already gone during cleanup is not an error.

### Running host-style commands in the container

```ts
import { ContainerCommandExecutor } from '@epsilon-asi/sandbox';

const executor = new ContainerCommandExecutor({ runtime, container, user: 'node', env: { CI: '1' } });
const result = await executor.run('npm', ['test'], { cwd: '/tmp/my-repo/packages/app', timeoutMs: 600_000 });
// result.command = ['npm', 'test'], result.cwd = '/workspace/packages/app'
```

- `cwd`: omitted → the workspace mount; a host path equal to or inside `workspacePath` (symlinks resolved) → the
  same relative path under `workspaceMountPath`; a relative path → resolved against the mount; any other absolute
  path → used unchanged as a container path.
- `env` is layered over the constructor `env`; an `undefined` value removes a constructor-level variable but cannot
  unset a variable the image or container defines.
- `stdin`, `timeoutMs`, `signal` and `maxOutputBytes` apply to the `docker exec` client. A timeout or abort ends
  that client; the process inside the container may keep running until the container stops.
- Non-zero exits are returned, a missing container rejects with `ContainerNotFoundError`, and the result's
  `binary`/`args`/`command`/`cwd` describe the command inside the container.

## Public API

### Runtimes

| Export                     | Purpose                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AbstractContainerRuntime` | Backend-agnostic base. Subclasses implement `isAvailable`, `imageExists`, `pullImage`, `createContainer`, `startContainer`, `stopContainer`, `removeContainer`, `inspectContainer`, `listContainers`, `exec`, `getLogs`, `waitForExit`, `copyToContainer`, `copyFromContainer`, `diffContainer`, `pauseContainer`, `unpauseContainer`, `killContainer`. |
| `DockerContainerRuntime`   | `new DockerContainerRuntime({ executor?, executable? })`. Every CLI call goes through the injected `CommandExecutor` (default `ChildProcessCommandExecutor`); `executable` selects another Docker-compatible CLI (e.g. `podman`).                                                                                                                       |
| `ContainerCommandExecutor` | `new ContainerCommandExecutor({ runtime, container, user?, env? })` — see above.                                                                                                                                                                                                                                                                        |

Workflow helpers inherited by every runtime:

| Method                                           | Behaviour                                                                                          |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `ensureImage(image, pullPolicy?)`                | `missing` (default) pulls when absent, `always` pulls, `never` throws `ImageUnavailableError`.     |
| `createStartedContainer(options)`                | Ensure image → create → start. A container that fails to start is force-removed before rethrowing. |
| `createCodingAgentContainer(options)`            | `createStartedContainer(buildCodingAgentContainerOptions(options))`.                               |
| `containerExists(id)` / `isContainerRunning(id)` | Inspection-based checks.                                                                           |
| `listCodingAgentContainers()`                    | All containers labelled `sandbox.kind=coding-agent`, running or not.                               |
| `execInWorkspace(handle, command, options?)`     | `exec` with the workspace mount as working directory.                                              |
| `execShellInWorkspace(handle, script, options?)` | `execInWorkspace(handle, ['/bin/sh', '-lc', script])`.                                             |
| `configureGitSafeDirectory(handle)`              | Adds the workspace mount to git's `safe.directory`.                                                |
| `runCommandSequence(handle, commands)`           | Runs `ContainerCommand`s in order, stopping after the first non-zero or timed-out one.             |
| `waitForHealthy(id, options?)`                   | Polls until `healthy`; throws `ContainerUnhealthyError` / `ContainerHealthTimeoutError`.           |
| `captureContainerSnapshot(id)`                   | Inspection, last 500 log lines and filesystem changes, collected in parallel.                      |
| `withContainer(options, work, cleanup?)`         | Scoped container with guaranteed cleanup (default `DEFAULT_CONTAINER_CLEANUP`).                    |
| `runInContainer({ container, exec, cleanup? })`  | One command in a fresh scoped container; returns `{ handle, exec }`.                               |

`exec` never throws for a non-zero exit code or timeout — check `exitCode` / `timedOut` (or `isSuccessfulResult`).
`ContainerExecResult` is the shared `CommandExecutionResult` plus `containerId`. Every operation on a container that
does not exist rejects with `ContainerNotFoundError`.

### Profiles and defaults

- `buildCodingAgentContainerOptions(options)` — workspace mounted at `/workspace` (also the workdir), `CI=1`,
  `--init`, a keepalive command, a tmpfs `/tmp`, and `sandbox.kind` / `sandbox.workspace` / `sandbox.profile`
  labels. `secureDefaults: true` layers `SECURE_READONLY_SECURITY_OPTIONS` under your `security` options
  (`--network none`, read-only root filesystem, `--cap-drop ALL`, `no-new-privileges`). `workspaceReadOnly: true`
  mounts the checkout read-only as well.
- `buildNodeTypescriptContainerOptions(options)` — adds `NODE_ENV=development`, disables the npm update notifier
  and, with `installCachePath`, mounts a host cache for `packageManager` (`npm` | `pnpm` | `yarn` | `bun`).
- Constants: `DEFAULT_CONTAINER_WORKSPACE_PATH`, `DEFAULT_CONTAINER_KEEPALIVE_COMMAND`,
  `DEFAULT_CONTAINER_TMPFS_MOUNT`, `DEFAULT_IMAGE_PULL_POLICY`, `DEFAULT_CONTAINER_CLEANUP`, `CONTAINER_LABELS`,
  `CODING_AGENT_CONTAINER_KIND`, `SECURE_READONLY_SECURITY_OPTIONS`. Label values keep their `sandbox.*` keys so
  existing containers are still recognised.

### Pure Docker builders and parsers

Builders return argv arrays (without the binary) and never perform I/O: `buildDockerCreateArgs`,
`buildDockerStartArgs`, `buildDockerStopArgs`, `buildDockerRemoveArgs`, `buildDockerExecArgs`, `buildDockerLogsArgs`,
`buildDockerInspectArgs`, `buildDockerListArgs`, `buildDockerWaitArgs`, `buildDockerCopyToContainerArgs`,
`buildDockerCopyFromContainerArgs`, `buildDockerDiffArgs`, `buildDockerPauseArgs`, `buildDockerUnpauseArgs`,
`buildDockerKillArgs`, `buildDockerPullArgs`, `buildDockerImageInspectArgs`, `buildDockerInfoArgs`,
`formatDockerBindMount`, `formatDockerTmpfsMount`.

Parsers turn CLI output into typed values and throw `ContainerParseError` on malformed input: `parseDockerInspect`,
`parseDockerListJsonLines`, `parseDockerDiff`, `parseDockerInfo`, `parseDockerCreate`, `parseDockerWait`.

### Errors

Every error extends the package root `SandboxError`.

- Shared: `CommandFailedError` (a Docker command that must succeed failed; `.result` holds the full
  `CommandExecutionResult`, the message names the operation, command, outcome and stderr) and
  `CommandExecutionError` (the CLI could not be spawned, was aborted, or exceeded `maxOutputBytes`).
- `ContainerRuntimeError` and its subclasses: `ContainerNotFoundError` (`containerId`, optional `result`),
  `ContainerParseError`, `ImageUnavailableError`, `ContainerHealthError` → `ContainerUnhealthyError` /
  `ContainerHealthTimeoutError`, and `ContainerCleanupError` (`cleanupErrors`).

### Types

All request/result contracts are exported as types, including `ContainerCreateOptions`, `ContainerHandle`,
`WorkspaceHandle`, `ContainerExecOptions`, `ContainerCommand`, `WorkspaceExecOptions`, `ContainerExecResult`,
`ContainerCleanupOptions`, `RunInContainerOptions`, `CodingAgentContainerOptions`, `NodeTypescriptContainerOptions`,
`ContainerCommandExecutorOptions` and `DockerContainerRuntimeOptions`. The subpath also re-exports the shared
`CommandExecutor`, `CommandExecutionOptions`, `CommandExecutionResult`, `EnvironmentOverrides`,
`ChildProcessCommandExecutor`, `SandboxError`, `CommandFailedError`, `CommandExecutionError`, `ensureSuccess` and
`isSuccessfulResult`.

## Adding a backend

1. Subclass `AbstractContainerRuntime` (no constructor arguments) and implement the abstract primitives.
2. Reject with `ContainerNotFoundError` when a container does not exist, and return (not throw) non-zero `exec`
   results — the workflow helpers and `ContainerCommandExecutor` rely on both.
3. Keep command construction and output parsing in pure helpers with their own tests.

`examples/container-runtime/customRuntime.example.ts` shows the pattern. A Docker-compatible CLI needs no new class:
`new DockerContainerRuntime({ executable: 'podman' })`.

## Security notes

The runtime composes container isolation settings; it is not a complete sandbox by itself. Actual isolation depends
on the backend, host configuration, image and flags.

- Secure defaults are opt-in (`secureDefaults: true`), not implicit.
- A writable bind mount grants the container write access to that host path.
- Treat `privileged` and added capabilities as exceptions.

## Tests

From the package root:

```bash
npx vitest run test/container-runtime                       # unit tests, no Docker needed
SANDBOX_CONTAINER_RUNTIME_INTEGRATION=1 \
  npx vitest run test/container-runtime/dockerContainerRuntime.integration.test.ts   # real Docker
```

The unit suite covers the builders, parsers, workflows, the Docker runtime over a recording executor, the container
executor, and runs every example against a fake Docker CLI. The integration test pulls
`node:24.15.0-bookworm-slim` if missing; run it only where Docker access is acceptable.

See [`examples/container-runtime/`](../../examples/container-runtime/README.md) for runnable examples.
