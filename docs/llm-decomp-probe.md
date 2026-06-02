# LLM-driven matching decompilation probe

This note records a no-user-intervention probe against the Conker fork using the local matching build as the only acceptance gate. The goal was not to maximize function count, but to sample several difficulty levels and document what an LLM/agent can and cannot currently do without a purpose-built decomp harness.

## Validation method

Candidate selection came from `tools/analyze_decomp_candidates.py --top 120`, followed by manual-in-agent inspection of the target assembly and nearby C/headers. Each accepted replacement was validated with:

```bash
docker run --rm --platform linux/amd64 \
  -v "$PWD:/conker" -w /conker conker-build-min-amd64 \
  bash -lc 'make -C conker -j$(nproc)'
```

Acceptance criterion: the repo's SHA check reports `build/conker.us.bin: OK`. Near misses were inspected with `mips-linux-gnu-objdump -dr` inside the same container and either fixed or reverted.

## Results

| Function | Area | Approx. difficulty | Outcome | Notes |
|---|---:|---:|---|---|
| `func_15169668` | game | trivial | matched | Setter for `D_800D2DAB` plus `return arg0`. Needed only an `extern u8` for an auto symbol. |
| `func_1513F6C0` | game | trivial | matched | `struct210` byte-field setter: `unk80`/`unk81`. |
| `func_15143044` | game | low | matched | Small arithmetic return: `0x7FFF - arg0`. |
| `func_15143E64` | game | low/medium | matched after one diff | Vector magnitude. Initial expression was semantically correct but had FPR load/add order differences; naming locals (`temp_f2`, `temp_f12`, `temp_f14`) shaped IDO into the target order. |
| `func_16001B00` | debugger | low/medium | matched after one diff | `strlen`-like loop. Initial `for` loop only differed in `move v1,zero` vs `move v0,a0` order; explicit pointer-first do/while matched. |
| `func_151429E0` | game | medium | matched after one diff | RNG-indexed 3-byte table lookup. Initial `s32 arg0` generated `lw` + `andi`; target loads the saved argument's low byte from the stack, so `u8 arg0` was required. |
| `func_100038E0` | init | medium edge case | reverted / not matched | Semantics are obvious, but exact target uses the address constant in `$v0` both as return value and as a pointer store target. Naive C either referenced missing `D_BC000C02` or regenerated the address in another register. |
| `func_15167010` | game | medium/hard edge case | reverted / not matched | Semantic loop over `D_8008B4A8` callback slots compiled cleanly but used a smaller stack frame and `s1` for the end pointer; target saves an otherwise-unused `s1` and uses `s2`. This needs register-pressure/stack-shaping work or a better diff search loop. |

Summary: **6 matched functions accepted, 2 useful near misses reverted**. Three matched immediately; three matched after one targeted assembly diff.

## What this says about LLM capability on this repo

The agent can already handle a meaningful slice of Conker's active `GLOBAL_ASM` backlog when the functions are small and self-contained:

- one-shot setters/getters and byte/halfword field updates;
- simple arithmetic functions;
- short loops if the target branch shape is visible;
- table-index/addressing math when the relevant symbols can be declared;
- FPU expressions after one objdump-guided register/order refinement.

The biggest blockers are not semantic understanding; they are **IDO 5.3 code-shape control** and **project-context gaps**:

- argument signedness/width changes codegen dramatically (`u8 arg0` vs `s32 arg0`);
- declaration order and local variable naming can influence register/FPR allocation;
- obvious C for MMIO/address literals may not preserve the target register reuse;
- callback loops can need artificial register pressure to reproduce saved-register sets;
- symbols only present in `undefined_syms_auto.txt` need temporary `extern` declarations until headers improve.

## Recommended next automation

A production loop should avoid full-ROM rebuilds for every attempt and should feed the LLM structured diffs:

1. Queue candidates from `tools/analyze_decomp_candidates.py` with size/branch/call/table-access tags.
2. For each candidate, compile only the owning translation unit when possible.
3. Extract target and generated function assembly with normalized labels/relocations.
4. Score exact match vs instruction/register/order differences.
5. Send the LLM the target asm, current C attempt, generated asm, and a compact diff.
6. Accept only when the full build reports `build/conker.us.bin: OK`; otherwise reset that candidate.

This probe suggests a harness should initially target low and medium-low functions under roughly 40 instructions, especially setters, field accessors, small arithmetic, short loops, and table lookups. Harder functions are still worth attempting, but should be separated into a queue that allows multiple register-shaping iterations instead of expecting one-shot success.
