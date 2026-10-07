# Invincible world, part 2: seen, alive, with a story — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/invincible`'s city is legible at a glance, its bugs are gone, its people and villains have brains, and a season of seven missions and a radio of side calls gives the player something to do next, with one cohesive cast of models.

**Architecture:** New pure, tested modules in `src/components/invincible/world/` (`hud.js`, `brains.js`, `companions.js`, `foes.js`, `missions.js`), the drawing in the existing `npcs.js`, `challenges.js`, `scene.js` and a new `villains.js`, the HUD in `InvWorld.jsx` (its HUD split out to `InvHud.jsx`). The cast is remade on one Meshy pipeline with one style line and one material pass. Each task is one pull request, merged when green.

**Tech Stack:** React 19, three r186, Vitest, the HQ engine (`avengers/hq/engine.js`), `lib/three/rig.js`, `lib/three/facade.js`, `lib/seeded.js`, Playwright on the bundled Chromium, Meshy (`scripts/meshy-invincible.mjs`), the PC's gen3d runner (GitHub issues labelled `gen3d`).

**Spec:** `docs/superpowers/specs/2026-10-07-invincible-world-2-design.md`

## Global Constraints

- Metres, y up, ground 0 in town; `+z` south; fixed steps of 1/120 s in `flight.js`; `dt` clamped to 0.05 s in `InvWorld`.
- Rules in pure modules, tests first; drawing never imported by a rules module.
- Nothing fetched at runtime; models committed under `public/models/invincible/`, credited in `src/data/modelCredits.json`; never print or commit a key.
- Style line for every figure prompt: “in the style of a modern American animated superhero series: clean cel shading, flat bold colours, strong simple shapes, matte surfaces, no photorealism; full body, A-pose, plain grey background”. Figures ≤ 30 k triangles, 2 K atlas plus `-sm` 1 K; props ≤ 15 k, 1 K.
- Low tier stays within 1.5 M triangles in town; figures posed only within 260 m.
- The HUD's accent is `#f5c518`. British spelling, curly quotes, plain sentences; comments say why. Dialogue is the site's own.
- Before every merge: `npm run lint`, `npm test`, `npm run build`, and the shots with no console errors.
- Commit messages: one plain sentence; no model identifiers.

## Review Focus

1. A tab hidden for a minute: `stepQuests`, `stepFoes`, `stepBrain` and `stepEve` get one 0.05 s step, not one 60 s step; nothing jumps or NaNs (Task 1 tests each with `dt = 60`).
2. A corrupt or stale save (`tp-inv-world-at` inside a tower, `tp-inv-world-story` with an unknown id): the world starts at the spawn and the story at episode 1 (Task 1, Task 8).
3. A mission abandoned mid-fight: foes, markers, the thrown car and the quake rings are cleared; the radio resumes after 60 s (Task 9 test on `feedMission` with `abandon`, and a browser check).
4. A thrown car or a quake ring reaching a crowd: they `flee`, never clip through a building (Task 5: `flee` keeps to pavement lines).
5. A Meshy figure whose skeleton the rig cannot pose: `figure()` throws with the file's name and the missing bone; the scene falls back to the kit figure for that role instead of a T-pose (Task 4).

---

### Task 1: The sweep, the metrics and one clock for the time of day

**Files:**
- Modify: `scripts/inv-world-check.mjs` (add `--metrics`, new shots `bank chase seismic maulers eveescort dadlesson gdasiege photo` as stubs that frame the places for now)
- Modify: `src/components/invincible/world/InvWorld.jsx` (time of day as one state; the saved-position check)
- Modify: `src/components/invincible/world/quests.js`, `fight.js` (clamp `dt` to 0.05)
- Test: `src/components/invincible/world/quests.test.js`, `fight.test.js`, `flight.test.js`, `map.test.js`

**Interfaces:**
- Produces: `node scripts/inv-world-check.mjs --metrics <shots…>` prints `name band=<0..1> mark=<0..1>` per shot. `isSafeStart(world, at) → boolean` exported from `map.js` (true when `at` is on open ground within `WORLD.half` and under 9,000 m).

