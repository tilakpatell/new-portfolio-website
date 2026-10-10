# The Battlefront II (2017) drop: the coverage ledger

Written 2026-10-10 15:14 UTC from the bucket (113,464 objects listed) by `scripts/bf2017-coverage.mjs`. One row per object (a model with all its LOD files; a map and each of its five extras kinds; `data/` by top folder and record type), each in one state: used, owned, excluded, not-uploaded, unowned. `npm run coverage:bf2017` fails while any row is unowned, or owned by a lane that has merged.

**Rows:** 80,837 · used 2,428 · owned 59,904 · excluded 13,837 · not-uploaded 4,668 · unowned 0

## By part

| part | rows | objects | MB | used | owned | excluded | not-uploaded | unowned |
| --- | --: | --: | --: | --: | --: | --: | --: | --: |
| models | 14,471 | 14,471 | 2,563 | 779 | 10,726 | 2,966 | 0 | 0 |
| collision | 12,941 | 12,941 | 151 | 0 | 10,297 | 2,644 | 0 | 0 |
| anims | 10,270 | 10,270 | 1,110 | 383 | 9,332 | 555 | 0 | 0 |
| textures | 29,836 | 29,836 | 21,803 | 1,155 | 18,942 | 5,071 | 4,668 | 0 |
| physics | 10,530 | 10,530 | 125 | 0 | 8,173 | 2,357 | 0 | 0 |
| terrain | 39 | 39 | 311 | 1 | 28 | 10 | 0 | 0 |
| maps | 76 | 76 | 38 | 2 | 61 | 13 | 0 | 0 |
| maps.lights | 74 | 74 | 0 | 0 | 62 | 12 | 0 | 0 |
| maps.decals | 74 | 74 | 0 | 0 | 62 | 12 | 0 | 0 |
| maps.actors | 74 | 74 | 0 | 0 | 62 | 12 | 0 | 0 |
| maps.vehicles | 74 | 74 | 0 | 0 | 62 | 12 | 0 | 0 |
| maps.effects | 74 | 74 | 39 | 0 | 62 | 12 | 0 | 0 |
| scatter | 40 | 40 | 10 | 0 | 30 | 10 | 0 | 0 |
| animtracks | 61 | 61 | 0 | 0 | 52 | 9 | 0 | 0 |
| movies | 116 | 116 | 5,725 | 0 | 109 | 7 | 0 | 0 |
| fonts | 23 | 23 | 36 | 0 | 23 | 0 | 0 | 0 |
| svg | 702 | 702 | 4 | 28 | 615 | 59 | 0 | 0 |
| strings | 2 | 2 | 1 | 0 | 2 | 0 | 0 | 0 |
| data | 1,307 | 83,983 | 2,078 | 73 | 1,203 | 31 | 0 | 0 |
| index | 12 | 12 | 97 | 7 | 1 | 4 | 0 | 0 |
| test | 41 | 41 | 42 | 0 | 0 | 41 | 0 | 0 |

## Owned, by lane

Of each lane’s rows, those its plan did not name are the fifth design’s first finding (`finding: true` in the owners table), given to it when the ledger was first written.

| lane | design | owned rows | of them, the first finding |
| --- | --- | --: | --: |
| E | #848 | 28,973 | 10,303 |
| O | #848 | 13,677 | 3,099 |
| A | #848 | 11,525 | 2,591 |
| surfaces-Q6 | #844 | 1,394 | 0 |
| M | #848 | 1,324 | 541 |
| space | #848 | 894 | 564 |
| 4 | #812 | 700 | 700 |
| X | #836 | 422 | 360 |
| Y | #839 | 310 | 0 |
| B | #839 | 175 | 0 |
| 6 | #812 | 139 | 139 |
| surfaces-Q4 | #844 | 125 | 0 |
| 7 | #812 | 80 | 80 |
| surfaces-Q3 | #844 | 70 | 0 |
| N | #836 | 30 | 0 |
| surfaces-Q1 | #844 | 29 | 0 |
| D | #839 | 27 | 0 |
| W | #839 | 10 | 0 |

## Excluded, by rule

| rule | rows |
| --- | --: |
| era | 11,511 |
| scaffolding | 2,326 |
