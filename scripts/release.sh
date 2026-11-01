#!/usr/bin/env bash
#
# Release one or more packages: bump each version, commit every bump in ONE
# commit, push the branch, then push one <package>-v<version> tag per package.
# Each tag triggers .github/workflows/publish.yml, which publishes that package
# to npm and creates its GitHub Release.
#
# Usage:
#   scripts/release.sh <package> [<package>...] [options]
#
#   <package>         directory name under packages/ (e.g. slack, command-line)
#
# Options:
#   --patch           bump the patch version (default)
#   --minor           bump the minor version
#   --major           bump the major version
#   --version X.Y.Z   use this exact version instead of bumping (one package only)
#   --dry-run         run every check and show the plan, change nothing
#   -y, --yes         skip the confirmation prompt
#   --any-branch      allow releasing from a branch other than main
#   -h, --help        show this help
#
# Examples:
#   scripts/release.sh slack                 # 0.1.7 -> 0.1.8, tag slack-v0.1.8
#   scripts/release.sh slack ui --minor      # both bumped, one commit, two tags
#   scripts/release.sh ui --version 1.0.0
#
# To release every publishable package at once, use scripts/release-all.sh.
#
# Steps:
#   1. check: on main, clean tree, in sync with origin, each package exists,
#      is public, is in the workflow allowlist, and its tag and npm version
#      are not already taken
#   2. write each new version into packages/<package>/package.json (+ lockfile)
#   3. commit all of those together and push the branch
#   4. create an annotated tag per package and push them one at a time
#
# Requirements: git, node, npm. Run from anywhere inside the repository.

set -euo pipefail

usage() { sed -n '2,/^$/p' "$0" | sed -E 's/^# ?//'; }
say()   { printf '==> %s\n' "$*"; }
warn()  { printf 'warning: %s\n' "$*" >&2; }
die()   { printf 'error: %s\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Arguments
# ---------------------------------------------------------------------------
PKGS=()
BUMP="patch"
EXPLICIT_VERSION=""
DRY_RUN=false
ASSUME_YES=false
ANY_BRANCH=false
RELEASE_BRANCH="main"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --patch|--minor|--major) BUMP="${1#--}" ;;
    --version)    [[ $# -ge 2 ]] || die "--version needs a value"; EXPLICIT_VERSION="$2"; shift ;;
    --version=*)  EXPLICIT_VERSION="${1#--version=}" ;;
    --dry-run)    DRY_RUN=true ;;
    -y|--yes)     ASSUME_YES=true ;;
    --any-branch) ANY_BRANCH=true ;;
    -h|--help)    usage; exit 0 ;;
    -*)           die "unknown option: $1 (see --help)" ;;
    *)            PKGS+=("$1") ;;
  esac
  shift
done

