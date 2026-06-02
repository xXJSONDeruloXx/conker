# Conker automation assessment

Assessment date: 2026-06-02

This fork was assessed against the N64 decomp/recomp automation research in `n64-decomp-recomp-research`, especially the Snowboard Kids / Nigel / BattleShip findings.

## Baseline status from local run

Local ROM used only for build/extract validation:

- Input path: `/Users/dhimebauch/Downloads/baserom.z64`
- Local repo copy: `baserom.us.z64` (ignored by git)
- SHA-1: `4cbadd3c4e0729dec46af64ad018050eada4f47a`
- Version: US

Validated commands:

```sh
make check
make extract
make -C conker extract
make -C conker
make -C conker replace
make
```

Result after local toolchain fixes / post-processing:

```text
build/conker.us.bin: OK
build/conker.us.z64: OK
```

## Local setup findings

### 1. macOS `sha1sum` incompatibility

The repository's Makefiles assume GNU `sha1sum --check`. On macOS, `/sbin/sha1sum` does not support that option. Use GNU coreutils:

```sh
brew install coreutils
mkdir -p .local-bin
ln -sf /opt/homebrew/bin/gsha1sum .local-bin/sha1sum
PATH="$PWD/.local-bin:$PATH" make check
```

### 2. Apple Silicon / Linux x86_64 mismatch

The repo ships Linux x86_64 binaries:

- `ido/ido5.3_recomp/cc`
- `tools/gzip`

On Apple Silicon, use Docker with `--platform linux/amd64` for compile/repack. A minimal working image only needs:

```Dockerfile
FROM ubuntu:22.04
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y binutils-mips-linux-gnu build-essential python3 make coreutils
WORKDIR /conker
```

The full Dockerfile currently pulls `ubuntu:24.04` and pip dependencies; local network/proxy reliability made that less useful than a minimal build image plus a host Python venv for splat extraction.

### 3. splat/spimdisasm metadata breaks this repo's legacy ASM flow

With the current pinned splat plus modern spimdisasm, generated assembly contains metadata pseudo-directives like:

```asm
nonmatching func_150D3360, 0x708
glabel func_150D3360
```

That breaks two stages:

1. GNU as sees `nonmatching` as an unknown opcode when assembling full generated ASM.
2. `asm-processor` rejects GLOBAL_ASM include files because they no longer begin with `glabel`.

This fork now includes `tools/strip_splat_metadata.py` and wires it into `make -C conker extract` so ignored generated ASM is normalized immediately after splat extraction.

## Current progress shape

`make -C conker progress` after a passing build produced:

| Section | C functions | ASM functions | Function % C | C bytes | ASM bytes | Byte % C |
|---|---:|---:|---:|---:|---:|---:|
| init | 307 | 315 | 49.36% | 51,008 | 113,040 | 31.09% |
| game | 1,429 | 5,842 | 19.65% | 123,292 | 1,949,588 | 5.95% |
| debugger | 160 | 22 | 87.91% | 8,000 | 11,800 | 40.40% |

Important interpretation:

- Function-count progress overstates game progress because many C functions are tiny and many ASM functions are large.
- The main game segment remains the bottleneck: ~1.95 MB of ASM by progress-script byte estimate.
- There are two classes of work:
  1. **Active `GLOBAL_ASM` functions** already embedded in C source files.
  2. **Whole ASM-only files/segments** not yet migrated into C files.

`tools/analyze_decomp_candidates.py` currently sees:

```text
active GLOBAL_ASM candidates: 944
init    :  135 funcs,  19181 instr, median=94.0 instr
debugger:   22 funcs,   2950 instr, median=73.5 instr
game    :  787 funcs, 111077 instr, median=84.0 instr
```

This is the immediately automatable queue; the larger ASM-only body needs either source-file migration first or a task runner that works directly from raw ASM segments.

## Low-hanging decompilation candidates

Run:

```sh
python3 tools/analyze_decomp_candidates.py --top 40
```

Top examples from the current queue:

| Function | Source | Signals | Notes |
|---|---|---|---|
| `func_151348F0` | `conker/src/game_161520.c:93` | 6 instructions, no calls | tiny arg-spill/no-op style function; may be ABI/handwritten edge case |
| `func_15134CD4` | `conker/src/game_161520.c:101` | 6 instructions, no calls | same pattern as above |
| `func_150A7770` | `conker/src/game_D4C20.c:8` | 8 instructions | marked "handwritten memset?"; likely easy to document even if not C-matchable |
| `func_10001420` | `conker/src/init_1420.c:7` | 9 instructions | BSS clear loop; source already has a near-match comment |
| `func_100038E0` | `conker/src/init_38E0.c:7` | 11 instructions | init section, likely high-value for early matching |
| `func_16001B00` | `conker/src/debugger_257350.c:20` | 13 instructions | debugger section is nearly complete by function count |

The tiny 6-instruction arg-spill functions are useful for triage but may not be the best first automation targets because they may represent compiler/ABI artifacts that ordinary C cannot emit. The best first targets are small but semantically normal loops or wrappers, such as `func_10001420`, `func_100038E0`, and small debugger functions.

## Asset / ROM manipulation findings

`make decompress` extracts the large non-table compressed section:

