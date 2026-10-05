# Autopilot backlog

What the autopilot does next, in order: the first unchecked item is the next run's job (`.claude/skills/autopilot/SKILL.md`, step 3). Quality and performance over quantity: finish and polish before starting new. A run ticks its item with the ship's log entry number, or writes what's left under it. A finding of a run's own goes in here first, at the place it belongs.

Each item says where, what, how to measure it, and what done looks like.

## Broken or unverified (first)

- [ ] **Middle-earth's two stranded patches.** `docs/superpowers/handoff-patches/east-cirith-ungol-wip.patch` (Cirith Ungol's side game, half done; base `d513724`) and `orthanc-gwaihir-wip.patch` (Gwaihir missing from Orthanc's pinnacle flight, base `18aad80`). One per run: `git checkout <base> && git apply <patch>`, carry it onto `main`, finish, test, ship. Done: the side game plays through, or Gandalf rides an eagle. Then delete the patch.
- [ ] **The Invincible planet, looked at.** `docs/superpowers/HANDOFF-invincible-planet.md`: merged without a browser run. Open `/universe/invincible`, tune the glow strength, dust opacity, debris belt against the halo, moon orbit (r × 2.15) against its neighbours. Done: a screenshot that reads as one object, not a pile of effects, and no console errors.
- [ ] **Galaxy surfaces, Tatooine's unverified list.** `docs/superpowers/HANDOFF-galaxy-surfaces.md`, "Not yet verified in a browser": the cantina (walls, lamps, band, Greedo), the palace (trapdoor, rancor), Tosche Station. One place per run. Done: each quest plays through in the browser with the DEV hooks, lamps bright enough, no errors.

## Performance (next)

- [ ] **Earth's day map is 1.4 MB and its clouds 1.4 MB** (`public/textures/earth/day.webp`, `clouds.webp`). Measure what's on screen at the globe's largest (`/earth`): if the texels never show, bring the desktop copy down a size or re-encode at a lower quality; keep the `-sm` copies for phones. Done: no visible loss at full zoom in a before/after screenshot, bytes said in the entry.
- [ ] **Avengers HQ's sky and forest floor** (`public/hq/sky/pines/sky.jpg`, 1.6 MB as JPEG; `public/hq/tex/forest-floor/normal.jpg`, 0.7 MB). WebP them at the same visible quality (sharp, `scripts/hq-assets.mjs` is the pipeline). Done: same look, fewer bytes, `WORLD_MB['/avengers']` corrected.
- [ ] **GPU-compressed textures where they pay.** Three r186 has `KTX2Loader`; the biggest colour maps on phones (the universe's planets, Earth) would take a fraction of the graphics memory as ETC1S/UASTC. Needs the Basis transcoder in `public/` and a build script (`@gltf-transform` is already a dependency and can write KTX2). Start with one planet, measure memory with `renderer.info.memory` on a `mid` tier, and only go on if it shows. Done: one world's textures as KTX2 with the WebP fallback kept, numbers in the entry.
- [ ] **The first load.** `index-*.js` is 177 kB, `vendor` 260 kB, `three.core` 377 kB, `renderer` 370 kB; the front door draws the universe straight away. Find what the entry chunk carries that only a world needs (rolldown's `INEFFECTIVE_DYNAMIC_IMPORT` warnings on `lib/audio.js` and `stages/ClaudeStage.jsx` are two leads) and make it lazy. Done: a smaller entry with the same first paint, measured by the check script's bundle report.
- [ ] **A real frame-rate pass on one heavy world at `?quality=mid`** (Albuquerque's city, Avengers HQ, C-137's street: `renderer.info.render.calls` and `.triangles` from a DEV hook). Instance or merge what's repeated, cull what's behind. Done: fewer calls and triangles with the same picture, numbers in the entry.

## Graphics (then)

- [ ] **Flat surfaces that should have relief.** Audit one world for materials with a colour map but no normal map, or painted surfaces where a CC0 scan would read better (`npm run cc0` fetches Poly Haven and ambientCG sets; `src/lib/cc0.js` loads them). One world a run. Done: before/after screenshots at the same spot.
- [ ] **Model credits and the hangar's HD ships.** `docs/superpowers/HANDOFF-universe-map.md`: a crewed cruiser (`rickmorty/cruiser3d.js`) the universe could fly; new voice clips through `lib/clips.js`. Only if the models and clips are already in the repo.

## Features (last, and only as whole slices)

- [ ] **C-137: side roads off the main street**, and a gym and hallway for the school (`docs/superpowers/HANDOFF-c137.md`, "Ideas for later"). Morty's walk animation should pause in the air.
- [ ] **Avengers HQ: ring 3 of the swing tour, under the bridge**, is fussy by hand (`docs/superpowers/HANDOFF-avengers-hq.md`). Move or widen it so a visitor gets it in a few tries; keep the bot's test green.
- [ ] **Galaxy missions still briefings.** `docs/superpowers/specs/2026-10-05-galaxy-games-design.md`: one mission a run, the smallest first, with its rules tested.

## Done

- [x] #1 The ship's log and the autopilot (this file, the skill, the check script, CI on pull requests, `/changes`).
