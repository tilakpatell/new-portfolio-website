# Albuquerque: grounding, foliage, wheels and matcaps — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish Step 1 (baked grounding), then build Step G (foliage, grass, hex tiling, contact shadow, clean edges), Step 2 (the Aztek on cannon-es) and Step 3 (matcaps) in Albuquerque, on `claude/dazzling-wozniak-fg5evk`, then merge to `main`.

**Architecture:** Shared modules in `src/lib/three/` (`grounding`, `foliage`, `grass`, `contactShadow`, `matcap`, and `hexTile` added to `surface`) and `src/lib/physics/`. Each is a set of pure functions with tests plus shader hooks as chunk swaps with a `customProgramCacheKey`. Albuquerque's `scene.js`, `city.js` and `roads.js` apply them. Offline scripts commit their output.

**Tech Stack:** three r186 (WebGL2, `onBeforeCompile`), Vite 8, Vitest 5, playwright-core with headless Edge or Chromium (SwiftShader) for bakes and QA, and cannon-es 0.20 (the one new dependency).

**Spec:**
- `docs/superpowers/specs/2026-10-06-baked-look-and-toy-physics-design.md` (Steps 1, 2, 3)
- `docs/superpowers/specs/2026-10-06-ground-grass-foliage-design.md` (Step G)

**Status (6 October, evening):**
- A1–A3 are done and merged: Step 1, with its numbers in the first spec's implementation notes.
- G1's and G2's modules (`lib/three/foliage.js`, `lib/three/lod.js`) are built and tested, but not wired into the city yet.
- Next: wire G1 into `city.js` and `scene.js`.
- Ruling for G4: the plan has only one lawn, the park. The spec's front lawns (Walt's and the neighbours') go in `plan.js`'s `houseRow`, chosen by a hash of each house's place, not by the city's seeded random. Drawing from that random would move everything after it.

## Global Constraints