- [ ] Run every existing shot: `OUT=/tmp/shots node scripts/inv-world-check.mjs` (all names). Note every console error and every wrong frame in the hand-off's new “Sweep, 2026-10-07” list.
- [ ] Tests, then fixes: `stepQuests` with `dt = 60` advances `nextCall` by at most 0.05; `stepFight` with `dt = 60` moves no Flaxan more than `FIGHT.speed * 0.05`; `isSafeStart` rejects a point inside a building, under the land, outside `WORLD.half`, or above 9,000 m, and accepts `SPAWN`; a boost dive into the river ends at the water's surface with a `splash` event (`flight.js`: `waterAt` at the landing point → `splash {speed}` instead of `slam`).
- [ ] `InvWorld.jsx`: `time` is one `useState`; an effect calls `api.setTime(time)`; the dev hook exposes `setTime` that sets the state. The time chip and the scene can no longer differ.
- [ ] `--metrics`: `page.screenshot` → PNG → luminance of the middle band (rows 35–75 %) and Mark's box (project `sim.h.p` through the camera; 60×90 px) against its 20 px ring. Print both. Record the numbers for `spawn street downtown streetnight high porch` in the hand-off as the “before”.
- [ ] Work through section 2's list; each failing item gets its fix in this task and a line in the hand-off.
- [ ] `npm run lint && npm test && npm run build`; commit; pull request; merge.

### Task 2: Seeing Mark and the city

