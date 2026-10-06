# Baked light everywhere: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> The owner chose inline execution with no subagents: superpowers:executing-plans.

**Goal:** Give every walkable world Bruno Simon's grounding: floors with soft sun shadow and
sky occlusion baked on the GPU when the world loads, a bounce tint from the floor, blob
shadows under movers, and no shadow pass.

**Architecture:** There are three parts.
- `bakeFloorTexture` (in `grounding-bake.js`) renders the same mask the offline bake does,
  but keeps it on the GPU with the floor's height packed in.
- `groundWorld` (new `groundwork.js`) wires the kit into a scene in one call: floorShadow,
  bounce, standIn, blobs, the shadow pass off.
- `matcap.js` makes matcaps from the world's own lights for opt-in props.

Each world calls `groundWorld` once its static world is built.

**Tech Stack:** three r186 (WebGL2), Vitest 5, Vite, Playwright-core (QA).

**Spec:** `docs/superpowers/specs/2026-10-06-baked-light-everywhere-design.md`

## Global Constraints

- No new downloads. No new npm dependency.
- The kit is imported only by world scene modules (lazy chunks). The main bundle doesn't grow.
- Tier presets, verbatim from the spec: mask 1024/512/512; sun/sky samples 40/40, 24/24, 12/16;
  shadow map 2048/2048/1024 for high/mid/low.
- Mask channels: R the sun, G and B the floor height (16 bits over `range`, high byte then
  low byte), A the sky.
- On a failed bake (no float render target, or an error), `null` comes back and the world
  stays exactly as it was. That means no shadow pass either: the world was already switched to
  the kit.
- House style:
  - comments say why, in plain prose
  - shader hooks are chunk swaps with `customProgramCacheKey`
  - pure logic is tested beside its module
  - dispose everything
- Credit Bruno Simon (bruno-simon.com, `brunosimon/folio-2019`, MIT) in the README and in
  the module headers.
- Checks per commit: `npm run lint`, `npm test`. Before the final push: `npm run build`.

## Review Focus

1. **A world whose float render target is missing (old iOS).** `bakeFloorTexture` resolves
   `null`, and the floor keeps its white placeholder. Test: a stub renderer without
   `EXT_color_buffer_float` returns null.
