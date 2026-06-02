#!/usr/bin/env bash
# Build a single translation unit inside Docker.
# Usage: ./tools/conker-build-tu.sh <source_file_basename>
# Example: ./tools/conker-build-tu.sh game_1944C0.c
#
# Returns 0 on compile success, 1 on error.
# Outputs compiler stderr/warnings to stdout.

set -euo pipefail

SRC="${1:?Usage: conker-build-tu.sh <source_file.c>}"

docker run --rm --platform linux/amd64 \
  -v "$PWD:/conker" -w /conker \
  conker-build-min-amd64 \
  bash -lc "make -C conker build/src/${SRC%.c}.c.o 2>&1"
