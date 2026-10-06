# Handoff: the Rick and Morty multiverse, Phase 4

Plan: `docs/superpowers/plans/2026-10-06-rick-and-morty-multiverse.md`.
Branch: `claude/rm-multiverse-phase4` (merged).

## Done

- **Phase 0, Tasks 0.4–0.5 (the dial)**: `world/dimensions/destinations.js`
  (tested) holds the destinations as data and the dial (`tp-rm-dial`);
  `rules.js` spreads them into its lists. The portal gun is on the garage
  bench's arm (hotspot `dial`), and `DimensionDial.jsx` is its overlay. The
  garage portal goes where the dial is set; each destination's portal comes
  home. The page's "Fire the portal gun" also sets the dial.
- **Phase 4's eight places**, each a lazy area (`scene.js` LAZY) built on
  `dimensions/stage.js`: Fantasy World, the Microverse, Anatomy Park, Needful
  Things, the Jerryboree, the Purge Planet (siren, then home inside 60 s),
  Pluto and Gear World. Each has its task, its achievement, and a view in
  `scripts/c137-shots.mjs`.
- **The models** (Meshy, `scripts/meshy-rm-local.mjs` PHASE4): 31 of 33
  fetched. Rigged figures are in `public/games/meshy/`; props and crowd
  copies in `public/models/c137/rm/` (crowd at full size, from
  `node_modules/.cache/meshy-full/`). Credits: 1,598 → about 350.

## Not done

- **King Flippy Nips** (`flippynips`) and **`magdalian-b`**. The king's
  picture was refused by the image filter twice; the prompt now reads "A
  Plutonian king". Magdalian B hit a service outage. A rerun was started:
  check `node scripts/meshy-rm-local.mjs balance`, then run `images`,
  `models`, `rig` and `anim` for `flippynips`, and `models` for
  `magdalian-b`, then `fetch` both. Copy `magdalian-b.glb` from
  `node_modules/.cache/meshy-full/` to `public/models/c137/rm/`. Until then
  both are left out of their places, as the rules say.
- Shots checked in the browser for Fantasy World, the Microverse, Anatomy
  Park and Needful Things. The Jerryboree, the Purge Planet, Pluto and Gear
  World are built and tested but not yet looked at. Run
  `BASE=http://127.0.0.1:<port> OUT=<dir> node scripts/c137-shots.mjs jerryboree purge pluto gearworld`.
- Small misses: Poncho has no bubble helmet, and Kyle reads like a Rick in a
  lab coat.
- Phase 0's Task 0.6 is mostly there already: the hook has `warp` and now
  `dial`. Phase 1 (Customs, Squanch, Gazorpazorp, Bird World) was never made.
  Its places would be rows 0–3 of the column, through the same `place()`.
- Phases 5 and 6 need more Meshy credits.
- PR #355 (gen3d runner fixes) is still a draft.
