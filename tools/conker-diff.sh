#!/usr/bin/env bash
# Extract and diff a single function against its target assembly.
# Usage: ./tools/conker-diff.sh <function_name> <source_file_basename>
# Example: ./tools/conker-diff.sh func_15169668 game_1944C0.c
#
# Outputs JSON via conker-normalize-asm.py with match status and score.

set -euo pipefail

FUNC="${1:?Usage: conker-diff.sh <func_name> <source_file.c>}"
SRC="${2:?Usage: conker-diff.sh <func_name> <source_file.c>}"

OBJ="conker/build/src/${SRC%.c}.c.o"
TARGET="conker/asm/nonmatchings/${SRC%.c}/${FUNC}.s"

if [ ! -f "$TARGET" ]; then
  echo '{"error": "target assembly not found: '"$TARGET"'"}' 
  exit 1
fi

if [ ! -f "$OBJ" ]; then
  echo '{"error": "object file not found (compile first): '"$OBJ"'"}'
  exit 1
fi

# Extract generated function assembly via Docker
GEN=$(docker run --rm --platform linux/amd64 \
  -v "$PWD:/conker" -w /conker \
  conker-build-min-amd64 \
  bash -lc "mips-linux-gnu-objdump -dr ${OBJ} | sed -n '/<${FUNC}>/,/^$/p' | sed '\$d'")

# Run normalizer/scorer
echo "$GEN" | python3 tools/conker-normalize-asm.py "$TARGET"
