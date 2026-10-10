# The Battlefront II (2017) drop: the coverage ledger

Written 2026-10-10 16:37 UTC from the bucket (113,464 objects listed) by `scripts/bf2017-coverage.mjs`. One row per object (a model with all its LOD files; a map and each of its five extras kinds; `data/` by top folder and record type), each in one state: used, owned, excluded, not-uploaded, unowned. `npm run coverage:bf2017` fails while any row is unowned, or owned by a lane that has merged.

**Rows:** 80,837 · used 3,525 · owned 58,602 · excluded 14,066 · not-uploaded 4,644 · unowned 0

## By part

| part | rows | objects | MB | used | owned | excluded | not-uploaded | unowned |
| --- | --: | --: | --: | --: | --: | --: | --: | --: |
| models | 14,471 | 14,471 | 2,563 | 978 | 10,529 | 2,964 | 0 | 0 |
| collision | 12,941 | 12,941 | 151 | 0 | 10,297 | 2,644 | 0 | 0 |
| anims | 10,270 | 10,270 | 1,110 | 383 | 9,332 | 555 | 0 | 0 |
| textures | 29,836 | 29,836 | 21,803 | 1,348 | 18,588 | 5,256 | 4,644 | 0 |
| physics | 10,530 | 10,530 | 125 | 0 | 8,173 | 2,357 | 0 | 0 |
| terrain | 39 | 39 | 311 | 1 | 28 | 10 | 0 | 0 |
| maps | 76 | 76 | 38 | 3 | 59 | 14 | 0 | 0 |
| maps.lights | 74 | 74 | 0 | 0 | 61 | 13 | 0 | 0 |
| maps.decals | 74 | 74 | 0 | 0 | 61 | 13 | 0 | 0 |
| maps.actors | 74 | 74 | 0 | 0 | 61 | 13 | 0 | 0 |
| maps.vehicles | 74 | 74 | 0 | 0 | 61 | 13 | 0 | 0 |
| maps.effects | 74 | 74 | 39 | 0 | 61 | 13 | 0 | 0 |
| scatter | 40 | 40 | 10 | 0 | 30 | 10 | 0 | 0 |
| animtracks | 61 | 61 | 0 | 0 | 52 | 9 | 0 | 0 |
| movies | 116 | 116 | 5,725 | 83 | 2 | 31 | 0 | 0 |
| fonts | 23 | 23 | 36 | 7 | 0 | 16 | 0 | 0 |
| svg | 702 | 702 | 4 | 626 | 17 | 59 | 0 | 0 |
| strings | 2 | 2 | 1 | 2 | 0 | 0 | 0 | 0 |
| data | 1,307 | 83,983 | 2,078 | 87 | 1,189 | 31 | 0 | 0 |
| index | 12 | 12 | 97 | 7 | 1 | 4 | 0 | 0 |
| test | 41 | 41 | 42 | 0 | 0 | 41 | 0 | 0 |

## Owned, by lane

Of each lane’s rows, those its plan did not name are the fifth design’s first finding (`finding: true` in the owners table), given to it when the ledger was first written.

| lane | design | owned rows | of them, the first finding |
| --- | --- | --: | --: |
| E | #848 | 28,805 | 10,139 |
| O | #848 | 13,516 | 3,098 |
| A | #848 | 8,985 | 51 |
| T | #839 | 1,833 | 1,833 |
| surfaces-Q6 | #844 | 1,394 | 0 |
| space | #848 | 764 | 454 |
| 5 | #812 | 679 | 679 |
| 4 | #812 | 626 | 626 |
| M | #848 | 592 | 539 |
| X | #836 | 415 | 354 |
| Y | #839 | 310 | 0 |
| B | #839 | 175 | 0 |
| 6 | #812 | 138 | 138 |
| surfaces-Q4 | #844 | 124 | 0 |
| 7 | #812 | 80 | 80 |
| surfaces-Q3 | #844 | 70 | 0 |
| N | #836 | 30 | 0 |
| surfaces-Q1 | #844 | 29 | 0 |
| D | #839 | 27 | 0 |
| W | #839 | 10 | 0 |

## Excluded, by rule

| rule | rows |
| --- | --: |
| era | 11,725 |
| scaffolding | 2,325 |
| licence-pending | 16 |
