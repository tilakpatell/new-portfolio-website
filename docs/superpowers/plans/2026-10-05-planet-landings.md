# Planet landings: plan

Spec: [`../specs/2026-10-05-planet-landings-design.md`](../specs/2026-10-05-planet-landings-design.md).

## PR 1: the framework, Middle-earth, Breaking Bad, Rick and Morty

1. `foot.js`: `frameAt(n, f)` and `place(frame, [x, z], R)` → `{ n, f }` (a spot in metres on the landing's flat frame, on the sphere); `circlesOf(solid, …)` (a builder's circle or box solid → `{ n, r }` obstacles). Tests first in `foot.test.js`.
2. `landings/landings.js`: `LANDINGS` (data) and `landingOf(id)`; `landings.test.js`: every landable planet, valid colours, GLBs on disk, clear of the ship and of each other, scatter budget.
3. `landings/place.js` (three.js): `furnish({ id, landing, frame, R, small, renderer })` → `{ group, solids, ready, dispose }`: imports `landings/<id>.js`, builds things (sync or promise) and scatter (instanced), stands them on the sphere.
4. `landings/models.js`: a cached GLB loader (meshopt) that hands out clones and disposes them.
5. `footScene.js`: `createGround` takes the landing's ground style and colours; `createSky` replaces `createHaze`; `begin` furnishes the landing and emits `arrive`; the scatter replaces `createRocks` where a landing has its own; solids join `obstacles()`; `end` disposes it all. `createFoot` takes the `renderer`.
6. `UniverseMap.jsx` + `universe.css`: the arrival title card.
7. `landings/middleearth.js` (Shire kit), `landings/breakingbad.js` (Sketchfab GLBs + galaxy rocks), `landings/rickmorty.js` (C-137 GLBs + portal).
8. Check in the browser: land on each of the three (Playwright), screenshots, frame time. Lint, test, build. PR, merge.

## PR 2: Transformers, Marvel, the Office, Gaming

One planet file each and its data; screenshots; PR, merge.

## PR 3: Earth, the Caribbean, Invincible, the music room

As PR 2. Anything missing is looked for on Sketchfab first (`scripts/sketchfab-batch.mjs`), then Meshy.

## PR 4: locals and doors

Figures standing about (idle clips where they have them); walking up to a landmark with a `to` shows its name and `E` opens that world's page; README and architecture notes.
