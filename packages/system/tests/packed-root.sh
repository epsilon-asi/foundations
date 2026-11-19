#!/bin/sh
set -eu

package_dir=$PWD
consumer=$(mktemp -d "${TMPDIR:-/tmp}/system-consumer.XXXXXXXXXX")
trap 'rm -rf "$consumer"' EXIT

corepack pnpm pack --pack-destination "$consumer"
cd "$consumer"
installed=node_modules/@epsilon-asi/system
mkdir -p "$installed"
tar -xzf ./*.tgz -C "$installed" --strip-components=1
# Reuse the dependencies installed for the build while loading system from the archive.
ln -s "$package_dir/node_modules" "$installed/node_modules"

node --input-type=module -e "import '@epsilon-asi/system'"
node --input-type=commonjs -e "require('@epsilon-asi/system')"
node --input-type=commonjs -e "
  const assert = require('node:assert/strict');
  const { dependencies } = require('@epsilon-asi/system/package.json');
  const { createRequire } = require('node:module');
  const fromSystem = createRequire(require.resolve('@epsilon-asi/system/package.json'));
  const foundation = fromSystem('@epsilon-asi/foundation/package.json');
  assert.equal(dependencies[foundation.name], '^' + foundation.version);
"
