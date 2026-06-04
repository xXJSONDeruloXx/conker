#!/usr/bin/env bash
# Batch-run Transmuter on all near-miss candidates
# Runs each function with a 90s timeout, 5000 max compiles, IDO profile
# Results saved to build/transmuter/batch/results.json
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BATCH_DIR="$PROJECT_ROOT/build/transmuter/batch"
TRANSMUTER="$PROJECT_ROOT/tools/transmuter/packages/cli/dist/index.js"
COMPILE_CMD="$PROJECT_ROOT/tools/transmuter-compile.sh {{inputPath}} {{outputPath}} {{functionName}}"
RESULTS="$BATCH_DIR/results.json"

cd "$PROJECT_ROOT"

# Initialize results
echo "[]" > "$RESULTS"

MATCHED=0
IMPROVED=0
FAILED=0
TOTAL=0

echo "=== Batch Transmuter Run ==="
echo ""

for src in "$BATCH_DIR"/*.c; do
    [ -f "$src" ] || continue
    FUNC=$(basename "$src" .c)
    FILE_KEY=$(python3 -c "
import json
m = json.loads(open('$BATCH_DIR/manifest.json').read())
entry = next((e for e in m if e['function'] == '$FUNC'), None)
print(entry['file'] if entry else 'unknown')
")
    
    # Assemble target .o
    TARGET_S="$PROJECT_ROOT/conker/asm/nonmatchings/${FILE_KEY%.c}/$FUNC.s"
    TARGET_O="$BATCH_DIR/${FUNC}_target.o"
    
    if [ ! -f "$TARGET_S" ]; then
        echo "[$FUNC] SKIP: no target .s"
        continue
    fi
    
    # Convert glabel to proper asm
    sed 's/^glabel \(.*\)/.global \1\n\1:/; /^[[:space:]]*\/\*/d; /^[[:space:]]*#/d' "$TARGET_S" | \
        (echo '.set noat'; echo '.set noreorder'; echo '.set gp=64'; echo '.section .text'; echo ''; cat) > "$BATCH_DIR/${FUNC}_target.s"
    
    if ! mips-linux-gnu-as -EB -march=vr4300 -mabi=32 -o "$TARGET_O" "$BATCH_DIR/${FUNC}_target.s" 2>/dev/null; then
        echo "[$FUNC] SKIP: asm failed"
        FAILED=$((FAILED + 1))
        continue
    fi
    
    TOTAL=$((TOTAL + 1))
    
    # Run Transmuter
    OUTPUT=$(timeout 95 bun "$TRANSMUTER" match "$src" \
        --target "$TARGET_O" \
        --function "$FUNC" \
        --compiler "$COMPILE_CMD" \
        --cwd "$PROJECT_ROOT" \
        --profile ido \
        --max-compiles 5000 \
        --timeout 90000 \
        --no-reduce \
        --concurrency 4 2>&1 | cat) || true
    
    # Check for match
    MATCH_FILE="$PROJECT_ROOT/${FUNC}-0.c"
    if [ -f "$MATCH_FILE" ]; then
        echo "[$FUNC] ✅ MATCHED!"
        WINNING_CODE=$(cat "$MATCH_FILE")
        rm -f "$MATCH_FILE"
        MATCHED=$((MATCHED + 1))
        
        # Append to results
        python3 -c "
import json
r = json.loads(open('$RESULTS').read())
r.append({'function': '$FUNC', 'file': '$FILE_KEY', 'status': 'matched', 'code': open('/dev/stdin').read()})
open('$RESULTS', 'w').write(json.dumps(r, indent=2))
" <<< "$WINNING_CODE"
    elif echo "$OUTPUT" | grep -q "Perfect match"; then
        echo "[$FUNC] ✅ MATCHED (from output)!"
        MATCHED=$((MATCHED + 1))
    else
        # Extract best score from output
        BEST=$(echo "$OUTPUT" | grep -oP 'Score:\s*\K\d+' | tail -1 || echo "?")
        echo "[$FUNC] ✗ best=$BEST"
        IMPROVED_CHECK=$(echo "$OUTPUT" | grep -o "forks" | head -1 || true)
        [ -n "$IMPROVED_CHECK" ] && IMPROVED=$((IMPROVED + 1))
    fi
    
    # Cleanup session files
    rm -f "$PROJECT_ROOT"/session-*.json
    rm -f "$BATCH_DIR/${FUNC}_target.s" "$BATCH_DIR/${FUNC}_target.o"
done

echo ""
echo "=== Results ==="
echo "Total: $TOTAL | Matched: $MATCHED | Improved: $IMPROVED | Asm failed: $FAILED"
echo "Results: $RESULTS"
