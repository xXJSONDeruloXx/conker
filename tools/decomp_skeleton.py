#!/usr/bin/env python3
"""Generate matched-sibling C skeletons for Conker decomp targets.

This does not try to be a semantic transpiler. It finds high-similarity matched
functions, pulls their accepted C from `.pi/decomp/queue.json`, renames the
function to the target, and emits notes about signature/argument adaptation.
The goal is to give the agent a strong starting shape instead of a blank page.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

FUNC_RE = re.compile(r"^(\s*(?:[\w\*]+\s+)+)(func_[0-9A-Fa-f]+)\s*\(", re.M)


def load_queue(root: Path) -> list[dict[str, Any]]:
    return json.loads((root / ".pi/decomp/queue.json").read_text())


def best_code(entry: dict[str, Any]) -> str | None:
    history = entry.get("history") or []
    if not history:
        return None
    # Accepted matches usually have score 1.0; otherwise use highest score with code.
    candidates = [h for h in history if h.get("code")]
    if not candidates:
        return None
    return max(candidates, key=lambda h: h.get("score", 0)).get("code")


def similar(root: Path, function: str, top: int, same_file: bool) -> list[dict[str, Any]]:
    cmd = [sys.executable, str(root / "tools/decomp_similarity.py"), "--repo", str(root), "--function", function, "--top", str(top), "--json"]
    if same_file:
        cmd.append("--same-file")
    result = subprocess.run(cmd, check=True, text=True, capture_output=True)
    return json.loads(result.stdout).get("similar", [])


def rename_function(code: str, source_func: str, target_func: str) -> str:
    # Prefer exact function symbol replacement in the declaration only; avoid
    # changing recursive/callee mentions elsewhere unless the exact source name appears.
    return re.sub(rf"\b{re.escape(source_func)}\b", target_func, code, count=1)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", default=".")
    parser.add_argument("--function", required=True)
    parser.add_argument("--top", type=int, default=3)
    parser.add_argument("--same-file", action="store_true", default=True)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    root = Path(args.repo).resolve()
    queue = load_queue(root)
    by_func = {e.get("function"): e for e in queue}
    rows = similar(root, args.function, args.top, args.same_file)
    skeletons: list[dict[str, Any]] = []
    for row in rows:
        entry = by_func.get(row.get("function"))
        if not entry:
            continue
        code = best_code(entry)
        if not code:
            continue
        skeletons.append({
            "source_function": row["function"],
            "source_file": row["file"],
            "score": row["score"],
            "reasons": row.get("reasons", []),
            "notes": [
                "Rename/signature is mechanical; adjust arguments to target assembly before attempting.",
                "Preserve control-flow, varargs style, local declaration order, and post-call block shape where possible.",
            ],
            "code": rename_function(code, row["function"], args.function),
        })

    payload = {"target": args.function, "skeletons": skeletons}
    if args.json:
        print(json.dumps(payload, indent=2))
    else:
        print(f"Skeleton seeds for {args.function}:")
        for skel in skeletons:
            reasons = f" [{', '.join(skel['reasons'])}]" if skel.get("reasons") else ""
            print(f"\n## from {skel['source_function']} ({skel['source_file']}, {skel['score']:.1f}%){reasons}")
            for note in skel["notes"]:
                print(f"- {note}")
            print("```c")
            print(skel["code"])
            print("```")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
