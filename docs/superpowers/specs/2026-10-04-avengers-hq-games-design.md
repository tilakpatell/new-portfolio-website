# Avengers HQ: seven games and the stone heist

Date: 2026-10-04 · Status: approved by Tilak in session (lineup "All 7 + stone heist", no-GPU fallback "keep today's toys", Poly Haven / ambientCG unblocked).

## Intent

The Avengers HQ page (`/avengers`, `src/pages/Avengers.jsx`) walks the compound building by building. Today every building holds a toy: a reactor that brightens, a hammer you hold, one scripted shield throw, a range that never misses, a redacted file, a button that angers Banner, and a Tesseract button. Tilak asked for these to become proper, fun games, robust in features and textures, in Three.js with CC0 textures and models (Poly Haven, ambientCG), in one consistent realistic style.

Success is: a visitor can play each building's game with mouse, keyboard or touch, can lose and retry in seconds, sees a world built from real PBR materials rather than primitives and glow, and is drawn from one game to the next by the stone heist.

## Constraints

- React 18, Vite 5, `three@0.180` (already a dependency), JavaScript like the rest of the repo. No new runtime dependencies.
- Three.js and each game's scene load only when that game is near the viewport and 3D is on (`src/lib/gpu.js`, `use3D`). Devices without a graphics chip keep today's SVG toy with a note and a "turn 3D on anyway" switch.
- CC0 assets only: Poly Haven (textures, HDRIs, models), ambientCG (textures). Nothing stylized (Kenney, Quaternius) in the same scenes. 1K textures (512 for small props), WebP, under about 4 MB per game.
- Rules live apart from rendering and are tested with Vitest, like `trench.js` and `duel.js`: deterministic with a seeded RNG, including a "doing nothing loses" test and a "a sensible player wins" test per game.
- Accessibility: every game is keyboard playable, has a `role="status"` line, respects `prefers-reduced-motion` (no shake, no flashes), and never traps focus or page scroll outside play.
- Performance: draw calls under 300 desktop and 150 mobile, DPR capped at 1.75, bloom only on authored emissives, slow frames drop DPR, then bloom, then fall back to the toy. One WebGL context per game, created near the viewport, disposed when far away, rendered only while visible.

## Art direction

Real places at the compound, lit by Poly Haven HDRIs and built from Poly Haven / ambientCG materials. Marvel colour comes from the heroes' kit, the HUDs and the effects, not from tinted worlds. Each game owns one accent that its HUD and its world signals share:

| Game | Place and light | Accent |
| --- | --- | --- |
| Repulsor Range | The test field at dusk, compound behind | arc-reactor cyan |
| Hold the Lawn | The front lawn at night in a storm | lightning white-blue |
| Ricochet | The training hall: concrete, steel panels, mats | shield red |
| Trick Shot | A pine clearing at misty dawn | Hawkeye purple |
| Infiltration | The operations room's holotable | hologram blue, Widow red for danger |
| Smash Run | Midtown 2012 at sunset, the portal open | gamma green |
| Tesseract Run | The airfield and hangar at golden hour | Tesseract blue |

Heroes, enemies and gadgets are procedural models with named parts and real materials: the shield (painted vibranium, dents), Mjolnir (uru with knotwork, leather grip), the Quinjet (extruded hull, VTOL fans), the bow, Hulk's fists, Ultron sentries, Chitauri soldiers and chariots, training bots. One humanoid factory (named joints, procedural walk / run / hit / fall) serves Chitauri, sentries, training bots, Cap seen from behind, and holotable figures.

## Architecture

```
src/components/avengers/
  hq/                    shared, three.js only inside scene code
    HQGame.jsx           the frame every game sits in: lazy 3D, fallback, overlay states, HUD slot, best score, stone award, pause when hidden
    engine.js            renderer, HDRI environment, tone mapping, bloom, resize, perf watchdog, context loss, diagnostics, dispose
    assets.js            cached loaders: PBR sets, GLB (meshopt), HDRI; procedural fallbacks if a file fails
    materials.js         shared material roles built on the PBR sets
    kit/                 procedural model factories (humanoid, pines, shield, hammer, quinjet, bow, bots…)
    vfx.js               pooled sparks, debris, rings, beams, decals
    feel.js              trauma shake, hitstop, FOV punch, tweens
    rng.js               seeded random (mulberry32, same as trench)
    stones.js            the stone heist store and hook
  <game>/
    rules.js             pure simulation: new…(), step(state, dt, input) → events
    rules.test.js        Vitest
    scene.js             three.js view of the state
    <Game>.jsx           controls, HUD and the overlay copy
public/hq/               processed CC0 assets (tex/, models/, hdri/) and CREDITS.md
scripts/hq-assets.mjs    downloads from Poly Haven / ambientCG and processes with sharp and glTF-Transform
```

