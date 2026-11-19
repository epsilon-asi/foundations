# Foundations

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