2. **A material shared by a mover and a static** (a town's shared wood). `standIn` would
   darken the static, so shared materials are left out. Test in Task 3.
3. **The world's own sun still has `castShadow` on during a bake chunk**, which makes an
   extra shadow render. Every light's `castShadow` is saved, set off and restored per chunk.
   Test: the chunk's set/restore leaves the flags as found.
4. **Sky domes and far rims larger than the area** would shadow the whole mask. The
   auto-skip rule covers them. Test in Task 1 (`bakeable`).
5. **`dispose()` while a bake is mid-chunk** (leaving a world during its load). The bake
   stops at the next chunk and frees its targets. Test: dispose before `ready`, then no
   texture is swapped in.

---

### Task 1: The runtime bake

**Files:**
- Modify: `src/lib/three/grounding-bake.js`
- Test: `src/lib/three/grounding-bake.test.js`

**Interfaces:**
- Produces:
  - `BAKE_TIERS = { high: { size: 1024, sun: 40, sky: 40, shadow: 2048 }, mid: { size: 512, sun: 24, sky: 24, shadow: 2048 }, low: { size: 512, sun: 12, sky: 16, shadow: 1024 } }`
  - `packHeight(h, [lo, hi]) → [g, b]`: bytes 0–255, where 0,0 means no floor and a valid
    height maps to at least 1/65535
  - `unpackHeight(g, b, [lo, hi]) → h | null`
  - `bakeable(object, areaRadius) → bool`: false for Points, Sprite, Line, SkinnedMesh,
    transparent, `userData.noBake`, a world bounding radius over `areaRadius`, and a
    per-instance geometry radius under 0.25 m
  - `bakeFloorTexture(renderer, scene, { area, floor, casters, skip = [], sun, size, sunSamples, skySamples, shadowSize, cone = 4°, top = 60, range, chunk = 6, signal }) → Promise<{ texture, range, area, dispose } | null>`
    (`sun` is a unit Vector3 toward the sun; `signal` is `{ aborted }`)

- [ ] **Step 1: Write the failing tests.** In `grounding-bake.test.js` add `packHeight`
  round trips:
  - `unpackHeight(...packHeight(3.2, [0, 10]), [0, 10])` is close to 3.2 within 0.001
  - `packHeight` gives a non-zero pair for `lo`, and `unpackHeight(0, 0, r)` is `null`
  - `bakeable` is false for a `THREE.Points`, a transparent mesh, a mesh with
    `userData.noBake`, a 500 m sphere when `areaRadius` is 100, and an `InstancedMesh` of a
    0.1 m box
  - `bakeable` is true for a 2 m box
  - `BAKE_TIERS.mid` deep-equals the constant above
  - `bakeFloorTexture` on `{ extensions: { has: () => false } }` resolves `null`
- [ ] **Step 2: Run** `npx vitest run src/lib/three/grounding-bake.test.js`. Expected: FAIL
  (the exports are missing).
- [ ] **Step 3: Implement.**
  - Factor `bakeFloorMask`'s position picture and its `pass(dir, weight)` into an internal
    `makeBaker(renderer, scene, opts)` → `{ positions, acc, pass, begin(), end(), dispose }`:
    - `begin()` saves and sets every light's `castShadow` off, the casters' flags on
      (through `bakeable` and minus `skip`), and `skip` hidden
    - `end()` restores all of it
    - `bakeFloorMask` keeps its output byte for byte
  - In `bakeFloorTexture`, return null when `!renderer.extensions?.has?.('EXT_color_buffer_float')`.
  - Run the passes in chunks of `chunk`, each between `begin()` and `end()`, with an
    `await` on the next animation frame between chunks. Check `signal.aborted` each time.
  - Resolve into an RGBA8 `WebGLRenderTarget` with linear mipmaps:
    - a 3 × 3 tent over `acc` for R and A
    - `packHeight` of `positions.y` in GLSL for G and B
    - R and A of 1 where there is no floor
  - `range` defaults to the floor's world `Box3` y span, padded by 0.5 m.
- [ ] **Step 4: Run** the tests. Expected: PASS, and the existing `bakeFloorMask` tests still
  PASS.
- [ ] **Step 5: Commit** `Engine: bake a world's floor light on the GPU when it loads`.

### Task 2: Bounce from the baked height, and standIn

**Files:**
- Modify: `src/lib/three/grounding.js`
- Test: `src/lib/three/grounding.test.js`

**Interfaces:**
- Consumes: the mask layout from Task 1.
- Produces:
  - `bounce(material, { ..., mask })`, where `mask` is a bake `{ areas: [{ texture, x0, z0, w, d }], range }`
  - `bounceShader(shader, { base, mask })`
  - `standIn(material, bake) → material`
  - `floorShadowShader(shader, { areas, mover })`

- [ ] **Step 1: Failing tests.**
  - `bounceShader(SHADER, { mask: true })`:
    - contains `uniform sampler2D uBounceMask;` and `uBounceRange`
    - its floor height is `gFloor(vGroundPos)`
    - its fallback to `uBounceFloor` happens when G + B is 0
  - `floorShadowShader(SHADER, { areas: 1, mover: true }, CHUNKS)`:
    - `swapped.shade` is false
    - the fragment contains `mix(0.7, 1.0, gV.y)`
    - the sun swap is still in
  - `standIn(new THREE.MeshStandardMaterial(), bake)` sets `userData.standIn`, and its cache
    key contains `standIn`.
- [ ] **Step 2: Run** `npx vitest run src/lib/three/grounding.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `mover` changes `gSky` to `mix(0.7, 1.0, gV.y)` and leaves out the shade swap.
  - `standIn` is `floorShadow` with `mover: true` and its own uniforms object, so it doesn't
    share the floor's tint mix.
  - The bounce mask adds a `gFloor` function: the height from G and B over `uBounceRange`,
    else `uBounceFloor`.
- [ ] **Step 4: Run.** Expected: PASS, with the old cases unchanged.
- [ ] **Step 5: Commit** `Engine: the bounce reads the floor's height; movers stand in baked shade`.

### Task 3: groundWorld

**Files:**
- Create: `src/lib/three/groundwork.js`
- Test: `src/lib/three/groundwork.test.js`

**Interfaces:**
- Consumes: `bakeFloorTexture`, `BAKE_TIERS`, `bakeable` (Task 1); `floorShadow`,
  `setFloorTime`, `bounce`, `standIn`, `createBlobShadows` (Task 2 and existing).
- Produces:
  - `groundWorld({ renderer, scene, floor, area, sun, casters = [scene], skip = [], movers = [], shade = 0x3a2c22, bounce: { color, strength } | false, height = () => 0, tier = 'mid', matcap = [] })`
    → `{ bake(): Promise<bool>, rebake(sunDir), update(), track(object, size, opts), untrack(object), blobs, mask (the bake object), dispose() }`
  - `sun` is a `DirectionalLight` or a unit `Vector3`. With a light, the direction is
    `position − target.position`.
  - `movers` entries are `{ object, size: [w, d], lift? }`.

- [ ] **Step 1: Failing tests,** with a stub renderer
  `{ shadowMap: { enabled: true }, extensions: { has: () => false } }` and a real
  `THREE.Scene` holding:
  - a floor mesh with a `MeshStandardMaterial`
  - a static box with its own material
  - a mover box with its own material
  - a second mover sharing the static's material

  Assert:
  - after `groundWorld` the stub's `shadowMap.enabled` is false, and every mesh's
    `castShadow` and `receiveShadow` are false
  - the floor material has `userData.floorShadow`
  - the static material has `userData.bounce`
  - the mover's own material has `userData.standIn`, and the shared one does not
  - `update()` with the mover at (3, 1, 4) and `height` 0 puts one blob instance at
    `mesh.count === 1`
  - `bake()` resolves `false` (no float targets) and leaves the placeholder white texture in
    the uniform
  - `dispose()` before the bake resolves leaves no swapped texture and removes the blob mesh
    from the scene
- [ ] **Step 2: Run** `npx vitest run src/lib/three/groundwork.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `groundWorld` as the spec describes.
  - The bake object is `{ areas: [{ texture: white, ...area }], times: [{ tod: 0.5, channel: 0 }], shade, range }`.
  - `setFloorTime(bake, 0.5, 1)` runs once.
  - When the bake lands, the mask texture and the range are swapped into the shared uniforms
    in place. The bounce and standIn materials read the same objects.
  - The bounce colour comes from `bounce.color`, else the scene's first `HemisphereLight`'s
    `groundColor`.
  - `matcap` roots go through `matcapFor` (Task 4).
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `Engine: groundWorld, the whole grounding kit in one call`.

### Task 4: Matcaps from the world's light

**Files:**
- Create: `src/lib/three/matcap.js`
- Test: `src/lib/three/matcap.test.js`

**Interfaces:**
- Produces:
  - `matcapKey({ color, roughness, metalness, size }, lights) → string`
  - `bakeMatcap(renderer, { color, roughness, metalness, size = 128 }, lights) → Texture`
    (cached by key)
  - `matcapFor(material, renderer, lights) → MeshMatcapMaterial | material` (unchanged when
    the material isn't a lit one)
  - `lights` is `{ sun: DirectionalLight, hemi: HemisphereLight }`

- [ ] **Step 1: Failing tests.**
  - `matcapKey` is stable for equal inputs and differs when the colour changes.
  - `matcapFor` with a renderer stub whose `render` is a no-op returns a
    `MeshMatcapMaterial`. That material keeps `map`, `vertexColors` and `color`, and has
    `toneMapped` false.
  - A `MeshBasicMaterial` comes back as itself.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - The bake scene:
    - a `SphereGeometry(1, 64, 48)` with a white `MeshStandardMaterial` of the given
      roughness and metalness (the colour lives in the material's `color` when used)
    - the hemisphere copied in
    - the sun placed in view space at the canonical folio angle: from upper left, front,
      at the sun's own elevation
  - An `OrthographicCamera(-1, 1, 1, -1)`, rendered into a `size²` RGBA8 target.
  - The output is in the renderer's tone map. The target's texture is `SRGBColorSpace` and
    the material is `toneMapped: false`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `Engine: matcaps rendered from a world's own light`.

### Task 5: Middle-earth: the towns and the Shire

**Files:**
- Create: `src/components/middleearth/towns/grounded.js`. It wraps `groundWorld` with the
  towns' defaults:
  - the floor is the `makeTerrain` mesh
  - the casters are `outdoors`
  - skip: the people, ghosts, puddles and tufts
  - the circle blobs come off the people and become tracked movers
- Modify: the 12 `towns/*/scene.js` and `shire/scene.js`.

- [ ] **Step 1:** In each scene:
  - keep the terrain mesh in a variable
  - after the statics are merged, call
    `const ground = groundTown({ stage, scene, floor, outdoors, sun, hemi, height, people: [...], tier, area })`,
    where `area` is the town's play radius: a square of side 2 × the town's radius + 20 m
    about its centre
  - call `ground.bake()`
  - call `ground.update()` each frame before `stage.render`
  - call `ground.dispose()` in `dispose`

  Drop the per-person `blob()` circle meshes, since the kit's blobs replace them.
- [ ] **Step 2:** For the Shire, also turn off its shadow pass. Its inside mode keeps its own
  lights.
- [ ] **Step 3: Verify.** `npm run lint && npm test`. Then take a browser screenshot of Bree
  and of the Shire before and after (QA recipe in Task 12).
- [ ] **Step 4: Commit** `Middle-earth: every town and the Shire on baked floor light`.

### Tasks 6–11: The other worlds

Each world follows Task 5's recipe:
- find the floor mesh, the sun and hemisphere, the static root and the movers
- call `groundWorld` after the static world is built (after its models load, where it loads
  any)
- call `update()` in the frame and `dispose()` in its disposal
- remove its shadow-pass setup
- verify with lint, tests and one screenshot
- commit one world per commit

| task | world | file | notes |
| --- | --- | --- | --- |
| 6 | C-137 street, Citadel | `rickmorty/world/scene.js`, `rickmorty/citadel/scene.js` | the street's interiors switch the light (ROOM_LIGHT): ground outdoors only |
| 7 | Scranton | `office/world/scene.js` | keep `ao.js` and add the floor bake under the desks; the casters leave out the ceiling |
| 8 | the music courtyard | `music/world/scene.js` | the stone floor and the dunes are the floor |
| 9 | the Avengers compound | `avengers/hq/engine.js` + the compound's scene | the HQ engine's sun is set by `setSky`: bake after it |
| 10 | Invincible city, Cybertron Roll out | `invincible/world/scene.js`, `cybertron/rollout/world.js` | large areas: the area is the play box near the start, or the kit is skipped where it can't cover |
| 11 | Galaxy surfaces | `galaxy/surface/scene.js` | `groundMesh` is the floor; rebake per site |

A world whose build can't be wrapped without restructuring it is skipped, with the reason in
the commit message.

### Task 12: Credit, QA, numbers

**Files:**
- Modify: `README.md` (Assets and credits)
- Modify: `docs/superpowers/specs/2026-10-06-baked-light-everywhere-design.md` (as-built notes)

- [ ] **Step 1:** Add a README "Lighting after Bruno Simon" entry, with links to
  https://bruno-simon.com and https://github.com/brunosimon/folio-2019 (MIT), and one line on
  what the kit does.
- [ ] **Step 1b:** In each grounded world that shows a credit line or panel, add one short line crediting Bruno Simon's folio for the lighting approach.
- [ ] **Step 2:** Run QA in headless Chromium (`/opt/pw-browsers/chromium`):
  - localStorage keys `tp-intro=1`, `tp-3d=on`, `tp-worlds="load"`, `tp-quality=mid`
  - screenshots of each grounded world into `docs/superpowers/shots/2026-10-06-baked-*`
  - the bake's time and `renderer.info` draw calls, before and after
- [ ] **Step 3:** `npm run lint && npm test && npm run build`. All pass. The kit appears only in
  world chunks.
- [ ] **Step 4:** Add the as-built notes and numbers to the spec. Commit and push.
