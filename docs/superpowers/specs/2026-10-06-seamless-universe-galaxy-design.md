# One game across the universe map and the galaxy: design

Date: 2026-10-06. Status: written from the owner's brief without a question
round (the owner asks not to be stopped for approvals: memory
"terse-no-repeat-asks"); every decision is the owner's words, something the
repo already settled, or an assumption marked as one.

## What the owner asked for

"The star wars worlds and the regular worlds should be seamless (in terms of
guns and modular building and stuff) as if we entered a new galaxy etc"

## What that means here

Flying from the universe map into the galaxy should feel like flying into
another region of one game: the ship you built and fitted, the guns your
crew carry, how each gun behaves and the keys for the things both sides do
are the same on both sides. Success: pick a gun in either place and it's in
your hands in the other; the same gun fires at the same rate for the same
damage with the same heat; the hangar (parts and the shipyard's build) opens
from either map; B, Tab and H do the same thing everywhere.

Assumptions: "modular building" is the hangar (outfit.js's parts, the
shipyard's garage builds); "stuff" is the controls, the combat numbers and
the HUD's gun line. The galaxy's own moves that the universe map has no
version of (the Force, sabers, the detonator, overcharge, dodge, block) stay
the galaxy's, on the keys they have.

## Where it is today

- **The ship** already crosses: both maps read the same `LOADOUT_KEY`,
  `HULL_KEY` (outfit.js, shipyard/build.js). But only the universe map opens
  the hangar (`Universe.jsx` owns the state and the writes; `Galaxy.jsx`
  reads them once per ship).
- **Guns on foot** don't: the universe map gives each crew member the gun in
  `footScene.js`'s `PARTY` (Rick's B cycles portal → freeze → shrink, as
  `GADGETS`), fires every 0.28 s (the bowcaster 0.55 s) for 1 (2, a gadget
  3). The galaxy's hero panel picks a hero, a gun of `PICKABLE` and mods
  (`HERO_KEY`), fired by `weaponRules.js`'s numbers (rate, damage, spread,
  range, burst, pellets, heat that locks out, mods).
- **Keys on foot**: the universe swaps who you play with X, the galaxy with
  Tab (its X is dodge). B is Rick's gadgets on the universe map only. H is the
  hangar on the universe map only.

## Decisions

- **One armoury, in `src/lib/arms/`** (two worlds need it: docs/health/RULES.md).
  `weaponRules.js` moves to `lib/arms/weapons.js` unchanged (the galaxy path
  re-exports it, so no caller changes). The gun models stay
  `universe/gunplay.js`'s `GUNS`, as both already import them.
- **A rack per person** (`lib/arms/rack.js`, pure, tested): the guns each
  member of a crew or each hero carries, up to three, and the mods on them,
  kept under one key (`tp-arms`: `{ [who]: { guns: [kind…], mods: [id…] } }`).
  Unset, a rack is that person's own gun (`PARTY`'s, a hero's), and Rick's is
  the portal gun, the freeze ray and the shrink ray. **B** takes the next gun
  in the rack of whoever you're playing, on both sides. The galaxy's hero
  panel writes the hero's rack (its first gun and the mods) as well as
  `HERO_KEY`; `heroSpec` reads the rack first.
- **The same numbers on both sides**: the universe map's foot combat fires by
  `weaponOf(kind)` with the rack's mods (`withMods`): the rate (`every`), the
  damage, the scatter, bursts and pellets, the range, and the heat (`heatShot`,
  `heatStep`: fire too long and it locks). The troops' hit points are already
  on the galaxy's scale (a Gromflomite 2, a cop 3, a stormtrooper 2). The
  mate fires by their own rack's first gun's numbers.
- **The HUD's gun line on the universe map**: the gun's name and a heat bar
  under it on foot, as the galaxy's own HUD shows them, and the
  moment's name after B (as now).
- **One hangar on both maps**: the universe map's `Hangar` opens from the
  galaxy map with H too, its fits and builds applied to the galaxy's ship at
  once. The state and writes move out of `Universe.jsx` into a hook
  (`universe/useOutfit.js`: loadouts, hulls, garage, `fit`, `setBuild`,
  `loadout`, `build`, `dropped`) that both pages use.
- **The hangar's Armoury tab**: beside parts and the shipyard, the crew's
  guns: each crew member's rack (pick up to three of the armoury's guns, in
  order, and up to two mods), on both maps. The galaxy's hero panel keeps its
  weapon tab, writing the same racks.
- **Keys**: B (next gun) and H (hangar) on both sides; Tab plays the other
  one on the universe map too (X stays as well there: nothing else uses it on
  that side). The guide's on-foot rows say so.

## Non-goals

- Merging the two ways of walking (the universe's A/D turn and Q/E step
  aside; the galaxy's camera-relative A/D), or the galaxy's moves coming to
  the universe map.
- Heroes walking on the universe map (its crews do; a hero's rack is kept
  for when they're played in the galaxy).
- New guns, models or network fields (other pilots see a crew's gun as now).

## The parts, in order (one pull request each)

1. The armoury: `lib/arms/weapons.js` (moved), `lib/arms/rack.js` (+ test);
   the universe map's foot combat by the numbers, with heat and the HUD's
   gun line; B on both sides by the rack; the hero panel writing racks.
2. The hangar on both maps: `useOutfit`, H on the galaxy map, the Armoury tab.
3. The keys and the guide: Tab on the universe map, the guide's rows, the
   key hints.

Each: `npx eslint .`, the touched suites in `npx vitest run`,
`node scripts/health.mjs --check --skip build`, a browser check through the
dev server, then the PR and the merge.