```text
7760 files
31 MB extracted
```

Asset blob sizes after root extraction:

| Asset group | Size | Notes |
|---|---:|---|
| `assets16` | 23,586,160 bytes | README labels this MP3s |
| `assets17` | 22,886,280 bytes | TODO in yaml: split out m64? files |
| `assets02` | 4,052,696 bytes | large unknown asset group |
| `assets04` | 1,793,096 bytes | large unknown asset group |

Implication: static recompilation can start from CPU code before asset formats are fully understood, but a polished native port will eventually require major asset/audio/rendering reverse engineering.

## Recommended project direction

### Track A — Matching decompilation acceleration (highest near-term leverage)

Adopt the Snowboard Kids automation stack in Conker-specific form:

1. **Candidate queue**: expand `tools/analyze_decomp_candidates.py` into a real difficulty scorer.
2. **Per-function workspaces**: generate isolated scratch directories with target ASM, current C context, headers, and a one-function build/diff loop.
3. **Scoring**: port the Snowboard Kids `dist.py` / `build.sh` pattern to Conker object files.
4. **LLM loop**: use Nigel-style task orchestration: candidate -> prompt -> compile -> diff -> accept/reset.
5. **Persistent learnings**: maintain `DECOMPILATION_LEARNINGS.md` for IDO 5.3 + Conker/Rare-specific codegen patterns.

Why this is the best first path:

- The repo already has a matching full ROM build.
- There are 944 active `GLOBAL_ASM` candidates ready for automated attack.
- Existing source context gives an LLM useful structs/includes/prototypes.
- Easy candidates can be batched quickly; hard candidates can be deferred.

### Track B — ASM-only segment migration

The largest code mass is still whole ASM files outside active `GLOBAL_ASM` source queues. Automating only existing pragmas will plateau.

Needed tool:

```text
raw asm segment -> function boundary parse -> generated C source shell with GLOBAL_ASM pragmas -> candidate queue
```

This mirrors older SM64/OoT migration workflows, but should be automated from the current splat output and map file.

### Track C — Static recompilation feasibility

Conker is more promising for an **early CPU static-recomp smoke test** than for an immediate polished PC port.

Pros:

- Function boundaries are mostly known from splat output.
- The built code sections are separated: init, game, debugger.
- The game section is already decompressed/repacked by the build.
- Full matching decomp is not required to begin N64Recomp experiments.

Hard parts:

- Three code regions with different VRAM bases: `0x10000000`, `0x15000000`, `0x16000000`.
- Boot/init/decompression behavior must be modeled or bypassed by preloading decompressed sections.
- Rare engine assets are custom and large.
- `assets16` MP3s and `assets17` music/sequence-like data likely need custom runtime support.
- Rendering likely uses F3DEX2-era display lists but Conker/Rare-specific microcode/data paths may need RT64 or runtime patches.

Recommended static-recomp proof-of-concept:

1. Generate an N64Recomp TOML from `conker/conker.us.bin`, `conker/conker.us.map`, and symbol files.
2. Recompile only a small init/debugger function set first to validate symbol parsing and codegen.
3. Preload decompressed game/debugger sections instead of emulating cartridge decompression initially.
4. Stub or wrap libultra/os calls before attempting graphics/audio.
5. Treat polished native rendering as a later RT64/N64ModernRuntime integration problem.

### Track D — Asset automation

Before attempting a full source port, build an asset-type classifier:

- decompress all rzip/chunk groups
- fingerprint by size, entropy, magic bytes, alignment, pointer-looking values, display-list-looking opcodes
- group repeated structures
- identify texture/display-list/model/audio candidates

This is a good LLM-assisted analysis task because it is classification/explanation-heavy, not byte-perfect matching.

## Priority roadmap

### P0: Build/automation hygiene

- Keep the metadata-strip post-processing in the extract flow.
- Add a documented Apple Silicon Docker build path.
- Add a one-command `make local-analysis` or `make candidates` target.

### P1: Automated decomp queue

- Extend `tools/analyze_decomp_candidates.py` with:
  - normalized instruction signatures
  - branch/call/data-access features
  - coddog/decomp.me similarity support if available
  - JSON output for Nigel
- Start with the 50 lowest-difficulty non-handwritten candidates.

### P2: Per-function scoring harness

- Create Conker equivalent of Snowboard Kids `tools/claude-decomp-env/build.sh`:
  - compile one file/function
  - objdump original vs candidate
  - normalize asm
  - score diff
  - map mismatch back to source line where possible

### P3: Nigel/agent integration

- Candidate JSON -> prompt template -> verify command -> commit/reset.
- Best-effort mode for partial improvements (renaming variables, structs, prototypes) should be disabled for matching commits but enabled for documentation branches.

### P4: Static recomp POC

- Generate N64Recomp config from linker map/symbol files.
- Recompile small code slices before attempting full runtime.
- Use this to learn what runtime hooks Conker needs.

## Bottom line

The highest-confidence path is not to jump straight to a PC port. The repo is ready for an SBK-style LLM decomp acceleration loop today. Static recompilation is feasible as a parallel experiment because the code sections and symbols are sufficiently organized, but it should be framed as a CPU/codegen smoke test first, not a near-term playable port.
