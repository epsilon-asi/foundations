#!/usr/bin/env bash
# Run from a package directory. npm forwards --listFiles to the final command
# in its typecheck script. If it chains compilers, earlier ones that check
# fixtures must also print their inputs with --listFiles.
set -euo pipefail

package_dir="$(pwd -P)"
work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

# Scan the checkout independently of tsconfig include/exclude and Git metadata.
find "$package_dir" \
  -type d \( -name node_modules -o -name .git -o -path "$package_dir/dist" \
    -o -path "$package_dir/build" -o -path "$package_dir/coverage" \) -prune -o \
  -type f \( -name '*.type-test.ts' -o -name '*.test-d.ts' \) -print0 > "$work_dir/fixtures"

if [[ ! -s "$work_dir/fixtures" ]]; then
  npm run typecheck
  exit
fi

status=0
npm run typecheck -- --listFiles > "$work_dir/output" || status=$?
# tsc lists absolute input paths, one per line. Keep diagnostics and npm output.
while IFS= read -r line; do
  if [[ "$line" != /* || ! -f "$line" ]]; then
    echo "$line"
  fi
done < "$work_dir/output"

while IFS= read -r -d '' fixture; do
  if ! grep -Fxq -- "$fixture" "$work_dir/output"; then
    echo "Typecheck skipped ${fixture#"$package_dir/"}" >&2
    status=1
  fi
done < "$work_dir/fixtures"

exit "$status"
