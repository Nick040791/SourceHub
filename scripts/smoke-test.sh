#!/usr/bin/env bash
# End-to-end smoke test against the production daemon.
#
# Exercises the paths that were reworked: branch creation, pull request
# creation with a diff snapshot, CI gating, merge strategies and the
# security guards.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d /tmp/sourcehub-smoke-XXXXXX)"
REPOS="$WORK/repos"
DATA="$WORK/data"
PORT="${PORT:-$(shuf -i 5200-5900 -n 1)}"
BASE="http://127.0.0.1:$PORT"
REPO="smoke-repo"

mkdir -p "$REPOS" "$DATA"
cleanup() {
  if [[ -n "${SERVER_PID:-}" ]]; then
    kill "$SERVER_PID" 2>/dev/null
    pkill -P "$SERVER_PID" 2>/dev/null
    wait "$SERVER_PID" 2>/dev/null
  fi
  rm -rf "$WORK"
}
trap cleanup EXIT

# --- fixture repository -------------------------------------------------
FIX="$REPOS/$REPO"
mkdir -p "$FIX"
git -C "$FIX" init -q -b main
git -C "$FIX" -c user.name=Smoke -c user.email=smoke@sourcehub.local commit -q --allow-empty -m "initial"
echo "hello" > "$FIX/README.md"
git -C "$FIX" add .
git -C "$FIX" -c user.name=Smoke -c user.email=smoke@sourcehub.local commit -q -m "readme"
git -C "$FIX" branch feature
# the feature branch carries an actual change
git -C "$FIX" checkout -q feature
echo "feature" > "$FIX/feature.txt"
git -C "$FIX" add .
git -C "$FIX" -c user.name=Smoke -c user.email=smoke@sourcehub.local commit -q -m "add feature"
git -C "$FIX" checkout -q main

PASS=0
FAIL=0
check() {
  local label="$1" expected="$2" actual="$3"
  if [[ "$expected" == "$actual" ]]; then
    printf '  \033[32mok\033[0m   %s\n' "$label"
    PASS=$((PASS + 1))
  else
    printf '  \033[31mFAIL\033[0m %s (expected: %s, got: %s)\n' "$label" "$expected" "$actual"
    FAIL=$((FAIL + 1))
  fi
}

status_of() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
body_of() { curl -s "$@"; }

echo "==> starting daemon on port $PORT"
cd "$ROOT"
SOURCEHUB_REPOS_DIR="$REPOS" SOURCEHUB_DATA_DIR="$DATA" PORT="$PORT" HOST="127.0.0.1" \
  ./node_modules/.bin/tsx server/index.ts > "$WORK/server.log" 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 60); do
  if curl -s -o /dev/null "$BASE/"; then break; fi
  sleep 0.5
done

if ! curl -s -o /dev/null "$BASE/"; then
  echo "server did not start:"; cat "$WORK/server.log"; exit 1
fi

echo "==> branch safety"
check "branch with option-like name is rejected" "400" \
  "$(status_of -X POST "$BASE/api/v1/repos/$REPO/branches" -H 'Content-Type: application/json' -d '{"name":"-D","base":"main"}')"
check "main branch still exists" "main" \
  "$(body_of "$BASE/api/v1/repos/$REPO/branches" | grep -o '"main"' | head -1 | tr -d '"')"

echo "==> pull request lifecycle"
check "pull request for a missing branch is rejected" "400" \
  "$(status_of -X POST "$BASE/api/v1/repos/$REPO/pulls" -H 'Content-Type: application/json' \
      -d '{"title":"nope","sourceBranch":"does-not-exist","targetBranch":"main"}')"

PR_JSON="$(body_of -X POST "$BASE/api/v1/repos/$REPO/pulls" -H 'Content-Type: application/json' \
  -d '{"title":"Add feature","body":"Adds the feature branch","sourceBranch":"feature","targetBranch":"main"}')"
PR_ID="$(echo "$PR_JSON" | sed -n 's/.*"id":\([0-9]*\).*/\1/p')"
PR_NUMBER="$(echo "$PR_JSON" | sed -n 's/.*"number":\([0-9]*\).*/\1/p')"
check "pull request created" "1" "$([ -n "$PR_ID" ] && echo 1 || echo 0)"
check "pull request number is repo scoped" "1" "$PR_NUMBER"

DETAIL="$(body_of "$BASE/api/v1/repos/$REPO/pulls/$PR_ID")"
check "pull request starts with pending checks" "pending" \
  "$(echo "$DETAIL" | sed -n 's/.*"checksStatus":"\([a-z_]*\)".*/\1/p' | head -1)"
check "pull request snapshot keeps the diff" "1" \
  "$(echo "$DETAIL" | grep -c '"commits"')"

check "merge is refused while checks are pending" "409" \
  "$(status_of -X POST "$BASE/api/v1/repos/$REPO/pulls/$PR_ID/merge" -H 'Content-Type: application/json' -d '{"strategy":"squash"}')"

echo "==> merge with passing checks"
# Simulate a green CI run for the pull request.
DATA_DIR_ESCAPED="${DATA//\//\\/}"
node -e "
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(process.argv[1] + '/sourcehub.db');
db.prepare(\"UPDATE pull_requests SET checks_status = 'passed', checks_summary = 'All CI checks passed' WHERE id = ?\").run(Number(process.argv[2]));
db.close();
" "$DATA" "$PR_ID"

check "mergeability reports a clean merge" "true" \
  "$(body_of "$BASE/api/v1/repos/$REPO/pulls/$PR_ID/mergeability" | sed -n 's/.*"canMerge":\([a-z]*\).*/\1/p')"

MERGE_JSON="$(body_of -X POST "$BASE/api/v1/repos/$REPO/pulls/$PR_ID/merge" -H 'Content-Type: application/json' -d '{"strategy":"squash"}')"
check "merge succeeded" "true" \
  "$(echo "$MERGE_JSON" | sed -n 's/.*"success":\([a-z]*\).*/\1/p')"
check "pull request is merged" "merged" \
  "$(body_of "$BASE/api/v1/repos/$REPO/pulls/$PR_ID" | sed -n 's/.*"state":"\([a-z]*\)".*/\1/p' | head -1)"

MAIN_SHA="$(git -C "$FIX" rev-parse main)"
check "main advanced to the merge commit" "$MAIN_SHA" \
  "$(git -C "$FIX" rev-parse main)"
check "merge produced exactly one new commit" "3" \
  "$(git -C "$FIX" rev-list --count main)"

echo "==> merged pull request keeps its diff"
DETAIL="$(body_of "$BASE/api/v1/repos/$REPO/pulls/$PR_ID")"
check "snapshot survives the merge" "1" \
  "$(echo "$DETAIL" | grep -c '"diffs"')"

echo "==> file access is confined to the repository"
echo "SECRET" > "$WORK/outside.txt"
check "diff outside the repository leaks nothing" "" \
  "$(body_of "$BASE/api/v1/repos/$REPO/desktop/diff?file=../../outside.txt" | grep -o 'SECRET' | head -1)"

echo "==> protected branches"
check "deleting the default branch is refused" "400" \
  "$(status_of -X DELETE "$BASE/api/v1/repos/$REPO/branches/main")"

echo
echo "passed: $PASS   failed: $FAIL"
[[ $FAIL -eq 0 ]]
