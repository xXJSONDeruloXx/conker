# Decomp Tooling Refinement Log

Append-only notes from decomp chunks. Use this to audit which tooling changes were suggested by real chunk usage rather than fresh-context intuition.

## Chunk 378 — 2026-06-10T13:17:20Z
- Matched: no
- Summary: Family/similarity routing quickly found high-leverage siblings (`func_1502B110`, `func_1502B9B4`, `func_1000FC18`) and skeleton seeds got close, but no full ROM match landed.
- Likely cause / blocker: Candidates were blocked by IDO edge cases rather than high-level algorithm misunderstanding: stack scratch-slot placement/trailing padding for `func_1502B9B4`, and scheduling/global-reload ordering for `func_1000FC18`.
- Tooling observations: Family routing and skeleton enrichment are useful; read-only queue behavior mostly worked, but family mode surfaced already-matched `func_1502B6BC` due stale pending queue state. `decomp_permute` was ineffective on a strong near-miss because it reported `compiled=0, forks=0` instead of exploring mutations.
- Improvement opportunities: Make candidate selection live-filter pending entries whose GLOBAL_ASM pragma no longer exists; make `decomp_permute` auto-retry without `--isolate` when an isolated run produces zero compiled mutations; require/record per-chunk tooling observations in-tree so future tooling sessions can audit recommendations against actual chunk data.