[[ ${#PKGS[@]} -gt 0 ]] || { usage >&2; exit 1; }
if [[ -n "$EXPLICIT_VERSION" && ${#PKGS[@]} -gt 1 ]]; then
  die "--version applies one exact version, so it can only be used with a single package"
fi
for PKG in "${PKGS[@]}"; do
  COUNT=0
  for OTHER in "${PKGS[@]}"; do [[ "$OTHER" == "$PKG" ]] && COUNT=$((COUNT + 1)); done
  [[ $COUNT -eq 1 ]] || die "package '$PKG' was given more than once"
done

# ---------------------------------------------------------------------------
# Repository checks
# ---------------------------------------------------------------------------
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || die "not inside a git repository"
cd "$REPO_ROOT"

for TOOL in git node npm; do
  command -v "$TOOL" >/dev/null 2>&1 || die "$TOOL is required but not installed"
done

# The Publish workflow only accepts packages in its allowlist. Read it from the
# workflow so this script and the workflow cannot drift apart.
WORKFLOW=".github/workflows/publish.yml"
PUBLISHABLE=""
if [[ -f "$WORKFLOW" ]]; then
  PUBLISHABLE="$(sed -nE 's/^[[:space:]]*(PACKAGES|AUTOMATION_PACKAGES):[[:space:]]*"([^"]*)".*$/\2/p' "$WORKFLOW" | tr '\n' ' ')"
fi
if [[ -z "$PUBLISHABLE" ]]; then
  warn "could not read PACKAGES / AUTOMATION_PACKAGES from $WORKFLOW; skipping the allowlist check"
fi

BRANCH="$(git branch --show-current)"
[[ -n "$BRANCH" ]] || die "detached HEAD; check out a branch first"
if [[ "$BRANCH" != "$RELEASE_BRANCH" && "$ANY_BRANCH" != true ]]; then
  die "on branch '$BRANCH'; releases are cut from '$RELEASE_BRANCH' (use --any-branch to override)"
fi

if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  git status --short --untracked-files=no >&2
  die "working tree has uncommitted changes; commit or stash them first"
fi

say "Fetching origin"
git fetch --quiet origin --tags
UPSTREAM="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)"
[[ -n "$UPSTREAM" ]] || die "branch '$BRANCH' has no upstream; run: git push -u origin $BRANCH"
BEHIND="$(git rev-list --count "HEAD..$UPSTREAM")"
AHEAD="$(git rev-list --count "$UPSTREAM..HEAD")"
[[ "$BEHIND" -eq 0 ]] || die "'$BRANCH' is $BEHIND commit(s) behind $UPSTREAM; pull first"
if [[ "$AHEAD" -gt 0 ]]; then
  warn "'$BRANCH' is $AHEAD commit(s) ahead of $UPSTREAM; they will be pushed together with the version bump"
fi

REMOTE_TAGS="$(git ls-remote --tags origin | awk '{print $2}' | sed -e 's#^refs/tags/##' -e 's#\^{}$##' | sort -u)"

REMOTE_URL="$(git remote get-url origin)"
REPO_SLUG=""
if [[ "$REMOTE_URL" == *github.com* ]]; then
  REPO_SLUG="$(printf '%s\n' "$REMOTE_URL" | sed -E -e 's#^(git@github\.com:|https://github\.com/|ssh://git@github\.com/)##' -e 's#\.git$##' -e 's#/$##')"
fi

# ---------------------------------------------------------------------------
# Resolve each package: current version, new version, tag
# ---------------------------------------------------------------------------
SEMVER_RE='^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$'
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

DIRS=(); NAMES=(); CURS=(); NEWS=(); TAGS=(); FILES=()
for PKG in "${PKGS[@]}"; do
  DIR="packages/${PKG}"
  [[ -f "$DIR/package.json" ]] || die "no package at $DIR (expected $DIR/package.json)"

  if [[ -n "$PUBLISHABLE" ]]; then
    case " $PUBLISHABLE " in
      *" $PKG "*) ;;
      *) die "'$PKG' is not in PACKAGES / AUTOMATION_PACKAGES in $WORKFLOW, so the Publish workflow would reject its tag. Add it there first." ;;
    esac
  fi

  NAME="$(node -p "require('./$DIR/package.json').name")"
  if [[ "$(node -p "require('./$DIR/package.json').private === true")" == "true" ]]; then
    die "$NAME is marked private and cannot be published"
  fi
  CUR="$(node -p "require('./$DIR/package.json').version")"

  if [[ -n "$EXPLICIT_VERSION" ]]; then
    NEW="$EXPLICIT_VERSION"
  else
    # Let npm do the semver math on a scratch copy, so nothing is written yet.
    mkdir -p "$TMP/$PKG"
    cp "$DIR/package.json" "$TMP/$PKG/package.json"
    NEW="$(cd "$TMP/$PKG" && npm version "$BUMP" --no-git-tag-version 2>/dev/null | tail -n 1)"
    NEW="${NEW#v}"
  fi
  [[ "$NEW" =~ $SEMVER_RE ]] || die "'$NEW' is not a valid semver version for $NAME"

  TAG="${PKG}-v${NEW}"
  if git rev-parse -q --verify "refs/tags/$TAG" >/dev/null || printf '%s\n' "$REMOTE_TAGS" | grep -qx "$TAG"; then
    die "tag $TAG already exists. If that release failed and you want to redo it, delete the tag first:
  git push --delete origin $TAG && git tag -d $TAG
To re-run its workflow instead:
  gh run list --workflow Publish --branch $TAG"
  fi

  # npm exits non-zero (E404) when the version or the package is unpublished,
  # so only a non-empty answer means the version is taken.
  PUBLISHED=""
  PUBLISHED="$(npm view "${NAME}@${NEW}" version 2>/dev/null || true)"
  if [[ -n "$PUBLISHED" ]]; then
    die "${NAME}@${NEW} is already published on npm; pick another version (--version X.Y.Z)"
  fi

  DIRS+=("$DIR"); NAMES+=("$NAME"); CURS+=("$CUR"); NEWS+=("$NEW"); TAGS+=("$TAG")
  FILES+=("$DIR/package.json")
  if [[ -f "$DIR/package-lock.json" ]]; then
    FILES+=("$DIR/package-lock.json")
  fi
done

# ---------------------------------------------------------------------------
# Plan
# ---------------------------------------------------------------------------
N=${#PKGS[@]}
if [[ $N -eq 1 ]]; then
  SUBJECT="chore(${PKGS[0]}): release v${NEWS[0]}"
  BODY=""
else
  SUBJECT="chore(release): bump $N packages"
  BODY=""
  for ((i = 0; i < N; i++)); do
    BODY="${BODY}${PKGS[$i]} ${CURS[$i]} -> ${NEWS[$i]}"$'\n'
  done
fi

echo
printf '  %-10s %s -> origin/%s\n' "branch" "$BRANCH" "$BRANCH"
printf '  %-10s %s\n' "commit" "$SUBJECT"
printf '  %-10s %s\n' "bump" "${EXPLICIT_VERSION:+exact version }${EXPLICIT_VERSION:-$BUMP}"
echo
printf '  %-30s %-22s %s\n' "package" "version" "tag"
for ((i = 0; i < N; i++)); do
  printf '  %-30s %-22s %s\n' "${NAMES[$i]}" "${CURS[$i]} -> ${NEWS[$i]}" "${TAGS[$i]}"
done
echo
echo "  Each tag starts a Publish workflow run that publishes that package to npm"
echo "  and creates its GitHub Release."
echo

if [[ "$DRY_RUN" == true ]]; then
  say "Dry run: nothing was changed."
  exit 0
fi

if [[ "$ASSUME_YES" != true ]]; then
  printf 'Proceed? [y/N] '
  REPLY=""
  read -r REPLY </dev/tty || true
  case "$REPLY" in
    y|Y|yes|YES|Yes) ;;
    *) echo "Aborted."; exit 1 ;;
  esac
fi

# ---------------------------------------------------------------------------
# Apply: bump, commit, push, tag, push tags
# ---------------------------------------------------------------------------
STAGE="bump"
on_error() {
  local rc=$?
  trap - ERR
  echo >&2
  echo "error: release failed during '${STAGE}'." >&2
  case "$STAGE" in
    bump|commit)
      echo "Nothing was committed. Discard the version changes with:" >&2
      echo "  git checkout -- ${FILES[*]}" >&2 ;;
    push-branch)
      echo "The commit exists locally but was not pushed. Retry with:" >&2
      echo "  git push origin ${BRANCH}" >&2
      echo "or undo it with:" >&2
      echo "  git reset --hard HEAD~1" >&2 ;;
    tag|push-tags)
      echo "The branch is pushed. Create any missing tags:" >&2
      for ((i = 0; i < N; i++)); do
        echo "  git tag -a ${TAGS[$i]} -m '${NAMES[$i]}@${NEWS[$i]}'" >&2
      done
      echo "then push them ONE AT A TIME (GitHub ignores pushes of more than three tags):" >&2
      for ((i = 0; i < N; i++)); do
        echo "  git push origin refs/tags/${TAGS[$i]}" >&2
      done ;;
  esac
  exit "$rc"
}
trap on_error ERR

for ((i = 0; i < N; i++)); do
  say "Setting ${DIRS[$i]}/package.json to ${NEWS[$i]}"
  (cd "${DIRS[$i]}" && npm version "${NEWS[$i]}" --no-git-tag-version --allow-same-version >/dev/null)
done

STAGE="commit"
if git diff --quiet -- "${FILES[@]}"; then
  say "Versions already set; nothing to commit"
else
  git add -- "${FILES[@]}"
  MSG_ARGS=(-m "$SUBJECT")
  if [[ -n "$BODY" ]]; then
    MSG_ARGS+=(-m "$BODY")
  fi
  git commit --quiet "${MSG_ARGS[@]}"
  say "Committed $(git log -1 --format='%h')"
fi

STAGE="push-branch"
say "Pushing ${BRANCH} to origin"
git push --quiet origin "$BRANCH"

STAGE="tag"
for ((i = 0; i < N; i++)); do
  git tag -a "${TAGS[$i]}" -m "${NAMES[$i]}@${NEWS[$i]}"
done
say "Tagged: ${TAGS[*]}"

STAGE="push-tags"
# One push per tag. GitHub does not create push events, and so never starts the
# Publish workflow, when more than three tags arrive in a single push.
for ((i = 0; i < N; i++)); do
  say "Pushing ${TAGS[$i]} to origin"
  git push --quiet origin "refs/tags/${TAGS[$i]}"
done
trap - ERR

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
echo
say "Done. ${N} Publish workflow run(s) are starting."
if [[ -n "$REPO_SLUG" ]]; then
  echo "  workflow runs:  https://github.com/${REPO_SLUG}/actions/workflows/publish.yml"
  for ((i = 0; i < N; i++)); do
    echo "  release:        https://github.com/${REPO_SLUG}/releases/tag/${TAGS[$i]}"
  done
  if command -v gh >/dev/null 2>&1; then
    echo "  watch:          gh run list --repo ${REPO_SLUG} --workflow Publish --limit ${N}"
  fi
fi
