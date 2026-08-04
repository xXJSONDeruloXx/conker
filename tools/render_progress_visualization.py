#!/usr/bin/env python3
"""Refresh the checked-in Conker progress/routine dashboard from repository state.

The HTML is a static artifact so it can be opened directly, while this command
is the source of its changing numbers. It reads the queue and build-derived
progress through the same portable harness used by other agents. Use --verify
when the Docker ROM gate should also be run while refreshing the dashboard.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).parent))
import decomp_harness as harness  # noqa: E402


DATA_SCRIPT_RE = re.compile(
    r'(<script id="conker-progress-data" type="application/json">).*?(</script>)',
    re.DOTALL,
)


def git_value(root: Path, *arguments: str) -> str:
    result = harness.run_process(["git", *arguments], root, 5)
    return result.stdout.strip() if result.returncode == 0 else "unknown"


def expected_sha1(root: Path) -> str | None:
    for path in (root / "conker.us.sha1", root / "conker/conker.us.sha1"):
        try:
            value = path.read_text(errors="replace").strip().split()[0]
        except (IndexError, OSError):
            continue
        if re.fullmatch(r"[0-9a-fA-F]{40}", value):
            return value.lower()
    return None


def rom_info(root: Path) -> dict[str, Any]:
    artifact = next(
        (
            path
            for path in (root / "build/conker.us.z64", root / "build/conker.us.bin")
            if path.is_file()
        ),
        None,
    )
    expected = expected_sha1(root)
    if artifact is None:
        return {
            "available": False,
            "sha_match": False,
            "docker_ok": None,
            "artifact": "build/conker.us.z64",
            "size": 0,
            "sha1": None,
            "expected_sha1": expected,
        }
    digest = hashlib.sha1(artifact.read_bytes()).hexdigest()
    return {
        "available": True,
        "sha_match": expected is not None and digest == expected,
        "docker_ok": None,
        "artifact": str(artifact.relative_to(root)),
        "size": artifact.stat().st_size,
        "sha1": digest,
        "expected_sha1": expected,
    }


def collect_data(root: Path) -> dict[str, Any]:
    queue = harness.queue_status(root)
    return {
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "branch": harness.git_branch(root) or "detached",
        "commit": git_value(root, "rev-parse", "--short", "HEAD"),
        "queue": {
            "entries": queue["entries"],
            "statuses": queue["statuses"],
            "live_pending": queue["live_pending"],
            "pending_source_missing": queue["pending_source_missing"],
            "pending_without_live_pragma": queue["pending_without_live_pragma"],
            "attempted": queue["attempted"],
            "patterns": queue["patterns"],
        },
        "progress": queue["progress"],
        "rom": rom_info(root),
    }


def render(template: str, data: dict[str, Any]) -> str:
    payload = json.dumps(data, indent=2, sort_keys=True)

    def replace(match: re.Match[str]) -> str:
        return f"{match.group(1)}\n{payload}\n  {match.group(2)}"

    rendered, count = DATA_SCRIPT_RE.subn(replace, template, count=1)
    if count != 1:
        raise harness.HarnessError(
            'visualization is missing <script id="conker-progress-data" type="application/json">'
        )
    return rendered


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", default=".", help="repository root (default: current/ancestor)")
    parser.add_argument(
        "--output",
        default="docs/conker-progress-routines.html",
        help="HTML file to refresh, relative to the repository root",
    )
    parser.add_argument(
        "--verify",
        action="store_true",
        help="run the Docker ROM gate and record its result while refreshing",
    )
    parser.add_argument("--image", default="conker-build-min-amd64")
    parser.add_argument("--clean", action="store_true", help="clean before --verify")
    args = parser.parse_args()

    root = harness.find_repo_root(Path(args.repo))
    output = (root / args.output).resolve()
    output.relative_to(root)
    template = output.read_text(encoding="utf-8")
    data = collect_data(root)
    if args.verify:
        try:
            result = harness.run_verify(root, args.image, args.clean)
            data["rom"]["docker_ok"] = result.returncode == 0 and (
                "OK" in result.stdout or "OK" in result.stderr
            )
        except harness.HarnessError as exc:
            data["rom"]["docker_ok"] = False
            data["rom"]["docker_error"] = str(exc)
    output.write_text(render(template, data), encoding="utf-8")
    print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
