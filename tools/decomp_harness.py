#!/usr/bin/env python3
"""Portable agent interface for Conker's matching-decompilation workflow.

The Pi extension remains the richest interactive frontend, but the project should
not require a particular agent runtime.  This command is the small, stable
boundary other harnesses can invoke:

    python3 tools/decomp_harness.py status --json
    python3 tools/decomp_harness.py next --json --with-asmlift
    python3 tools/decomp_harness.py lift --function func_10001420
    python3 tools/decomp_harness.py attempt --function FUNC --code-file candidate.c --json
    python3 tools/decomp_harness.py verify --json

All build/match decisions still come from Conker's IDO 5.3 build and ROM SHA
gate.  asmlift is deliberately an optional candidate generator: its closest
available MIPS target is IDO 7.1, not Conker's IDO 5.3 compiler.

The command has no Python dependencies and communicates through stdout/stderr,
so it is usable from an agent shell tool, a CI job, or another agent adapter.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any, Iterable


PRAGMA_TEMPLATE = '#pragma GLOBAL_ASM("asm/nonmatchings/{stem}/{function}.s")'
PRAGMA_RE = re.compile(r'#pragma\s+GLOBAL_ASM\("asm/nonmatchings/([^/"]+)/([^"]+)\.s"\)')
SYMBOL_RE = re.compile(r"%(?:hi|lo)\(([^)]+)\)")
CALLEE_RE = re.compile(r"\bjal\s+([A-Za-z_][A-Za-z0-9_$]*)")
DEFAULT_ASMLIFT_TARGET = "ido7.1"
ROTATE_AFTER_ATTEMPTS = 8
OUTPUT_LIMIT = 16_000


class HarnessError(RuntimeError):
    """An expected setup or workflow error suitable for an agent response."""


def now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def tail(text: str, limit: int = OUTPUT_LIMIT) -> str:
    if len(text) <= limit:
        return text
    return "…\n" + text[-limit:]


def find_repo_root(start: Path) -> Path:
    current = start.resolve()
    for candidate in (current, *current.parents):
        if (candidate / "conker/Makefile").is_file() and (candidate / "tools").is_dir():
            return candidate
    raise HarnessError(
        f"could not find a Conker repository from {start}; expected conker/Makefile and tools/"
    )


def load_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text())
    except FileNotFoundError:
        return default
    except (OSError, json.JSONDecodeError) as exc:
        raise HarnessError(f"could not read JSON state {path}: {exc}") from exc


def queue_path(root: Path) -> Path:
    return root / ".pi/decomp/queue.json"


def patterns_path(root: Path) -> Path:
    return root / ".pi/decomp/patterns.json"


def load_queue(root: Path) -> list[dict[str, Any]]:
    value = load_json(queue_path(root), [])
    if not isinstance(value, list):
        raise HarnessError(f"queue state must be a JSON array: {queue_path(root)}")
    return [entry for entry in value if isinstance(entry, dict)]


def load_patterns(root: Path) -> list[dict[str, Any]]:
    value = load_json(patterns_path(root), [])
    if not isinstance(value, list):
        raise HarnessError(f"pattern state must be a JSON array: {patterns_path(root)}")
    return [pattern for pattern in value if isinstance(pattern, dict)]


def save_queue(root: Path, queue: list[dict[str, Any]]) -> None:
    path = queue_path(root)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(queue, indent=2) + "\n")


def file_stem(entry: dict[str, Any]) -> str:
    file_name = str(entry.get("file", ""))
    return Path(file_name).stem


def pragma_for(entry: dict[str, Any]) -> str:
    return PRAGMA_TEMPLATE.format(stem=file_stem(entry), function=entry["function"])


def source_path(root: Path, entry: dict[str, Any]) -> Path:
    return root / "conker/src" / str(entry.get("file", ""))


def target_path(root: Path, entry: dict[str, Any]) -> Path | None:
    expected = root / "conker/asm/nonmatchings" / file_stem(entry) / f"{entry['function']}.s"
    if expected.is_file():
        return expected
    matches = list((root / "conker/asm/nonmatchings").glob(f"**/{entry['function']}.s"))
    return matches[0] if matches else None


def has_live_pragma(root: Path, entry: dict[str, Any]) -> bool:
    path = source_path(root, entry)
    try:
        return pragma_for(entry) in path.read_text(errors="ignore")
    except OSError:
        # A missing source should remain visible to the agent instead of being
        # silently discarded from the queue.
        return True


def entry_for(
    root: Path,
    function: str,
    file_name: str | None = None,
    queue: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    entries = queue if queue is not None else load_queue(root)
    matches = [entry for entry in entries if entry.get("function") == function]
    if file_name:
        requested = Path(file_name).name
        matches = [entry for entry in matches if Path(str(entry.get("file", ""))).name == requested]
    if len(matches) > 1:
        files = ", ".join(str(entry.get("file")) for entry in matches)
        raise HarnessError(f"function {function} appears in multiple queue files: {files}; pass --file")
    if matches:
        return matches[0]
    if file_name:
        # A newly promoted function may not be in the persisted queue yet.  A
        # synthesized entry still makes the portable workflow usable.
        return {
            "function": function,
            "file": Path(file_name).name,
            "region": "unknown",
            "instructions": 0,
            "difficulty": "unknown",
            "tags": ["untracked"],
            "attempts": 0,
            "lastScore": 0,
            "status": "pending",
        }
    raise HarnessError(f"function {function} is not present in .pi/decomp/queue.json; pass --file")


def read_text(path: Path, description: str) -> str:
    try:
        return path.read_text(errors="replace")
    except OSError as exc:
        raise HarnessError(f"could not read {description} {path}: {exc}") from exc


def source_context(root: Path, entry: dict[str, Any], radius: int = 18) -> str:
    path = source_path(root, entry)
    try:
        lines = path.read_text(errors="replace").splitlines()
    except OSError:
        return "(source file not found)"
    needle = pragma_for(entry)
    try:
        index = next(index for index, line in enumerate(lines) if needle in line)
    except StopIteration:
        return "(GLOBAL_ASM pragma not found; source may already be converted)"
    start = max(0, index - radius)
    end = min(len(lines), index + radius + 1)
    return "\n".join(f"{line_number + 1:4d} | {lines[line_number]}" for line_number in range(start, end))


def referenced_symbols(target_asm: str) -> list[str]:
    return sorted(set(SYMBOL_RE.findall(target_asm)))


def referenced_callees(target_asm: str) -> list[str]:
    return sorted(set(CALLEE_RE.findall(target_asm)))


def matching_lines(path: Path, names: Iterable[str]) -> list[str]:
    try:
        lines = path.read_text(errors="replace").splitlines()
    except OSError:
        return []
    found: list[str] = []
    for line in lines:
        if any(re.search(rf"\b{re.escape(name)}\b", line) for name in names):
            found.append(line.strip())
    return found


def pattern_matches(patterns: list[dict[str, Any]], target_asm: str, context: str) -> list[dict[str, Any]]:
    haystack = f"{target_asm}\n{context}".lower()
    ranked: list[tuple[int, dict[str, Any]]] = []
    for pattern in patterns:
        score = 0
        examples = pattern.get("example_functions") or pattern.get("exampleFunctions") or []
        if not isinstance(examples, list):
            examples = []
        trigger_words = re.findall(r"[a-z_][a-z0-9_]+", str(pattern.get("trigger", "")).lower())
        score += sum(1 for word in trigger_words if len(word) > 3 and word in haystack)
        solution_words = re.findall(r"[a-z_][a-z0-9_]+", str(pattern.get("solution", "")).lower())
        score += sum(1 for word in solution_words if len(word) > 4 and word in target_asm.lower()) // 2
        if score:
            ranked.append((score, pattern))
    ranked.sort(key=lambda item: item[0], reverse=True)
    return [pattern for _, pattern in ranked[:5]]


def run_process(
    command: list[str],
    root: Path,
    timeout: float,
) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(
            command,
            cwd=root,
            text=True,
            capture_output=True,
            timeout=timeout,
            check=False,
        )
    except FileNotFoundError as exc:
        raise HarnessError(f"required command not found: {command[0]}") from exc
    except subprocess.TimeoutExpired as exc:
        stdout = exc.stdout if isinstance(exc.stdout, str) else ""
        stderr = exc.stderr if isinstance(exc.stderr, str) else ""
        raise HarnessError(
            f"command timed out after {timeout:g}s: {' '.join(command)}\n{tail(stdout + stderr)}"
        ) from exc


def similarity(root: Path, function: str, same_file: bool = False) -> dict[str, Any] | None:
    command = [
        sys.executable,
        str(root / "tools/decomp_similarity.py"),
        "--repo",
        str(root),
        "--function",
        function,
        "--top",
        "3",
        "--json",
    ]
    if same_file:
        command.append("--same-file")
    try:
        result = run_process(command, root, 20)
        if result.returncode != 0:
            return None
        payload = json.loads(result.stdout)
        return payload if isinstance(payload, dict) else None
    except (HarnessError, json.JSONDecodeError):
        return None


def asmlift_command(root: Path, explicit: str | None = None) -> list[str] | None:
    configured = explicit or os.environ.get("CONKER_ASMLIFT") or os.environ.get("ASMLIFT_COMMAND")
    if configured:
        parts = shlex.split(configured)
        if not parts:
            raise HarnessError("asmlift command is empty")
        return parts
    installed = shutil.which("asmlift")
    if installed:
        return [installed]
    sibling = root.parent / "asmlift"
    built = sibling / "packages/cli/dist/asmlift.mjs"
    node = shutil.which("node")
    if built.is_file() and node:
        return [node, str(built)]
    if (sibling / "package.json").is_file() and shutil.which("pnpm"):
        # pnpm's normal lifecycle banner is stdout and would corrupt the
        # generated C source returned to an agent. --silent keeps stdout a
        # protocol channel while diagnostics remain on stderr.
        return ["pnpm", "--silent", "--dir", str(sibling), "asmlift"]
    return None


def run_asmlift(
    root: Path,
    asm: Path,
    function: str | None,
    target: str,
    explicit_command: str | None = None,
    strict: bool = False,
) -> dict[str, Any]:
    command = asmlift_command(root, explicit_command)
    if command is None:
        return {
            "available": False,
            "target": target,
            "usable_for_matching": False,
            "reason": "asmlift is not installed; set CONKER_ASMLIFT or install @asmlift/cli",
        }
    args = [str(asm), "--target", target]
    if function:
        args.extend(["--name", function])
    if strict:
        args.append("--strict")
    try:
        result = run_process(command + args, root, 90)
    except HarnessError as exc:
        return {
            "available": True,
            "command": command,
            "target": target,
            "usable_for_matching": False,
            "error": str(exc),
        }
    return {
        "available": True,
        "command": command,
        "target": target,
        "exit_code": result.returncode,
        "source": result.stdout,
        "diagnostics": result.stderr,
        "usable_for_matching": False,
        "reason": "Conker is IDO 5.3; asmlift's nearest MIPS target is IDO 7.1",
    }


def progress_stats(root: Path) -> dict[str, Any]:
    csv_path = root / "conker/progress.csv"
    result: dict[str, Any] = {"available": False, "sections": {}}
    if not csv_path.is_file():
        return result
    sections: dict[str, dict[str, int]] = {}
    total = {"c_functions": 0, "asm_functions": 0, "c_bytes": 0, "asm_bytes": 0}
    for line in csv_path.read_text(errors="replace").splitlines():
        parts = line.split(",")
        if len(parts) < 7:
            continue
        section = parts[1].strip()
        symbol = parts[3].strip()
        language = parts[6].strip()
        try:
            length = int(parts[5].strip())
        except ValueError:
            continue
        if not symbol or symbol == "function" or symbol.startswith((".", "D_")):
            continue
        bucket = sections.setdefault(section, {"c_functions": 0, "asm_functions": 0, "c_bytes": 0, "asm_bytes": 0})
        if language == "c":
            bucket["c_functions"] += 1
            bucket["c_bytes"] += length
            total["c_functions"] += 1
            total["c_bytes"] += length
        elif language == "asm":
            bucket["asm_functions"] += 1
            bucket["asm_bytes"] += length
            total["asm_functions"] += 1
            total["asm_bytes"] += length
    result["available"] = bool(total["c_functions"] + total["asm_functions"])
    result["total"] = total
    result["sections"] = sections
    return result


def queue_status(root: Path) -> dict[str, Any]:
    queue = load_queue(root)
    statuses: dict[str, int] = {}
    for entry in queue:
        status = str(entry.get("status", "unknown"))
        statuses[status] = statuses.get(status, 0) + 1
    live_pending = sum(
        1 for entry in queue if entry.get("status") == "pending" and has_live_pragma(root, entry)
    )
    attempted = sum(1 for entry in queue if int(entry.get("attempts", 0) or 0) > 0)
    return {
        "entries": len(queue),
        "statuses": statuses,
        "live_pending": live_pending,
        "attempted": attempted,
        "patterns": len(load_patterns(root)),
        "progress": progress_stats(root),
    }


def filtered_candidates(root: Path, args: argparse.Namespace) -> list[dict[str, Any]]:
    queue = load_queue(root)
    candidates: list[dict[str, Any]] = []
    for entry in queue:
        if entry.get("status") != "pending" or not has_live_pragma(root, entry):
            continue
        if not args.near_miss and not args.include_attempted and int(entry.get("attempts", 0) or 0) >= ROTATE_AFTER_ATTEMPTS:
            continue
        if args.region and entry.get("region") != args.region:
            continue
        if args.difficulty and entry.get("difficulty") != args.difficulty:
            continue
        if args.max_instructions is not None and int(entry.get("instructions", 0) or 0) > args.max_instructions:
            continue
        history = entry.get("history") or []
        best = max((float(item.get("score", 0) or 0) for item in history if isinstance(item, dict)), default=0)
        if args.near_miss and best < 0.8:
            continue
        candidates.append(entry)
    if args.near_miss:
        candidates.sort(
            key=lambda entry: (
                -max((float(item.get("score", 0) or 0) for item in entry.get("history", []) if isinstance(item, dict)), default=0),
                int(entry.get("instructions", 0) or 0),
            )
        )
    else:
        candidates.sort(
            key=lambda entry: (
                int(entry.get("instructions", 0) or 0),
                int(entry.get("attempts", 0) or 0),
                str(entry.get("function", "")),
            )
        )
    return candidates


def history_view(entry: dict[str, Any], include_code: bool) -> list[dict[str, Any]]:
    history = entry.get("history") or []
    if not isinstance(history, list):
        return []
    view: list[dict[str, Any]] = []
    for item in history[-8:]:
        if not isinstance(item, dict):
            continue
        row = {
            "score": item.get("score", 0),
            "reason": item.get("reason", ""),
            "diffs": item.get("diffs", []),
            "timestamp": item.get("timestamp", ""),
        }
        if include_code:
            row["code"] = item.get("code", "")
        view.append(row)
    return view


def candidate_payload(root: Path, entry: dict[str, Any], args: argparse.Namespace) -> dict[str, Any]:
    asm_path = target_path(root, entry)
    target_asm = read_text(asm_path, "target assembly") if asm_path else "(target assembly not found)"
    context = source_context(root, entry)
    symbols = referenced_symbols(target_asm)
    callees = referenced_callees(target_asm)
    payload: dict[str, Any] = {
        "candidate": entry,
        "source_path": str(source_path(root, entry).relative_to(root)),
        "target_path": str(asm_path.relative_to(root)) if asm_path else None,
        "target_asm": target_asm,
        "source_context": context,
        "context": {
            "symbols": symbols,
            "symbol_declarations": matching_lines(root / "conker/include/variables.h", symbols),
            "callee_prototypes": matching_lines(root / "conker/include/functions.h", callees),
            "callees": callees,
        },
        "patterns": pattern_matches(load_patterns(root), target_asm, context),
        "history": history_view(entry, args.include_history_code),
        "workflow": {
            "attempt": f"python3 tools/decomp_harness.py attempt --function {entry['function']} --file {entry['file']} --code-file candidate.c --json",
            "verify": "python3 tools/decomp_harness.py verify --json",
            "accept": f"python3 tools/decomp_harness.py accept --function {entry['function']} --file {entry['file']} --json",
            "authority": "Conker IDO 5.3 compile plus ROM SHA-1 verification",
        },
    }
    if args.similar:
        payload["similarity"] = similarity(root, str(entry["function"]), same_file=True)
    if args.with_asmlift and asm_path:
        payload["asmlift"] = run_asmlift(
            root,
            asm_path,
            str(entry["function"]),
            args.asmlift_target,
            args.asmlift_command,
        )
    return payload


def run_verify(root: Path, image: str, clean: bool = False) -> subprocess.CompletedProcess[str]:
    image_check = run_process(["docker", "image", "inspect", image], root, 15)
    if image_check.returncode != 0:
        raise HarnessError(
            f"Docker image {image!r} is not available locally; build it with "
            f"docker build --platform linux/amd64 -t {image} ."
        )
    commands = ["set -e"]
    if clean:
        commands.append("make -C /src clean")
    commands.extend(["make -C /src dirs >/dev/null", "make -C /src verify"])
    command = [
        "docker",
        "run",
        "--rm",
        "--platform",
        "linux/amd64",
        "-v",
        f"{root}:/src",
        "-w",
        "/src",
        image,
        "bash",
        "-lc",
        "; ".join(commands),
    ]
    return run_process(command, root, 900)


def safe_repo_path(root: Path, raw: str) -> Path:
    candidate = (root / raw).resolve()
    try:
        candidate.relative_to(root.resolve())
    except ValueError as exc:
        raise HarnessError(f"path escapes repository root: {raw}") from exc
    return candidate


def load_context_patches(root: Path, patch_file: str | None) -> list[dict[str, str]]:
    if not patch_file:
        return []
    payload = load_json(safe_repo_path(root, patch_file), [])
    if isinstance(payload, dict):
        payload = payload.get("patches", [])
    if not isinstance(payload, list):
        raise HarnessError("context patch file must contain an array or {\"patches\": [...]}")
    patches: list[dict[str, str]] = []
    for item in payload:
        if not isinstance(item, dict) or not all(key in item for key in ("path", "oldText", "newText")):
            raise HarnessError("each context patch needs path, oldText, and newText")
        patches.append({key: str(item[key]) for key in ("path", "oldText", "newText")})
    return patches


def apply_context_patches(root: Path, patches: list[dict[str, str]]) -> dict[Path, str]:
    originals: dict[Path, str] = {}
    try:
        for patch in patches:
            path = safe_repo_path(root, patch["path"])
            if path not in originals:
                originals[path] = read_text(path, "context patch target")
            current = path.read_text()
            count = current.count(patch["oldText"])
            if count != 1:
                raise HarnessError(f"context patch {patch['path']} expected one oldText match, found {count}")
            path.write_text(current.replace(patch["oldText"], patch["newText"], 1))
    except Exception:
        # A later patch can fail after earlier patches have already landed. Do
        # not leak a partial context transaction to the next agent turn.
        restore_files(originals)
        raise
    return originals


def restore_files(originals: dict[Path, str]) -> None:
    for path, content in originals.items():
        path.write_text(content)


def record_attempt(
    root: Path,
    function: str,
    file_name: str,
    code: str,
    score: float,
    reason: str,
    diffs: list[Any],
    context_patches: list[dict[str, str]] | None = None,
) -> None:
    queue = load_queue(root)
    for entry in queue:
        if entry.get("function") != function or Path(str(entry.get("file", ""))).name != Path(file_name).name:
            continue
        history = entry.setdefault("history", [])
        if not isinstance(history, list):
            history = []
            entry["history"] = history
        history.append({
            "code": code,
            "score": score,
            "reason": reason,
            "diffs": diffs[:20],
            "timestamp": now(),
            **({"contextPatch": context_patches} if context_patches else {}),
        })
        entry["attempts"] = max(int(entry.get("attempts", 0) or 0) + 1, len(history))
        entry["lastScore"] = score
        # A match is not accepted until the full ROM gate passes.  Keeping the
        # entry pending makes this state safe to share with the Pi extension.
        if entry.get("status") not in ("matched", "skipped"):
            entry["status"] = "pending"
        save_queue(root, queue)
        return


def code_from_args(root: Path, args: argparse.Namespace) -> str:
    if args.code_file:
        path = Path(args.code_file)
        if not path.is_absolute():
            path = root / path
        return read_text(path.resolve(), "candidate code")
    if args.code is not None:
        return args.code
    if not sys.stdin.isatty():
        return sys.stdin.read()
    raise HarnessError("provide --code-file, --code, or candidate C on stdin")


def parse_diff_output(output: str) -> dict[str, Any]:
    try:
        payload = json.loads(output)
        if isinstance(payload, dict):
            return payload
    except json.JSONDecodeError:
        pass
    raise HarnessError(f"diff helper did not return JSON:\n{tail(output)}")


def cmd_status(root: Path, args: argparse.Namespace) -> int:
    payload = {"repo": str(root), "queue": queue_status(root), "branch": git_branch(root)}
    if args.json:
        print(json.dumps(payload, indent=2))
    else:
        queue = payload["queue"]
        print(f"Conker decomp queue: {queue['entries']} entries; {queue['live_pending']} live pending; {queue['attempted']} attempted")
        print("Statuses: " + ", ".join(f"{key}={value}" for key, value in sorted(queue["statuses"].items())))
        print(f"Patterns: {queue['patterns']}")
        if queue["progress"].get("available"):
            total = queue["progress"]["total"]
            print(f"Progress: {total['c_functions']} C / {total['asm_functions']} ASM functions; {total['c_bytes']} / {total['c_bytes'] + total['asm_bytes']} bytes")
        else:
            print("Progress CSV: unavailable (run make -C conker progress when the build artifacts exist)")
    return 0


def git_branch(root: Path) -> str | None:
    try:
        result = run_process(["git", "branch", "--show-current"], root, 5)
        return result.stdout.strip() if result.returncode == 0 else None
    except HarnessError:
        return None


def cmd_next(root: Path, args: argparse.Namespace) -> int:
    if args.verify_baseline:
        result = run_verify(root, args.image)
        if result.returncode != 0:
            payload = {
                "error": "rom_baseline_broken",
                "stdout": tail(result.stdout),
                "stderr": tail(result.stderr),
            }
            if args.json:
                print(json.dumps(payload, indent=2))
            else:
                print("ROM baseline verification failed. Fix it before selecting a candidate.", file=sys.stderr)
                print(tail(result.stdout + result.stderr), file=sys.stderr)
            return 1
    candidates = filtered_candidates(root, args)
    if not candidates:
        payload = {"candidate": None, "message": "no pending candidate matches the requested filters"}
        if args.json:
            print(json.dumps(payload, indent=2))
        else:
            print(payload["message"])
        return 1
    payload = candidate_payload(root, candidates[0], args)
    if args.json:
        print(json.dumps(payload, indent=2))
    else:
        entry = payload["candidate"]
        print(f"## Next candidate: {entry['function']}")
        print(f"File: {entry['file']} | Region: {entry.get('region', 'unknown')} | Instructions: {entry.get('instructions', 0)} | Difficulty: {entry.get('difficulty', 'unknown')}")
        print(f"Attempts: {entry.get('attempts', 0)} | Last score: {entry.get('lastScore', 0)}")
        print("\n### Target assembly\n```mips\n" + payload["target_asm"] + "\n```")
        print("\n### Surrounding C context\n```c\n" + payload["source_context"] + "\n```")
        context = payload["context"]
        if context["symbol_declarations"]:
            print("\n### Symbol declarations\n```c\n" + "\n".join(context["symbol_declarations"]) + "\n```")
        if context["callee_prototypes"]:
            print("\n### Callee prototypes\n```c\n" + "\n".join(context["callee_prototypes"]) + "\n```")
        if payload["history"]:
            print("\n### Prior attempts\n" + json.dumps(payload["history"], indent=2))
        if args.with_asmlift:
            lift = payload.get("asmlift", {})
            print("\n### asmlift draft\n```c\n" + str(lift.get("source", "(unavailable)")) + "\n```")
            if lift.get("reason"):
                print(f"asmlift note: {lift['reason']}", file=sys.stderr)
    return 0


def cmd_lift(root: Path, args: argparse.Namespace) -> int:
    if args.asm:
        asm = safe_repo_path(root, args.asm)
        function = args.function
    else:
        if not args.function:
            raise HarnessError("lift needs --function when using the queue")
        entry = entry_for(root, args.function, args.file)
        asm = target_path(root, entry)
        function = args.function
        if asm is None:
            raise HarnessError(f"target assembly not found for {args.function}")
    if not asm.is_file():
        raise HarnessError(f"assembly input not found: {asm}")
    payload = run_asmlift(
        root,
        asm,
        function,
        args.asmlift_target,
        args.asmlift_command,
        strict=args.strict,
    )
    payload["input"] = str(asm.relative_to(root)) if asm.is_relative_to(root) else str(asm)
    payload["function"] = function
    if args.json:
        print(json.dumps(payload, indent=2))
    else:
        if payload.get("source"):
            print(payload["source"], end="" if payload["source"].endswith("\n") else "\n")
        if payload.get("diagnostics"):
            print(payload["diagnostics"], file=sys.stderr, end="" if payload["diagnostics"].endswith("\n") else "\n")
        if payload.get("reason"):
            print(f"asmlift: {payload['reason']}", file=sys.stderr)
        if not payload.get("available") or payload.get("error"):
            return 1
    return 0 if payload.get("source") else 1


def cmd_diff(root: Path, args: argparse.Namespace) -> int:
    entry = entry_for(root, args.function, args.file)
    file_name = Path(str(entry["file"])).name
    result = run_process([str(root / "tools/conker-diff.sh"), args.function, file_name], root, 180)
    try:
        payload = parse_diff_output(result.stdout)
    except HarnessError:
        payload = {"error": "diff_failed", "stdout": tail(result.stdout), "stderr": tail(result.stderr), "exit_code": result.returncode}
    if args.json:
        print(json.dumps(payload, indent=2))
    else:
        print(json.dumps(payload, indent=2))
    return 0 if result.returncode == 0 and not payload.get("error") else 1


def cmd_attempt(root: Path, args: argparse.Namespace) -> int:
    queue = load_queue(root)
    entry = entry_for(root, args.function, args.file, queue)
    file_name = Path(str(entry["file"])).name
    src = source_path(root, {**entry, "file": file_name})
    if not src.is_file():
        raise HarnessError(f"source file not found: {src}")
    code = code_from_args(root, args).strip()
    if not code:
        raise HarnessError("candidate code is empty")
    if "#pragma GLOBAL_ASM" in code:
        raise HarnessError("candidate code must replace one function, not contain another GLOBAL_ASM pragma")
    original_source = read_text(src, "source")
    pragma = pragma_for({**entry, "file": file_name})
    if original_source.count(pragma) != 1:
        raise HarnessError(f"expected exactly one target pragma in {src}, found {original_source.count(pragma)}")
    context_patches = load_context_patches(root, args.context_patch_file)
    originals: dict[Path, str] = {src: original_source}
    kept = False
    try:
        originals.update(apply_context_patches(root, context_patches))
        patched_source = read_text(src, "source after context patches")
        src.write_text(patched_source.replace(pragma, code, 1))
        compile_result = run_process([str(root / "tools/conker-build-tu.sh"), file_name], root, args.timeout)
        if compile_result.returncode != 0:
            payload = {
                "match": False,
                "score": 0.0,
                "reason": "compile_error",
                "compile_stdout": tail(compile_result.stdout),
                "compile_stderr": tail(compile_result.stderr),
                "kept": False,
            }
            record_attempt(root, args.function, file_name, code, 0.0, "compile_error", [], context_patches)
            return emit_attempt(payload, args, 1)
        diff_result = run_process([str(root / "tools/conker-diff.sh"), args.function, file_name], root, args.timeout)
        diff = parse_diff_output(diff_result.stdout)
        score = float(diff.get("score", 0) or 0)
        match = bool(diff.get("match")) and diff_result.returncode == 0
        reason = str(diff.get("reason", "match" if match else "nonmatch"))
        record_attempt(root, args.function, file_name, code, score, reason, diff.get("diffs", []), context_patches)
        kept = match and not args.revert_on_match
        payload = {
            "match": match,
            "score": score,
            "reason": reason,
            "diff": diff,
            "kept": kept,
            "source": str(src.relative_to(root)),
            "next": "run verify then accept" if match else "inspect the diff and try a different candidate",
        }
        return emit_attempt(payload, args, 0 if match or diff_result.returncode == 0 else 1)
    finally:
        # The source remains in place only for a matching attempt, allowing the
        # agent to run accept. Every non-match/compile failure is automatically
        # rolled back, including context patches.
        if not kept:
            restore_files(originals)


def emit_attempt(payload: dict[str, Any], args: argparse.Namespace, code: int) -> int:
    if args.json:
        print(json.dumps(payload, indent=2))
    else:
        print(json.dumps(payload, indent=2))
    return code


def cmd_verify(root: Path, args: argparse.Namespace) -> int:
    try:
        result = run_verify(root, args.image, args.clean)
        payload = {
            "ok": result.returncode == 0 and ("OK" in result.stdout or "OK" in result.stderr),
            "exit_code": result.returncode,
            "stdout": tail(result.stdout),
            "stderr": tail(result.stderr),
            "image": args.image,
        }
    except HarnessError as exc:
        payload = {"ok": False, "error": str(exc), "image": args.image}
    if args.json:
        print(json.dumps(payload, indent=2))
    else:
        print(tail(payload.get("stdout", "") + payload.get("stderr", "")))
    return 0 if payload.get("ok") else 1


def cmd_accept(root: Path, args: argparse.Namespace) -> int:
    queue = load_queue(root)
    entry = entry_for(root, args.function, args.file, queue)
    if has_live_pragma(root, entry) and not args.force:
        raise HarnessError("source still contains the target GLOBAL_ASM pragma; run a matching attempt first or pass --force")
    result = run_verify(root, args.image)
    payload: dict[str, Any] = {
        "ok": result.returncode == 0 and ("OK" in result.stdout or "OK" in result.stderr),
        "function": args.function,
        "file": entry.get("file"),
        "stdout": tail(result.stdout),
        "stderr": tail(result.stderr),
    }
    if payload["ok"]:
        for queued in queue:
            if queued.get("function") == args.function and Path(str(queued.get("file", ""))).name == Path(str(entry.get("file", ""))).name:
                queued["status"] = "matched"
                queued["lastScore"] = max(float(queued.get("lastScore", 0) or 0), 1.0)
                break
        save_queue(root, queue)
        if args.commit:
            commit = run_process(["git", "add", str(source_path(root, entry).relative_to(root)), str(queue_path(root).relative_to(root))], root, 10)
            if commit.returncode == 0:
                commit = run_process(["git", "commit", "-m", f"feat(decomp): match {args.function}"], root, 30)
            payload["commit"] = {"exit_code": commit.returncode, "stdout": tail(commit.stdout), "stderr": tail(commit.stderr)}
    if args.json:
        print(json.dumps(payload, indent=2))
    else:
        print(tail(payload["stdout"] + payload["stderr"]))
        print("accepted" if payload["ok"] else "verification failed", file=sys.stderr if not payload["ok"] else sys.stdout)
    return 0 if payload["ok"] else 1


def add_json_flag(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--json", action="store_true", help="emit machine-readable JSON")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", default=".", help="Conker repository root (default: current/ancestor)")
    commands = parser.add_subparsers(dest="command", required=True)

    status = commands.add_parser("status", help="summarize queue and build progress")
    add_json_flag(status)

    next_parser = commands.add_parser("next", help="select a pending candidate and return its context")
    next_parser.add_argument("--region", choices=["init", "game", "debugger"])
    next_parser.add_argument("--difficulty", choices=["trivial", "low", "medium-low", "medium", "hard"])
    next_parser.add_argument("--max-instructions", type=int)
    next_parser.add_argument("--near-miss", action="store_true", help="route to prior attempts scoring at least .8")
    next_parser.add_argument("--include-attempted", action="store_true", help="do not auto-rotate after eight attempts")
    next_parser.add_argument("--include-history-code", action="store_true")
    next_parser.add_argument("--similar", action="store_true", help="include assembly-shape sibling ranking")
    next_parser.add_argument("--with-asmlift", action="store_true", help="include an optional asmlift source draft")
    next_parser.add_argument("--asmlift-target", default=DEFAULT_ASMLIFT_TARGET)
    next_parser.add_argument("--asmlift-command", help="override asmlift command, e.g. /path/to/asmlift")
    next_parser.add_argument("--verify-baseline", action="store_true", help="run the Docker ROM gate before selecting")
    next_parser.add_argument("--image", default=os.environ.get("CONKER_BUILD_IMAGE", "conker-build-min-amd64"))
    add_json_flag(next_parser)

    lift = commands.add_parser("lift", help="run asmlift on a target assembly function")
    lift.add_argument("--function", "--name")
    lift.add_argument("--file", help="queue source file when selecting by function")
    lift.add_argument("--asm", help="repository-relative assembly path instead of queue lookup")
    lift.add_argument("--asmlift-target", default=DEFAULT_ASMLIFT_TARGET)
    lift.add_argument("--asmlift-command", help="override asmlift command")
    lift.add_argument("--strict", action="store_true")
    add_json_flag(lift)

    diff = commands.add_parser("diff", help="diff an already-built translation unit")
    diff.add_argument("--function", required=True)
    diff.add_argument("--file")
    add_json_flag(diff)

    attempt = commands.add_parser("attempt", help="compile/diff one candidate, rolling back non-matches")
    attempt.add_argument("--function", required=True)
    attempt.add_argument("--file")
    attempt.add_argument("--code-file")
    attempt.add_argument("--code")
    attempt.add_argument("--context-patch-file")
    attempt.add_argument("--revert-on-match", action="store_true")
    attempt.add_argument("--timeout", type=float, default=180)
    add_json_flag(attempt)

    verify = commands.add_parser("verify", help="run the Dockerized full Conker ROM verification")
    verify.add_argument("--image", default=os.environ.get("CONKER_BUILD_IMAGE", "conker-build-min-amd64"))
    verify.add_argument("--clean", action="store_true")
    add_json_flag(verify)

    accept = commands.add_parser("accept", help="run the ROM gate and mark a matching source accepted")
    accept.add_argument("--function", required=True)
    accept.add_argument("--file")
    accept.add_argument("--image", default=os.environ.get("CONKER_BUILD_IMAGE", "conker-build-min-amd64"))
    accept.add_argument("--force", action="store_true")
    accept.add_argument("--commit", action="store_true", help="explicitly commit the source and queue change")
    add_json_flag(accept)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        start = Path(args.repo)
        root = find_repo_root(start)
        if args.command == "status":
            return cmd_status(root, args)
        if args.command == "next":
            return cmd_next(root, args)
        if args.command == "lift":
            return cmd_lift(root, args)
        if args.command == "diff":
            return cmd_diff(root, args)
        if args.command == "attempt":
            return cmd_attempt(root, args)
        if args.command == "verify":
            return cmd_verify(root, args)
        if args.command == "accept":
            return cmd_accept(root, args)
        raise HarnessError(f"unknown command: {args.command}")
    except HarnessError as exc:
        if getattr(args, "json", False):
            print(json.dumps({"error": str(exc)}, indent=2))
        else:
            print(f"decomp_harness: {exc}", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        if getattr(args, "json", False):
            print(json.dumps({"error": "interrupted"}, indent=2))
        else:
            print("decomp_harness: interrupted", file=sys.stderr)
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
