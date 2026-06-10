#!/usr/bin/env python3
"""Find matched functions with assembly shape similar to pending decomp targets.

This is intentionally dependency-free so the Pi decomp loop can call it cheaply.
It adapts the Snowboard Kids 2 idea of routing agents toward targets that have
nearby solved examples, but uses Conker's local `.pi/decomp/queue.json` plus
`conker/asm/nonmatchings/**` instead of embeddings.
"""
from __future__ import annotations

import argparse
import json
import math
import re
from collections import Counter
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterable

INSTR_RE = re.compile(r"/\*\s*[0-9A-Fa-f]+\s+[0-9A-Fa-f]+\s+[0-9A-Fa-f]+\s*\*/\s*([^#]*)")
BRANCH_OPS = {
    "beq", "bne", "beqz", "bnez", "blez", "bgtz", "bltz", "bgez",
    "bc1t", "bc1f", "j", "jr",
}
CALL_OPS = {"jal", "jalr"}
LOAD_OPS = {"lb", "lbu", "lh", "lhu", "lw", "lwl", "lwr", "ld", "lwc1", "ldc1"}
STORE_OPS = {"sb", "sh", "sw", "swl", "swr", "sd", "swc1", "sdc1"}
FP_OPS = {"add.s", "sub.s", "mul.s", "div.s", "sqrt.s", "trunc.w.s", "cvt.s.w", "cvt.w.s", "c.eq.s", "c.lt.s", "c.le.s", "mov.s", "neg.s", "abs.s"}


def load_queue(root: Path) -> list[dict[str, Any]]:
    queue_path = root / ".pi/decomp/queue.json"
    if not queue_path.exists():
        return []
    return json.loads(queue_path.read_text())


def asm_path_for(root: Path, entry: dict[str, Any]) -> Path | None:
    file_stem = Path(entry.get("file", "")).stem
    func = entry.get("function")
    if file_stem and func:
        candidate = root / "conker/asm/nonmatchings" / file_stem / f"{func}.s"
        if candidate.exists():
            return candidate
    matches = list((root / "conker/asm/nonmatchings").glob(f"**/{func}.s")) if func else []
    return matches[0] if matches else None


def parse_instruction_body(line: str) -> str | None:
    match = INSTR_RE.search(line)
    if not match:
        return None
    body = match.group(1).strip()
    return body or None


def normalize_op(op: str) -> str:
    # Keep FP mnemonics as-is, but collapse branch-likely suffixes and uncommon
    # load/store variants enough for cross-file shape matching.
    if op.endswith("l") and op[:-1] in BRANCH_OPS:
        return op[:-1]
    return op


def op_class(op: str) -> str:
    if op in CALL_OPS:
        return "call"
    if op in BRANCH_OPS:
        return "branch"
    if op in LOAD_OPS:
        return "load"
    if op in STORE_OPS:
        return "store"
    if op in FP_OPS or op.startswith(("c.", "cvt.", "trunc.")):
        return "fp"
    if op in {"addiu", "addu", "subu", "sll", "sra", "srl", "andi", "ori", "xori", "slti", "sltiu", "slt", "sltu"}:
        return "int"
    return "other"


def ngrams(items: list[str], n: int) -> Iterable[str]:
    if len(items) < n:
        return []
    return (" ".join(items[i : i + n]) for i in range(len(items) - n + 1))


def counter_cosine(a: Counter[str], b: Counter[str]) -> float:
    if not a or not b:
        return 0.0
    dot = sum(v * b.get(k, 0) for k, v in a.items())
    norm_a = math.sqrt(sum(v * v for v in a.values()))
    norm_b = math.sqrt(sum(v * v for v in b.values()))
    return dot / (norm_a * norm_b) if norm_a and norm_b else 0.0


def bounded_ratio(a: float, b: float) -> float:
    if a == 0 and b == 0:
        return 1.0
    if a == 0 or b == 0:
        return 0.0
    return min(a, b) / max(a, b)


@lru_cache(maxsize=4096)
def features_for_path(path_text: str) -> dict[str, Any]:
    path = Path(path_text)
    ops: list[str] = []
    classes: list[str] = []
    labels = 0
    for line in path.read_text(errors="ignore").splitlines():
        stripped = line.strip()
        if stripped.startswith(".L") or stripped.startswith("glabel"):
            labels += 1
        body = parse_instruction_body(line)
        if not body:
            continue
        op = normalize_op(body.split()[0])
        ops.append(op)
        classes.append(op_class(op))

    op_counts = Counter(ops)
    class_counts = Counter(classes)
    return {
        "path": str(path),
        "instructions": len(ops),
        "ops": ops,
        "classes": classes,
        "op_counts": op_counts,
        "class_counts": class_counts,
        "op_bigrams": Counter(ngrams(ops, 2)),
        "op_trigrams": Counter(ngrams(ops, 3)),
        "class_bigrams": Counter(ngrams(classes, 2)),
        "branches": sum(class_counts[c] for c in ["branch"]),
        "calls": sum(class_counts[c] for c in ["call"]),
        "loads": sum(class_counts[c] for c in ["load"]),
        "stores": sum(class_counts[c] for c in ["store"]),
        "fp": sum(class_counts[c] for c in ["fp"]),
        "labels": labels,
    }


