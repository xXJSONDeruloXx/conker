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
