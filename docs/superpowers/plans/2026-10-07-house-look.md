# One house look, the Shire first: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route the Shire, then the other worlds, through one shared look, ground map, grass
and wind, tunable by eye.

**Architecture:** `onBeforeCompile` patches in `src/lib/three/` (the shape of
`lib/three/surface.js` and `lib/three/grounding.js`), with pure shader-rewrite functions tested
on stub shaders. Worlds supply data (a look, a paint function) and call one adopt function.

**Tech Stack:** three r186 (WebGL 2), Vitest, Playwright with software WebGL for screenshots.

**Spec:** `docs/superpowers/specs/2026-10-07-house-look-design.md`

## Global Constraints

- No new runtime dependency. The debug panel is plain DOM.
- Every patch chains the material's earlier `onBeforeCompile` and `customProgramCacheKey`.
- One pull request per task. Each is merged after green CI (`npm run lint`, `npm test`, build,
  `node scripts/health.mjs --check --skip build`).
- `big-files` health budget is 30 and already full: no source file may grow past the
  threshold. New code goes in new files.

## Review Focus

- A material with no albedo (black, or a metal): the look must not divide by zero or blacken
  it. Test: `houseShader` guards the reference with `max(..., 1e-4)` and scales by metalness.
- A world without fog: the fog rewrite must leave the shader alone. Test: no `USE_FOG` path
  touched when the chunk is not found.
- A material patched twice (adopt over a subtree shared with another): patch once. Test:
  `adopt` skips materials with `userData.house`.
- The blades in the floor bake: the grass must be in groundTown's `skip`, or the bake draws
  blades wrapped round its own camera.
- Night: the look's shadow colour must follow the mood, or night shade glows purple.

---

### Task 1: The house look (`src/lib/three/house.js`)

**Files:** create `src/lib/three/house.js`, `src/lib/three/house.test.js`; modify
`src/components/middleearth/shire/{scene.js,sky.js}`.

**Interfaces:** produces `houseShader(shader, { fog }, chunks) → { vertexShader,
fragmentShader, swapped: { look, fog } }`, `createHouse(look) → { uniforms, material(opts),
adopt(root), set(look), light({ sun, hemi }), sky({ low, high, sunDir, halo }) }`, `LOOK`
(defaults).

- [ ] Tests: the rewrite inserts the look before `#include <opaque_fragment>` and the sky fog
      in place of `#include <fog_fragment>`; leaves a shader without those chunks alone; works
      on three's shipped chunks; `adopt` patches lit materials once and skips basic, matcap and
      shader materials; `light` sets `uLookRef` from a sun and a hemisphere light.
- [ ] Implement; run `npx vitest run src/lib/three/house.test.js`.
- [ ] Shire: a `shadow` colour per mood in `sky.js`; `makeAtmosphere` writes the look's
      shadow, sky and reference light each frame; `scene.js` calls `house.adopt(scene)` after
      `groundTown`, Neutral tone mapping, fog colour equal to the horizon.
- [ ] Screenshot (`scripts/ground-qa.mjs --route /middle-earth/shire --global __SHIRE__`),
      compare with the baseline, commit, PR, merge.

### Task 2: Ground map (`src/lib/three/groundmap.js`)

**Interfaces:** produces `createGroundMap({ area, size, paint, height }) → { colour,
heightTexture, uniforms, colourAt(x, z, out), glsl, dispose() }`; consumes nothing earlier.

- [ ] Tests: `paintGround` (pure) fills RGBA from `paint`, alpha from grass, clamps; `colourAt`
      reads back bilinearly; the GLSL chunk declares `groundColour(vec2)` and
      `groundHeight(vec2)`.
- [ ] Shire: `ground.js` paints the map from its existing colour rules; the terrain samples it
      per fragment (sharper lanes than per-vertex colour); groundTown's bounce takes its colour
      from the map under each point.
- [ ] Screenshot, commit, PR, merge.

### Task 3: Grass and wind (`src/lib/three/{grass,wind}.js`)

**Interfaces:** consumes Task 2's `uniforms` and `glsl`; produces `createWind({ strength,
angle }) → { uniforms, glsl, update(dt), sway(material, { strength }) }` and
`createGrass({ ground, wind, count, size, height }) → { mesh, material, update(camera),
dispose() }`.

- [ ] Tests: blade layout (pure): count, jitter inside its cell, one triangle each; wind GLSL
      declares `windOffset(vec2)`; `sway` chains earlier patches.
- [ ] Shire: replace the crossed tufts with `createGrass`, flowers and crowns sway on the
      shared wind, grass in groundTown's `skip`, `floorShadow` on the blades.
- [ ] Screenshot, commit, PR, merge.

### Task 4: `?debug` panel and narrower lens

**Interfaces:** produces `debugPanel({ title, groups }) → { dispose() }` in
`src/lib/debugPanel.js`, `debugOn()`.

- [ ] Tests: `debugOn` reads `?debug` from the search or after the hash route; `toCode` prints
      the values as a JS object.
- [ ] Shire: panel bound to the look, the wind, the grass and the lens; walk camera 38°.
- [ ] Screenshot, commit, PR, merge.

### Task 5: Repaint Meshy models (`scripts/flatten-glb.mjs`)

- [ ] Tests: per-vertex sampling and palette quantising (pure) in `scripts/flatten-glb.test.mjs`.
- [ ] Run on the worst clashes named in the research (the C-137 Smith house first), check a
      `scripts/glb-shot.mjs` render, commit, PR, merge.

### Task 6 onward: move each world onto the house look

One world a pull request: a look for it, `house.adopt` after its grounding, a screenshot before
and after.