def similarity(a: dict[str, Any], b: dict[str, Any]) -> float:
    if a["instructions"] == 0 or b["instructions"] == 0:
        return 0.0

    # Sequence similarity catches exact compiler idioms; count/class features keep
    # useful references when operands/ordering differ.
    trigram_sim = counter_cosine(a["op_trigrams"], b["op_trigrams"])
    bigram_sim = counter_cosine(a["op_bigrams"], b["op_bigrams"])
    op_sim = counter_cosine(a["op_counts"], b["op_counts"])
    class_seq_sim = counter_cosine(a["class_bigrams"], b["class_bigrams"])
    class_sim = counter_cosine(a["class_counts"], b["class_counts"])
    length_sim = bounded_ratio(a["instructions"], b["instructions"])

    structural = sum(
        bounded_ratio(a[k], b[k])
        for k in ["branches", "calls", "loads", "stores", "fp", "labels"]
    ) / 6.0

    return round(
        100.0
        * (
            0.25 * trigram_sim
            + 0.18 * bigram_sim
            + 0.18 * op_sim
            + 0.14 * class_seq_sim
            + 0.10 * class_sim
            + 0.10 * structural
            + 0.05 * length_sim
        ),
        2,
    )


def entry_features(root: Path, entry: dict[str, Any]) -> dict[str, Any] | None:
    path = asm_path_for(root, entry)
    if not path:
        return None
    try:
        feats = features_for_path(str(path))
    except OSError:
        return None
    return feats


def best_matches(root: Path, target: dict[str, Any], matched: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    target_features = entry_features(root, target)
    if not target_features:
        return []

    out: list[dict[str, Any]] = []
    for entry in matched:
        if entry.get("function") == target.get("function"):
            continue
        feats = entry_features(root, entry)
        if not feats:
            continue
        score = similarity(target_features, feats)
        if score <= 0:
            continue
        out.append(
            {
                "function": entry.get("function"),
                "file": entry.get("file"),
                "score": score,
                "instructions": feats["instructions"],
                "target_instructions": target_features["instructions"],
                "branches": feats["branches"],
                "calls": feats["calls"],
            }
        )
    out.sort(key=lambda row: (-row["score"], abs(row["instructions"] - target_features["instructions"]), row["function"]))
    return out[:limit]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", default=".", help="repository root (default: cwd)")
    parser.add_argument("--function", help="target function to compare against matched queue entries")
    parser.add_argument("--rank-pending", action="store_true", help="rank pending queue entries by best matched-function similarity")
    parser.add_argument("--top", type=int, default=5, help="top similar matches per target")
    parser.add_argument("--limit", type=int, default=50, help="limit for --rank-pending output")
    parser.add_argument("--json", action="store_true", help="emit JSON")
    args = parser.parse_args()

    root = Path(args.repo).resolve()
    queue = load_queue(root)
    matched = [e for e in queue if e.get("status") == "matched"]
    pending = [e for e in queue if e.get("status") == "pending"]

    if args.function:
        target = next((e for e in queue if e.get("function") == args.function), None)
        if not target:
            target = {"function": args.function, "file": ""}
        similar = best_matches(root, target, matched, args.top)
        payload = {"target": args.function, "similar": similar}
        if args.json:
            print(json.dumps(payload, indent=2))
        else:
            print(f"Similar matched functions for {args.function}:")
            for row in similar:
                print(f"  {row['score']:5.1f}  {row['function']}  {row['file']}  {row['instructions']} instr")
        return 0

    if args.rank_pending:
        ranked: list[dict[str, Any]] = []
        for target in pending:
            matches = best_matches(root, target, matched, max(1, args.top))
            if not matches:
                continue
            best = matches[0]
            ranked.append(
                {
                    "function": target.get("function"),
                    "file": target.get("file"),
                    "instructions": target.get("instructions"),
                    "difficulty": target.get("difficulty"),
                    "score": best["score"],
                    "match_function": best["function"],
                    "match_file": best["file"],
                    "match_instructions": best["instructions"],
                }
            )
        ranked.sort(key=lambda row: (-row["score"], row.get("instructions") or 9999, row["function"]))
        ranked = ranked[: args.limit]
        if args.json:
            print(json.dumps({"ranked": ranked}, indent=2))
        else:
            print("Pending functions with strongest matched references:")
            for row in ranked:
                print(
                    f"  {row['score']:5.1f}  {row['function']} ({row['instructions']} instr) "
                    f"~ {row['match_function']} ({row['match_instructions']} instr)"
                )
        return 0

    parser.error("provide --function or --rank-pending")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
