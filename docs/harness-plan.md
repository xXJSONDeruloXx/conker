# Conker Matching Decomp Harness — Architecture Plan

This document proposes a Pi-native harness for automated matching decompilation of Conker's Bad Fur Day, built as a **Pi package** (`pi-n64-decomp`) containing an extension, a skill, and CLI tooling. The design is informed by the LLM decomp probe findings and the Pi extension/SDK documentation.

## Goals

1. **Automate the candidate→attempt→diff→accept/reject loop** without human intervention for the easy/medium tail.
2. **Provide structured diff feedback** so the LLM can iterate on hard functions with register-pressure experiments.
3. **Track progress, patterns, and IDO idioms** persistently across sessions.
4. **Scale to 100%** by combining LLM hypothesis generation with conventional permutation/search where codegen-shaping is the bottleneck.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  Pi Package: pi-n64-decomp                              │
│                                                         │
│  ┌─────────────────┐  ┌──────────────────────────────┐ │
│  │ Extension        │  │ Skill (SKILL.md)             │ │
│  │ (index.ts)       │  │ - Candidate selection        │ │
│  │                  │  │ - IDO pattern library        │ │
│  │ Tools:           │  │ - Diff interpretation        │ │
│  │  decomp_queue    │  │ - Register-shaping tactics   │ │
│  │  decomp_attempt  │  └──────────────────────────────┘ │
│  │  decomp_diff     │                                   │
│  │  decomp_accept   │  ┌──────────────────────────────┐ │
│  │  decomp_status   │  │ CLI Scripts                  │ │
│  │                  │  │  conker-diff.sh              │ │
│  │ Widget:          │  │  conker-build-tu.sh          │ │
│  │  Progress bar    │  │  conker-normalize-asm.py     │ │
│  │  Current func    │  │  conker-score.py             │ │
│  │  Match streak    │  └──────────────────────────────┘ │
│  └─────────────────┘                                    │
│                                                         │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Data Files (per-project, .pi/decomp/)               ││
│  │  queue.json          — ordered candidate list       ││
│  │  patterns.json       — IDO idiom library            ││
│  │  history.jsonl       — attempt log (kept/reverted)  ││
│  │  learnings.md        — human-readable pattern notes ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

---

## Extension Design

### Custom Tools

The extension registers five tools via `pi.registerTool()`:

#### `decomp_queue`

**Purpose:** Manage the candidate queue — list, filter, sort, pick next.

```typescript
parameters: Type.Object({
  action: StringEnum(["list", "next", "skip", "prioritize", "stats"]),
  filter: Type.Optional(Type.Object({
    maxInstructions: Type.Optional(Type.Number()),
    region: Type.Optional(StringEnum(["init", "game", "debugger"])),
    tags: Type.Optional(Type.Array(Type.String())),
  })),
})
```

Returns the next candidate with: target assembly, surrounding C context, known prototypes/externs, relevant pattern library entries, and prior attempt history if any.

#### `decomp_attempt`

**Purpose:** Apply a C replacement for a `GLOBAL_ASM` pragma, compile, extract generated assembly, diff against target.

```typescript
parameters: Type.Object({
  function: Type.String({ description: "Function name, e.g. func_15169668" }),
  code: Type.String({ description: "Complete C function body to replace the pragma" }),
  externs: Type.Optional(Type.Array(Type.String())),
})
```

Workflow:
1. Patch the source file (replace `#pragma GLOBAL_ASM(...)` with the provided code).
2. Compile only the owning translation unit via Docker (fast, ~3-5s).
3. Extract generated function assembly via `mips-linux-gnu-objdump`.
4. Normalize both target and generated assembly (strip addresses, relocations → symbolic).
5. Compute structured diff and score.
6. Return: `{ match: boolean, score: number, diff: string, generated_asm: string, target_asm: string }`.
7. If not matching, auto-revert the patch.

#### `decomp_diff`

**Purpose:** Re-examine the last attempt's diff with additional context (for multi-iteration refinement).

```typescript
parameters: Type.Object({
  function: Type.String(),
  focus: Type.Optional(StringEnum(["registers", "scheduling", "branches", "stack"])),
})
```

Returns a focused analysis of what differs and suggests IDO-specific tactics from the pattern library.

#### `decomp_accept`

**Purpose:** After `decomp_attempt` returns `match: true`, run the full ROM SHA gate and commit.

```typescript
parameters: Type.Object({
  function: Type.String(),
  description: Type.Optional(Type.String()),
})
```

Workflow:
1. Full `make -C conker` in Docker.
2. If `build/conker.us.bin: OK`, stage and commit with conventional message.
3. Update queue (remove from candidates, record in history).
4. If SHA fails (rare race), revert and report.

#### `decomp_status`

**Purpose:** Show overall progress and recent activity.

```typescript
parameters: Type.Object({
  detail: Type.Optional(StringEnum(["summary", "recent", "failures", "patterns"])),
})
```

