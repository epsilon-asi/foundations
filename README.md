# Foundations

## in progress work that can be picked back up by an agent

### Prompt for the next agent

> Resume the resource framework in `@epsilon-asi/apps`. The goal is for an application to declare a resource once and have its client and server agree on field access, request encoding, responses and errors. Offering is our first working example. Use it to prove that moving behavior into the framework makes the application smaller while preserving what a caller sees over HTTP.
>
> Read `CLAUDE.md` and its architecture reference first. Then start with the weekly handoff in the resource framework plan. It records which milestones have passed, which are partial and which checkpoint to pick up next. The companion end-to-end plan gives the observable behavior for each checkpoint. [Repository instructions](CLAUDE.md) · [Weekly handoff](docs/plans/resource-framework.md#weekly-handoff) · [End-to-end acceptance criteria](docs/plans/resource-framework-e2e.md#implementation-order-and-acceptance)
>
> **Where the contract work stopped.** Create, Get, Update, Delete and List all have browser-safe helpers that convert a caller’s flat request to and from HTTP sections. Get and Delete share an item-request helper. The standalone `createEndpointContract()` also assembles Create’s route, readable response data, 201 response and typed failure union. The named endpoint factory already serves the unparented Offering. The next contract task is to reuse the standalone Create helper in that factory, preserve the existing Offering behavior and cover a parent-scoped Create whose parent ID travels in the URL. [Endpoint plan §1.4](docs/plans/resource-framework.md#14-endpoints-appssrcendpoints) · [Worked Create example](packages/apps/README.md#assembling-a-create-endpoint) · [Named endpoint factory](packages/apps/src/endpoints/createEndpoints.ts)
>
> **Start with the plan’s recommended checkpoint, reusable Delete.** All five Offering operations already work through the typed client over real HTTP against memory and PostgreSQL. Get is the first reusable database handler. The example supplies the other four. Follow Get’s path through `ResourceService(Offering)` and `crudHandlers(Offering)`, move tenant-scoped deletion into the service, and replace the example’s PostgreSQL Delete handler with the default. Keep the in-memory route as the second implementation of the same HTTP contract. [Default handlers §3.4](docs/plans/resource-framework.md#34-default-handlers) · [Resource service](packages/apps/src/mikro-orm/resourceService.ts) · [Offering routes](packages/apps/examples/crud-api/api/src/routes/OfferingRoutes.ts)
>
> **How to tell Delete is done.** Run the existing shared scenario against both backends. The owning tenant’s administrator receives exactly `{ code: 200 }`. An editor gets 403. A foreign tenant, a missing ID and a repeated delete get 404. Two administrators racing to delete one row get one success and one 404. Require the PostgreSQL tests with `SPIKE_REQUIRE_POSTGRES=1` and a local `SPIKE_POSTGRES_URL`. Then run the workspace build, typecheck and tests below. Record the verified result and next checkpoint in the weekly handoff, update the package docs for any public API change, and keep release verification to the local dry run. [Shared Delete scenario](packages/apps/tests/e2e/offeringDelete.fixture.ts) · [PostgreSQL setup](packages/apps/README.md#persisting-offerings-in-postgresql) · [Local release check](#release)

## Workspace

Use Node 24 for the full workspace. From the repository root, install the 12 packages and their shared tooling with the pinned pnpm 10.33.2.

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm run build
corepack pnpm run typecheck
corepack pnpm test
```

The root `pnpm-lock.yaml` records the workspace install. Internal dependencies use `workspace:^`, so consumers resolve the local package. Build once after a clean install to generate the JavaScript and declarations those consumers import. The root test command runs every workspace package’s test script. To build only `apps` and its prerequisites in dependency order, then verify it, run the following.

```sh
corepack pnpm --filter '@epsilon-asi/apps...' run build
corepack pnpm --filter @epsilon-asi/apps run verify
```

## Release

`scripts/release.sh` creates per-package version tags. The publish workflow takes the version from the tag and uses the pinned pnpm to pack the package and convert any `workspace:^` dependencies to caret ranges.

For packages released on Node 24, the bundled npm CLI requires an explicit dist-tag for prerelease versions such as `1.2.3-rc.1`. The workflow currently uses npm's implicit tag, so those prereleases remain blocked.

To preview the current `apps` package locally, run the following from the repository root with its build dependencies installed and the pinned pnpm already cached. The command runs the package's prepack build and prints the files and checksum that would be published. It uses offline mode and a loopback registry.

```sh
(
  cd packages/apps &&
  COREPACK_ENABLE_NETWORK=0 npm_config_offline=true npm_config_userconfig=/dev/null \
    corepack pnpm publish --dry-run --no-git-checks --access public --json --registry=http://127.0.0.1:1
)
```

## Type tests

CI checks that each package's `typecheck` script compiles every `*.type-test.ts` and `*.test-d.ts` fixture. After the workspace install and build, run the same check from the repository root for the package you are changing.

```sh
(cd packages/foundation && bash ../../scripts/testing/check-type-tests.sh)
```

If the check reports `Typecheck skipped`, add the named fixture to the TypeScript project used by the package's `typecheck` script. If that script chains multiple compiler commands, each earlier command that owns fixtures must also pass `--listFiles`.
