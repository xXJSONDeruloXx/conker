#!/usr/bin/env bash
# Permuter watchdog: watches decomp-permuter output dirs for exact-match
# candidates (score file == 0), verifies them through the Conker harness,
# and pushes verified matches one commit per function.
#
# Usage: nohup ./tools/permuter-watchdog.sh >> /tmp/watchdog.log 2>&1 &

set -u
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
PM="$ROOT/tools/decomp-permuter/nonmatchings"
TMP="${TMPDIR:-/tmp}/conker-wd"
mkdir -p "$TMP"

FN_LIST="func_15160B74 func_1000B060 func_15016170 func_1516295C func_151415D4"

file_for() {
  case "$1" in
    func_15160B74) echo "game_18D770.c" ;;
    func_1000B060) echo "init_A420.c" ;;
    func_15016170) echo "game_43620.c" ;;
    func_1516295C) echo "game_18D770.c" ;;
    func_151415D4) echo "game_16DC80.c" ;;
    *) echo "" ;;
  esac
}

while true; do
  for FN in $FN_LIST; do
    DIR="$PM/$FN"
    [ -d "$DIR" ] || continue
    MARKER="$TMP/$FN.done"
    [ -f "$MARKER" ] && continue

    BEST=$(ls "$DIR" 2>/dev/null | grep '^output-' | sed 's/output-//;s/-.*//' | sort -n | head -1)
    [ -z "$BEST" ] && continue
    [ "$BEST" -ne 0 ] && continue

    SRC=$(ls "$DIR"/output-$BEST-*/source.c 2>/dev/null | head -1)
    if [ -z "$SRC" ]; then
      echo "[$(date +%T)] $FN: zero-dir missing source"
      touch "$MARKER"
      continue
    fi

    FILE=$(file_for "$FN")
    [ -z "$FILE" ] && { touch "$MARKER"; continue; }

    CAND="$TMP/$FN.c"
    python3 - "$SRC" "$CAND" <<'PYEOF'
import sys
src, out = sys.argv[1], sys.argv[2]
text = open(src).read()
idx = text.find('(')
# find start of the function definition line
lines = text.split('\n')
start = 0
for n, ln in enumerate(lines):
    if ln.startswith('s32 ') or ln.startswith('void ') or ln.startswith('struct225 *'):
        start = n
        break
open(out, 'w').write('\n'.join(lines[start:]) + '\n')
PYEOF
    [ -f "$CAND" ] || { echo "[$(date +%T)] $FN: extraction failed"; touch "$MARKER"; continue; }

    echo "[$(date +%T)] $FN: score-0 found, verifying through harness..."
    RES=$(python3 tools/decomp_harness.py attempt --function "$FN" --file "$FILE" \
          --code-file "$CAND" --json 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('match'),d.get('score'))")
    MATCH=${RES%% *}
    if [ "$MATCH" = "True" ]; then
      echo "[$(date +%T)] $FN: EXACT MATCH confirmed - accepting..."
      python3 tools/decomp_harness.py accept --function "$FN" --file "$FILE" --json > /dev/null 2>&1
      git add "conker/src/$FILE" .pi/decomp/queue.json
      if git diff --cached --check; then
        if git commit -q -m "feat(decomp): match $FN (permuter harvest)"; then
          VERIFY=$(python3 tools/decomp_harness.py verify --json 2>/dev/null | grep -c '"ok": true')
          if [ "$VERIFY" -ge 1 ]; then
            git push origin master 2>&1 | tail -1
            echo "[$(date +%T)] $FN: PUSHED"
          else
            echo "[$(date +%T)] $FN: post-commit verify FAILED"
          fi
        else
          echo "[$(date +%T)] $FN: commit blocked by pre-commit hook"
        fi
      fi
    else
      echo "[$(date +%T)] $FN: permuter claimed 0 but harness says: $RES"
    fi
    touch "$MARKER"
  done
  sleep 120
done
