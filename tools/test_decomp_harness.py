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

    def test_legacy_basename_resolves_nested_source_and_near_miss(self) -> None:
        nested = {
            "function": "func_nested",
            "file": "init_nested.c",
            "region": "init",
            "instructions": 4,
            "difficulty": "trivial",
            "attempts": 1,
            "lastScore": 0.86,
            "status": "pending",
            "history": [{"score": 0.86, "reason": "near miss"}],
        }
        source_path = self.root / "conker/src/libultra/audio/init_nested.c"
        source_path.parent.mkdir(parents=True)
        source_path.write_text(
            '#pragma GLOBAL_ASM("asm/nonmatchings/libultra/audio/init_nested/func_nested.s")\n'
        )
        target_path = self.root / "conker/asm/nonmatchings/libultra/audio/init_nested/func_nested.s"
        target_path.parent.mkdir(parents=True)
        target_path.write_text("glabel func_nested\n")
        queue = harness.load_queue(self.root)
        queue.append(nested)
        harness.save_queue(self.root, queue)

        self.assertEqual(harness.source_path(self.root, nested), source_path)
        self.assertEqual(harness.source_relative_path(self.root, nested), "libultra/audio/init_nested.c")
        self.assertEqual(harness.target_path(self.root, nested), target_path)
        self.assertTrue(harness.has_live_pragma(self.root, nested))
        args = argparse.Namespace(
            near_miss=True,
            include_attempted=False,
            region="init",
            difficulty=None,
            max_instructions=None,
        )
        self.assertEqual(harness.filtered_candidates(self.root, args), [nested])
        context = harness.source_context(self.root, nested)
        self.assertIn("GLOBAL_ASM", context)

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

    def test_assembler_not_alias_matches_objdump_nor(self) -> None:
        target = self.root / "target.s"
        target.write_text(
            "glabel func_1\n"
            "    /* 0 0 01004027 */  not $t0, $t0\n"
        )
        generated = "00000000 <func_1>:\n"
        generated += "   0:\t01004027\tnor\tt0,t0,zero\n"
        normalizer = Path(__file__).with_name("conker-normalize-asm.py")
        result = subprocess.run(
            [sys.executable, str(normalizer), str(target)],
            input=generated,
            text=True,
            capture_output=True,
            check=True,
        )
        payload = json.loads(result.stdout)
        self.assertTrue(payload["match"])
        self.assertTrue(payload["raw_match"])
        self.assertTrue(payload["raw_available"])
        self.assertEqual(payload["raw_diffs"], [])

    def test_raw_opcode_mismatch_rejects_same_shape(self) -> None:
        target = self.root / "target.s"
        target.write_text(
            "glabel func_1\n"
            "    /* 0 0 01004027 */  not $t0, $t0\n"
        )
        generated = "00000000 <func_1>:\n"
        generated += "   0:\t01084027\tnor\tt0,t1,zero\n"
        normalizer = Path(__file__).with_name("conker-normalize-asm.py")
        result = subprocess.run(
            [sys.executable, str(normalizer), str(target)],
            input=generated,
            text=True,
            capture_output=True,
            check=True,
        )
        payload = json.loads(result.stdout)
        self.assertFalse(payload["match"])
        self.assertFalse(payload["raw_match"])
        self.assertEqual(payload["raw_diffs"][0]["target"], "01004027")

    def test_raw_opcode_comparison_masks_object_relocations(self) -> None:
        target = self.root / "target.s"
        target.write_text(
            "glabel func_1\n"
            "    /* 0 0 3c088004 */  lui $t0, %hi(D_TEST)\n"
        )
        generated = "00000000 <func_1>:\n"
        generated += "   0:\t3c080000\tlui\tt0,0\n"
        generated += "\t0:\tR_MIPS_HI16\tD_TEST\n"
        normalizer = Path(__file__).with_name("conker-normalize-asm.py")
        result = subprocess.run(
            [sys.executable, str(normalizer), str(target)],
            input=generated,
            text=True,
            capture_output=True,
            check=True,
        )
        payload = json.loads(result.stdout)
        self.assertTrue(payload["match"])
        self.assertTrue(payload["raw_match"])
        self.assertEqual(payload["raw_diffs"], [])

    def test_progress_stats_include_live_percentages(self) -> None:
        (self.root / "conker/progress.csv").write_text(
            "version,section,filename,function,offset,length,language\n"
            "us,game,game.c,func_c,0,4,c\n"
            "us,game,game.s,func_a,4,12,asm\n"
        )
        progress = harness.progress_stats(self.root)
        self.assertEqual(progress["total"]["c_functions"], 1)
        self.assertEqual(progress["total"]["function_percent"], 50.0)
        self.assertEqual(progress["total"]["byte_percent"], 25.0)

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