A game component steps its rules at a fixed 1/120 s, draws with its scene, and turns events into sound (`src/lib/sfx.js`), haptics, HUD changes and VFX. The DEV build exposes `window.__HQ__[game]` with `state`, `start()`, `setState(name)` and renderer info for browser tests.

## The stone heist

Each game awards an Infinity Stone once, kept in `localStorage` (`tp-hq-stones`): Power (Repulsor Range), Reality (Hold the Lawn), Mind (Ricochet), Soul (Trick Shot and Infiltration together, as Clint and Natasha went to Vormir together), Time (Smash Run, from the Ancient One in 2012), Space (Tesseract Run). The compound map and the rail show which buildings have given up their stone. In Titan, the gauntlet starts with the earned stones set (any stone can still be set by hand, so the snap stays one click away). Earning all six by playing unlocks a new achievement, "Whatever it takes", and Tony's snap: Thanos's army turns to dust instead of half the page.

## The games

Each has a design brief, a core-loop contract and a level plan.

### 1. Repulsor Range (Iron Man, the workshop)

- **Promise:** you are Iron Man holding the test field against drone waves with repulsors and a unibeam fed by the arc reactor.
- **Verbs:** aim and fire (primary); strafe between three hover positions; charge and fire the unibeam.
- **Loop:** Player aims and fires repulsors to destroy drones and sentries before they reach or shoot him, while reactor energy limits fire and telegraphed sentry shots force strafing; kills build the unibeam and combo; damage costs armour, and losing all five ends the run.
- **Enemies:** scout drone (weaves, rams), Ultron sentry (strafes, glows red for 0.9 s, then fires a bolt you strafe out of), missile (fast; shoot it down), Ultron Prime (boss: armoured plates, glowing weak points, a sweeping beam telegraphed across lanes, summons drones).
- **Level plan:** nine waves of 20–35 s: 1 drones only (teach aim), 2 drones and practice discs, 3 first sentry (teach strafe), 4 missiles, 5 mixed, 6 flanking sentries, 7 heavy, 8 swarm, 9 Ultron Prime. Short breather and a F.R.I.D.A.Y. line between waves.
- **Reward:** Power Stone for beating Ultron Prime. Best score kept.

### 2. Hold the Lawn (Thor, the lawn)

- **Promise:** you are Thor in a thunderstorm: hurl Mjolnir, call it back through the Chitauri, bring down lightning.
- **Worthy:** to start, lift Mjolnir: hold, and keep a drifting balance needle in the green until the hammer rises. Failing drops it back; succeeding unlocks the existing "Worthy" achievement.
- **Verbs:** throw (to the aimed point; it flies on through soldiers), recall (it returns to your hand along a straight line, hitting everything on the way), lightning (when charged, strikes the hammer, or the aim point, and chains).
- **Loop:** Player throws and recalls Mjolnir to cut down Chitauri crossing the lawn, while armoured brutes block throws from the front and chariots strafe from the air; kills charge lightning; soldiers reaching the line or bolts hitting cost one of five hearts.
- **Level plan:** seven waves then Cull Obsidian (a heavy who must be hit from behind, by a recall).
- **Reward:** Reality Stone for beating Cull Obsidian.

### 3. Ricochet (Captain America, training)

- **Promise:** clear each training room with the fewest shield throws: it bounces off steel and always comes back.
- **Rules:** top-down plane. Steel walls reflect, padded mats stop the shield, glass breaks once and lets it through, switches open doors, armoured bots need two hits in one throw, a hostage dummy must not be hit. The shield flies until it has bounced six times or hits a mat; if its path passes Cap, he catches it (catch bonus).
- **Loop:** Player aims a throw to knock down every bot in the room within par, while bank angles, mats and hostages constrain the route; under par earns stars, over the limit fails the room.
- **Level plan:** twelve rooms: straight shot, one bank, two banks, mats, glass, patrol bot, switch and door, corner pocket, hostage, chain of five, armoured bot, gauntlet. Every room is tested to have a par solution.
- **Reward:** Mind Stone for clearing room 12. Progress and stars kept.

