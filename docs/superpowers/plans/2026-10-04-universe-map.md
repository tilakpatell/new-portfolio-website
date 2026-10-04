# Universe Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/universe/:id?` page where the nine fandoms are planets in one 3D scene you fly between, with an SVG mini-map as Home's teaser and the 3D-off fallback.

**Architecture:** Pure data and math (`universes.js`, `layout.js`, `flight.js`) are unit-tested in Node. One `useScene` scene module (`scene.js` + `planets.js`) draws the map and moves DOM labels through refs. The URL is the only selection state (`navigate(…, { replace: true })`). Cards move unchanged into `cards.jsx` and are shown in the panel.

**Tech Stack:** React 19, react-router-dom 7 (HashRouter), three 0.180, Vitest 3, Tailwind + `src/styles/extras.css`.

**Spec:** `docs/superpowers/specs/2026-10-04-universe-map-design.md`

> Execution note: the user asked for terse work and no checkpoints. Pure modules and tests are given in full; the procedural planet art (Task 5) is specified by parameters, not pasted twice.

## Global Constraints

- One WebGL context for the map; the jump's App-level context is separate and the map stops drawing when the jump or dive starts.
- Desktop budget: under 120 draw calls, under 300k triangles, under 24 MB of textures (`renderer.info`).
- Canvas textures 512 px or less. No bloom pass, no purple nebula gradients.
- Camera ease: exponential ease-out (`easeOut` from `lib/three/renderer.js`), no spring. Dive 600 ms ease-in.
- Star Wars Enter: `tp:hyperspace`, navigate at 1250 ms. Others: dive then navigate. Reduced motion or 3D off: navigate at once.
- Selecting replaces the URL; Escape replaces with `/universe`.
- Every `accent` reaches 4.5:1 on `#03040a`.
- 3D first: the box shows `data-gl="loading"` while loading, never the SVG; SVG only when 3D is off, failed, slow or lost.
- Labels: rendered once by React, moved by the scene (`style.transform`), no per-frame React state.
- Copy style: plain sentences, no em-dash stacks; match the site's voice.

## Review Focus

1. Click B while flying to A: the flight restarts from the current pose, no snap. → `flight.test.js` "retargets mid-flight".
2. Deep link `/universe/marvel` on a cold load: the scene opens at Marvel's pose, no flight from the overview. → `flight.test.js` "initial pose".
3. Odd ids (`STARWARS`, `__proto__`, `constructor`, empty): `parseId` returns a real id or `null`, never a prototype key. → `layout.test.js`.
4. Phone rotation 390×844 ↔ 844×390 and desktop panel: overview fits both. → `flight.test.js` projection cases.
5. Enter pressed twice, or leaving during the dive: one navigation, timers cleared on unmount. → `enterPlan` test + cleanup in `Universe.jsx`.

---

### Task 1: Data, layout and flight (pure)

**Files:**
- Create: `src/components/universe/universes.js`, `layout.js`, `flight.js`
- Create tests: `src/components/universe/universes.test.js`, `layout.test.js`, `flight.test.js`
- Modify: `src/components/worlds/worlds.js` (derive `WORLDS`)

**Interfaces (produced):**
- `UNIVERSES: Array<{ id, label, world: string|null, to, swatch, accent, size, palette: { base, dark, light, glow } }>` in map order: starwars, music, middleearth, transformers, marvel, breakingbad, office, gaming, travel.
- `byId(id) → universe|undefined`, `byPath(pathname) → universe|undefined`
- `contrast(hexA, hexB) → number`
- `layout.js`: `ORDER: string[]`, `POSITIONS: Record<id, [x,y,z]>`, `REACH: Record<id, number>`, `MAP_RADIUS: number`, `next(id|null)`, `prev(id|null)`, `parseId(param) → id|null`, `nextWorld(id) → universe`, `keyStep(key, id|null) → id|null|undefined` (undefined = not ours)
- `flight.js`: `FOV`, `cover({ w, h, phone, panel, sheet }) → { x, y, w, h, sx, sy }`, `cameraFrom(pose) → { position:[x,y,z], target:[x,y,z] }`, `project(point, pose, size, shift) → [x, y, depth]`, `overviewPose(size, rect) → pose`, `focusPose(id, yaw, size, rect) → pose`, `worldPos(id, yaw) → [x,y,z]`, `startFlight(from, to, now, dur?) → flight`, `poseAt(flight, now) → { pose, done }`, `enterPlan(universe, { reduced, three }) → { mode: 'jump'|'dive'|'now', delay }`
- `pose = { target: [x,y,z], dist, pitch }`

