#!/usr/bin/env python3
"""Small stdlib-only tests for the portable agent boundary."""

from __future__ import annotations

import argparse
import contextlib
import io
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import decomp_harness as harness  # noqa: E402


class HarnessTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        (self.root / "conker/src").mkdir(parents=True)
        (self.root / "conker/asm/nonmatchings/game").mkdir(parents=True)
        (self.root / "conker/include").mkdir(parents=True)
        (self.root / "tools").mkdir()
        (self.root / "conker/Makefile").write_text("# test fixture\n")
        (self.root / "tools/decomp_similarity.py").write_text("")
        (self.root / "conker/include/variables.h").write_text("extern s32 D_TEST;\n")
        (self.root / "conker/include/functions.h").write_text("void func_2(void);\n")
        self.entry = {
            "function": "func_1",
            "file": "game.c",
            "region": "game",
            "instructions": 4,
            "difficulty": "trivial",
            "tags": [],
            "attempts": 0,
            "lastScore": 0,
            "status": "pending",
            "history": [],
        }
        source = harness.pragma_for(self.entry)
        (self.root / "conker/src/game.c").write_text(f"#include <ultra64.h>\n\n{source}\n")
        (self.root / "conker/asm/nonmatchings/game/func_1.s").write_text(
            "glabel func_1\n"
            "    /* 0 0 00000000 */  lui $t0, %hi(D_TEST)\n"
            "    /* 4 4 00000000 */  jal func_2\n"
        )
        (self.root / ".pi/decomp").mkdir(parents=True)
        (self.root / ".pi/decomp/queue.json").write_text(json.dumps([self.entry]))
        (self.root / ".pi/decomp/patterns.json").write_text(
            json.dumps([{
                "id": "global-call",
                "description": "test",
                "trigger": "global call",
                "solution": "preserve call",
                "example_functions": [],
            }])
        )

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def test_live_pragma_and_context(self) -> None:
        self.assertTrue(harness.has_live_pragma(self.root, self.entry))
        context = harness.source_context(self.root, self.entry)
        self.assertIn("GLOBAL_ASM", context)
        self.assertEqual(harness.referenced_symbols("%hi(D_TEST)"), ["D_TEST"])
        self.assertEqual(harness.referenced_callees("jal func_2"), ["func_2"])

    def test_candidate_payload_is_agent_context(self) -> None:
        args = argparse.Namespace(
            include_history_code=False,
            similar=False,
            with_asmlift=False,
            asmlift_target=harness.DEFAULT_ASMLIFT_TARGET,
            asmlift_command=None,
        )
        payload = harness.candidate_payload(self.root, self.entry, args)
        self.assertEqual(payload["candidate"]["function"], "func_1")
        self.assertEqual(payload["context"]["symbol_declarations"], ["extern s32 D_TEST;"])
        self.assertEqual(payload["context"]["callee_prototypes"], ["void func_2(void);"])
        self.assertEqual(payload["target_path"], "conker/asm/nonmatchings/game/func_1.s")

    def test_filter_skips_rotated_candidates(self) -> None:
        queue = harness.load_queue(self.root)
        queue[0]["attempts"] = harness.ROTATE_AFTER_ATTEMPTS
        harness.save_queue(self.root, queue)
        args = argparse.Namespace(
            near_miss=False,
            include_attempted=False,
            region=None,
            difficulty=None,
            max_instructions=None,
        )
        self.assertEqual(harness.filtered_candidates(self.root, args), [])
        args.include_attempted = True
        self.assertEqual(len(harness.filtered_candidates(self.root, args)), 1)

    def test_context_patch_is_transactional(self) -> None:
        path = self.root / "conker/include/variables.h"
        original = path.read_text()
        patches = [{"path": "conker/include/variables.h", "oldText": "extern s32 D_TEST;", "newText": "extern s32 *D_TEST;"}]
        originals = harness.apply_context_patches(self.root, patches)
        self.assertIn("*D_TEST", path.read_text())
        harness.restore_files(originals)
        self.assertEqual(path.read_text(), original)

    def test_failed_context_transaction_restores_earlier_patch(self) -> None:
        path = self.root / "conker/include/variables.h"
        original = path.read_text()
        patches = [
            {"path": "conker/include/variables.h", "oldText": "extern s32 D_TEST;", "newText": "extern s32 *D_TEST;"},
            {"path": "conker/include/variables.h", "oldText": "does not exist", "newText": "still does not exist"},
        ]
        with self.assertRaises(harness.HarnessError):
            harness.apply_context_patches(self.root, patches)
        self.assertEqual(path.read_text(), original)

    def test_diff_json_parser_rejects_non_json(self) -> None:
        with self.assertRaises(harness.HarnessError):
            harness.parse_diff_output("not json")

    def test_verify_targets_mounted_repository_root(self) -> None:
        real_run_process = harness.run_process
        calls = []

        def fake_run(command: list[str], root: Path, timeout: float) -> subprocess.CompletedProcess[str]:
            calls.append(command)
            return subprocess.CompletedProcess(command, 0, "", "")

        harness.run_process = fake_run
        try:
            result = harness.run_verify(self.root, "conker-build-min-amd64")
        finally:
            harness.run_process = real_run_process

        self.assertEqual(result.returncode, 0)
        self.assertEqual(calls[0], ["docker", "image", "inspect", "conker-build-min-amd64"])
        docker_command = calls[1]
        self.assertIn("make -C /src dirs >/dev/null", docker_command[-1])
        self.assertIn("make -C /src verify", docker_command[-1])
        self.assertNotIn("/src/conker", docker_command[-1])

    def test_nonmatching_attempt_restores_source(self) -> None:
        original = (self.root / "conker/src/game.c").read_text()
        real_run_process = harness.run_process

        def fake_run(command: list[str], root: Path, timeout: float) -> subprocess.CompletedProcess[str]:
            if "conker-build-tu.sh" in command[0]:
                return subprocess.CompletedProcess(command, 0, "", "")
            return subprocess.CompletedProcess(
                command,
                0,
                json.dumps({"match": False, "score": 0.5, "reason": "structural_diffs=1", "diffs": [{"line": 0}]}),
                "",
            )

        harness.run_process = fake_run
        try:
            args = argparse.Namespace(
                function="func_1",
                file="game.c",
                code_file=None,
                code="void func_1(void) {}",
                context_patch_file=None,
                revert_on_match=False,
                timeout=10,
                json=True,
            )
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(harness.cmd_attempt(self.root, args), 0)
        finally:
            harness.run_process = real_run_process
        self.assertEqual((self.root / "conker/src/game.c").read_text(), original)
        self.assertEqual(len(harness.load_queue(self.root)[0]["history"]), 1)

    def test_matching_attempt_keeps_source_for_accept(self) -> None:
        real_run_process = harness.run_process

        def fake_run(command: list[str], root: Path, timeout: float) -> subprocess.CompletedProcess[str]:
            if "conker-build-tu.sh" in command[0]:
                return subprocess.CompletedProcess(command, 0, "", "")
            return subprocess.CompletedProcess(
                command,
                0,
                json.dumps({"match": True, "score": 1.0, "reason": "match", "diffs": []}),
                "",
            )

        harness.run_process = fake_run
        try:
            args = argparse.Namespace(
                function="func_1",
                file="game.c",
                code_file=None,
                code="void func_1(void) {}",
                context_patch_file=None,
                revert_on_match=False,
                timeout=10,
                json=True,
            )
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(harness.cmd_attempt(self.root, args), 0)
        finally:
            harness.run_process = real_run_process
        self.assertIn("void func_1(void) {}", (self.root / "conker/src/game.c").read_text())


if __name__ == "__main__":
    unittest.main()
