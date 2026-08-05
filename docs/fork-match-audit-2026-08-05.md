# Fork matching and promotion audit

Date: 2026-08-05

This records the fork comparison, match verification, attribution, and
promotion work performed against the archived upstream repository
[`mkst/conker`](https://github.com/mkst/conker).

## Promoted matches

The default branch now contains 95 verified fork-derived matches from this
promotion series:

| Commit | Source | Count | Attribution |
| --- | --- | ---: | --- |
| [`00c30268`](https://github.com/xXJSONDeruloXx/conker/commit/00c30268b9cec8d595896f4613ae2272c43cd023) | [`sylas94/conker`](https://github.com/sylas94/conker) | 28 | `ssssylassss` |
| [`cf2601f8`](https://github.com/xXJSONDeruloXx/conker/commit/cf2601f8aec74e6125478e9b81416487d7abdd3f) | [`sylas94/conker`](https://github.com/sylas94/conker) | 65 | `ssssylassss` |
| [`7933aed6`](https://github.com/xXJSONDeruloXx/conker/commit/7933aed64619bb58ba96f26f428a58837d9c02cb) | [`NameSpace-64/Conker-s-Bad-Decomp`](https://github.com/NameSpace-64/Conker-s-Bad-Decomp) | 2 | `NameSpace-64`; source credit for `func_150104F0` is `mono21400` |

Every promoted function was independently compiled in this repository. The
complete US ROM passed both repository gates:

```text
conker/build/conker.us.bin: 842e3d348e3c8ae0039e2ab367ad492f9b5266d8
build/conker.us.z64:         4cbadd3c4e0729dec46af64ad018050eada4f47a
```

The verification used a forced-clean inner build, `make replace`, and a fresh
outer ROM verification. The pre-commit hook repeated the ROM check before the
last promotion commit was accepted.

### Attribution details

- `func_15002560`: credited to NameSpace-64, with cleanup credit to Ethteck
  and mono21400. Source commit:
  [`1ff35378`](https://github.com/NameSpace-64/Conker-s-Bad-Decomp/commit/1ff353781a2f796e84ba658bcb7076ad65dc463b).
- `func_150104F0`: source commit credits mono21400 and was committed by
  NameSpace-64. Source commit:
  [`76bcc43a`](https://github.com/NameSpace-64/Conker-s-Bad-Decomp/commit/76bcc43a75ab991102b5a1efb9ea28f75b712c6b).
- The imported Sylas work retains `ssssylassss <ssssylassss@gmail.com>` as
  the commit author. The promotion commits also include the Claude co-author
  trailer used for the porting work.

## Preserved bulk work

The larger, not-yet-individually-verified import remains on the local
`sylas-bulk-experiment` branch. It is intentionally not part of `master`:
the branch is a candidate archive for future surgical matching and can be
retreated from without affecting the verified default-branch state.

## Forkager sweep

Forkager was run against the complete upstream network with branch enumeration
and default-branch comparisons:

```sh
forkager scan mkst/conker \
  --network network \
  --max-repositories 100 \
  --workers 8 \
  --include-branches \
  --max-branches 1000 \
  --compare-defaults \
  --format json
```

The scan covered 30 repositories total: the archived upstream plus 29
discovered forks. It enumerated 70 fork branch refs (72 branch refs including
the upstream's two branches), with no repository or branch enumeration
truncation.

Forkager marked the result partial because six warnings were reported:

- one fork (`56m12xgd/conker`) returned 404s for its comparison/API requests;
- commit lists were truncated for `jefemagril/conker`, `sylas94/conker`, and
  `xXJSONDeruloXx/conker`.

Those warnings were preserved in the scan output and treated as reasons for
targeted follow-up, not as positive match evidence.

## Follow-up candidate results

The targeted follow-up compared directly portable source definitions against
the promoted tree. Two additional functions matched exactly and were
promoted. The remaining six direct candidates did not match in this build:

| Source | Candidate(s) | Result |
| --- | --- | --- |
| NameSpace-64 | `func_15002560`, `func_150104F0` | Exact; promoted in `7933aed6` |
| NameSpace-64 | `func_150762D4` | Non-matching |
| RZacharias | `func_15169040` | Non-matching after signature adjustments |
| McMarius | `func_15134908`, `func_15135480`, `func_151355B8` | Non-matching |
| Ianwal | `_VirtualToPhysicalTask` | Not emitted as a matching candidate in this tree |

Other fork branches contain useful decompilation leads, but many are in
segments or source files that have not yet been migrated in this repository.
They were not copied into `master` without a local byte-match result. No
additional independently verified batch was found in this sweep.

## Current progress snapshot

After the promoted changes, the generated US progress report is:

| Section | C functions | ASM functions | Function coverage | Byte coverage |
| --- | ---: | ---: | ---: | ---: |
| init | 299 | 238 | 55.68% | 37.46% |
| game | 1,362 | 3,950 | 25.64% | 7.69% |
| debugger | 29 | 13 | 69.05% | 30.63% |
| **total** | **1,690** | **4,201** | **28.69%** | **9.93%** |

Regenerate this snapshot with:

```sh
make -C conker progress
```
