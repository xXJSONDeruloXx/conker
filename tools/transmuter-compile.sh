#!/usr/bin/env bash
# Transmuter compile script for Conker (native macOS IDO 5.3 recomp)
# Usage: transmuter-compile.sh {{inputPath}} {{outputPath}} {{functionName}}
set -e

INPUT="$1"
OUTPUT="$2"
FUNC="$3"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
IDO="$SCRIPT_DIR/ido-native"
# IDO requires .c extension
if [[ "$INPUT" != *.c ]]; then
  TMP_DIR=$(mktemp -d)
  TMP_INPUT="$TMP_DIR/src.c"
  cp "$INPUT" "$TMP_INPUT"
else
  TMP_DIR=""
  TMP_INPUT="$INPUT"
fi

# Compile with IDO 5.3 (same flags as conker/Makefile)
"$IDO/cc" -c -32 -G 0 -Xfullwarn -Xcpluscomm -signed -nostdinc -non_shared -Wab,-r4300_mul \
  -D_LANGUAGE_C -D_FINALROM -DF3DEX_GBI_2 -D_MIPS_SZLONG=32 -woff 649,838 \
  -I "$PROJECT_ROOT/conker" \
  -I "$PROJECT_ROOT/conker/include" \
  -I "$PROJECT_ROOT/conker/include/2.0L" \
  -I "$PROJECT_ROOT/conker/include/2.0L/PR" \
  -I "$PROJECT_ROOT/conker/include/libc" \
  -I "$PROJECT_ROOT/conker/src/libultra/os" \
  -I "$PROJECT_ROOT/conker/src/libultra/audio" \
  -O2 -g3 -mips2 -o32 \
  -o "$OUTPUT" "$TMP_INPUT"

[ -n "$TMP_DIR" ] && rm -rf "$TMP_DIR" || true
