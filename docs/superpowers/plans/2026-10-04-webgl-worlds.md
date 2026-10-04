# Plan: WebGL games, Transformers and Rick and Morty

Spec: `docs/superpowers/specs/2026-10-04-webgl-worlds-design.md`

Each task ends with `npm run lint && npm test` green; the build runs at the end
of each game. Tests are written before the rules they cover.

## Task 1: the probe and the gate

1. Test: `probe` reports software WebGL when the strict request fails but the
   relaxed one succeeds; `needsGpu(info)` says why (`software`, `none`).
2. Implement in `src/lib/gpu.js`; add `reprobe()`.
3. `src/components/games/GpuGate.jsx`: the sorry card, browser detection
   (`browserSteps(ua)`, tested), Check again, Play anyway.

## Task 2: shared 3D kit

1. Test `src/lib/paint.js`: noise is seeded and in range, tiles wrap.
2. `src/lib/stage3d.js`: renderer + composer + bloom + adaptive quality +
   context loss + dispose, used by both games.

## Task 3: Roll out (Transformers)

1. Tests for `src/components/cybertron/rollout/rules.js`: steering and lanes,
   transform timing, energon drain and auto-revert, boost, barricade (robot
   jump clears, vehicle crashes), gap (vehicle ramp clears, robot falls),
   blaster kills a Vehicon, bombs and bolts hit, shields and invulnerability,
   pickups, boss phases, stage end, win/loss, determinism, idle loses, bot
   clears stage one.
2. Rules.
3. `paint.js` (asphalt, sand, rock strata, facades, Cybertron plating, decals).
4. `models.js` (transform rigs: Optimus, Bumblebee; Vehicon; Starscream jet;
   Shockwave; Megatron; props).
5. `RollOut3D.js` (stages, chunked road, recycled props, sky, effects, camera).
6. `RollOut.jsx` (host, HUD, controls, gate) and the section on `/cybertron`.

## Task 4: Rick and Morty

1. Tests for `src/components/rickmorty/portal/rules.js`: movement and arena
   bounds, obstacles, auto-aim and mouse aim, firing and upgrades, portal dash
   (charges, recharge, clamping, invulnerability), each enemy's behaviour,
   splitting, pickups and magnet, waves and dimensions, upgrades offered and
   applied, bosses, win/loss, determinism, idle loses, bot survives.
2. Rules, then textures, toon models, `Portal3D.js`, `PortalPanic.jsx`.
3. Page `/c-137`: portal hero, Meeseeks box, interdimensional cable, family,
   soundboard of synthesized sounds; the Portal theme.

## Task 5: integration

Routes, WORLDS, palette, terminal, guide, achievements, typed words, home
card, Cybertron 3D planet hero, trench copy, README.

## Task 6: verify and ship

Lint, tests, build, Playwright screenshots, commit, push.
