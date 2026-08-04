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
