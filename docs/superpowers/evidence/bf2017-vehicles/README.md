# Lane V's evidence: the vehicles, in depth

The cast is [`cast.md`](cast.md). Every picture here was looked at before the lane shipped.

## The sheets

- [`sheet-ground-turrets.webp`](sheet-ground-turrets.webp): the walkers, ground vehicles, droids and turrets, each in its plain cut.
- [`sheet-fighters.webp`](sheet-fighters.webp): the twenty fighters.
- [`sheet-cockpits.webp`](sheet-cockpits.webp): the fourteen cockpits, each in its hull's frame.
- [`fleet.webp`](fleet.webp): the space layer's ships, old on the left and the game's on the right. Rows: the close-up Star Destroyer, the Nebulon-B, the MC80, the TIE fighter. The game's Nebulon-B and TIE went in. The close-up Star Destroyer and the MC80 stayed, and so did the close-up Nebulon-B: the game's are 16,000-triangle backdrops.

## The walkers on their own rigs

`node scripts/rig-shot.mjs <file> <rig> <out.png> <clips>`: a row a clip, four moments across, the lowest foot's height at each.

- [`rig-atst.webp`](rig-atst.webp): the AT-ST bound to `ATST_Ske01` at import, playing idle, walk, die and turn. Feet at 0.08 to 0.09 m through the walk.
- [`rig-atat.webp`](rig-atat.webp): the AT-AT, the game's own skin on `ATAT_Ske`: idle, walk, and the tow cable's fall.
- [`rig-atat-composite-bound.webp`](rig-atat-composite-bound.webp): the gameplay composite bound to the same rig. It was not taken: 4.0 MB, and a plate tore between the legs.
- [`rig-atte.webp`](rig-atte.webp), [`rig-atrt.webp`](rig-atrt.webp), [`rig-droideka.webp`](rig-droideka.webp): walk, turn, the big gun's stance, the droideka's roll and deploy, each death.
- In the world: [`world-hoth-atat.webp`](world-hoth-atat.webp) and [`world-endor-atst.webp`](world-endor-atst.webp).
- `anim-check` saw every AT-AT in view on Hoth, and the AT-ST on Endor, at 0 m/s of planted drift, none at bind pose. On Hoth an AT-AT at 2.2 m/s crossfades from the idle into the walk, paced 1.73 times the clip's 1.27 m/s.

## The cost on the worlds

`BUDGET=1 QUALITY=<q> JSON=1 node scripts/galaxy-check.mjs surface hoth,endor,geonosis,kashyyyk,scarif,tatooine,naboo`.

Measured twice on 2026-10-10:

- **main:** `85d92f8b`, lane S merged;
- **lane V:** the same main merged into this branch.

The raw runs are `surface-<q>-main.json` and `surface-<q>.json`. The PASS and FAIL marks are against `lab/baseline/`, which predates both runs: Geonosis and Scarif fail it on main too. At low there is no baseline, so a world is held to the low row itself, which most worlds broke on main already. What the lane is held to is main's own numbers.

**High**

| world | draw calls (main → lane V) | triangles | models |
| --- | --- | --- | --- |
| Hoth | 156 → 128 | 865,338 → 862,311 | 14.7 → 15.1 MB |
| Endor | 167 → 167 | 2,046,229 → 2,046,229 | 12.3 → 12.9 MB |
| Geonosis | 196 → 173 | 1,022,138 → 1,015,500 | 22.9 → 26.1 MB |
| Kashyyyk | 108 → 94 | 1,301,214 → 1,306,930 | 12.3 → 13.6 MB |
| Scarif | 147 → 132 | 1,743,891 → 1,757,740 | 12.4 → 11.1 MB |
| Tatooine | 95 → 84 | 707,257 → 709,005 | 24.3 → 25.0 MB |
| Naboo | 597 → 588 | 1,968,520 → 1,899,004 | 24.4 → 25.8 MB |

**Low**

| world | draw calls | triangles | models |
| --- | --- | --- | --- |
| Hoth | 156 → 128 | 671,170 → 668,143 | 14.7 → 15.1 MB |
| Endor | 167 → 167 | 1,362,301 → 1,362,301 | 12.3 → 12.9 MB |
| Geonosis | 196 → 173 | 781,010 → 774,372 | 22.9 → 26.1 MB |
| Kashyyyk | 108 → 94 | 934,094 → 939,810 | 12.3 → 13.6 MB |
| Scarif | 147 → 132 | 1,149,765 → 1,163,614 | 12.4 → 11.1 MB |
| Tatooine | 97 → 82 | 530,185 → 527,213 | 24.3 → 25.0 MB |
| Naboo | 595 → 586 | 1,396,467 → 1,326,951 | 24.4 → 25.8 MB |

- **Draw calls:** fewer or the same on every world. A game vehicle is one to six draws where the old ones were more.
- **Triangles:** within 1% of main's either way (Scarif +0.8%, Naboo −3.5% at high).
- **Model bytes:** from 1.3 MB fewer (Scarif) to 3.2 MB more (Geonosis: the AT-TE, the gunship, the droidekas). All are within the 60 MB row at high. At low, Geonosis, Tatooine and Naboo were already over the 20 MB row on main.
- **No world fails that passed on main**, at either level.

## The space layer

`BUDGET=1 QUALITY=high node scripts/galaxy-check.mjs space endor,hoth,scarif`. Calls and triangles are unchanged; models Endor 10.4 → 10.8 MB, Hoth 7.8 → 8.1, Scarif 7.5 → 7.4, against the 60 MB row.

## The console

One error shows on every surface world on main and here alike: a `MeshBasicMaterial`'s fog shader without `mvPosition` (`skyfog.js`). Main logged five on Hoth's run, this branch one. Nothing in this lane touches it.
