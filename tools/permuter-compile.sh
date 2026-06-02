#!/usr/bin/env bash
# Compile script for decomp-permuter.
# Called as: ./permuter-compile.sh input.c -o output.o
# Must use the EXACT same compiler flags as the Conker Makefile.
#
# This runs INSIDE Docker (conker-build-min-amd64) where the IDO recomp is available.

set -euo pipefail

INPUT="$1"
shift  # skip input.c
shift  # skip -o
OUTPUT="$1"

# IDO 5.3 recomp compiler path (relative to conker/ subdir)
CC="/conker/ido/ido5.3_recomp/cc"

# Exact flags from conker/Makefile
CFLAGS="-c -32 -G 0 -Xfullwarn -Xcpluscomm -signed -nostdinc -non_shared -Wab,-r4300_mul"
CFLAGS="$CFLAGS -D_LANGUAGE_C -D_FINALROM -DF3DEX_GBI_2 -D_MIPS_SZLONG=32"
CFLAGS="$CFLAGS -woff 649,838"
CFLAGS="$CFLAGS -I /conker/conker -I /conker/conker/include -I /conker/conker/include/2.0L -I /conker/conker/include/2.0L/PR -I /conker/conker/include/libc -I /conker/conker/src/libultra/os -I /conker/conker/src/libultra/audio -I /conker/conker/src/libultra/io"

# Optimization (default -O2 -g3, can be overridden via env)
OPT="${PERMUTER_OPT_FLAGS:--O2 -g3}"

# MIPS ABI
MIPSBIT="-mips2 -o32"

$CC $CFLAGS $OPT $MIPSBIT -o "$OUTPUT" "$INPUT"