- [ ] Write the three test files (below), run `npx vitest run src/components/universe` → FAIL (modules missing).
- [ ] Implement the three modules and the `worlds.js` derivation; run → PASS.
- [ ] `npm run lint`, commit.

`universes.test.js` checks: nine unique ids; every `to` matches a `<Route path>` parsed from `src/App.jsx` with `matchPath`; `/projects/gameboy-emulator` id exists in `data/projects.js`; every accent ≥ 4.5 on `#03040a`; `WORLDS` equals the seven universes with a `world`, in map order.
`layout.test.js` checks: centres are farther apart than `REACH[a] + REACH[b]`; all within `MAP_RADIUS`; `next`/`prev` wrap and handle `null`; `parseId` for valid, upper-case, `__proto__`, `constructor`, `''`, `undefined`; `nextWorld('music')` skips gaming/travel and wraps to starwars; `keyStep` for arrows, Home, End, others.
`flight.test.js` checks: `poseAt` at t=0 equals `from`, at end equals `to`, target distance monotonic; retarget mid-flight starts at the current pose; overview at 1440×900 with a 400 px panel, 390×844 with a 46% sheet and 844×390 projects every planet (± its reach) inside the uncovered rect for yaw 0, 1, 2.5; `focusPose` puts the planet at the uncovered rect's centre; `enterPlan` cases.

### Task 2: Cards into `cards.jsx`

**Files:** Create `src/components/interests/cards.jsx`; modify `src/components/interests/Interests.jsx`.

**Produces:** `CARDS: Record<universeId, Component>` (MusicCard imported from its own file), `Card` stays internal. Card bodies move verbatim.

- [ ] Move `Card`, the eight card functions, `Tile`, `eggsFound` and their imports; export `CARDS`.
- [ ] `Interests.jsx` renders `ORDER.map((id) => { const C = CARDS[id]; return <C key={id} />; })` (unchanged output for now).
- [ ] `npm run lint && npm test && npx vite build`, commit.

### Task 3: SVG mini-map and Home teaser

**Files:** Create `src/components/universe/MiniMap.jsx`, `src/components/universe/universe.css`; modify `Interests.jsx`.

**Interfaces:** `<MiniMap selected?: id|null onSelect?: (id) => void linkTo?: (id) => string className? />`. Projects `POSITIONS` with a fixed tilt (y scale 0.42) into a 600×300 viewBox: orbit ellipses for each radius, a dot per universe in `swatch`, JetBrains Mono labels. With `onSelect` the dots are `<button>`s in a roving group (`keyStep`); with `linkTo` they are `<Link>`s.

- [ ] Home: replace the arrows and `.fun-row` with `<MiniMap linkTo={(id) => `/universe/${id}`} />` and `<Link to="/universe" className="btn btn-primary">Open the universe</Link>`; keep title, lead, dock.
- [ ] Lint/test/build, commit.

### Task 4: The page shell (works with the SVG map)

**Files:** Create `src/pages/Universe.jsx`, `src/components/universe/UniversePanel.jsx`; modify `src/App.jsx`.

- [ ] `App.jsx`: lazy `Universe`; `<Route path="/universe/:id?" …>`; page key `pathname.startsWith('/universe') ? '/universe' : pathname` for the `page-enter` div and `ErrorBoundary`; no Footer on `/universe`.
- [ ] `Universe.jsx`: `.dark-scope universe-page` at `100svh`, background `#03040a`, inline `--accent/--accent-text/--btn-bg` from the selected accent. `selected = parseId(useParams().id)`; `select(id)` → `navigate(id ? /universe/id : /universe, { replace: true })`. Escape handler on the root (skip if `defaultPrevented` or an `[aria-modal="true"]` exists). Enter via `enterPlan`; timers in a ref, cleared on unmount, a second press ignored.
- [ ] `UniversePanel.jsx`: `<aside>` (bottom sheet on phones, `max-height: 46svh`, scrolls inside): label, previous/next buttons, **Enter the world** button, `<ul className="universe-card"><C /></ul>`. With none selected: a short intro line.
- [ ] Browser check (headless): select, URL, Back, Escape, Enter for Star Wars and Office. Commit.

