# Invincible world, part 1: the flyable city — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/invincible` opens on a 3D city you fly about as Invincible: hover, cruise, boost through the sound barrier, slam into the ground.

**Architecture:** Pure, tested rules (`map.js`, `flight.js`) in `src/components/invincible/world/`; drawing split by concern (`ground.js`, `city.js`, `fx.js`, `scene.js`) on the HQ engine; `InvWorld.jsx` runs input, the fixed-step loop and the HUD, mounted at the top of `pages/Invincible.jsx`.

**Tech Stack:** React 19, three r186, Vitest, the repo's HQ engine (`avengers/hq/engine.js`), facade shader (`lib/three/facade.js`), rig (`lib/three/rig.js`).

**Spec:** `docs/superpowers/specs/2026-10-05-invincible-world-design.md`

## Global Constraints

- Metres, y up, ground 0 in town, city centre at the origin; +z is south.
- Flight in fixed steps of 1/120 s.
- Cruise 40 m/s; boost top 260 m/s; `boom` once on crossing 120 m/s, re-armed under 90 m/s; soft landing under 18 m/s, `slam` above; wall hit over 60 m/s is an `impact`, bounce at 1/3 speed; altitude cap 4000 m.
- Nothing downloaded beyond what's in `public/` already; new models in code.
- Comments in the repo's voice: plain sentences saying what a thing is for.

## Review Focus

- Spawn on the Graysons' lawn must not start inside a collider (test in Task 1).
- Very long frames (tab back from hidden): the step loop must clamp dt so he doesn't tunnel through a tower (Task 2 test: one 0.25 s call equals the same path as 30 small ones, and a wall still stops him).
- Flying into the ground at boost speed must not go under it (Task 2 test).
- Leaving the map: he's held inside the world's bound (Task 2 test).
- WebGL missing or lost: the section shows the cards fallback, the page below still works (Task 6, checked by hand).

---

### Task 1: The map (`map.js`)

**Files:** Create `src/components/invincible/world/map.js`, `map.test.js`.

**Produces:**
- `WORLD = { half: 3200, ceiling: 4000 }`; `RIVER = { x0: 1050, x1: 1250 }`; `COAST = 2200` (z beyond is sea); `SUBURB_X = -1700`.
- `groundAt(x, z) → number` (0 in town; rising hills for z < −2300; −2 under water).
- `waterAt(x, z) → boolean`.
- `buildWorld(seed = 11) → { buildings: [{ id, x, z, w, d, h, kind, tone, roof, top, zone }], houses: [{ x, z, yaw, w, d, h, tone }], trees: [[x, z, s]], lamps: [[x, z]], places: [{ id, name, x, z, door: [x, z], face, r }], boxes, grid }`.
- `near(world, x, z, r) → boxes[]` via a 100 m grid hash.
- `PLACES` ids: `home` (the Graysons'), `school`, `burgermart`, `guardians`, `gda`.
- `SPAWN = { x, y, z, face }` on the Graysons' lawn.

- [ ] Tests: no building's footprint touches the river or the sea; `near` returns every box a full scan finds for 50 random points; SPAWN inside no box; every place's door is on open ground (no box within 3 m).
- [ ] Implement; `npx vitest run src/components/invincible/world/map.test.js` passes.

### Task 2: Flying (`flight.js`)

**Files:** Create `src/components/invincible/world/flight.js`, `flight.test.js`.

**Consumes:** `groundAt`, `near`, `WORLD` from Task 1.

**Produces:** `FLY` constants; `newHero({ x, y, z, face }) → hero`; `stepHero(hero, input, dt, world) → hero` where input is `{ x, z, up, down, boost, run, jump, look: [x, y, z] }` (x/z the camera-relative move on the ground plane, `look` the camera's forward for boost) and `hero = { p: [x,y,z], v: [x,y,z], face, mode: 'ground'|'air', crouch, boomed, ev: [] }`. Events: `takeoff`, `boom`, `slam {speed}`, `land`, `impact {speed, at}`.

- [ ] Tests (values from Global Constraints): hover holds still in 2 s; cruise reaches ≥ 38 m/s; boost for 4 s reaches ≥ 240 m/s and emits exactly one `boom`; a building stops him and an over-30 hit emits `impact`; a dive at boost speed lands on the ground (y ≥ ground) with `slam`; held inside `WORLD.half`; one 0.25 s step vs 30 steps of 1/120 end within 1 m.
- [ ] Implement; tests pass.

### Task 3: The land (`ground.js`)

**Files:** Create `src/components/invincible/world/ground.js`.

**Produces:** `buildGround({ small }) → { group, setNight(k), update(t, camPos) }`: a 6.4 km plane whose `onBeforeCompile` paints streets, sidewalks, markings, lots, lawns and parks from world xz (same grid as `map.js`), the hill ring, the river and sea water (Standard material, low roughness, waves in the normal).

- [ ] Build; looks right in a screenshot from 30 m and 1500 m.

### Task 4: The city (`city.js`)

**Files:** Create `src/components/invincible/world/city.js`.

**Produces:** `buildCity(world, { small }) → { group, setNight(k) }`: facade boxes (one draw), roof clutter, suburb houses (walls, hipped roofs, instanced), trees, lamps, bridges.

- [ ] Build; screenshot check.

### Task 5: Effects and Mark (`fx.js`, `scene.js`)

**Files:** Create `fx.js`, `scene.js`.

**Produces:** `createInvWorld(canvas, { onLost, calm }) → { engine, frame(sim, dt), resize(w, h), fx(type, data), setTime('noon'|'dusk'|'night'), dispose(), lost }`. Mark posed per mode (rig `POSES.hover/fly/stride/punch`), Omni-Man hovering over downtown; camera behind, distance and FOV growing with speed, kept out of boxes; vapour cone + shock ring on `boom`; crater decal + dust on `slam`; debris on `impact`; speed lines.

- [ ] Build; screenshot check of hover, boost and a slam.

### Task 6: The page (`InvWorld.jsx`, `world.css`, `pages/Invincible.jsx`)

**Consumes:** Tasks 1, 2, 5.

- [ ] `InvWorld` section at the top of the page with canvas, HUD (title, speed, Mach, altitude, compass, minimap, prompts, controls), keyboard (WASD, Space, C, Shift, E, T time of day), drag-look, touch stick and buttons, gamepad; the cards fallback without 3D; `window.__INVWORLD__` in dev.
- [ ] `npm run lint`, `npm test`, `npx vite build` pass; screenshots in headless Chromium; commit, PR, merge.