### Widget

A persistent widget above the editor shows:

```
┌ decomp: game 1119/4199 C (5.3%) │ streak: 4 │ next: func_15168A4C (medium) ┐
```

Updates after each `decomp_accept` or queue change.

### Event Hooks

- **`session_start`**: Load queue, history, and patterns from `.pi/decomp/`.
- **`agent_end`**: If a decomp loop was running, persist updated state.
- **`before_agent_start`**: Inject the IDO pattern library as system prompt context when decomp tools are active.

### State Persistence

Uses `pi.appendEntry("decomp-state", {...})` for session-level state and file-based `.pi/decomp/` for cross-session persistence.

---

## Skill Design

A skill at `skills/n64-decomp/SKILL.md` provides the LLM with:

1. **IDO 5.3 codegen rules**: How declaration order affects register allocation, how `u8` vs `s32` argument types change stack behavior, how byte-addressed externs differ from pointer-array externs, etc.
2. **Conker-specific patterns**: `struct12` linked-list idiom, `D_800DCE50` byte-addressed table, `func_151696DC` implicit-arg convention, etc.
3. **Diff interpretation guide**: How to read the normalized diff output and map instruction differences to C-level changes.
4. **Multi-iteration tactics**: When to try local variable reordering, when to try `volatile`, when to use pointer cast expressions, when a function is better left for permuter search.

This skill is loaded on-demand when the agent uses decomp tools or when invoked via `/skill:n64-decomp`.

---

## CLI Scripts

These run inside the Docker container and are called by the extension tools:

### `conker-build-tu.sh`

Compile a single translation unit (fast path, ~3s):

```bash
#!/bin/bash
# Usage: conker-build-tu.sh <source_file>
# Returns 0 on success, 1 on compile error
cd /conker/conker
make build/src/${1%.c}.c.o 2>&1
```

### `conker-diff.sh`

Extract and diff a single function:

```bash
#!/bin/bash
# Usage: conker-diff.sh <function_name> <source_file>
# Outputs: JSON with target_asm, generated_asm, match, score
FUNC=$1
OBJ="build/src/${2%.c}.c.o"
TARGET="asm/nonmatchings/${2%.c}/${FUNC}.s"

# Extract generated
GEN=$(mips-linux-gnu-objdump -dr "$OBJ" | sed -n "/<${FUNC}>/,/<[^.]/p" | head -n -1)

# Normalize and compare
python3 ../tools/normalize_asm.py "$TARGET" /dev/stdin <<< "$GEN"
```

### `conker-normalize-asm.py`

Normalize assembly for comparison:

- Strip address prefixes and hex offsets
- Replace relocation targets with symbolic names
- Normalize branch labels to sequential numbers
- Ignore delay slot `nop` differences (optional)
- Output: line-by-line normalized text suitable for `diff`

### `conker-score.py`

Score a diff:

- **1.0** = exact match
- **0.95+** = only register renaming differences
- **0.8-0.95** = same structure, different scheduling/ordering
- **0.5-0.8** = different branch shapes or missing/extra instructions
- **<0.5** = fundamental structural mismatch

Also outputs tagged failure reasons: `arg-width`, `fpr-order`, `saved-registers`, `branch-delay`, `induction-variable`, `missing-symbol`, `mmio-alias`.

---

## Queue Generation

Initial queue is generated from `tools/analyze_decomp_candidates.py` extended with:

1. **JSON output mode** (`--json`) for machine consumption.
2. **Scoring heuristics**: instruction count, branch count, call count, data references, existing comment hints.
3. **Difficulty tiers**: trivial (≤10 instr), low (11-30), medium-low (31-50), medium (51-80), hard (81+).
4. **Dependency awareness**: Functions that call other undecompiled functions are deprioritized.
5. **Pattern matching**: Functions whose assembly matches known IDO patterns (simple loops, switch tables, struct setters) are prioritized.

---

## Autonomous Loop

The harness supports two modes:

### Interactive (default)

The agent uses `decomp_queue` to pick candidates, `decomp_attempt` to try them, interprets the diff, retries up to N times, then either accepts or skips. The user can steer at any point.

### Ralph Loop (automated)

Using the `ralph_start` tool for long-running autonomous execution:

```markdown
# Task: Conker Decomp Sweep

## Goals
- Match as many GLOBAL_ASM functions as possible
- Record IDO patterns discovered
- Skip after 5 failed attempts per function

## Checklist
- [ ] Process all trivial candidates
- [ ] Process all low candidates  
- [ ] Process medium-low candidates
- [ ] Attempt medium candidates (3 retries each)
- [ ] Document new patterns in learnings.md
```

The loop calls `decomp_queue next`, `decomp_attempt`, evaluates the diff, retries or skips, and calls `decomp_accept` on matches. Progress is tracked in the Ralph task file.

---

## Pattern Library

