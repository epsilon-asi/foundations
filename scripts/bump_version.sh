#!/usr/bin/env zsh

set -euo pipefail

PACKAGE_JSON="${1:-package.json}"

if [[ ! -f "$PACKAGE_JSON" ]]; then
  echo "Error: $PACKAGE_JSON not found"
  exit 1
fi

CURRENT_VERSION=$(jq -r '.version' "$PACKAGE_JSON")

if [[ -z "$CURRENT_VERSION" || "$CURRENT_VERSION" == "null" ]]; then
  echo "Error: version field not found in $PACKAGE_JSON"
  exit 1
fi

IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

if [[ -z "${MAJOR:-}" || -z "${MINOR:-}" || -z "${PATCH:-}" ]]; then
  echo "Error: version is not valid semver: $CURRENT_VERSION"
  exit 1
fi

NEW_PATCH=$((PATCH + 1))
NEW_VERSION="${MAJOR}.${MINOR}.${NEW_PATCH}"

TMP_FILE=$(mktemp)

jq --arg version "$NEW_VERSION" \
  '.version = $version' \
  "$PACKAGE_JSON" > "$TMP_FILE"

mv "$TMP_FILE" "$PACKAGE_JSON"

echo "Version bumped: $CURRENT_VERSION -> $NEW_VERSION"