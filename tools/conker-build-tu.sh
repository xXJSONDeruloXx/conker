#!/usr/bin/env bash
# Build a single translation unit inside Docker.
# Usage: ./tools/conker-build-tu.sh <source_file_basename>
# Example: ./tools/conker-build-tu.sh game_1944C0.c
#
# Returns 0 on compile success, 1 on error.
# Outputs compiler stderr/warnings to stdout.

set -euo pipefail

SRC="${1:?Usage: conker-build-tu.sh <source_file.c>}"

# Queue entries historically used source basenames, while libultra/debugger
# translation units now live in nested directories. Resolve a unique basename
# before handing the path to the matching make target.
if [ ! -f "conker/src/$SRC" ]; then
  matches=()
  while IFS= read -r match; do
    matches+=("$match")
  done < <(find conker/src -type f -name "$(basename "$SRC")" -print)
  if [ "${#matches[@]}" -eq 1 ]; then
    SRC="${matches[0]#conker/src/}"
  fi
fi

if [ ! -f "conker/src/$SRC" ]; then
  echo "source file not found or ambiguous: $SRC" >&2
  exit 1
fi

docker run --rm --platform linux/amd64 \
  -v "$PWD:/conker" -w /conker \
  conker-build-min-amd64 \
  bash -lc "make -C conker build/src/${SRC%.c}.c.o 2>&1"
