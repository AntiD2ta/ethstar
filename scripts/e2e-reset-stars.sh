#!/usr/bin/env bash
# Reset half of the currently-starred repos (from frontend/src/lib/repos.ts)
# to an unstarred state via gh CLI, so the E2E flow has a batch to star.
# Defaults to dry-run; pass --apply to actually unstar.
#
# Usage:
#   scripts/e2e-reset-stars.sh             # dry-run
#   scripts/e2e-reset-stars.sh --apply     # actually unstar
#   scripts/e2e-reset-stars.sh --apply --half=even|odd|first|last
#
# Requires: gh (authenticated), node.

set -euo pipefail

APPLY=0
HALF=even

for arg in "$@"; do
  case "$arg" in
    --apply) APPLY=1 ;;
    --half=*) HALF="${arg#--half=}" ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) echo "unknown arg: $arg" >&2; exit 2 ;;
  esac
done

command -v gh >/dev/null || { echo "gh CLI not found" >&2; exit 1; }
command -v node >/dev/null || { echo "node not found" >&2; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "gh not authenticated — run: gh auth login" >&2; exit 1; }

REPO_TS="$(cd "$(dirname "$0")/.." && pwd)/frontend/src/lib/repos.ts"
[ -f "$REPO_TS" ] || { echo "repos.ts not found at $REPO_TS" >&2; exit 1; }

# Parse owner/name pairs in source order via node (avoid fragile regex on TS).
PAIRS=()
while IFS= read -r line; do
  [ -n "$line" ] && PAIRS+=("$line")
done < <(node -e '
  const fs = require("fs");
  const src = fs.readFileSync(process.argv[1], "utf8");
  const re = /owner:\s*"([^"]+)"[\s\S]*?name:\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(src)) !== null) console.log(m[1] + "/" + m[2]);
' "$REPO_TS")

TOTAL=${#PAIRS[@]}
[ "$TOTAL" -gt 0 ] || { echo "no repos parsed from repos.ts" >&2; exit 1; }

TARGETS=()
case "$HALF" in
  even) for i in "${!PAIRS[@]}"; do (( i % 2 == 0 )) && TARGETS+=("${PAIRS[i]}"); done ;;
  odd)  for i in "${!PAIRS[@]}"; do (( i % 2 == 1 )) && TARGETS+=("${PAIRS[i]}"); done ;;
  first) H=$(( TOTAL / 2 )); TARGETS=("${PAIRS[@]:0:$H}") ;;
  last)  H=$(( TOTAL / 2 )); TARGETS=("${PAIRS[@]:$H}") ;;
  *) echo "unknown --half mode: $HALF (use even|odd|first|last)" >&2; exit 2 ;;
esac

echo "total repos: $TOTAL"
echo "mode:        --half=$HALF"
echo "targets:     ${#TARGETS[@]}"
[ "$APPLY" = 1 ] || echo "(dry-run — pass --apply to actually unstar)"
echo

OK=0; SKIP=0; FAIL=0
TOTAL_T=${#TARGETS[@]}
BAR_WIDTH=30

# draw_bar <done> <total>  — renders on stderr, overwrites in place.
draw_bar() {
  local done=$1 total=$2
  local filled=$(( done * BAR_WIDTH / total ))
  local empty=$(( BAR_WIDTH - filled ))
  local pct=$(( done * 100 / total ))
  local bar=""
  local i
  for ((i=0; i<filled; i++)); do bar+="#"; done
  for ((i=0; i<empty;  i++)); do bar+="-"; done
  printf "\r\033[2K[%s] %3d%%  %d/%d  ok=%d skip=%d fail=%d" \
    "$bar" "$pct" "$done" "$total" "$OK" "$SKIP" "$FAIL" >&2
}

# log_line — clear the bar, print a line, redraw the bar afterwards.
log_line() {
  printf "\r\033[2K%s\n" "$1" >&2
}

i=0
for pair in "${TARGETS[@]}"; do
  i=$((i + 1))

  if [ "$APPLY" = 0 ]; then
    log_line "would unstar $pair"
    draw_bar "$i" "$TOTAL_T"
    continue
  fi

  # Skip if not currently starred (GET /user/starred/{owner}/{repo}: 204 yes, 404 no).
  if ! gh api "/user/starred/$pair" --silent >/dev/null 2>&1; then
    SKIP=$((SKIP + 1))
    log_line "skip   $pair (not starred)"
    draw_bar "$i" "$TOTAL_T"
    sleep 0.3
    continue
  fi

  if gh api --method DELETE "/user/starred/$pair" --silent; then
    OK=$((OK + 1))
    log_line "unstar $pair"
  else
    FAIL=$((FAIL + 1))
    log_line "FAIL   $pair"
  fi
  draw_bar "$i" "$TOTAL_T"
  sleep 0.5
done

printf "\n" >&2
echo "done. unstarred=$OK skipped=$SKIP failed=$FAIL"