### Task 5: The 3D map

**Files:** Create `src/components/universe/planets.js`, `scene.js`, `UniverseMap.jsx`; modify `Universe.jsx`, `universe.css`.

**Scene contract:** `create(canvas, ctx)` with props `{ selected, labels, cover, onPick, onHover }` returns `{ resize, render, update, setVisible, lowerQuality, dive(id) → ms, dispose }`.
**planets.js:** `buildPlanet(u, THREE, { lowQuality }) → { group, pick, update(ms, t), glow? }`, one shared `paint(size, fn) → CanvasTexture` (≤512). Matte `MeshStandardMaterial` (roughness 0.9), key light upper left + soft rim (a back-facing fresnel shell, one per planet, additive, low alpha). Signatures:
  - starwars: grey panelled sphere with the superlaser dish (darker disc + rim), trench band; Alderaan moon (blue-green, small).
  - music: saffron sphere; 6 thin `RingGeometry`/line strings at slight tilts (sitar strings), plucked wobble on select.
  - middleearth: green-gold banded sphere; gold torus Ring orbiting, inscription glow texture on the torus.
  - transformers: metal-panel texture (grid of plates), seams emissive cyan-violet.
  - marvel: gold sphere banded red; six small emissive Stone moons (space blue, mind yellow, reality red, power purple, time green, soul orange), instanced.
  - breakingbad: sand desert sphere with mesa streaks; blue crystal moons (`OctahedronGeometry`, emissive), 4 element tiles (planes with Br/Ba canvas text) orbiting.
  - office: paper-white sphere with ruled blue lines and a red margin; mug moon (cylinder + torus handle).
  - gaming: voxel sphere (instanced boxes on a low-res sphere lattice) in four Game Boy greens.
  - travel: Earth (procedural blue + land blobs) with 3–5 accent arcs (`TubeGeometry` thin) lifted off the surface.
- [ ] Scene: starfield `Points` (2500, 900 on `lowerQuality`), the nine planets in a `map` group (rotation.y = yaw), raycast on `pick` spheres, drag to yaw (6 px threshold, pitch fixed), `cover` → `setViewOffset` shift, flight with `poseAt`, labels `transform` + `data-behind` each drawn frame, reduced motion = cut and still. Stops asking for frames when idle (flight done, no orbits in reduced/low).
- [ ] `UniverseMap.jsx`: `useScene(load, { id: 'universe', props })`, renders the nine label buttons (roving, `ref` map), the `MiniMap` when `!meant`.
- [ ] Headless Chromium + Metal check at 1440×900 and 390×844: screenshot overview, Marvel, Office; `renderer.info` counts; console clean. Commit.

### Task 6: Ways in

**Files:** Modify `src/components/worlds/WorldSwitcher.jsx`, `src/pages/Travel.jsx`, `src/components/CommandPalette.jsx`, `src/components/Guide.jsx`.

- [ ] `WorldSwitcher`: `useLocation` → `byPath`; links **Universe map** (`/universe/<id>`) and **Next universe: <world>** (`nextWorld`).
- [ ] Travel: quiet `Universe map` link near the end of the page.
- [ ] ⌘K: `{ id: 'w-uni', group: 'Easter eggs', label: 'The universe map', keywords: 'universe map planets worlds fandoms', run: go('/universe') }`. Guide: `'/universe'` tips (pick, keys, Enter).
- [ ] Lint/test/build, browser hop from every world page back through **Universe map**. Commit.

### Task 7: Verify

- [ ] `npm run lint && npm test && npx vite build`.
- [ ] Headless browser: desktop + phone, 3D on/off, each universe selected and entered, keyboard only, ⌘K, Home teaser. Screenshots + renderer counts in the report.