`.pi/decomp/patterns.json` accumulates IDO-specific codegen patterns:

```json
[
  {
    "id": "byte-addressed-table",
    "description": "Tables accessed with complex index math should be declared as `extern u8 TABLE[]` and byte-offset computed manually",
    "example_functions": ["func_15168A9C", "func_151429E0"],
    "trigger": "Target uses sll/subu/addu chain for array offset, not simple indexed load",
    "solution": "Declare table as u8[], compute offset as (field1 * stride1) + (field2 * stride2)"
  },
  {
    "id": "u8-arg-stack-reload",
    "description": "When target loads arg from stack with lbu, the parameter should be u8 not s32",
    "example_functions": ["func_151429E0"],
    "trigger": "Target has lbu from stack offset matching an argument position",
    "solution": "Change parameter type to u8"
  }
]
```

New patterns are added automatically when the agent successfully matches a function that required a non-obvious technique.

---

## Package Structure

```
pi-n64-decomp/
├── package.json
├── extensions/
│   └── index.ts              # Extension with 5 tools + widget
├── skills/
│   └── n64-decomp/
│       ├── SKILL.md          # IDO patterns, diff guide, tactics
│       └── references/
│           └── ido-codegen-rules.md
├── scripts/
│   ├── conker-build-tu.sh
│   ├── conker-diff.sh
│   ├── conker-normalize-asm.py
│   └── conker-score.py
└── README.md
```

```json
{
  "name": "pi-n64-decomp",
  "version": "0.1.0",
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./extensions"],
    "skills": ["./skills"]
  },
  "peerDependencies": {
    "@earendil-works/pi-coding-agent": "*",
    "@earendil-works/pi-tui": "*",
    "typebox": "*"
  }
}
```

Installation:

```bash
pi install /Users/dhimebauch/Developer/personal/pi-n64-decomp
# or after publishing:
pi install git:github.com/xXJSONDeruloXx/pi-n64-decomp
```

---

## Implementation Phases

### Phase 1: Foundation (MVP)

- [ ] `conker-normalize-asm.py` and `conker-score.py` scripts
- [ ] `conker-build-tu.sh` and `conker-diff.sh` wrappers
- [ ] Extension with `decomp_attempt` and `decomp_accept` tools
- [ ] Basic queue from existing `analyze_decomp_candidates.py`
- [ ] Validate: run 10 known-matchable functions through the tool loop

### Phase 2: Intelligence

- [ ] Pattern library (seed with probe findings)
- [ ] Skill with IDO codegen rules and diff interpretation guide
- [ ] `decomp_diff` tool with focused analysis mode
- [ ] `decomp_status` tool with progress widget
- [ ] History tracking and failure-reason tagging

### Phase 3: Automation

- [ ] Ralph loop integration for autonomous sweeps
- [ ] Automatic pattern extraction from successful matches
- [ ] Difficulty-aware queue sorting
- [ ] Multi-retry logic with expression permutation suggestions
- [ ] Cross-function dependency tracking

### Phase 4: Hard Tail

- [ ] Integration with decomp-permuter for brute-force search on hard functions
- [ ] Register-pressure experiment generator
- [ ] Branch-shape permutation search
- [ ] Parallel candidate processing (multiple Docker containers)

---

## Key Design Decisions

1. **Pi extension, not standalone script**: Runs inside the agent session with full access to LLM reasoning, steering, and session persistence. The LLM is the hypothesis generator; the tools are the verification engine.

2. **Per-TU compilation, not full ROM rebuild**: 3s per attempt instead of 30s+. Full SHA gate only on final accept.

3. **Structured diff, not raw objdump**: Normalized assembly comparison with semantic scoring gives the LLM actionable feedback instead of noise.

4. **Pattern library as persistent memory**: IDO idioms discovered in one session carry forward to all future sessions. This is how the system gets smarter over time.

5. **Docker for build isolation**: The existing `conker-build-min-amd64` image already works. No host toolchain contamination.

6. **Skill for domain knowledge**: The LLM needs IDO-specific expertise that doesn't fit in tool descriptions. A skill provides on-demand deep context without always consuming tokens.

7. **Widget for progress visibility**: Decomp work is inherently incremental; a persistent progress indicator keeps the user (and the agent) oriented.

---

## Expected Impact

Based on the probe results:

- **Trivial/low** (≈200 candidates under 30 instructions): ~90% one-shot success rate → ~180 matches
- **Medium-low** (≈300 candidates, 31-50 instructions): ~60% success with retries → ~180 matches  
- **Medium** (≈250 candidates, 51-80 instructions): ~30% success with pattern library → ~75 matches
- **Hard** (≈200+ candidates, 80+ instructions): ~10% LLM-only, more with permuter → ~20-50 matches

Conservative estimate: **450-500 new function matches** from a full autonomous sweep, bringing game C% from ~5% to ~30%+ by byte count (since many ASM functions are small).
