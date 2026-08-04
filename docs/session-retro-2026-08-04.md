# Byte-match session review — 2026-08-04

## Outcome

The session produced five counted exact function matches and four additional
exact bonus matches. The bonuses were verified and included in the work, but
they were deliberately excluded from the counted goal of ten. Commit `402f6fa`
passed the repository ROM check and was pushed to `origin/master`.

The follow-up build cleanup replaces the old generated-linker mutation with the
tracked [`conker/n_csplayer.lds`](../conker/n_csplayer.lds) fragment. The US
Makefile passes that fragment before the generated linker script, so the C
switch table can resolve its relocations without editing ignored generated
files.

## What went well

- The harness accepted exact matches and preserved queue/progress state.
- Object-level matching plus the full ROM SHA-1 gate checked both function bytes
  and whole-image effects.
- The pre-commit hook stopped an attempted commit when a clean link failed. That
  caught a source/build change that an incremental check had not exposed before
  it could be published.
- Investigation connected the failure to the C switch table in
  `n_csplayer.c.o`, the existing table address `0x8002C4CC`, and the generated
  linker's `/DISCARD/` rule.
- A forced clean build and a normal incremental build both produced
  `build/conker.us.bin: OK` after the linker integration was corrected.

## What struggled

- Incremental harness verification did not expose the clean-link failure.
  Linker, compiler, and other build-support changes therefore need an explicit
  clean/default build.
- The first tracked linker-fragment attempt was placed after the generated
  script, allowing `/DISCARD/` to claim the C `.rodata`. Passing the fragment
  first fixed the ownership of that input section.
- Direct edits to ignored generated `conker.ld` and generated assembly were
  useful for diagnosis, but were not durable project changes.
- The first durable Makefile approach used nine `sed` commands to mutate the
  generated linker script. It was difficult to review and encoded US-specific
  addresses and generated-file assumptions. The tracked linker fragment is
  smaller, explicit, and conditional on `VERSION=us`.
- Multiple matching functions were initially staged in one commit. That made
  function boundaries and independent hook checks less clear.

## Revised workflow

1. Work one exact byte-matching function at a time; keep required support in
   that function's commit and keep bonus matches separate.
2. Use the harness to attempt, diff, verify, and accept the candidate.
3. Stage narrowly, inspect the staged paths, and run `git diff --cached --check`.
4. Make one normal commit per matching function and let the pre-commit ROM hook
   pass. Never bypass it.
5. Push successful commits one at a time when remote history should mirror the
   local checkpoints. Remember that the hook is per commit, not per push.
6. For linker/build changes, regenerate from tracked inputs and run a clean
   Docker build plus the normal harness verification.