**Files:**
- Modify: `src/components/invincible/world/scene.js` (`LOOK`, the camera's hover distance, the follow spotlight, fog from the sky), `people.js` (`castMaterial(mesh, { rim })`), `city.js` (noon window tone), `ground.js` (street widths at distance, river and coast edge), `landmarks.js` (the five beacons)
- Test: none new (drawing); the metrics are the check.

**Interfaces:**
- Consumes: `--metrics` from Task 1.
- Produces: `castMaterial(mesh, { rim = 0.35 } = {})` in `people.js`: sets roughness 0.78, metalness 0, envMapIntensity 0.2, and an `onBeforeCompile` Fresnel rim whose strength is the uniform `uRim`; returns `{ setRim(k) }`. `scene.setTime` sets `uRim` 0.35 noon, 0.5 dusk, 0.7 night. `scene` exports nothing new.

- [ ] `castMaterial` applied to Mark, Omni-Man, Thragg and every kit person; the spotlight (`THREE.SpotLight`, range 12, angle 0.5, penumbra 0.6; intensity 0 / 6 / 14 by time) parented to the camera rig, target Mark's chest.
- [ ] The camera at hover and standing: distance 5.2 m, aim 0.35 of the screen height above his feet.
- [ ] `LOOK.noon`: `sun: 4.2, fill: 0.3, env: 1.15`; windows at noon a lighter pane with 0.25 reflection (`city.js`'s facade uniforms); dusk and night window light +20 %.
- [ ] Fog colour sampled from the sky's horizon per time (`engine.setSky` gives the sky texture; read one pixel row at the horizon once, average it).
- [ ] From height: `ground.js` line widths scale with camera distance up to 2×; a 1 px bright edge on river and coast; `landmarks.js` beacons (400 m, additive, faint at noon, bright at night) over the five places.
- [ ] `node scripts/inv-world-check.mjs --metrics spawn street downtown streetnight high porch`: band 0.30–0.65 at noon, 0.12–0.35 at night, Mark ≥ 0.18 everywhere. Tune until they pass; put the “after” numbers in the hand-off beside the “before”.
- [ ] Lint, test, build; commit; pull request; merge.

### Task 3: The HUD

**Files:**
- Create: `src/components/invincible/world/hud.js`, `hud.test.js`, `InvHud.jsx`
- Modify: `InvWorld.jsx` (renders `InvHud`; passes it `{ hero, time, zone, objective, marks, width, moved, missionOn }`), `world.css`

**Interfaces:**
- Produces: `layoutCompass(marks, width) → [{ id, x, row, clipped, side }]` (`marks`: `[{ id, label, bearing }]`, `bearing` in radians relative to the camera; `x` in px from the strip's left; `row` 0 or 1; marks within 72 px stack to row 1; no label within the right-hand 220 px: it is `clipped` with `side: 'right'`; off the strip: `clipped` with `side`). `titleMode(t, movedAt, missionOn) → 'full' | 'chip'` (chip 2.5 s after `movedAt`, or when `missionOn`). `objectiveText(step, dist) → string` (metres under 1,000, else `x.x km`). `markerSize(dist, height) → px` (min 24).
- Consumes: nothing new from the scene yet; `objective` is `null` until Task 9.

- [ ] Tests for the four functions with the spec's numbers (two marks 60 px apart: one on row 1; a mark at x = width − 100: clipped right; `titleMode(3, 0, false) === 'chip'`; `objectiveText(s, 1234) === '1.2 km'`; `markerSize(5000, 540) === 24`).
- [ ] `InvHud.jsx`: the chip title, the one `Menu` button (time, controls, players, Think, Mark!), the time chip, the compass from `layoutCompass`, the objective line, the minimap at 200 / 140 px with a route, speed with the zone. `InvWorld.jsx` loses its HUD JSX.
- [ ] Shots `spawn street porch`: no label under a button, the title a chip after a move. Lint, test, build; commit; pull request; merge.

### Task 4: The cast, one look

**Files:**
- Modify: `scripts/meshy-invincible.mjs` (`STYLE`, `ASSETS` for every name in spec section 8, props without `rig`), `scripts/meshy-invincible-tasks.json`
- Create: `scripts/inv-cast-sheet.mjs`, `src/components/invincible/cast.test.js`, `docs/gen3d/invincible/cast-sheet.webp`
- Modify: `src/components/invincible/cast.js` (every figure and prop), `people.js` (a kit person falls back when a model is missing or cannot be posed), `src/data/modelCredits.json`, `CREDITS.md`

**Interfaces:**
- Produces: `CAST = { mark, omni, thragg, eve, cecil, debbie, allen, mauler, seismic, civA, civB, civC, bank, heli, truck }`, each `{ file, h, rig: true | false, credit }`. `loadCast(names) → { [name]: template }` in `cast.js` (loads with `lib/models`, applies `castMaterial`). `figure(template, spec)` throws `Error('<file>: no bone <name>')` when the rig cannot pose it; `people.js`'s `personFor(kind)` catches it and returns the kit figure.

- [ ] `cast.test.js`: every `CAST` file exists under `public/models/invincible/`; every entry has `h` and a credit in `modelCredits.json`; every name `npcs.js`, `companions.js`, `villains.js` and `missions.js` use is in `CAST` (grep the sources for `CAST.`).
- [ ] `STYLE` and the prompts (described, not named; Omni-Man: a tall, broad man in a white suit with red trim, a red cape and a thick black moustache; and so on for each). Run `images`, look at the four-view images, redo any wrong one (delete its task id). Then `models`, `rig` (figures only), `fetch`. Commit the GLBs and the credits as they land, one commit per batch, each with the credits spent in its message.
- [ ] A figure wrong twice on Meshy: open a GitHub issue labelled `gen3d` (title the name; body `what:` and `image:` the best Meshy view) for the PC's runner; merge its pull request when it comes; carry on with the rest meanwhile.
- [ ] `scripts/inv-cast-sheet.mjs` (after `scripts/glb-shot.mjs`): every entry at one scale, one light, four views, one sheet. Judge it: line weight, saturation, heights. Remake what stands out.
- [ ] Wire: Mark, Omni-Man and Thragg replaced in `scene.js`; Eve, Cecil, Debbie, Allen in `npcs.js` and `scene.js` (space); the townspeople in `npcs.js` from `civA..C` by seed; old `omni-man.glb` and `thragg.glb` deleted; Sketchfab credits for them removed.
- [ ] Shots `spawn porch gda eve allen thragg`; lint, test, build; commit; pull request; merge.

### Task 5: The crowd's brains

**Files:**
- Create: `src/components/invincible/world/brains.js`, `brains.test.js`
- Modify: `npcs.js` (one brain per person; groups; counts by time), `people.js` (`phone`, `run` poses), `scene.js` (passes `sense`), `traffic.js` (cars within 60 m of a fight reverse 3 s)
- Test: `traffic.test.js`

**Interfaces:**
- Produces: `newBrain({ home: [x, z], yaw, group }) → brain`; `stepBrain(brain, sense, dt, r) → brain` (`sense = { hero: [x, y, z], heroMode, heroSpeed, slam: [x, z] | null, hit: [x, z] | null, fight: boolean, won: boolean, time }`; `r()` from `lib/seeded`); `brain = { state, t, home, at, yaw, target, fear, group }`; `poseOf(brain) → 'idle' | 'walk' | 'wave' | 'talk' | 'phone' | 'run'`; `crowdCount(base, time) → n` (1 / 0.7 / 0.35, school steps 0 at night).
- Consumes: `traffic.js`'s `WALK`, `segmentOk`, `walkerAt` for pavement lines.

- [ ] Tests: `wander` stays on a pavement line (`|at − line| ≈ WALK`) and within 20 m of `home`; a `slam` at 30 m → `flee` at 4 m/s away from it for 6 s, then `idle` with `fear > 0`; a hero landed at 10 m → `gather` to 4–8 m facing him, leaves after 12 s; a frightened brain does not `gather`; `won` within 80 m → `cheer` 4 s; `stepBrain` with `dt = 60` moves at most 0.05 s worth; `crowdCount(6, 'night') === 2`.
- [ ] Implement; `npcs.js` steps each brain with the scene's `sense`, poses from `poseOf`, keeps groups within 2 m; `people.js` adds the two poses.
- [ ] `traffic.test.js`: a `scare` with `reverse: true` sends a car backward for 3 s. Implement.
- [ ] Shots `plaza burger school` at noon and night; lint, test, build; commit; pull request; merge.

### Task 6: Eve and Dad

**Files:**
- Create: `companions.js`, `companions.test.js`
- Modify: `npcs.js` (Eve from `stepEve`), `scene.js` (Omni-Man from `stepDad`; Dad on the porch at dusk and night), `InvWorld.jsx` (Eve's and Dad's lines through `say`)

**Interfaces:**
- Produces: `newEve(loop) → eve`; `stepEve(eve, sense, dt) → { eve, ev }` (`sense` = Task 5's plus `lesson`, `mission`, `foes: [[x, y, z]…]`; states `patrol | intercept | escort | fight | talk`; `ev`: `{ type: 'line', who: 'eve', text }`, `{ type: 'eveHit', foe }` every 8 s in `fight`). `newDad() → dad`; `stepDad(dad, sense, dt) → { dad, ev }` (states `watch | lesson | home | spar`; `ev` lines at rings, and `{ type: 'dadAt', i }` at each spar point). `EVE_LINES`, `DAD_LINES` exported from `npcs.js`'s `LINES`.
- Consumes: `foes.js` consumes `eveHit` in Task 7 (a `ko` whose `by` is `'eve'`).

- [ ] Tests: hero still 4 s within 300 m → `intercept` and arrives within 6 m; hero flies off → `escort` 8 m to his left for 40 s then `patrol`; a foe within 400 m → `fight` and an `eveHit` every 8 s; `lesson` on → Dad 50 m behind and 20 m above, one line at each ring, impatience after 90 s; `time === 'dusk'` with no lesson → `home` on the porch; `spar` advances a point when Mark is within 20 m.
- [ ] Implement and wire; shots `eve eveescort dadlesson porch` (dusk); lint, test, build; commit; pull request; merge.

### Task 7: The villains

**Files:**
- Create: `foes.js`, `foes.test.js`, `villains.js`
- Delete: `fight.js`, `fight.test.js` (its tests move into `foes.test.js` unchanged in what they assert), `flaxans.js`
- Modify: `scene.js`, `InvWorld.jsx` (`stepFoes` in place of `stepFight`), `fx.js` (quake ring with a dust skirt; a thrown car's trail), `life.js` (a car taken from the pool for a throw)

**Interfaces:**
- Produces: `KINDS = { flaxan, flaxanElite, mauler, seismic }` with the spec's numbers; `newFoes(seed) → state`; `spawnFoes(state, kind, n, at) → state`; `stepFoes(state, hero, input, dt, world) → { foes: state, ev, push, stun }` (`ev`: `spawn`, `bolt`, `hurt {hp}`, `ko {kind, by}`, `swing`, `throw {car}`, `carHit`, `quake {at}`, `shake`, `down`, `clear`); `portalOpen(state) → boolean`; `foeAt(state) → [[x, y, z]…]`.
- Consumes: Task 6's `eveHit` (`input.eveHit` names a foe to ko with `by: 'eve'`); Task 4's `mauler` and `seismic` models.

- [ ] Move the Flaxan tests; they pass against `stepFoes` with `kind: 'flaxan'`.
- [ ] Tests: an elite takes two `ko` hits' worth of punches and fires three bolts a volley; a Mauler at 2 m swings every 1.4 s for 18 and a push of 10 m; a Mauler at 30 m with Mark 10 m up throws a car at 35 m/s that hurts 22 on a hit and can be punched away; three punches ko a Mauler; Doc Seismic quakes every 6 s with a ring at 30 m/s that knocks a grounded hero down and emits `shake`; five punches ko him; `eveHit` kos the named foe with `by: 'eve'`.
- [ ] Implement `foes.js`; `villains.js` draws each kind (Flaxans as before; Maulers and Doc Seismic from `CAST` on the rig's poses; the thrown car; the portal); `fx.js` ring and trail.
- [ ] Shots `fight maulers seismic`; lint, test, build; commit; pull request; merge.

### Task 8: The missions' rules

**Files:**
- Create: `missions.js`, `missions.test.js`

**Interfaces:**
- Produces: `MISSIONS` (seven story entries and the side entries `chase`, `everace`, `photo1..5`, each per spec section 6); `startMission(id, now) → progress` (`{ id, step, count, t, hp, best }`); `feedMission(progress, event) → { progress, out }`; `nextStory(doneIds) → id | null`; `markerOf(progress, scene) → [x, y, z] | null` (`scene = { npcs: { [id]: [x, y, z] }, foes: [[x, y, z]…], car: [x, y, z] | null }`); `loadStory(saved) → { done: [], best: {} }` tolerant of garbage; `placeOf(id)` for `bank` (on the plaza's east side, its door on open ground).
- Consumes: `quests.js`'s `ring` and `caught` events; `foes.js`'s `ko` and `hurt`; `flight.js`'s `land`/`slam`.

- [ ] Tests: each of the seven missions is walked end to end by feeding events and ends with `done`; `race` fails on `tick` past its time; `protect` fails when `hurt` takes `hp` to 0; `through` needs `speed > 120` at the portal; `escort` fails when Mark is 200 m from Dad for 10 s; `abandon` clears progress; `nextStory([]) === 'ep1'`, `nextStory(['ep1'…'ep6']) === 'ep7'`; `loadStory('garbage')` is empty; every marker is on open ground or in the air (`map.js`'s `near`); every `npc` is in `CAST` and every `kind` in `KINDS`.
- [ ] Implement; lint, test; commit; pull request; merge.

### Task 9: Missions in the world

**Files:**
- Create: `MissionCard.jsx` (start and end cards)
- Modify: `InvWorld.jsx` (the mission loop: events in, `say` and markers out; `tp-inv-world-story`; Cecil's board on E at the GDA listing done and next; Dad on the porch starts ep7; the Think, Mark! result back as `use thinkmark`), `InvHud.jsx` (objective, marker, route), `scene.js` (the 3D chevron, the camera swing, the bank and the truck from `CAST`, the getaway truck driven on the grid), `challenges.js` (students on the school roof for ep3), `Achievements.jsx` (`maulers`, `seismic`, `gda`, `season`), `pages/Invincible.jsx` (Think, Mark! reports its result to the world through a callback prop)

**Interfaces:**
- Consumes: Tasks 3, 6, 7, 8.
- Produces: `window.__INVWORLD__.api.mission(id)` starts one in development; `api.story()` reads progress.

- [ ] Wire each mission: start by giver, the card (2.5 s, the camera's one swing, none under reduced motion), markers from `markerOf`, the end card with time, best and the next episode, `Again`, `Escape`, `Q` to abandon; cleanup on abandon (foes, car, rings, markers).
- [ ] Shots `bank chase seismic maulers gdasiege` driven by `api.mission`; each reaches `done` through the dev hook in the check script (feed the events the way `scripts/galaxy-check.mjs` reaches a mission's end).
- [ ] Lint, test, build; commit; pull request; merge.

### Task 10: The radio

**Files:**
- Modify: `missions.js` (the side entries' timing: `nextRadioCall(state, now)` every 60–120 s when no mission is on and the zone is `city`), `InvWorld.jsx`, `InvHud.jsx` (the radio line), `scene.js` (the chase car on the grid; Eve's race gates; the photo spots' frames; the shutter), `challenges.js`
- Test: `missions.test.js`

**Interfaces:**
- Consumes: Task 6's Eve `escort` (she offers the race), Task 8's engine.

- [ ] Tests: `nextRadioCall` fires nothing while a story mission is on or in space; a `chase` ends `done` on `land` within 12 m ahead of the car, `fail` after 45 s; `photo` needs the sphere, the heading within 20°, and `use photo`.
- [ ] Implement; the HUD hides for the shutter frame; shots `chase photo`; lint, test, build; commit; pull request; merge.

### Task 11: Feel, docs and the hand-off

**Files:**
- Modify: `src/lib/sfx.js` (`stinger`, `crackle`, `shutter`), `InvWorld.jsx` (hit-stop 70 ms, shake by foe size, none under reduced motion), `docs/superpowers/HANDOFF-invincible-world.md`, `docs/architecture.md` (the Invincible section, a few lines), `README.md` (one line)
- Create: `docs/superpowers/shots/2026-10-07-inv-*.webp`

- [ ] Sounds and feel; shots of each mission, the cast sheet, noon and night street with the metrics in the hand-off.
- [ ] Hand-off: done, the credits spent, the metrics before and after, what is left (interiors, ghosts, the runtime move).
- [ ] Lint, test, build; commit; pull request; merge.
