# Kashyyyk's battle and Rick's portal jump: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On Kashyyyk's beach the Republic (clones and Wookiees) and the Separatists (B1s and B2s) fight a battle that never ends, with rigged soldiers who carry guns and think for themselves. Rick's cruiser goes through a real 3D portal on the universe map and in the galaxy: you see it fly into the gate and out of the next one.

**Handoff:** `docs/superpowers/plans/2026-10-06-kashyyyk-troops-and-portal-handoff.md` (the owner's words, the diagnosis and the outline this plan follows).

**Architecture:** The fight's rules are a pure, seeded module (`surface/skirmish.js`), tested in Node, in the style of `missions/assault.js`. A scene part (`surface/skirmishScene.js`) draws it the way `missions/assaultScene.js` draws an assault. A site opts in with `site.skirmish`. The soldiers are the Meshy-rigged Battlefront models already in `public/models/galaxy/troops/`, loaded once a kind and copied (SkeletonUtils) for each soldier, walking on Rick's clips plus six combat clips. The jump is a shared 3D gate (`lib/three/portalGate.js`) that both maps open in front of the cruiser and at its arrival point. The page overlay gets a "staged" mode that stays clear while the ship goes in and opens back up while it comes out.

**Tech stack:** React 19, Vite 8, three.js, Vitest 5 (plain Node, no DOM), Playwright with the container's Chromium for captures.

## Global constraints

- No API keys: no new models. Everything uses what is in the repo.
- Lint (`npx eslint .`), tests (`npx vitest run`) and the build (`npx vite build`) clean before the push.
- Gun kinds go in the middle of `GUNS` (another branch adds at the end).
- A figure whose model never loads still fights (as a built figure or nothing) without throwing.
- Reduced motion: the portal jump falls back to the overlay as it is today. The battle still runs, without camera shake.

## Review focus

- The rules must stay deterministic for a seed and never produce NaN positions over ten minutes of play.
- Line of sight respects heights: a 1.25 m barricade hides a kneeling soldier and lets a standing one fire over it.
- At most three enemies fire at you at once.
- Shared figures: copies share geometry and materials. Nothing per soldier may write to a shared material.
- The jump's clipping planes must be removed and the ship's own materials put back, even when the jump is cut short (page left, reduced motion, Interdictor).

---

### Task 1: The soldiers' figures

**Files:** `src/components/galaxy/surface/crew.js`, `crew.test.js`, `src/components/universe/footScene.js` (one export)

- [ ] `CREW` gains `clone`, `battledroid`, `superdroid`, `stormtrooper`, `snowtrooper`, `hothtrooper`, `sandtrooper`, `scouttrooper`, `shoretrooper`, `deathtrooper` (`/models/galaxy/troops/<kind>.glb`, their real heights) and `wookiee` (chewie.glb, 2.2 m).
- [ ] Rigged crew load once a URL (template), each figure a SkeletonUtils copy rigged with Rick's idle, walk and run (`footScene.js` exports `rigCopy`).
- [ ] `combatClips()` loads the six `clip-*.glb` once; each figure retargets them from the clip file's own hips height.
- [ ] A figure gets `pose(name)` (`kneel`, `taunt`, `hit`, `die`, `dieFwd`, `dieBlown`, or null) layered over the locomotion weights.
- [ ] Tests: every troop kind has a file on disk and a height; `fileOf`; `variety(i)` gives the Wookiees a spread of sizes.

### Task 2: Guns

**Files:** `src/components/universe/gunplay.js`, `gunplay.test.js`

- [ ] `dc15` (the clone's DC-15A), `e5` (the droids' E-5) and `wrist` (the B2's wrist blasters, built along the forearm) in the middle of `GUNS`, each with a muzzle, and a fore-end where it has one.
- [ ] Tests: each builds with a muzzle in front of the grip.

### Task 3: The rules (`surface/skirmish.js`)

**Files:** create `src/components/galaxy/surface/skirmish.js`, `skirmish.test.js`

- [ ] `UNITS`: per kind numbers (hp, range, burst, rate, magazine, reload, accuracy near and far, damage, cover use, bravery, speed, and the kind's habits: `flank`, `charge`, `stopToShoot`, `advanceFiring`).
- [ ] `lineOfSight(solids, from, to)` with heights (a solid's `top`, ignoring ones with a `base`).
- [ ] `coverSpots(solids, field)`: spots along low walls and round rocks and trunks, made once.
- [ ] `newSkirmish(spec, { n, seed, solids, ground })`, `stepSkirmish(b, dt, you, env)` → events (`shot`, `down`, `kill`, `spawn`, `taunt`, `wave`), `hitUnit(b, id, damage, push, by)`, `skirmishView(b)`.
- [ ] Each unit thinks on its own timer: perceives enemies with line of sight; picks a target by distance, by who shot at it and by low health; takes cover from its threat; ducks (kneels) and pops up to fire bursts; reloads; clones flank a target in cover; Wookiees charge and melee at close range and pound their chests after a kill; B1s stop to shoot; B2s walk forward firing; a hurt unit falls back; suppression lowers aim and drives units into cover. Death picks a clip by which way the shot pushed. The Republic comes back one at a time at its spawn, the Separatists in waves out of the lagoon.
- [ ] Tests for each behaviour, plus ten minutes of play with no NaNs and both sides still fighting.

### Task 4: The scene and Kashyyyk

**Files:** create `src/components/galaxy/surface/skirmishScene.js`; modify `surface/scene.js`, `sites/forest.js`, `sites/quests.js`, `props/forest.js`

- [ ] Bodies from Task 1 with guns from Task 2 (`createGunplay`), aimed at the target while standing to fire, the gun kicking on each shot; kneel, flinch, death clips; corpses cleared after a while.
- [ ] Shots between soldiers through `blaster.tracer`, at you through `blaster.enemy` (three at most). Your bolts hit soldiers: the skirmish's targets join `shootable()` and `struck()` sends hits to it. A droid you kill counts for `beachhead` (`kill` with tag `lagoondroids`).
- [ ] Kashyyyk: `skirmish` (sides, field, spawns, cover), the beach's wandering clones, B1s and B2s gone from `life`, the barricade's solid gets `top: 1.25`, crates, rocks and logs between the water and the barricades. The beachhead quest's own droids give way to the battle's.

### Task 5: The portal jump

**Files:** create `src/lib/three/portalGate.js`; modify `components/jumps/timing.js`, `timing.test.js`, `styles.js`, `PortalJump.jsx`, `App.jsx`, `pages/Galaxy.jsx`, `universe/scene.js`, `galaxy/scene.js`

- [ ] `portalGate.js`: `createGateFx({ parent })` → `open({ at, normal, radius })` a disc of the show's goo facing along the flight line (settles on opening, a lip glow, motes), `clip(object, gate, side)` clips an object's materials at the gate's plane (cloned, put back by the handle), `shut()` pinches it with a flash. Pure timing (`gateAt(t)`) tested in Node.
- [ ] `jumps/timing.js`: `stagedAt(t)`: clear until 0.95 s, the goo wiping in from the centre by `T.jump`, the vortex until `T.tunnel`, then a hole opening outward. Tested.
- [ ] `jumpEvent(style, { staged })`, App passes `staged` to the jump, `PortalJump` uses `stagedAt` when staged.
- [ ] Universe map: the cruiser's jump fires a green bolt, opens a gate ahead, flies in while the camera holds back; at the flash it parks, the exit gate opens behind it, and it flies out nose first under a short camera shot from the side that blends back to the chase view; the gate pinches shut.
- [ ] Galaxy: `Galaxy.jsx` dispatches `jumpEvent(crew?.jump, { staged })` at `spool`; `jumpFrame` opens the gate ahead in `spool` and the exit gate in `exit`, the same way.

### Task 6: Check it and ship it

- [ ] Playwright (container Chromium, SwiftShader): Kashyyyk from above and at eye level, a motion capture of soldiers taking cover, firing and falling; the universe map's cruiser jump and the galaxy's, frame by frame.
- [ ] Full tests, lint, build. Commit and push to `claude/festive-meitner-ctyhqf`.
