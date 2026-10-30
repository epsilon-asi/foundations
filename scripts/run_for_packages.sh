#!/usr/bin/env zsh

set -euo pipefail

# Package directory names to skip. Add entries as needed, one per line.
SKIP_PACKAGES=(
"actors"
)

SCRIPT_DIR="${0:A:h}"
PACKAGES_DIR="${PACKAGES_DIR:-${SCRIPT_DIR}/../packages}"

if (( $# == 0 )); then
  echo "Usage: ${0:t} <command> [args...]"
  echo "Example: ${0:t} npm install"
  echo "Set PACKAGES_DIR to run against a directory other than $PACKAGES_DIR"
  exit 1
fi

if [[ ! -d "$PACKAGES_DIR" ]]; then
  echo "Error: $PACKAGES_DIR not found"
  exit 1
fi

for PACKAGE_DIR in "$PACKAGES_DIR"/*(/N); do
  PACKAGE_NAME="${PACKAGE_DIR:t}"

  if (( ${SKIP_PACKAGES[(Ie)$PACKAGE_NAME]} )); then
    echo "Skipping $PACKAGE_NAME: in skip list"
    continue
  fi

  if [[ ! -f "$PACKAGE_DIR/package.json" ]]; then
    echo "Skipping $PACKAGE_NAME: no package.json"
    continue
  fi

  echo "$PACKAGE_NAME: $@"
  (cd "$PACKAGE_DIR" && "$@")
done

echo "Done: $@"