- Comments say why, in plain prose and in the file's voice. Pure logic lives in modules with Vitest tests beside them.
- Shader hooks are chunk swaps with `customProgramCacheKey`; `lib/three/surface.js` is the model.
- Every texture goes through `lib/three/textures.js`. Dispose what you make (`own()`).
- No new dependency beyond `cannon-es`. No runtime calls to asset services.
- `stepCar` and `rules.test.js` stay untouched.
- Commits: one plain sentence, the body says why and gives numbers, the session's attribution footer. Stage specific files only (`git add <files>`). No amend, no rebase, no force-push.
- Push to `claude/dazzling-wozniak-fg5evk`. Merge to `main` at the end (the owner's instruction), then run the full check on `main`.
- Shade colour is `#5a3420`. The mid tier's frame time must not rise in Step G.
- British spelling, curly quotes in prose.

## Review Focus

1. **The bake on Windows paths.** The scripts build paths with `new URL('..', import.meta.url).pathname`, which gives `/C:/...` on Windows. They should use `fileURLToPath`, and they should find a local Edge or Chrome when `/opt/pw-browsers` doesn't exist.
2. **A missing mask.** With Data Saver on the low tier, or a 404 on `index.json`, the world must still draw: floors without masks, blobs still there, no shader errors (Task A2's guard).
3. **Material cache keys.** Two materials with different hooks must never share a program. Every hook adds its own segment to `customProgramCacheKey` (Tasks A2, G1, G3).
4. **The low tier.** No grass, no hex tiling, a blob instead of the contact shadow, and the world still loads with masks off (Task G6).
5. **Physics failing to load.** If `import('cannon-es')` rejects, the car falls back to `stepCar` and the HUD still reads the same state (Task C3).

---

### Task A1: The QA and bake scripts run on Windows

**Files:**
- Modify: `scripts/abq-qa.mjs`
- Modify: `scripts/bake-floor-shadows.mjs`

- [ ] Set `ROOT = fileURLToPath(new URL('..', import.meta.url))`. Import `playwright-core` and `sharp` by name.
- [ ] Browser path, first match wins: `--chromium`, `$CHROME`, `$CHROMIUM`, `/opt/pw-browsers/...`, then the local Edge or Chrome install.
- [ ] `abq-qa.mjs` gains:
  - views `park` (the plan's park block) and `central-slant` (low, down Central at a slant)
  - `--shots-name <prefix>` (default `abq-grounding`)
  - `--frames` stays
- [ ] Verify: `node scripts/abq-qa.mjs --tag smoke --times noon --frames 3` prints a frame line and writes one shot.

### Task A2: Dawn's shadows lifted, the shade tinted warm

**Files:**
- Modify: `src/lib/three/grounding-bake.js`
  - `bakeFloorMask` gains a per-time `lift` (minimum sun elevation in degrees).
  - `liftSun(dir, deg)` is pure and exported.
- Modify: `scripts/bake-floor-shadows.mjs`
  - TIMES: dawn `{ tod: 0.262, channel: 0, lift: 12.8 }`. 12.8° is golden hour's elevation, so dawn's shadows are as long as golden's, mirrored.
- Modify: `src/lib/three/grounding.js`
  - The shade becomes `uShadeTint`: `#5a3420` scaled to luminance 0.75, mixed in by `uShadeMix` 0.4 where unlit.
  - Formula: `outgoingLight *= mix(vec3(1.0), uShadeTint, uShadeMix * (1.0 - min(gSun, gV.y)))`.
  - `shadeTint(color, luminance)` is pure and tested.
- Test: `src/lib/three/grounding.test.js`, extended:
  - `liftSun` keeps the azimuth and raises y to `sin(12.8°)`
  - `shadeTint` has luminance 0.75
  - the fragment swap contains `uShadeTint`
- Output: `public/albuquerque/shadow/*.webp`, rebaked with `npm run bake:abq`, and `index.json`.
- [ ] Verify: Read the dawn and golden QA shots. Shadows should be warm brown, not grey, and should not blanket the town.

### Task A3: Step 1 measured, written up, committed

- [ ] Run `abq-qa` before (a worktree of `origin/main`, served on its own port, `--reuse`) and after (this branch). Use mid tier, the `walt` view, and the same frame count.
- [ ] Append "Implementation notes" to the first spec:
  - every decision in `8087d86`'s body
  - the attribute packing
  - the 2048→1024 shrink
  - the extra no-sun times
  - dawn's lift
  - the shade tint
  - the before and after numbers
- [ ] Commit "Step 1: …" and push.

### Task G1: Foliage that lights as a volume

**Files:**
- Create: `src/lib/three/foliage.js`, with:
  - `spherifyNormals(geometry, { centre, radii, keep = 0.25 })`: pure
  - `wrapLighting(material, { wrap = 0.5, backScatter = 0.25 })`
  - `wind(material, { kind, strength, trunkHz = 0.45, leafHz = 2.6, time })`
  - `canopyLevels(geometry, …)`
  - `wrapShader`, `windShader`: pure
- Test: `src/lib/three/foliage.test.js`:
  - a unit sphere's normals come out radial
  - a flattened one's lean outward
  - `keep` blends toward the original normal
  - the wrap and wind swaps report what they found
- Modify: `city.js` trees:
  - canopies spherified (bounding-box centre and half-extents, `keep 0.2`)
  - `flatShading` off
  - wrap and wind on the leaf material
  - one shared `uTime` from `update(t)`
- Modify: `scene.js`: creosote and yucca spherified per cluster, `wind({ kind: 'shrub' })`.

### Task G2: Trees by distance (near, mid, card)

**Files:**
- Create: `src/lib/three/lod.js`:
  - `lodBands(dist, bands, prev, hysteresis = 0.1)`: pure
  - `createInstancedLod({ levels, items, place })` → `{ meshes, update(camera) }`
  - re-sort every 0.5 s or 20 m
- Test: `src/lib/three/lod.test.js`, hysteresis behaviour:
  - no flip between frames at the boundary
  - a jump of more than 10% switches bands
- Cards: `bakeImpostor` from `avengers/hq/kit/impostor.js` (read its signature first), `alphaToCoverage` with `alphaTest` 0.5. Bands per tier: high 60/140, mid 40/100, low mid-only with cards past 60.

### Task G3: Hex tiling on the roads and lots

**Files:**
- Modify: `src/lib/three/surface.js`, adding:
  - `hexTileShader(shaders, opts, chunks)`: pure
  - `hexTile(material, { patchScale = 2, gamma = 7, contrast = true })`
  - Mikkelsen's three fetches, contrast for colour, derivative blend for the normal
  - mutually exclusive with `antiTile`
- Test: `src/lib/three/surface.test.js`, extended:
  - the map, normal and roughness reads are swapped
  - the cache key differs from `antiTile`'s
- Modify: `roads.js`:
  - `hexTile` on asphalt, concrete and pavers when the tier is high; `antiTile` on mid; neither on low
  - applied before `floorShadow`, because `floorShadow` comes last

### Task G4: Lawns as blades

**Files:**
- Create: `src/lib/three/grass.js`, with:
  - `createGrassField({ patch, perPatch, lods, grows, colours, height, ground, tier, mask })` → `{ group, update(camera, t), stats, dispose }`
  - `bladeHash(i, seed)`, `ringFor(dist, lods)`, `easeIn(x, p)`: pure
- Test: `src/lib/three/grass.test.js`:
  - the hash is in range and deterministic
  - ring choice at the boundaries
  - `grows` filtering
- Modify: `src/lib/three/grounding.js`: export `FLOOR_MASK_GLSL` (the `gRead` snippet) and `floorMaskUniforms(bake)` for the grass.
- Modify: `scene.js`:
  - the field over `CITY.lots` where `surface === 'grass'`
  - base `#4f6e2e`, tip `#a8c25a`, height `[0.18, 0.32]`
  - the mask read at each blade's root

### Task G5: The Aztek's contact shadow

**Files:**
- Create: `src/lib/three/contactShadow.js`: `createContactShadow({ size, resolution, layer, darkness, blur })` → `{ mesh, update(renderer, scene, x, y, z, yaw), dispose }`, after mrdoob's example.
- Modify: `scene.js`:
  - on high (256²) and mid (128²): the Aztek's meshes on layer 1, its blob dropped
  - on low: the blob stays

### Task G6: Edges, tiers, and the measurements

- [ ] `alphaToCoverage: true` on every `alphaTest` material in `albuquerque/` (grep it). Tree cards get it from G2.
- [ ] Tier table: blades per patch high 3,072 / mid 1,200 / low 0; rings high 15/100, mid 12/70.
- [ ] `api.info()` gains `blades` and `patches`.
- [ ] Shots: `docs/superpowers/shots/2026-10-06-abq-foliage-<peek>-{before,after}.webp` at noon and golden, for `walt`, `central-slant` and `park`. Mid tier frame time before and after; reject any regression. Commit "Step G: …" and push.

### Task C1: Toy physics

**Files:**
- `npm i cannon-es`. Read `node_modules/cannon-es/dist/cannon-es.js` for the real `RaycastVehicle`, `World.step` and `Body` API.
- Create: `src/lib/physics/world.js`:
  - `createToyWorld({ gravity = -13 })` → `{ world, step(dt), alpha, materials, dispose }`
  - its own accumulator over `world.step(1/60)`, interpolating its own transforms
- Create: `src/lib/physics/vehicle.js`: `addVehicle(world, spec)` → `{ chassis, vehicle, drive(input, surface, dt), state(out), reset(x, z, yaw), wheelPose(i, out) }`
  - brake as an impulse per step, from `CAR.brake` 28 m/s²
  - forward needs a negative engine force on the spec's axes
- Create: `src/lib/physics/statics.js`, `props.js`, `impacts.js`, with the spec's signatures.
- Test: `src/lib/physics/vehicle.test.js` (Node), the spec's list:
  - reaches and holds top speed
  - coasts to a stop
  - covers the same distance at 1/30 and 1/120
  - climbs a 0.14 m kerb
  - a 0.5 kg prop flies while the car loses under 10% of its speed
  - rights itself within 2 s
  - `yaw 0 → +z`

### Task C2: The Aztek on wheels

**Files:**
- Create: `src/components/albuquerque/world/vehicle.js`: the Aztek's spec and adapter. It returns `{ x, z, yaw, speed, slide, yawRate, bump, slip, surface }`. `stepCar` is the fallback.
- Create: `src/components/albuquerque/world/props.js`: about 60 props (cones, trash cans, newspaper boxes, mailboxes, tyres), plus their meshes and impact sounds through `sounds.js`.
- Modify:
  - `AbqWorld.jsx`: the sim step goes through the adapter
  - `scene.js`: the car follows the chassis, the camera follows x/z only, the faked lean goes
- Commit "Step 2: …" and push.

### Task D1: Matcaps

- `scripts/matcaps.mjs`, `src/lib/three/matcap.js` (`matcapMaterial`, `setMatcapTime`), with tests on the swap.
- Props and the code-built cars switch to matcaps, with `bounce()` on top.
- Commit "Step 3: …" and push.

### Task M: Merge and check

- [ ] Merge the branch into `main` with `--no-ff`.
- [ ] Run, on `main`:
  - `npm run lint`
  - `npm test`
  - `npm run build`
  - `node scripts/autopilot-check.mjs --routes /albuquerque --settle 8000`
- [ ] Fix anything red, then push `main`.
