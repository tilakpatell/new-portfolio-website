# The war, played: the plan

The design is `docs/superpowers/specs/2026-10-10-war-played-design.md`.
One pull request a part, in order, each merged when green. Before each is
done: `npm run lint`, `npm test`, `npm run build`,
`node scripts/health.mjs --check --skip build`, and the part’s browser
check. Restore `src/data/health/latest.json` and `public/github.json` after
a health or build run. Merge `origin/main` in before touching
`universe/scene.js` or `galaxy/scene.js`.

## Part 1: the look

1. **`glowAt(rgb, lum)`** in `universe/battleFx.js`, beside `BOLT_LOOK`,
   with `GLOW = { laser: 3.0, turbo: 3.6, flak: 2.4, engine: 1.8 }`.
   Test (battleFx.test.js): it keeps the hue ratios and hits the luminance
   for every side in `wars.js` and the galaxy’s `LOOKS`.
2. **Bolts and engines through it**: `battleScene.js`’s `colourOf` (lasers,
   turbolasers, flak) and the fighters’ glows. Torpedoes keep `bright` 1.6
   over the turbo luminance.
3. **The player’s bolts**: `galaxy/scene.js`’s `.multiplyScalar(4)` becomes
   `glowAt(colour, GLOW.laser)` (one line).
4. **Flashes** (`galaxy/fx.js`): the rim fade
   (`1 - smoothstep(0.65, 1, r)`) in place of the hard discard, and the body
   cooling as k². Capital death and break-up flashes in `battleScene.js`
   and DS2’s in `warpieces/endor.js` at most min(0.45 × size, 24),
   brightness 1.0. Test (fx.test.js): the shader has the rim smoothstep.
5. **The look’s bloom in the post** (`universe/post.js`):
   - `createPost(renderer, scene, camera, { small, bloom })`, the scene’s
     look’s bloom over the map’s; `knee`, `falloff` (five numbers),
     `flareMax` and `cap` optional.
   - The bright pass: the soft knee on the excess, four bilinear taps,
     through `finite()`, as an in-place edit of the patched material with a
     `uKnee` and `uStep` uniform (set in `render()` on resize).
   - `falloff` written to `bloomFactors`.
   - `bloomSize` capped at the bloom’s `cap` (960 for the galaxy).
   - `flare(k)` = base × min(k, `flareMax`), where base is the look’s (or
     the panel’s) strength.
   - Tests (post.test.js): the look’s numbers are taken; falloff lands in
     `bloomFactors`; `flare(2)` with no look still gives 1.6; with
     `{ strength: 0.5, flareMax: 1.25 }`, `flare(2)` gives 0.625 and
     `flare(1)` 0.5; the shader string has the knee and `finite(`.
6. **The galaxy’s look** (`galaxy/look.js`): `bloom: { threshold: 1.4,
   knee: 0.5, strength: 0.5, radius: 0, falloff: [1, 0.6, 0.3, 0.12, 0.04],
   flareMax: 1.6, cap: 960 }` with `why.bloom`; `galaxy/scene.js` passes it to
   `createPost`; while a war battle is on the flare is held to 1.25.
   `looks.test.js` still passes.
7. **The ?debug panel**: `galaxy/scene.js`’s `tune()` adds
   `bloomGroups(post.bloom)`; `lib/three/bloom.js` gains a knee slider.
8. **The check**: `scripts/galaxy-bloom-check.mjs` forces an Endor battle,
   hides the HUD, reads the canvas in three views (dogfight, panorama,
   flagship), prints the darkest half’s mean luma and the share over 0.9,
   and fails over 0.02 or 0.5%. Shots and numbers under
   `docs/superpowers/evidence/war-played/bloom/`.

## Part 2: back in the fight

- `battleFlights.js` `homeFor(team)` (test: out of `avoid`, behind the
  line, facing the enemy; a live carrier’s hangar first); `battle.homeFor`.
- `warfront.respawn()`: the point when sworn, took part and on, else null
  (warfront.test.js).
- `galaxy/scene.js`: the comeback takes `war.respawn() ?? arrival(...)`;
  `ghost: state.clock < state.safeUntil` into `war.update`; firing ends
  safe; the bubble chip.
- Browser: `galaxy-war-check.mjs` shoots you down and finds you behind
  your line, unhurt for 4 s.

## Part 3: targeting

- `targeting.js` `track()` options: `pin` (range only) and a candidate’s
  `far`; tests for each, defaults unchanged.
- `pickHunter` takes the war’s targets; Y locks the last attacker, U the
  objective (`warfront.objectiveFor(team)`).
- `battle.js` `hurt` carries `dir`; warfront keeps the last; the hit arc on
  the HUD.
- `keyRows.js` and the guide; `KeysCard.test.jsx`.

## Part 4: power-ups and the heal

- `hitFighter` returns `ace`; `dropFor` on aces, objectives and batteries.
- `pickups.js`: `amp` and `ammo` (tests: amp takes the larger buff).
- `galaxy/repair.js` (pure, tested): 15/s for 3 s, broken by a big hit,
  30 s cooldown; a third power tile on C; the crews’ words.
- Faster shield regen near your carrier (`warfront.home()`).

## Part 5: weapons by ship

- `galaxy/arms.js` over `createArmory`: R cycles, 1/2/3 select; missiles
  land through `war.hit` with `by`.
- `universe/weapons.js` stock arsenals made real; `weapons.test.js`
  updated.
- The objective cap per hit (a quarter of its most).
- The weapon readout in the flight cluster.

## Part 6: the deploy card

- `galaxy/deploy.js` (pure: when, what); `DeployCard.jsx`; the arrival
  prompt; the death card with the 4 s default; the side locked per battle;
  `tookPart` on deploy (warfront.test.js); `__galaxyDebug.deploy()` for the
  checks.

## Part 7: your side’s fighters

- `galaxy/craft.js` (`tp-galaxy-craft`); the roster’s fighters with a
  model; `buildShip`’s MODELS path; per-craft stats and the battle tune;
  the chase camera without a cab; the hello carries the craft; `.lo` cuts
  for the AI.

## Part 8: the Death Stars

- Scarif: the held cycle, the arrival at the gate’s fall, the dish’s fire.
- Endor: the held spin, the dish onto its target, `galaxy/stationFx.js`.
- Yavin: the station registered; `warpieces/yavin.js`; the director’s
  `counter`; no boarding in a war battle.
- `galaxy-setpieces-check.mjs` gains Yavin and the Scarif arrival.

## Parts 9 and 10: fleet command

After #793’s arcs and courses (part 9) and its ledger and #746’s
`wire2.js` (part 10).

- `universe/battleCommand.js` (pure): stances on the shared clock, focus,
  the five abilities and cooldowns, squadrons and their orders.
- `galaxy/commandCam.js`, `CommandHud.jsx`, the keys, the drop into a
  fighter and back.
- `online/fleetWire.js`: the `cmd` order log, seat claims; outcomes in the
  ledger; the scenario test of arrival order.

## Part 11: the universe map’s wars

- The front’s tactics and difficulty, the side picker restored from
  `5ceb67ac^`, the respawn behind your line; one front per ready war; the
  pickups and the heal; shared online; gen3d requests for the sixteen
  kinds once the runner is healthy.
