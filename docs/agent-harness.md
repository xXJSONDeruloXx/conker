# Portable agent harness

Conker’s decompilation loop is intentionally split into two layers:

1. `tools/decomp_harness.py` is the runtime-neutral command interface. Any
   agent that can run a process can select a candidate, request context, call an
   optional decompiler, compile a candidate, inspect a normalized diff, and run
   the ROM gate.
2. `.pi/extensions/decomp/index.ts` is the Pi adapter. It adds an interactive
   widget, session rotation, persistent prompts, and the existing Transmuter
   integration on top of the same queue/build artifacts.

This keeps Pi useful without making the project depend on Pi’s extension SDK.

## Install the optional asmlift aid

The recommended install is the published CLI:

```sh
npm install --global @asmlift/cli
```

The adjacent source checkout at `~/Developer/asmlift` is also detected when
`pnpm` is available. Override discovery explicitly when needed:

```sh
CONKER_ASMLIFT=/path/to/asmlift python3 tools/decomp_harness.py lift \
  --function func_10001420 --json
```

`asmlift` currently exposes an IDO 7.1 MIPS target, while Conker’s build uses
SGI IDO 5.3. That makes it useful for a structured first C hypothesis and for
principled declines, but not a byte-match oracle for this repository. The
Conker compiler and ROM SHA gate remain authoritative.

## Command contract

All commands accept `--repo PATH` before the subcommand and most accept
`--json`. JSON is intended for agent adapters; human-readable output is meant
for a terminal or prompt transcript.

```sh
# Queue and progress
python3 tools/decomp_harness.py status --json
python3 tools/decomp_harness.py progress --json
python3 tools/render_progress_visualization.py
python3 tools/decomp_harness.py next --json --similar --with-asmlift
python3 tools/decomp_harness.py next --json --near-miss

# Generate a mechanical source draft
python3 tools/decomp_harness.py lift --function func_10001420

# Test a candidate. Non-matches and compile errors roll the source/context back.
python3 tools/decomp_harness.py attempt \
  --function func_10001420 \
  --file init_1420.c \
  --code-file candidate.c \
  --json

# Inspect an already-built object without changing source
python3 tools/decomp_harness.py diff \
  --function func_10001420 --file init_1420.c --json

# Run the full Dockerized ROM gate, then mark the source accepted
python3 tools/decomp_harness.py verify --json
python3 tools/decomp_harness.py accept \
  --function func_10001420 --file init_1420.c --json
```

`attempt` leaves a matching candidate in place so the agent can call `accept`.
It records the score, reason, diff summary, and candidate code in
`.pi/decomp/queue.json`, which means a later Pi or non-Pi session can reuse the
same history. Every non-match is restored automatically. Context declarations
can be tested transactionally with a JSON file containing either an array or:

```json
{
  "patches": [
    {
      "path": "conker/include/variables.h",
      "oldText": "extern s32 D_EXAMPLE;",
      "newText": "extern s32 *D_EXAMPLE;"
    }
  ]
}
```

The portable interface does not auto-commit or auto-push. `accept --commit` is
an explicit opt-in; this is safer for harnesses whose branch/approval policy is
managed outside the decomp loop.

## Commit and ROM-gate workflow

Keep one exact byte-matching function per commit. Include only the declarations,
context, queue metadata, or linker/build support needed by that function. This
keeps each match independently reviewable and gives the repository's full ROM
gate a separate checkpoint. Bonus matches follow the same rule but remain
outside the counted goal.

After accepting a match, review and commit it as a narrow change:

```sh
git add FUNCTION.c required-support-file
git diff --cached --name-only
git diff --cached --check
git commit -m "Match FUNC"
python3 tools/decomp_harness.py verify --json
git push origin BRANCH
```

The repository hook is a `pre-commit` hook. When staged files under
`conker/src/` or `conker/include/` are present, it runs the Dockerized build
and requires `conker.us.bin: OK`; do not use `git commit --no-verify`. A push
does not run that pre-commit hook, so one commit per function is the part that
provides independent verification. Push commits one at a time when the remote
should show the same progression.

If a linker, Makefile, compiler, or other build-support change is involved,
also run a clean/default build rather than relying only on an incremental
harness diff. Generated linker scripts and build outputs are disposable; keep
durable linker behavior in tracked inputs.

Queue file names are historically stored as basenames. The harness resolves
them against nested paths under `conker/src` and derives the nested
`asm/nonmatchings` pragma, so `next`, `attempt`, and `accept` work for libultra
and other subtrees as well. If a queue entry has gone stale, `status` reports
source-missing and missing-live-pragma counts; an empty `next --near-miss`
response includes the scoped candidate counts that explain the routing result.

`conker-diff.sh` keeps normalized assembly scoring for useful near-miss signals,
but also compares the encoded instruction words from the target splat comments
with the generated object. Only fields covered by an object `R_MIPS_HI16`,
`R_MIPS_LO16`, or `R_MIPS_26` relocation are masked. A raw-word mismatch cannot
be accepted as a match.

The repository-local [progress and routine dashboard](conker-progress-routines.html)
is generated from the same live inputs:

```sh
python3 tools/render_progress_visualization.py
# or
make progress-dashboard
```

It reads `.pi/decomp/queue.json`, live source pragmas, `conker/progress.csv`,
Git state, and the current `build/conker.us.z64` SHA-1. Add `--verify` when the
Docker ROM gate should also run during refresh.

## Agent integration pattern

An agent adapter only needs four operations:

```text
select = next --json [filters]
draft  = lift --function select.candidate.function
edit   = write the agent’s candidate C to a temporary code file
trial  = attempt --json --code-file temporary file
```

On `trial.match == true`, the adapter runs `accept`; otherwise it reads
`trial.diff` and tries a materially different candidate. The queue history is
the durable memory, so compaction or switching from one agent runtime to
another does not require copying Pi session state.
