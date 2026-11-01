# Container runtime examples

Every example imports only from `src/container-runtime/index.js` (published as `@epsilon-asi/sandbox/container-runtime`),
accepts an optional `AbstractContainerRuntime` (defaulting to a real `DockerContainerRuntime`), and returns its result
instead of printing it.

`test/container-runtime/examples.test.ts` runs every example end to end through `DockerContainerRuntime` backed by a
fake Docker CLI, asserting the exact Docker commands issued (including teardown on failure) — no Docker daemon needed.

## Files

- `basicLifecycle.example.ts` — explicit lifecycle: create, start, exec, then always stop and remove
- `codingAgentWorkspace.example.ts` — secure coding-agent container over a bind-mounted repository: install and test
- `containerCommandExecutor.example.ts` — run a host-style command inside the container via `ContainerCommandExecutor`
- `runSequence.example.ts` — run a command sequence in the workspace, stopping at the first failure
- `serviceHealthcheck.example.ts` — start a service with a healthcheck and wait for it to become healthy
- `secureReadonlyContainer.example.ts` — no network, read-only root filesystem and read-only workspace
- `customRuntime.example.ts` — a custom backend that subclasses `AbstractContainerRuntime`
- `snapshotCapture.example.ts` — run a shell command, then collect inspection data, logs and filesystem changes
- `copyArtifacts.example.ts` — copy files into and out of a running container
- `nodeInstallTestBuild.example.ts` — Node/TypeScript install, test and build in a scoped container with a cache mount
