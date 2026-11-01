#!/usr/bin/env bash
#
# Runs a command in every package directory under packages/ (or $PACKAGES_DIR).
#
# Usage:   run_for_packages.sh <command> [args...]
# Example: run_for_packages.sh npm install
#
# Stays compatible with bash 3.2 (the macOS default): no associative arrays,
# mapfile or ${var,,}.

set -euo pipefail

# Package directory names to skip. Add entries as needed, one per line.
SKIP_PACKAGES=(
"actors"
)

SCRIPT_NAME="${0##*/}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
PACKAGES_DIR="${PACKAGES_DIR:-${SCRIPT_DIR}/../packages}"

# Succeeds when $1 is listed in SKIP_PACKAGES. The ${arr[@]+...} form keeps
# `set -u` happy when the list is empty.
is_skipped() {
  local candidate="$1" skipped
  for skipped in ${SKIP_PACKAGES[@]+"${SKIP_PACKAGES[@]}"}; do
    if [[ "$skipped" == "$candidate" ]]; then
      return 0
    fi
  done
  return 1
}

if (( $# == 0 )); then
  echo "Usage: ${SCRIPT_NAME} <command> [args...]"
  echo "Example: ${SCRIPT_NAME} npm install"
  echo "Set PACKAGES_DIR to run against a directory other than $PACKAGES_DIR"
  exit 1
fi

if [[ ! -d "$PACKAGES_DIR" ]]; then
  echo "Error: $PACKAGES_DIR not found"
  exit 1
fi

# A trailing slash matches directories only; nullglob makes an empty packages
# directory expand to nothing instead of the literal pattern.
shopt -s nullglob
for PACKAGE_DIR in "$PACKAGES_DIR"/*/; do
  PACKAGE_DIR="${PACKAGE_DIR%/}"
  PACKAGE_NAME="${PACKAGE_DIR##*/}"

  if is_skipped "$PACKAGE_NAME"; then
    echo "Skipping $PACKAGE_NAME: in skip list"
    continue
  fi

  if [[ ! -f "$PACKAGE_DIR/package.json" ]]; then
    echo "Skipping $PACKAGE_NAME: no package.json"
    continue
  fi

  echo "$PACKAGE_NAME: $*"
  (cd "$PACKAGE_DIR" && "$@")
done
shopt -u nullglob

echo "Done: $*"
