# AGENT.md — container runtime

## Mission

Maintain a strict, backend-agnostic container runtime that downstream coding agents (and the top-level `Sandbox`
facade) can use directly.

## Hard rules

1. Vocabulary: a container is a **container**, the mounted host directory is the **workspace**
   (`workspacePath` on the host, `workspaceMountPath` in the container). "Sandbox" is reserved for the package root
   and the top-level facade. Docker label _values_ (`sandbox.kind`, ...) are stored on existing containers and must
   not change.
2. Every external command runs through an injected shared `CommandExecutor` (`src/shared`). Do not spawn processes,
   merge environments or add `omitUndefined`/`isRecord`-style helpers locally — use `src/shared`.
3. Commands that must succeed go through `ensureSuccess` (→ `CommandFailedError`); spawn failures propagate as the
   shared `CommandExecutionError` unwrapped. Container-domain errors extend `ContainerRuntimeError` (→
   `SandboxError`) and never set `name` manually.
4. Keep `strict`, `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` satisfied in real code.
5. Docker command construction stays pure in `dockerCommandBuilder.ts`; Docker output parsing stays pure in
   `dockerParsing.ts`; backend-specific logic (CLI executors, executable names) stays out of
   `abstractContainerRuntime.ts`.
6. Defaults and label names live once in `defaults.ts`.
7. Every exported name must be unique across the whole package (the root entry is a flat `export *`).
8. If you change public API, update tests, examples and this folder's README in the same change.
9. Examples import only from `src/container-runtime/index.js` and accept an optional runtime so
   `test/container-runtime/examples.test.ts` can run them against the fake Docker CLI.

## Source layout (`src/container-runtime/`)

- `types.ts` — public contracts
- `defaults.ts` — default values and label names
- `errors.ts` — `ContainerRuntimeError` and its subclasses
- `internal.ts` — small internal helpers (not exported)
- `dockerCommandBuilder.ts` / `dockerParsing.ts` — pure Docker argv builders / output parsers
- `codingAgentProfiles.ts` — coding-agent create-option profiles
- `abstractContainerRuntime.ts` — backend-agnostic workflows
- `dockerContainerRuntime.ts` — Docker CLI runtime (owns the host executor)
- `containerCommandExecutor.ts` — shared `CommandExecutor` that runs commands inside a container
- `index.ts` — the public API of the subpath (explicit named exports, plus the shared symbols it uses)

Tests live in `test/container-runtime/`; test doubles (`RecordingCommandExecutor`, `fakeDockerCli`) in
`test/container-runtime/fixtures/`.

## Change strategy

- Add Docker flags through the builder's `flag` / `option` / `repeatedOption` / `keyValueOptions` helpers, with a
  builder test asserting the exact argv.
- Add parsed fields to the parser's field table, with a parser test.
- Route new Docker runtime methods through `runForContainer` (container-scoped) or `runChecked`.
- New workflow helpers need tests and at least one example.
- Do not weaken cleanup semantics to hide failures.
