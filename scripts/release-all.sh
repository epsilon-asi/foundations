#!/usr/bin/env bash
#
# Release EVERY publishable package in one go: bump each version, commit all
# the bumps in a single commit, push the branch, then push one
# <package>-v<version> tag per package. Each tag triggers the Publish workflow
# for that package.
#
# The package list is read from PACKAGES and AUTOMATION_PACKAGES in
# .github/workflows/publish.yml, so it always matches what the workflow accepts.
#
# Usage:
#   scripts/release-all.sh [options]
#
# Options:
#   --skip <package>   leave this package out (repeatable)
#   --patch            bump the patch version (default)
#   --minor            bump the minor version
#   --major            bump the major version
#   --dry-run          run every check and show the plan, change nothing
#   -y, --yes          skip the confirmation prompt
#   --any-branch       allow releasing from a branch other than main
#   -h, --help         show this help
#
# Examples:
#   scripts/release-all.sh --dry-run
#   scripts/release-all.sh --skip actors --skip ui
#   scripts/release-all.sh --minor -y
#
# This is a thin wrapper around scripts/release.sh, which is called ONCE with
# the whole package list. That is what makes it a single commit: calling
# release.sh per package would create one commit per package.

set -euo pipefail

usage() { sed -n '2,/^$/p' "$0" | sed -E 's/^# ?//'; }
say()   { printf '==> %s\n' "$*"; }
warn()  { printf 'warning: %s\n' "$*" >&2; }
die()   { printf 'error: %s\n' "$*" >&2; exit 1; }

HERE="$(cd "$(dirname "$0")" && pwd)"
RELEASE="$HERE/release.sh"
[[ -x "$RELEASE" ]] || die "$RELEASE not found or not executable"

REPO_ROOT="$(git -C "$HERE" rev-parse --show-toplevel 2>/dev/null)" || die "not inside a git repository"
WORKFLOW="$REPO_ROOT/.github/workflows/publish.yml"

# ---------------------------------------------------------------------------
# Arguments: --skip is ours, everything else is passed through to release.sh
# ---------------------------------------------------------------------------
SKIPS=()
PASS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip)   [[ $# -ge 2 ]] || die "--skip needs a package name"; SKIPS+=("$2"); shift ;;
    --skip=*) SKIPS+=("${1#--skip=}") ;;
    -h|--help) usage; exit 0 ;;
    --patch|--minor|--major|--dry-run|-y|--yes|--any-branch) PASS+=("$1") ;;
    --version|--version=*) die "--version sets one exact version, which makes no sense across many packages; use --patch, --minor or --major" ;;
    -*) die "unknown option: $1 (see --help)" ;;
    *)  die "unexpected argument '$1'. This script releases every package; to pick packages use scripts/release.sh <package>..." ;;
  esac
  shift
done

# ---------------------------------------------------------------------------
# Package list from the workflow allowlist
# ---------------------------------------------------------------------------
[[ -f "$WORKFLOW" ]] || die "$WORKFLOW not found"
ALL="$(sed -nE 's/^[[:space:]]*(PACKAGES|AUTOMATION_PACKAGES):[[:space:]]*"([^"]*)".*$/\2/p' "$WORKFLOW" | tr '\n' ' ')"
[[ -n "${ALL// /}" ]] || die "could not read PACKAGES / AUTOMATION_PACKAGES from $WORKFLOW"

for SKIP in ${SKIPS[@]+"${SKIPS[@]}"}; do
  case " $ALL " in
    *" $SKIP "*) ;;
    *) warn "--skip $SKIP: not a publishable package, ignoring" ;;
  esac
done

PKGS=()
for PKG in $ALL; do
  KEEP=true
  for SKIP in ${SKIPS[@]+"${SKIPS[@]}"}; do
    if [[ "$SKIP" == "$PKG" ]]; then KEEP=false; fi
  done
  if [[ "$KEEP" == true ]]; then PKGS+=("$PKG"); fi
done
[[ ${#PKGS[@]} -gt 0 ]] || die "every package was skipped; nothing to release"

say "Releasing ${#PKGS[@]} package(s): ${PKGS[*]}"
exec "$RELEASE" "${PKGS[@]}" ${PASS[@]+"${PASS[@]}"}
