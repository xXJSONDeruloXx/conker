#!/usr/bin/env python3
"""Rank active GLOBAL_ASM functions by simple decompilation difficulty signals.

Run after `make extract && make -C conker extract` so `conker/asm/nonmatchings`
exists. The ranking is intentionally transparent and dependency-free; it is a
bootstrap queue for LLM/agent orchestration, not a replacement for asm-differ.
"""
from __future__ import annotations

import argparse
import json
import re
import statistics
from pathlib import Path
from typing import Any

PRAGMA_RE = re.compile(r'#pragma\s+GLOBAL_ASM\("([^"]+)"\)')
INSTR_RE = re.compile(r"/\*\s*[0-9A-Fa-f]+\s+[0-9A-Fa-f]+\s+[0-9A-Fa-f]+\s*\*/\s*([^#]*)")
STACK_RE = re.compile(r"addiu\s+\$sp,\s*\$sp,\s*-0x([0-9A-Fa-f]+)")
BRANCH_OPS = {
    "beq", "bne", "beqz", "bnez", "blez", "bgtz", "bltz", "bgez",
    "bc1t", "bc1f", "j", "jal", "jr",
}


def active_pragmas(src_root: Path):
    for c_file in src_root.rglob("*.c"):
        for line_no, line in enumerate(c_file.read_text(errors="ignore").splitlines(), 1):
            if line.lstrip().startswith("//"):
                continue
            match = PRAGMA_RE.search(line)
            if match:
                yield c_file, line_no, match.group(1)


def analyze_asm(path: Path) -> dict[str, Any]:
    ops: list[str] = []
    branches = calls = labels = stack = handwritten = 0
    if not path.exists():
        return {
            "exists": False,
            "instructions": 0,
            "bytes": 0,
            "branches": 0,
            "calls": 0,
            "labels": 0,
            "stack": 0,
            "handwritten": False,
        }

    for line in path.read_text(errors="ignore").splitlines():
        stripped = line.strip()
        if "Handwritten" in line:
            handwritten = 1
        if stripped.startswith("glabel") or stripped.startswith(".L"):
            labels += 1
        instr = INSTR_RE.search(line)
        if not instr:
            continue
        body = instr.group(1).strip()
        if not body:
            continue
        op = body.split()[0]
        ops.append(op)
        if op in BRANCH_OPS:
            branches += 1
        if op == "jal":
            calls += 1
        stack_match = STACK_RE.search(body)
        if stack_match:
            stack = max(stack, int(stack_match.group(1), 16))

    return {
        "exists": True,
        "instructions": len(ops),
        "bytes": len(ops) * 4,
        "branches": branches,
        "calls": calls,
        "labels": labels,
        "stack": stack,
        "handwritten": bool(handwritten),
    }


def section_for_source(path: Path) -> str:
    name = path.name
    if name.startswith("init_") or "/init/" in str(path):
        return "init"
    if name.startswith("debugger_") or "/debugger/" in str(path):
        return "debugger"
    return "game"


def difficulty(row: dict[str, Any]) -> float:
    # Simple first-pass heuristic: instruction count dominates; branches, calls,
    # stack frames, and labels increase expected matching difficulty.
    return (
        row["instructions"]
        + row["branches"] * 6
        + row["calls"] * 10
        + row["labels"] * 2
        + min(row["stack"], 0x200) / 16
        + (30 if row["handwritten"] else 0)
    )


def difficulty_label(row: dict[str, Any]) -> str:
    score = row["difficulty"]
    if row["instructions"] <= 5 and row["branches"] == 0 and row["calls"] == 0:
        return "trivial"
    if score <= 18:
        return "low"
    if score <= 35:
        return "medium-low"
    if score <= 80:
        return "medium"
    return "hard"


def queue_tags(row: dict[str, Any]) -> list[str]:
    tags: list[str] = []
    if row["calls"]:
        tags.append("calls")
    if row["branches"]:
        tags.append("branches")
    if row["stack"]:
        tags.append("stack")
    if row["handwritten"]:
        tags.append("handwritten")
    return tags


def queue_row(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "function": row["function"],
        "file": Path(row["source"]).name,
        "region": row["section"],
        "instructions": row["instructions"],
        "difficulty": difficulty_label(row),
        "tags": queue_tags(row),
        "source": row["source"],
        "asm": row["asm"],
        "line": row["line"],
        "difficultyScore": row["difficulty"],
    }


def collect(repo_root: Path) -> list[dict[str, Any]]:
    conker_root = repo_root / "conker"
    rows: list[dict[str, Any]] = []
    for c_file, line_no, asm_rel in active_pragmas(conker_root / "src"):
        asm_path = conker_root / asm_rel
        metrics = analyze_asm(asm_path)
        row = {
            "function": asm_path.stem,
            "section": section_for_source(c_file),
            "source": str(c_file.relative_to(repo_root)),
            "line": line_no,
            "asm": str(asm_path.relative_to(repo_root)),
            **metrics,
        }
        row["difficulty"] = round(difficulty(row), 2)
        rows.append(row)
    rows.sort(key=lambda r: (r["difficulty"], r["instructions"], r["branches"], r["calls"], r["source"], r["function"]))
    return rows


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", default=".", help="repository root (default: cwd)")
    parser.add_argument("--top", type=int, default=50, help="number of rows to print")
    parser.add_argument(
        "--json",
        nargs="?",
        const="-",
        dest="json_path",
        help="write queue-compatible JSON to PATH, or stdout when PATH is omitted",
    )
    args = parser.parse_args()

    rows = collect(Path(args.repo).resolve())
    if args.json_path:
        queue_rows = [queue_row(r) for r in rows[: args.top]]
        if args.json_path == "-":
            print(json.dumps(queue_rows, indent=2))
            return 0
        Path(args.json_path).write_text(json.dumps(queue_rows, indent=2))

    print(f"active GLOBAL_ASM candidates: {len(rows)}")
    for section in ("init", "debugger", "game"):
        subset = [r for r in rows if r["section"] == section]
        if not subset:
            continue
        print(
            f"{section:8s}: {len(subset):4d} funcs, "
            f"{sum(r['instructions'] for r in subset):6d} instr, "
            f"median={statistics.median(r['instructions'] for r in subset):.1f} instr"
        )

    print("\nlowest-difficulty candidates:")
    for r in rows[: args.top]:
        print(
            f"{r['difficulty']:7.1f}  {r['instructions']:4d}i "
            f"{r['branches']:2d}br {r['calls']:2d}jal "
            f"stack={r['stack']:3d}  {r['function']}  "
            f"{r['source']}:{r['line']}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
