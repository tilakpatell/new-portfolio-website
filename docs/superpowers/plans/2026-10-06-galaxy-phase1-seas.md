# Galaxy Phase 1: Seas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (native, inline: the owner asked for no subagents). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Real seas on the galaxy's surfaces. A camera-following disc of
Gerstner waves, with a swell for each world, shallows and shore foam from
a baked depth map, and waves that shoal and break on the beaches.

**Architecture:** `surface/ocean.js` is pure and tested. It holds the
presets, the wave sets, the CPU heightAt, the depth bake and the disc
rings. `surface/water.js` builds the sea and swamp mesh and shader from
it; lava and cloud keep their plane. `surface/scene.js` changes in one
call and one update line.

**Tech Stack:** three 0.186 (`ShaderMaterial`, `DataTexture`), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-06-galaxy-phases-design.md` (Phase 1).

## Global Constraints

- Budget: `galaxy-check.mjs` with `BUDGET=lab/baseline/surface-merged.json`.
  Each world stays within +10% calls and triangles, never over 600 calls or
  2.5M triangles. Kamino's headroom is about 54k triangles, so the high
  disc stays under 50k triangles.
- No sequel content. Terse comments, in the code's own voice.
- Site files (`sites/*.js`) stay unedited (the foliage lane's). The
  presets live in `SEAS[id]`.
- `scene.js` diff: the `createWater` call and the `water?.update` line only.
- The vertex shader keeps `mvPosition` and three's fog chunks, so
  `skyfog.js` patches it.

## Review Focus

- A world with `water` but no `SEAS` entry (Kashyyyk before this, and any
  future site) still gets a sea from its `kind`. Test: `seaFor('nowhere',
  { kind: 'sea' })` returns the `sea` default.
- The camera moving fast (a speeder) must not make the waves swim. The
  disc centre snaps to the ring step. Test: `snapCentre` is constant
  within one step.
- A deck world (Kamino, `noGround`): the depth bake treats the column and
  the sea floor as depth. Waves must not climb the deck. Test: heightAt's
  amplitude stays under the preset's ceiling.
- The low tier and small screens get a coarser disc. Test: the vertex
  count of `discRings({ small: true })` is under half the high one's.
- Rooms (zones) hide the sea as before (`water.mesh.visible = !z` is
  untouched).

---

### Task 1: `surface/ocean.js`

**Files:** create `src/components/galaxy/surface/ocean.js`,
`src/components/galaxy/surface/ocean.test.js`.

**Produces:**
- `SEAS`: `{ [id]: preset }`.
- `seaFor(id, water) → preset`, where a preset is `{ waves: [[dir, len,
  steep]…], shallow, bed, clarity, caps, shore, breakers, glint, rough }`.
- `wavesFor(preset) → [{ dx, dz, k, c, steep, amp, len }]`.
- `heightAt(x, z, t, waves, depth = Infinity) → y`.
- `damp(depth, preset) → 0..~1.3`.
- `bakeDepth(heightAt, level, { half, n, max }) → { data: Uint8Array,
  half, n, max, at(x, z) }`.
- `discRings({ small }) → { radii: number[], around }`.
- `snapCentre(x, z, step) → [x, z]`.
- `WAVES_GLSL(waves) → string`, which defines `vec3 gerstner(vec2 p,
  float dist, float amp, out vec3 n, out float pinch)`.

- [ ] Write the tests:
  - the steepness of every preset's waves sums under 1;
  - `seaFor` falls back by kind;
  - in deep water, `heightAt` equals the plain Gerstner sum (spot values),
    and it goes to 0 at depth 0;
  - `damp` is 0 on land, peaks above 1 in the shallows, and is 1 in deep
    water;
  - `bakeDepth` reads back the depth at sample points, within one 8-bit
    step;
  - the ring radii rise and the small disc has under half the vertices;
  - `snapCentre` holds still within a step;
  - the GLSL has one block per wave.
- [ ] Run `npx vitest run src/components/galaxy/surface/ocean.test.js`. It
  fails (no module).
- [ ] Implement. The presets:
  - `lagoon` (Scarif): a swell of 60–90 m, chop 9–20 m, shallow
    `#5fe0d2`, bed `#e8dcb0`, clarity 9, breakers 1;
  - `storm` (Kamino): 40–120 m, steepness to 0.14, caps 0.8, slate;
  - `lake` (Naboo): 6–18 m, steepness ≤ 0.04, mirror;
  - `surf` (Kashyyyk): 30–60 m, green-grey, breakers 0.6;
  - `swamp` (Dagobah, Yavin): 3–9 m, steepness ≤ 0.02, murky, no foam.
- [ ] Run the tests. They pass. Commit.

### Task 2: the sea in `surface/water.js`

**Files:** modify `src/components/galaxy/surface/water.js`; test in
`src/components/galaxy/surface/water.test.js` (new).

**Consumes:** Task 1.

**Produces:** `createWater(site, sunDir, sunColor, { heightAt, small, id })
→ { mesh, glow, update(t, camera), depth, height(x, z), dispose }`.

- [ ] Write the tests. They run in Node, with three's classes only:
  - sea and swamp return a mesh whose geometry has the disc's vertex count;
  - lava and clouds keep the plane (four vertices);
  - `update(t, { position })` moves the centre uniform to the snapped
    camera position;
  - `height` is 0 where the depth map says land;
  - the material's vertex shader contains `#include <fog_vertex>`.
- [ ] Run the tests. They fail.
- [ ] Implement:
  - the vertex shader: the disc position plus `uCentre`, depth from
    `uDepth` (8-bit, LinearFilter, mapped over `±half`, deep outside), the
    amplitude damped by depth, `gerstner`, then `vWorld`, `vNormal`,
    `vPinch` and `vDepth`;
  - the fragment shader: noise-texture ripples on the normal; the sky by
    Fresnel (`uZenith` and `uHorizon`); the body from deep to colour to
    shallow to bed by depth and clarity; light through the crests toward
    the sun; the sun's glitter; foam from the pinch (whitecaps,
    `uCaps`), the breaking band (`uBreakers`, crest height in 0.4–2.5 m
    of depth) and swash bands that travel up to the waterline (`uShore`);
  - three's fog chunks.
- [ ] Run the tests. They pass. Commit.

### Task 3: wire into the scene

**Files:** modify `src/components/galaxy/surface/scene.js` (the
`createWater` call at :192 and `water?.update(t)` at :2216).

- [ ] Pass `{ heightAt: grid.heightAt, small, id: site.id ?? id }` and
  `update(t, camera)`. Check how the scene knows the world id.
- [ ] Run `npx vitest run src/components/galaxy` and lint. Commit.

### Task 4: browser proof and budget

- [ ] Use a scratch script: in-process Vite (no HMR) and the cached
  Chromium with `--use-angle=metal`. Shoot Scarif's beach, Kamino's
  platform edge and Naboo's lake, on `main` (before) and on the branch
  (after). Teleport with `__surfaceDo('teleport', x, z)` toward the water.
  Check there are no console errors.
- [ ] Run `galaxy-check.mjs surface scarif,kamino,naboo,kashyyyk,dagobah,yavin`
  with `BUDGET=lab/baseline/surface-merged.json` and the cached Chromium.
- [ ] Run the full suite, lint, build and health. Trial-merge against the
  open branches. Open the PR and merge.
