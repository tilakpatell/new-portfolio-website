# Handoff: the shipyard, the wardrobe and the HD cast

Spec: `docs/superpowers/specs/2026-10-05-shipyard-and-wardrobe-design.md`.
Plan: `docs/superpowers/plans/2026-10-05-shipyard-and-wardrobe.md` (all 16 tasks done).

## Done (all merged)
- **Ink and rim** (PR #143): `src/lib/three/ink.js`. The cruiser's ink no longer breaks at the atlas seams; the Meshy cast has a rim of light.
- **The shipyard** (PRs #165, #170): `src/components/universe/shipyard/`, the hangar's Build tab, flown on the map, in the galaxy, landed on its worlds, sent online. `hulls.js` `loft()` was inside out and is fixed.
- **HD Rick and Morty** (PR #182): about 40,000 faces and 2k textures, made by Meshy from their own concept images (`scripts/meshy.mjs ... hd`). The HD cruiser came out smudged and was not used; its task is in `scripts/meshy-tasks.json` as `saucer-hd` if it's ever wanted (fetch is free). 71 Meshy credits were left.
- **The wardrobe** (PRs #208, #213): `src/components/rickmorty/wardrobe/`, worn in the C-137 world, the Citadel, the cruiser's seats, on foot, and online.

## Breaking Bad wardrobe
- Walt and Jesse are dressed by the same wardrobe (`looks.js` `CASTS`, `CREW_CAST`): the hangar's panel shows their tabs when the RV's crew is flying, and their looks are worn in the RV's cockpit, on foot, in Albuquerque and online (`lb` beside Rick and Morty's `l`).
- Their colour windows are in `dress.js` (`SUIT`, `BOOTS`, Jesse's hoodie, jeans and trainers): they were checked against the HD figures (about 40,000 faces, 2k maps, `scripts/meshy-albuquerque.mjs` and `meshy-cockpit.mjs`) by sampling each texture by bone zone, and still hold; retune them there if the figures are retextured again. The town's budget test holds Walt and Jesse to the HD budget, everyone else to the town's. Jesse in his hoodie was made again (`jessePinkHd`, his first HD face a cartoon grin) and starts in his beanie (`starts`); the gear's fits for each HD head were measured against the skull (`lab/skull.mjs`, local: its top, width and middle against the head bones). Their gear is built in code in `gear.js` and fitted per figure (`FIT`'s `lift` and `back`).
- Only the hazmat Walt figure exists; Mr. White and Heisenberg are looks on it. A Walt in his own green shirt and tan jacket would want a figure of his own (Meshy, on the shared skeleton).

## Ideas for later
- More shipyard modules: the CC0 kits found (Kenney Space Kit, majadroid's CC0 ship components) need sockets of their own.
- Wardrobe gear colours (a swatch for the hat), and more bodies (the crowd's variants are static, not rigged).
- Other pilots' cruisers on the map are the code stand-in: they could carry their crews in their looks.

## How to check
- `npm run lint`, `npm test` and `npm run build` must all be clean.
- The lab pages used to tune this are local only (`lab/` is gitignored): `lab/builds.html` (rolled builds), `lab/wardrobe.html?body=rick` (each region in portal green), `lab/gear-sheet.html?body=morty&slot=face` (gear), `lab/wardrobe-ui.html` (the panel), `node lab/zones.mjs rick` (a body's texture colours by bone zone).
