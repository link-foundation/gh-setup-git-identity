#!/usr/bin/env bash
# Local dry run of the release path (version-and-commit.mjs, then
# publish-to-npm.mjs) against a throwaway bare git remote.
# `changeset:publish` is replaced by a stub, so nothing is published to npm.
#
# Usage: experiments/issue-32-release-dry-run.sh [ref] [publish-stub] [rerun]
#   ref           git ref whose scripts to run (default: HEAD)
#   publish-stub  shell command used as changeset:publish (default: "exit 1")
#   rerun         if set, then re-run both steps from the original commit
#                 with a succeeding stub, like `gh run rerun --failed`
set -u
REPO="$(cd "$(dirname "$0")/.." && pwd)"
REF="${1:-HEAD}"
export PUBLISH_STUB="${2:-exit 1}"
RERUN="${3:-}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

mkdir "$WORK/seed"
git -C "$REPO" archive "$REF" | tar x -C "$WORK/seed"
cd "$WORK/seed"
# Bring the pending changeset from main, as it was when the release failed.
cp "$REPO/.changeset/fix-cli-version.md" .changeset/ 2>/dev/null || true
node -e '
  const fs = require("fs");
  const p = JSON.parse(fs.readFileSync("package.json", "utf8"));
  p.scripts["changeset:publish"] = "eval \"$PUBLISH_STUB\"";
  fs.writeFileSync("package.json", JSON.stringify(p, null, 2) + "\n");'
# Shorten the 10 s retry delay for the dry run.
sed -i 's/const RETRY_DELAY = 10000;/const RETRY_DELAY = 10;/' scripts/publish-to-npm.mjs
git init -q -b main && git add -A && git -c user.name=t -c user.email=t@t commit -q -m seed
SEED_SHA="$(git rev-parse HEAD)"
git clone -q --bare . "$WORK/origin.git"

release() {
  rm -rf "$WORK/work"
  git clone -q "$WORK/origin.git" "$WORK/work"
  cd "$WORK/work"
  # Like actions/checkout: the commit that triggered the run.
  git checkout -q -B main "$SEED_SHA"
  bun install --silent >/dev/null 2>&1
  export GITHUB_OUTPUT="$WORK/output"
  : > "$GITHUB_OUTPUT"
  echo "### version-and-commit.mjs ($REF)"
  bun scripts/version-and-commit.mjs --mode changeset
  echo "exit=$?"
  if grep -qE "version_committed=true|already_released=true" "$GITHUB_OUTPUT"; then
    echo "### publish-to-npm.mjs ($REF, changeset:publish = '$PUBLISH_STUB')"
    bun scripts/publish-to-npm.mjs --should-pull
    echo "exit=$?"
  else
    echo "### publish step skipped (no version_committed/already_released)"
  fi
  echo "### GITHUB_OUTPUT"
  cat "$GITHUB_OUTPUT"
  echo "### origin/main"
  git -C "$WORK/origin.git" log --oneline -2 main
}

release
if [ -n "$RERUN" ]; then
  echo
  echo "##### re-run of the same commit, changeset:publish succeeds"
  export PUBLISH_STUB="echo stub-published"
  release
fi
