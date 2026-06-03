# Implement Mizuchi-inspired improvements to Conker decomp harness

## Goals
Port the best aspects of Mizuchi to our Pi-native decomp harness:

1. **In-loop preview compile** (`decomp_preview` tool) — lightweight compile + diff without recording to attempt history. Agent can iterate internally before committing a real attempt.
2. **Auto-rotate on stuck functions** — `decomp_queue next` automatically skips functions with 8+ attempts in current session without score improvement.
3. **Stronger stall recovery** — More aggressive "try fundamentally different approach" messaging, handle alternating score patterns (not just flat ±0.05).
4. **Background permuter auto-spawn** — When `decomp_attempt` scores ≥ 0.8, automatically trigger permuter in background and report result.

## Checklist
- [x] Add `decomp_preview` tool (compile TU, extract ASM, score, show diff — NO history recording, NO revert complexity) — `62bc0e1`
- [x] Implement auto-rotate logic in `decomp_queue next` (track attempts-per-function in session, skip after 8 without improvement) — `62bc0e1`
- [x] Improve stall detection to handle alternating patterns (look at score variance, not just ±0.05 flatness) — `62bc0e1`
- [x] Add auto-permuter trigger on 0.8+ scores (strong hint to call decomp_permute immediately) — `fa4092e`
- [x] Update chunk prompt to mention `decomp_preview` — `62bc0e1`
- [x] Test: verify extension loads cleanly (9 tools, brace balance maintained) — verified
- [x] Test: verify Docker TU build pipeline still works — verified via `conker-build-tu.sh`
- [ ] Verify in live session (needs /reload in decomp loop session)

## Constraints
- File: `/Users/dhimebauch/Developer/personal/conker/.pi/extensions/decomp/index.ts`
- Must maintain existing tool interfaces ✓
- Must not break existing `decomp_attempt` / `decomp_queue` flows ✓
- Use existing Docker build infrastructure ✓
- Keep brace balance (currently diff=1, maintain that) ✓

## Summary of Changes

### Commits
- `62bc0e1` — preview tool, auto-rotate, improved stall detection, chunk prompt update
- `fa4092e` — auto-permuter suggestion on 0.8+ scores

### New tool: `decomp_preview`
- Same compile+diff pipeline as `decomp_attempt`
- Does NOT record to queue.json history
- Does NOT increment attempt counter
- Always reverts source immediately
- Returns: score, diff, generated ASM, match/non-match indicator

### Auto-rotate
- `sessionRotatedFunctions` Set tracks functions ground on this session
- `sessionAttemptCounts` Map tracks per-function attempt counts + best scores
- After `SESSION_ROTATE_THRESHOLD` (8) attempts without improvement → added to rotated set
- `decomp_queue next` filters out rotated functions (unless nearMiss filter explicitly set)
- Functions stay pending — not permanently skipped, just rotated for this session

### Improved stall detection
Three patterns caught:
1. **Flat**: scores within ±0.05 (original)
2. **Alternating**: high variance (>0.3 range) without beating best
3. **Stagnant**: 8+ attempts without beating best score
Messaging: directive "call decomp_queue next" + "try decomp_permute" for 0.8+

### Auto-permuter hint
When `decomp_attempt` score ≥ 0.8:
- Appends "🎯 HIGH SCORE — this is a strong permuter candidate!"
- Directs agent to call `decomp_permute` immediately
