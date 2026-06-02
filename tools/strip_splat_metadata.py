#!/usr/bin/env python3
"""
Strip splat/spimdisasm matching metadata pseudo-directives from generated ASM.

Recent splat/spimdisasm versions emit lines like:

    nonmatching func_12345678, 0x40
    matching func_12345678, 0x40
    enddlabel D_12345678

Those are useful as metadata, but this repository's GNU assembler and pinned
asm-processor expect generated assembly and GLOBAL_ASM includes to start with
normal labels (`glabel`, `dlabel`, etc.). Leaving the metadata in place causes:

- GNU as: "unrecognized opcode `nonmatching ...`"
- asm-processor: ".text block without an initial glabel"

This script is intentionally conservative: it only removes full-line metadata
pseudo-directives, leaving comments and real assembly untouched.
"""
from __future__ import annotations

import argparse
import re
from pathlib import Path

METADATA_RE = re.compile(
    r"^\s*(?:(?:non)?matching\s+[^\n]+|endd?label\s+[^\n]+)\n?",
    re.MULTILINE,
)


def strip_file(path: Path) -> bool:
    original = path.read_text(errors="ignore")
    stripped = METADATA_RE.sub("", original)
    if stripped != original:
        path.write_text(stripped)
        return True
    return False


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "paths",
        nargs="+",
        help="Files or directories to process recursively for *.s files",
    )
    args = parser.parse_args()

    changed = 0
    seen: set[Path] = set()
    for raw in args.paths:
        root = Path(raw)
        files = [root] if root.is_file() else root.rglob("*.s")
        for path in files:
            if path in seen or path.suffix != ".s":
                continue
            seen.add(path)
            if strip_file(path):
                changed += 1

    print(f"strip_splat_metadata: updated {changed} file(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
