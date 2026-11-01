# Runner Extension Guide

A new ecosystem is a subclass of `AbstractRepoRunner` that answers four questions. Everything else — config
memoization, task listing, missing-task errors vs. skipped results, argument forwarding, install, timeouts, command
execution through the injected executor, and the result policy (`CommandFailedError` unless `allowNonZeroExit`) — is
inherited. The complete worked example is
[`examples/repo-runner/custom-runner/cargoRepoRunner.ts`](../../examples/repo-runner/custom-runner/cargoRepoRunner.ts)
(Rust/cargo), exercised by `test/repo-runner/examples/examples.test.ts`.

## 1. Define the config and install-plan types

```ts
export interface CargoRepoConfig {
  readonly kind: 'rust-cargo';
  readonly packageName: string | null;
  readonly lockfile: 'Cargo.lock' | null;
}
```

Use a narrower `InstallPlan` subtype (e.g. `mode: 'fetch'`) as the second type parameter if callers benefit from it.

## 2. Implement the hooks

```ts
export class CargoRepoRunner extends AbstractRepoRunner<CargoRepoConfig> {
  public readonly kind = 'rust-cargo';

  public detect() {
    return this.hasFile('Cargo.toml'); // cheap marker check; no parsing if avoidable
  }

  protected async loadRepoConfig(): Promise<CargoRepoConfig> {
    // Parse config files; throw RepoConfigParseError on invalid content.
  }

  protected resolveTasks(config: CargoRepoConfig): TaskTable {
    return new Map([['test', { binary: 'cargo', args: ['test'] }] /* ... */]);
  }

  protected resolveInstallPlan(config: CargoRepoConfig): InstallPlan {
    return { binary: 'cargo', args: config.lockfile ? ['fetch', '--locked'] : ['fetch'], mode: 'fetch' };
  }
}
```

Rules:

- `resolveTasks` is the **only** place tasks are defined. Do not add a second list for display; set
  `description` on a `TaskCommand` if the command line is not the best description.
- Describe argument forwarding with data: `argsSeparator: '--'` (npm style) or `trailingArgs: ['./...']` (args must
  precede a trailing operand, Go style). The default appends forwarded args.
- Keep parsing in pure functions next to the runner (see `golang/goModParser.ts`, `python/pyprojectTomlReader.ts`)
  so they can be unit-tested without a filesystem. Built-in runners use `readConfigFile` / `parseWithSchema` from
  `src/repo-runner/filesystem/configReaders.ts` so all parse errors are `RepoConfigParseError`s naming the failing
  field.
- Never spawn processes directly; use `this.runCommand(binary, args, options, failureMessage?)` (or just the task
  table) so the injected `CommandExecutor` and the result policy stay in control.
- Ecosystem-specific conveniences (e.g. `runLint()`) are fine on the subclass; implement them as
  `this.runNamedTask('lint', options)`.

## 3. Register it

```ts
const options = { executor, defaultTimeoutMs: 300_000 }; // RepoRunnerOptions, both optional
const registry = createDefaultRepoRunnerRegistry(options);
registry.register('rust-cargo', (repoPath) => new CargoRepoRunner(repoPath, options));
```

Registration order is detection priority. A built-in runner is added to `BUILT_IN_RUNNERS` in
`src/repo-runner/registry/createDefaultRegistry.ts` and exported from `src/repo-runner/index.ts` (class and config
types); every exported name must be unique across the whole package.

## 4. Test it

- Unit tests for the pure parser / task-table builder.
- Integration tests with a fixture under `test/repo-runner/fixtures/<kind>-*` and the `RecordingCommandExecutor`
  (a fake of the shared `CommandExecutor`) from `test/repo-runner/helpers/testUtils.ts`, asserting exact argv and
  options.
- Add the fixture to `test/repo-runner/integration/taskContract.test.ts` (advertised ⇔ runnable).
- Optionally a real-toolchain check in `test/repo-runner/smoke/toolchains.test.ts` (runs only with
  `REPO_RUNNER_SMOKE=1`; use `copyFixture()` so real commands never modify checked-in fixtures).
