# Autopilot backlog

What the autopilot does next, in order: the first unchecked item is the next run's job (`.claude/skills/autopilot/SKILL.md`, step 3). Quality and performance over quantity: finish and polish before starting new. A run ticks its item with the ship's log entry number, or writes what's left under it. A finding of a run's own goes in here first, at the place it belongs.

Each item says where, what, how to measure it, and what done looks like.

## Broken or unverified (first)

- [ ] **The Invincible planet, looked at.** `docs/superpowers/HANDOFF-invincible-planet.md`: merged without a browser run. Open `/universe/invincible`, tune the glow strength, dust opacity, debris belt against the halo, moon orbit (r × 2.15) against its neighbours. Done: a screenshot that reads as one object, not a pile of effects, and no console errors.
- [ ] **Galaxy surfaces, Tatooine's unverified list.** `docs/superpowers/HANDOFF-galaxy-surfaces.md`, "Not yet verified in a browser": the cantina (walls, lamps, band, Greedo), the palace (trapdoor, rancor), Tosche Station. One place per run. Done: each quest plays through in the browser with the DEV hooks, lamps bright enough, no errors.
- [ ] **Avengers HQ: ring 3 of the swing tour, under the bridge**, is fussy by hand (`docs/superpowers/HANDOFF-avengers-hq.md`). Move or widen it so a visitor gets it in a few tries; keep the bot's test green.

## Textures and performance (next)

The measurements and the plan are the other sessions' `docs/research/2026-10-05-textures-and-asset-quality.md` and `docs/superpowers/specs/2026-10-05-texture-quality-design.md`. Slices 1 and 2 (`src/lib/three/textures.js`, `src/lib/three/gltf.js`) are on `main`. Use them for anything new; don't add another loader.

- [x] #2 **Slice 4 of the texture spec: breaking tiling on big grounds** (`src/lib/three/surface.js`, `antiTile`): the helper, tested, and the music courtyard's dunes and paving.
- [ ] **`antiTile` on the next grounds**: the Avengers compound's lawn, forest floor, roads and apron (`avengers/world/scene.js`: `floorMat`, `lawnMat`; it chains after `cloudy`'s onBeforeCompile), then Roll out's desert and asphalt (`cybertron/rollout/world.js`: `groundMat`, `roadMat`). One ground a run, before/after screenshots at the same spot on `high` and `low`. Done: no visible repeat across the ground, same frame rate.
- [ ] **`antiTile`'s close-range detail normal** (`detail` in the spec: a tiling normal texture faded in within a few metres). Only once a ground shows it's needed up close.
- [ ] **Slice 3 of the texture spec: `scripts/ktx2.mjs`** and the first UASTC normal maps (the HQ games' `public/hq/tex/*/normal.jpg` are JPEG, which halves a normal map's resolution: the research measured 26.6 dB). The loader already reads KTX2 (`lib/three/gltf.js`). The transcoder goes in `public/basis/`. Convert only what the report shows a net win (GPU memory down, bytes within 1.25×, PSNR ≥ 34 dB). Done: one set converted with numbers in the entry, the rest a one-line command away.
- [ ] **Anisotropy that follows the tier.** The research lists the files with anisotropy hardcoded to 8 or 4 (`lib/three/rig.js`, `avengers/hq/assets.js`, `universe/planets.js`, `universe/shipModels.js`, `universe/hulls.js`, `universe/footScene.js`, `cybertron/transform3d.js`, `earth/scene.js`, `galaxy/surface/placer.js`, `cockpit/kit.js`, `universe/trafficKit.js`) and half the site's models at GLTFLoader's default of 1. Route them through `textures.js`'s `sharpen`. A few files a run. Done: a floor seen at a glancing angle stays sharp a few metres out, screenshot to prove it.
- [ ] **Earth's day map is 1.4 MB and its clouds 1.4 MB** (`public/textures/earth/day.webp`, `clouds.webp`; the 8K day map alone is 171 MB of graphics memory on a `high` desktop). Measure what's on screen at the globe's largest (`/earth`); bring the desktop copy down a size if the texels never show; keep the `-sm` copies for phones. Done: no visible loss at full zoom in a before/after screenshot, bytes said in the entry.
- [ ] **The first load.** `index-*.js` is 174 kB, `vendor` 253 kB, `three.core` 369 kB, `renderer` 361 kB; the front door draws the universe straight away. Find what the entry chunk carries that only a world needs (rolldown's `INEFFECTIVE_DYNAMIC_IMPORT` warnings on `lib/audio.js` and `stages/ClaudeStage.jsx` are two leads) and make it lazy. Done: a smaller entry with the same first paint, measured by the check script's bundle report.
- [ ] **A real frame-rate pass on one heavy world at `?quality=mid`** (Albuquerque's city, Avengers HQ, C-137's street: `renderer.info.render.calls` and `.triangles` from a DEV hook). Instance or merge what's repeated, cull what's behind. Done: fewer calls and triangles with the same picture, numbers in the entry.

## Graphics (then)

- [ ] **Flat surfaces that should have relief.** Audit one world for materials with a colour map but no normal map, or painted surfaces where a CC0 scan would read better (`npm run cc0` fetches Poly Haven and ambientCG sets; `src/lib/cc0.js` loads them). One world a run. Done: before/after screenshots at the same spot.
- [ ] **Model credits and the hangar's HD ships.** `docs/superpowers/HANDOFF-universe-map.md`: a crewed cruiser (`rickmorty/cruiser3d.js`) the universe could fly; new voice clips through `lib/clips.js`. Only if the models and clips are already in the repo.

## Features (last, and only as whole slices)

- [ ] **C-137: side roads off the main street**, and a gym and hallway for the school (`docs/superpowers/HANDOFF-c137.md`, "Ideas for later"). Morty's walk animation should pause in the air.
- [ ] **Galaxy missions still briefings.** `docs/superpowers/specs/2026-10-05-galaxy-games-design.md`: one mission a run, the smallest first, with its rules tested.

## Done

- [x] (other sessions, same day) Middle-earth's stranded patches (Cirith Ungol's side game, Gwaihir at Orthanc), the texture helper and the model loader, KTX2 in the loader.
- [x] #1 The ship's log and the autopilot (this file, the skill, the check script, CI on pull requests, `/changes`).
