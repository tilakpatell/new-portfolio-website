# Smash Run: handoff (2026-10-04, second session)

Task 7 of `docs/superpowers/plans/2026-10-04-avengers-hq-games.md`; brief in the spec's "6. Smash Run". Branch `claude/sweet-planck-8ckze3` (the first session's `claude/funny-fermat-fzo6lu` plus `main` merged in).

## Done
- `smash/rules.js` + `rules.test.js`: the simulation, 29 tests (first session).
- `smash/models.js`: Midtown built from code. Blocks (walk-ups with fire escapes and water towers, lofts, limestone prewar with setbacks, glass towers), every window, shop front, sign, awning and traffic light from one painted atlas (8 materials a block); sedans, taxis, police cars, SUVs as instanced parts; energy wall pylons and their hex field; craters (decal + emissive embers + rim slabs); road paint per 80 m block; the chariot lane warning; Stark Tower with the Tesseract beam.
- `smash/scene.js`: Hulk at z = 0, the course at z = d - at; blocks reused by variant, lamps every 30 m, parked wrecks (some burning), Stark Tower, portal and circling chariots at the end of the avenue; Hulk's heavy run, smash, leap, roar, kneel; flung soldiers, barricades and cars; chariot runs.
- `smash/SmashRun.jsx` + `smash.css`: keys, mouse, swipes/taps, HUD (distance, Time Stone track, score, hearts, rage), teaching lines, sounds, best distance (`tp-hq-smash-best`), Time Stone (`earnStone('time')`) and the `hulk` achievement. Floor 5 shows it with `HulkLab` as the fallback. `window.__HQ__.smash.setState('action' | 'rage' | 'chariot' | 'lost')`.
- `smash/meshy.js` + `scripts/meshy.mjs --set hq`: Meshy models replace the procedural ones when `public/hq/meshy/manifest.json` lists them. Checked with Portal panic's models as stand-ins.

## Next
1. Generate the Meshy set (needs `MESHY_API_KEY`; about 330 credits): `node --env-file=.env.local scripts/meshy.mjs --set hq images`, then `models`, `rig`, `anim`, `fetch`. Look at `lab/meshy-hq/*.png` after `images` before paying for `models`. Commit `public/hq/meshy/`.
2. With the real models: tune Hulk's smash/leap/roar directions in `poseMeshyHulk`, car scale/orientation (`meshyParts(..., { h: 4.6, along: 'z' })`), soldier walk speed.
3. Performance (measured in headless Chromium, mid-run with walls and cars): phones (tier medium) 127 draws, 186k triangles: blocks in six materials, a plain lamp, no car or soldier shadows, the city built 260 m ahead; desktop 205 draws, 395k. Touch (tap, swipes) checked with real touch events at 390 × 844. Not yet tried on a real phone.
4. Merge to `main` via a PR when happy.
