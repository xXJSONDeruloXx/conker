# Agent workflow

Conker is a matching decompilation project. The authoritative acceptance test is
the IDO 5.3 translation-unit diff followed by the full ROM SHA-1 gate.

Use the portable command boundary in `tools/decomp_harness.py` from any agent
harness:

```sh
python3 tools/decomp_harness.py status --json
python3 tools/decomp_harness.py next --json --with-asmlift
python3 tools/decomp_harness.py attempt --function FUNC --file FILE.c --code-file candidate.c --json
python3 tools/decomp_harness.py accept --function FUNC --file FILE.c --json
```

`asmlift` is an optional source-candidate aid. It currently targets MIPS/IDO
7.1, while Conker is compiled with IDO 5.3, so an asmlift draft must always be
verified through Conker's own compile/diff flow before it is accepted.

The `.pi` extension provides the interactive Pi frontend and additional
permuter/loop tooling; it is not required for the portable workflow. See
[`docs/agent-harness.md`](docs/agent-harness.md) for the command contract and
rollback rules.

## Byte-match commit and push discipline

Treat each exact byte-matching function as one logical commit. A commit may
include declarations, type/context fixes, queue metadata, or linker support
required by that function, but it must not include a second matching function.
Keep bonus exact matches in their own function-sized commits as well; bonuses
are useful verified work, but do not increase the counted goal.

For each function:

1. Use `attempt`/`diff` and `accept` to establish the translation-unit match.
2. Run `python3 tools/decomp_harness.py verify --json` when the candidate or
   its build support is ready.
3. Stage only that function and its required support. Inspect
   `git diff --cached --name-only` and run `git diff --cached --check`.
4. Commit normally with the function-specific change. Never use
   `git commit --no-verify`.
5. Wait for the pre-commit hook to report `conker.us.bin: OK` before pushing.
6. Push successful commits one at a time when remote history should mirror the
   function-by-function progression.

The ROM gate is a **pre-commit** hook, not a pre-push hook: pushing does not
run it again. Separate commits—not merely separate pushes—give each matching
function an independent hook check. If the hook fails, fix the build or
candidate and retry the same commit; do not bypass the hook.

## Generated linker and build artifacts

Do not edit or commit ignored generated artifacts such as `conker/conker.ld`,
`conker/asm/`, or `conker/build/`. If a match needs linker placement, use a
tracked linker fragment or source/configuration change and verify it with a
clean/default Docker build. The US `n_csplayer` switch-table fragment is
passed before the generated linker script because the generated script's
`/DISCARD/` rule otherwise drops the C object's `.rodata`.

The session review and the reasoning behind these rules are recorded in
[`docs/session-retro-2026-08-04.md`](docs/session-retro-2026-08-04.md).
