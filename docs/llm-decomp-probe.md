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
| `func_15168A9C` | game | medium | matched after several diffs | Linked-list removal from the `D_800DCE50` table. The key was declaring the table as byte-addressed `extern u8 D_800DCE50[]`; pointer-array syntax made IDO choose a different multiplication shape. |
| `func_15168E34` | game | medium-low | matched | Word patch helper: only adds an offset if the high command nibble is clear. |
| `func_15168F84` | game | medium | matched | Branch-chain mapping helper. Straight-line `if`/`return` C reproduced the target branch/delay-slot shape. |
| `func_1516968C` | game | medium | matched | Conditional removal callback: width-cast `arg2` to `u8`, compare a byte at `arg1` with byte `0xC` of `arg0`, then call `func_1516972C`. |
| `func_100038E0` | init | medium edge case | reverted / not matched | Semantics are obvious, but exact target uses the address constant in `$v0` both as return value and as a pointer store target. Naive C either referenced missing `D_BC000C02` or regenerated the address in another register. |
| `func_15167010` | game | medium/hard edge case | reverted / not matched | Semantic loop over `D_8008B4A8` callback slots compiled cleanly but used a smaller stack frame and `s1` for the end pointer; target saves an otherwise-unused `s1` and uses `s2`. This needs register-pressure/stack-shaping work or a better diff search loop. |
| `func_15168A4C` | game | medium near miss | reverted / not matched | Paired linked-list insertion. Byte-addressed table math matched, but IDO kept using `$a2` for the list head where target uses `$t0`. |
| `func_15168F08` | game | medium/hard near miss | reverted / not matched | Semantic loop and volatile double-store were understood, but IDO swapped loop index/pointer roles (`$v0`/`$v1` vs `$v1`/`$a2`) unless the return/loop shape changed, which then added a non-target final move. |
| `func_151696DC` | game | medium/hard near miss | reverted / not matched | List-stack removal loop. Could independently get correct `$v0`/`$v1` allocation or correct branch-delay scheduling for `D_800DD198`, but not both in one C shape yet. |
| `func_15168E54` | game | hard near miss | reverted / not matched | Saved-register loop over display-list-like records. Stack frame and helper-call semantics were reproducible, but IDO swapped saved-register assignments and optimized the index loop back into pointer-increment form. |

Summary: **10 matched functions accepted, 6 useful near misses reverted**. The second pass proved the agent can handle medium list/table/control-flow helpers, not just trivial setters.

## What this says about LLM capability on this repo

The agent can already handle a meaningful slice of Conker's active `GLOBAL_ASM` backlog when functions are small-to-medium and their surrounding data model is recoverable:

- one-shot setters/getters and byte/halfword field updates;
- simple arithmetic functions;
- short loops if the target branch shape is visible;
- table-index/addressing math when the relevant symbols can be declared;
- FPU expressions after one objdump-guided register/order refinement;
- medium linked-list/table helpers when globals are declared in the same byte-addressed shape the original compiler saw.

The biggest blockers are not semantic understanding; they are **IDO 5.3 code-shape control** and **project-context gaps**:

- argument signedness/width changes codegen dramatically (`u8 arg0` vs `s32 arg0`);
- declaration order and local variable naming can influence register/FPR allocation;
- obvious C for MMIO/address literals may not preserve the target register reuse;
- callback loops can need artificial register pressure to reproduce saved-register sets;
- symbols only present in `undefined_syms_auto.txt` need temporary `extern` declarations until headers improve.

## 100% feasibility assessment

A path to 100% looks feasible in the traditional decompilation sense, but not as a pure one-shot LLM translation exercise. The successful medium functions show the agent can recover semantics and steer IDO when the diff is compact. The hard near misses show the remaining work becomes a compiler-shaping search problem: saved-register pressure, delay-slot scheduling, branch-likely selection, argument-preservation quirks, and expression forms that keep values in the target registers.

Given enough time and a proper harness, the LLM should be useful all the way through the project as an orchestrator and hypothesis generator. It should not be the only mechanism. A 100% push would need conventional decomp tools plus automated retries/permutation search, and the LLM should consume the resulting structured diffs and pattern history.

## Recommended next automation

A production loop should avoid full-ROM rebuilds for every attempt and should feed the LLM structured diffs:

1. Queue candidates from `tools/analyze_decomp_candidates.py` with size/branch/call/table-access tags.
2. For each candidate, compile only the owning translation unit when possible.
3. Extract target and generated function assembly with normalized labels/relocations.
4. Score exact match vs instruction/register/order differences.
5. Send the LLM the target asm, current C attempt, generated asm, and a compact diff.
6. Accept only when the full build reports `build/conker.us.bin: OK`; otherwise reset that candidate.

This probe suggests a harness should target low, medium-low, and selected medium functions first: setters, field accessors, small arithmetic, short loops, branch chains, table lookups, and list helpers under roughly 70 instructions. Harder functions are still viable, but they need a separate multi-iteration queue with register-pressure experiments, expression-shape permutations, and persistent IDO pattern notes rather than one-shot C generation.