### 4. Trick Shot (Hawkeye, the range)

- **Promise:** you are Clint on a forest range: draw, read the wind, and loose.
- **Rules:** arrows fly ballistically (gravity, draw-dependent speed, wind drift). Holding a full draw too long makes the aim sway. Targets score by ring (1–10, X). Moving targets slide and swing, clay pigeons arc, drones dodge. Streaks earn trick arrows: explosive (area), EMP (freezes movers), split (three arrows).
- **Loop:** Player draws, aims and looses to hit targets for score within a 60 s round and a quiver, while range, wind and motion make each shot a read; streaks earn trick arrows; a round ends when time or arrows run out.
- **Level plan:** three rounds: static boards 20–50 m with light wind; movers and clays with wind; trick shots over cover with drones.
- **Reward:** Clint's half of the Soul Stone for 1,200 points across the three rounds.

### 5. Infiltration (Black Widow, operations)

- **Promise:** plan Natasha's route through a HYDRA facility on the holotable; every move she makes, the guards make one too.
- **Rules:** a grid, turn by turn. Guards patrol or turn on a schedule and see a cone blocked by walls; ending a turn in sight is caught. Moving into a guard from behind or the side takes it down. Widow's Bite stuns a guard up to two tiles away in a line (limited charges). Lasers switch on and off on a cycle; cameras sweep and can be switched off at terminals. Reach the file, then the exit.
- **Loop:** Player chooses one move per turn to reach the file and exit unseen, while vision cones, lasers and cameras constrain the route; each level cleared declassifies one line of her file; being seen restarts the level instantly.
- **Level plan:** eight levels, introducing in order: patrol, turning guard, takedown, lasers, Widow's Bite, camera and terminal, two guards covering each other, a final level combining all.
- **Reward:** Natasha's half of the Soul Stone for clearing level 8.

### 6. Smash Run (Hulk, the lab)

- **Promise:** Hulk charges down a Midtown street through the Chitauri: smash what's in your lane, leap what you can't.
- **Rules:** three lanes, auto-run that speeds up. Soldiers and barricades can be smashed in a timing window, cars smashed or leapt, craters must be leapt, energy barriers must be avoided, chariot runs paint a lane red before they fire. Smashes fill rage; full rage is HULK SMASH (eight seconds unstoppable). Three hits and Banner is back.
- **Loop:** Player switches lanes, smashes and leaps to run as far as possible, while speed and obstacle combinations rise; rage rewards aggression; a hit costs one of three.
- **Level plan:** a safe first 150 m, then sections that alternate dense and open, introducing one obstacle at a time, then combining them.
- **Reward:** Time Stone at 2,000 m. Best distance kept.

### 7. Tesseract Run (Quinjet, the hangar)

- **Promise:** fly the Quinjet with the Tesseract case slung beneath it, and set it down gently.
- **Rules:** side-on physics: thrust and tilt, gravity, wind gusts, fuel. The case hangs on a cable and swings. Deliver it onto the pad slowly enough; hitting the ground or trees too hard with the jet or the case fails.
- **Loop:** Player balances thrust and tilt to carry the swinging case to the pad, while wind, obstacles and fuel push back; a soft set-down scores on fuel, time and softness; a crash restarts the leg.
- **Level plan:** six legs: a short hop, over the trees, crosswind, under the gantry, gusts over the ridge, and the storm into the hangar.
- **Reward:** Space Stone for the sixth leg, then the existing portal to Thanos.

## Fallback and errors

`HQGame` shows the 3D game when `use3D().on` and the scene starts. If WebGL is missing, off, lost, too slow, or the scene throws, it shows the current SVG toy for that building with one line saying why and a switch to try 3D. Asset files that fail to load fall back to procedural textures, so a missing file never blanks a game.

## Testing

- Vitest for every `rules.js`: start, progress, fail, retry, reward, determinism with a seed, plus the per-game invariants above (every Ricochet room solvable at par; every Infiltration level solvable; a scripted Hulk bot survives the safe opening; a scripted Quinjet controller lands leg 1).
- Playwright in this session: real input on each game in desktop and phone viewports, active-play screenshots, renderer counts from `window.__HQ__`, console free of errors, the toy fallback with 3D off.
- `npm run lint`, `npm test`, `npm run build` before each push.
