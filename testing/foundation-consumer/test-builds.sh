#!/usr/bin/env bash
set -euo pipefail

fixture=$(cd "$(dirname "$0")" && pwd)
foundation=$(cd "$fixture/../../packages/foundation" && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

# Preserve the package's publishable assets while keeping both the workspace
# build and the installed fixture intact for other commands.
mkdir "$work/package"
tar -C "$foundation" --exclude='./node_modules' --exclude='./build' --exclude='./coverage' \
  --exclude='./.npmrc' --exclude='./.env*' -cf - . | tar -C "$work/package" -xf -
cp -R "$fixture" "$work/consumer"

installed="$work/consumer/node_modules/@epsilon-asi/foundation"
for compiler in typescript typescript7; do
  tsc="$fixture/node_modules/$compiler/bin/tsc"
  echo "Building foundation with $(node "$tsc" --version)"
  rm -rf "$work/package/build"
  node "$tsc" -p "$foundation/tsconfig.json" --outDir "$work/package/build" --noEmitOnError

  mkdir "$work/$compiler"
  corepack pnpm --dir "$work/package" pack --pack-destination "$work/$compiler"

  # Keep Zod and the tooling from the locked fixture install. Load foundation
  # exclusively from this compiler's tarball, including its shipped types.
  rm -rf "$installed" "$work/consumer/build"
  mkdir -p "$installed"
  tar -xzf "$work/$compiler/"*.tgz --strip-components=1 -C "$installed"
  npm --prefix "$work/consumer" test
done
