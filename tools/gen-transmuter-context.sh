#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUT="$PROJECT_ROOT/build/transmuter/context.h"
mkdir -p "$(dirname "$OUT")"

{
    echo "/* Auto-generated: context for Transmuter compilation */"
    echo "#include <ultra64.h>"
    echo "#include \"functions.h\""
    echo "#include \"variables.h\""
    echo ""
    echo "/* Undefined symbols as externs */"
    cat "$PROJECT_ROOT/conker/undefined_syms.us.txt" "$PROJECT_ROOT/conker/undefined_syms_auto.txt" 2>/dev/null | \
        grep -oE '^[A-Za-z_][A-Za-z0-9_]+' | sort -u | \
        sed 's/^/extern s32 /; s/$/;/'
} > "$OUT"
echo "$OUT"
