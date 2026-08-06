# Fork matching and promotion audit

Date: 2026-08-06

This records the fork comparison, match verification, attribution, and
promotion work performed against the archived upstream repository
[`mkst/conker`](https://github.com/mkst/conker).

## Promoted matches

The default branch now contains 171 verified fork-derived matches from this
promotion series:

| Commit | Source | Count | Attribution |
| --- | --- | ---: | --- |
| [`00c30268`](https://github.com/xXJSONDeruloXx/conker/commit/00c30268b9cec8d595896f4613ae2272c43cd023) | [`sylas94/conker`](https://github.com/sylas94/conker) | 28 | `ssssylassss` |
| [`cf2601f8`](https://github.com/xXJSONDeruloXx/conker/commit/cf2601f8aec74e6125478e9b81416487d7abdd3f) | [`sylas94/conker`](https://github.com/sylas94/conker) | 65 | `ssssylassss` |
| [`7933aed6`](https://github.com/xXJSONDeruloXx/conker/commit/7933aed64619bb58ba96f26f428a58837d9c02cb) | [`NameSpace-64/Conker-s-Bad-Decomp`](https://github.com/NameSpace-64/Conker-s-Bad-Decomp) | 2 | `NameSpace-64`; source credit for `func_150104F0` is `mono21400` |
| this promotion commit | [`sylas94/conker`](https://github.com/sylas94/conker) | 48 | Ethan Shold (45); `ssssylassss` (3) |
| this promotion commit | [`sylas94/conker`](https://github.com/sylas94/conker) | 28 | Ethan Shold (16); `ssssylassss` (10); Mark Street (2) |

Every promoted function was independently compiled in this repository. The
complete US ROM passed both repository gates:

```text
conker/build/conker.us.bin: 842e3d348e3c8ae0039e2ab367ad492f9b5266d8
build/conker.us.z64:         4cbadd3c4e0729dec46af64ad018050eada4f47a
```

The verification used a forced-clean inner build, `make replace`, and a fresh
outer ROM verification. The pre-commit hook repeated the ROM check before the
last promotion commit was accepted.

## Bulk match promotion

The prepared bulk pass compiled and compared 96 definitions from the Sylas
fork: 48 matched exactly and 48 remained nonmatching. Only the exact set was
copied into `master`; the larger candidate snapshot remains available on the
local `sylas-bulk-experiment` branch for future surgical work.

The 48 promoted definitions are:

| Source file | Matching functions |
| --- | --- |
| `game_14FF90.c` | `func_1512623C`, `func_15127EB8` |
| `game_161520.c` | `func_151347CC`, `func_151355B8`, `func_15136698`, `func_15136AE4`, `func_15138120` |
| `game_168A90.c` | `func_1513BEB0` |
| `game_169510.c` | `func_1513E6E8`, `func_1513FFF4` |
| `game_16DC80.c` | `func_151411E4`, `func_15141250`, `func_1514143C`, `func_15141478`, `func_151416E8`, `func_15141928` |
| `game_16EE20.c` | `func_15143794`, `func_1514462C` |
| `game_1897A0.c` | `func_1515D088` |
| `game_18D770.c` | `func_15161F4C`, `func_15163FEC`, `func_15164134`, `func_151645C4` |
| `game_1FFF60.c` | `func_151D2C40`, `func_151D3130`, `func_151D324C` |
| `game_2062D0.c` | `func_151DAA88`, `func_151DAB58` |
| `game_305D0.c` | `func_15003120` |
| `game_30E90.c` | `func_15004CE0` |
| `game_35D20.c` | `func_15008930` |
| `game_362B0.c` | `func_15008E10` |
| `game_3BA70.c` | `func_1500E5C0` |
| `game_3D5C0.c` | `func_15010110` |
| `game_3D9A0.c` | `func_15010600` |
| `game_3F820.c` | `func_15012370` |
| `game_439B0.c` | `func_15016588` |
| `game_447B0.c` | `func_150174C0` |
| `game_70200.c` | `func_15043BB8` |
| `game_76710.c` | `func_15049260` |
| `game_77AD0.c` | `func_15052760` |
| `game_981E0.c` | `func_1506C32C`, `func_15071A64`, `func_15074C80` |
| `game_C8950.c` | `func_1509B5AC`, `func_1509B810`, `func_1509BA04` |
| `game_DBA60.c` | `func_150AEDF8` |

Attribution was checked against the source fork's history rather than
assigning every fork change to its owner: `git blame` attributes 45 of these
definitions to Ethan Shold (`sholdee@gmail.com`) and three to
`ssssylassss` (`ssssylassss@gmail.com`): `func_1514143C`, `func_150174C0`,
and `func_15052760`. The promotion commit credits both contributors.

Each promoted function produced an object-level asm-differ score of zero.
After a forced-clean build, `make replace`, and a fresh outer build, the ROM
hashes were:

```text
conker/build/conker.us.bin: 842e3d348e3c8ae0039e2ab367ad492f9b5266d8
build/conker.us.z64:         4cbadd3c4e0729dec46af64ad018050eada4f47a
```

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

## Latest byte-exact batch (2026-08-06)

The wider Sylas fork pass found 37 symbols whose linked bytes matched the
clean master image. Two were already source-backed in this repository. Of the
35 remaining stubs, 28 compiled byte-identically in the master source context
and were promoted:

| Source file | Matching functions |
| --- | --- |
| `debugger/debugger.c` | `func_160006CC`, `func_1600160C` |
| `debugger_256F80.c` | `func_16001700` |
| `game_36680.c` | `func_1500B1F4`, `func_1500B8F4`, `func_1500BAB8`, `func_1500BC7C` |
| `game_40490.c` | `func_15013000` |
| `game_75E60.c` | `func_150489B0` |
| `game_77AD0.c` | `func_15052260` |
| `game_83300.c` | `func_1505ED34` |
| `game_C8950.c` | `func_1509B950` |
| `game_16EE20.c` | `func_15142314`, `func_15142444`, `func_15142B7C`, `func_15142C10`, `func_15142FBC` |
| `game_1944C0.c` | `func_15168F08` |
| `libultra/audio/game_21FC90.c` | `func_151F2D6C` |
| `libultra/audio/n_csq.c` | `__n_alCSeqGetTrackEvent`, `n_alCSeqNew`, `n_alCSeqNextEvent` |
| `libultra/audio/n_synthesizer.c` | `n_alSynNew` |
| `libultra/audio/n_synallocvoice.c` | `n_alSynAllocVoice` |
| `libultra/io/sptask.c` | `_VirtualToPhysicalTask` |
| `init_B1B0.c` | `func_1000DEC4` |
| `init_EB00.c` | `func_1000F85C`, `func_10010E78` |

Per-function attribution from `git blame remotes/forks/sylas94/master` is:
Ethan Shold (`sholdee@gmail.com`), 16; `ssssylassss`
(`ssssylassss@gmail.com`), 10; and Mark Street
(`streetster@gmail.com`), 2. The promotion commit carries all three as
co-authors.

The seven source candidates excluded from this batch because their master-tree
objects were not exact are `__osPfsRequestData2`, `osPfsIsPlug2`,
`func_15077F64`, `func_15079228`, `func_150916B4`, `func_1001A508`, and
`n_alAudioFrame`. They remain available in the preserved Sylas bulk work for
future surgical passes.

The promoted set adds 9,848 C bytes. It was checked with a force-clean inner
build, object comparisons, `make replace`, and a fresh outer build:

```text
conker/build/conker.us.bin: 842e3d348e3c8ae0039e2ab367ad492f9b5266d8
build/conker.us.z64:         4cbadd3c4e0729dec46af64ad018050eada4f47a
```

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

After the latest promoted changes, the generated US progress report is:

| Section | C functions | ASM functions | Function coverage | Byte coverage |
| --- | ---: | ---: | ---: | ---: |
| init | 308 | 229 | 57.36% | 40.89% |
| game | 1,426 | 3,886 | 26.84% | 8.58% |
| debugger | 32 | 10 | 76.19% | 34.93% |
| **total** | **1,766** | **4,125** | **29.98%** | **11.02%** |

Regenerate this snapshot with:

```sh
make -C conker progress
```
