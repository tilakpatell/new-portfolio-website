# The shipyard, the wardrobe and the quality pass: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let visitors build their own ship from modules (No Man's Sky's way) and fly it with any crew, dress Rick and Morty (variant, colours, gear) everywhere they appear, and lift the cast's look.

**Architecture:** Pure, tested data modules (`shipyard/parts.js`, `shipyard/build.js`, `wardrobe/looks.js`) decide what exists and what a saved or received choice means; code-built geometry (`shipyard/modules3d.js`, `wardrobe/gear.js`) and shader hooks (`wardrobe/dress.js`, `lib/three/ink.js`) draw it; the existing hangar, scenes and protocol carry it (ids only on the wire).

**Tech Stack:** React 19, Vite 8, three.js r186, Vitest 5 (plain Node, no DOM), Playwright-core with the container's Chromium for screenshots.

**Spec:** `docs/superpowers/specs/2026-10-05-shipyard-and-wardrobe-design.md`

## Global Constraints

- Nothing calls an asset service at runtime; everything is code or committed files.
- Only ids from the tables are believed from storage or the wire; never a colour or a shape.
- Storage keys: `tp-universe-hull`, `tp-wardrobe`. Wire fields on `hi`: `b` (build), `l` (looks).
- Ships are built nose −z at `BUILT = 0.36` long (shipModels.js), BUILT units throughout the shipyard.
- The Meshy skeleton's bone names: Hips Spine02 Spine01 Spine neck Head head_end headfront LeftShoulder LeftArm LeftForeArm LeftHand RightShoulder RightArm RightForeArm RightHand LeftUpLeg LeftLeg LeftFoot LeftToeBase RightUpLeg RightLeg RightFoot RightToeBase.
- Comments and copy in the repo's voice: plain British English, full sentences, no marketing words.
- Before every merge: `npm run lint`, `npm test`, `npm run build` clean, and the screenshots for that PR looked at.
- One PR per part (spec "Order of work"), merged to main with the GitHub MCP tools; the branch restarts from `origin/main` after each merge.

## Review Focus

- A build saved before a module is renamed or removed: `readBuild` gives the slot's first module, never throws (test in Task 4).
- A build whose engines module has more engines than the hull has engine sockets: only the sockets' worth are placed (test in Task 5).
- A look saved for a body whose region list doesn't include a saved colour (Cowboy Rick has no `shirt`): the colour is dropped, the rest kept (test in Task 10).
- A peer's `hi` with a garbage `b` or `l` (numbers, long strings, nested arrays): read as stock, the pilot still shown (tests in Tasks 9 and 15).
- The hangar's power cap with a build whose plant is smaller than the parts fitted: parts come off hungriest first, as `loadoutOf` does now (test in Task 6).

---

## Part 1: the quality pass (PR 2)

### Task 1: Shared ink with smoothed normals

**Files:**
- Create: `src/lib/three/ink.js`, `src/lib/three/ink.test.js`
- Modify: `src/components/rickmorty/cruiser3d.js` (drop its `inkHull`, import the shared one), `src/components/rickmorty/portal/cast.js:526` (its ink hull uses the shared one)

**Interfaces:**
- Produces: `smoothNormals(geometry: BufferGeometry): BufferGeometry` (adds `inkNormal`, returns the same geometry), `inkHull(root: Object3D, width: number, { clipY?: number|null, color?: number }): Material`, `rimToon(material: MeshToonMaterial, { color = 0xffffff, power = 3, strength = 0.35 }): MeshToonMaterial`.

- [ ] **Step 1: Write the failing tests** in `ink.test.js`:
  - `smoothNormals` on `new BoxGeometry(1,1,1)` (24 vertices, split normals): every vertex at the same position gets the same `inkNormal`, and each corner's is the normalised `(±1,±1,±1)/√3` (to 1e-5).
  - On a geometry with no index and no normals it still writes `inkNormal` of unit length.
  - `rimToon` returns the same material with a `customProgramCacheKey` that includes `rim`.
- [ ] **Step 2:** `npx vitest run src/lib/three/ink.test.js` fails (module not found).
- [ ] **Step 3: Implement.** Weld by quantising positions to `1e-4 × bounding radius`, sum area-weighted face normals per weld key, normalise. `inkHull` is cruiser3d.js's, with the vertex shader reading `inkNormal` (skinned: transform it as `objectNormal` is, via `#include <skinnormal_vertex>` order) when the attribute exists, `normal` otherwise; `smoothNormals` is called on each mesh's geometry first (once: mark `geometry.userData.inkSmoothed`). `rimToon` adds `rim = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), power) * strength` to `outgoingLight` before `#include <opaque_fragment>`.
- [ ] **Step 4:** tests pass; `npm run lint` clean.
- [ ] **Step 5: Commit** `Ink: one inverted hull for the cast, on smoothed normals`.

### Task 2: Rim light on the Meshy cast, and the look checked

**Files:**
- Modify: `src/components/rickmorty/portal/meshyCast.js` (`paint`: `rimToon(toon(...))`, map anisotropy 8)
- Create (scratchpad, not committed): a Playwright script that serves `npm run dev` and screenshots `/c-137` and the cruiser on `/universe`.

- [ ] **Step 1:** Screenshot before (Morty close in the C-137 world, the cruiser on the universe map).
- [ ] **Step 2:** Apply `rimToon` with `{ color: 0xdff6ff, power: 3, strength: 0.3 }` in `paint`; anisotropy 8 on `map`.
- [ ] **Step 3:** Screenshot after; the rim reads on the silhouette without washing out the faces; the cruiser's ink has no gaps at the hull's seams.
- [ ] **Step 4:** `npm run lint && npm test && npm run build` clean.
- [ ] **Step 5: Commit** `The cast: a rim of light, sharper textures`; push, PR, merge.

## Part 2: the shipyard (PRs 3a, 3b, 3c)

### Task 3: The modules (`parts.js`)

**Files:**
- Create: `src/components/universe/shipyard/parts.js`, `src/components/universe/shipyard/parts.test.js`

**Interfaces:**
- Produces: `BUILD_SLOTS = ['hull','cockpit','wings','engines','tail','extras']`, `MODULES` (array), `modulesFor(slot) → Module[]`, `moduleById(slot, id) → Module|null`, `isModuleOpen(m, unlocked) → boolean`.
- A Module: `{ id, slot, name, blurb, mass, power, does: { boost?, accel?, cruise?, agility?, level?, plant? }, weight, achievement, hint, sockets? }`. Hull sockets: `{ cockpit: [x,y,z], wing: [x,y,z, sweep], engine: [[x,y,z], …], tail: [x,y,z], top: [x,y,z], mounts: { …MOUNTS-shaped table for modules.js } }` in BUILT units, nose −z. Wings have `tip: [x,y,z]` relative to their root.
- Ids: hulls `dart`, `saucer`, `hauler`, `needle`; cockpits `bubble`, `canopy`, `visor`; wings `swept`, `delta`, `twinboom`, `stub`; engines `twincans`, `ring`, `quad`; tails `fin`, `twinfin`, `none`; extras `antenna`, `dish`, `lights`.
- Locks: `ring` → `showmewhatyougot`, `saucer` → `offthegrid`, `dish` → `trench`.

- [ ] **Step 1: Write the failing tests:** every slot has at least three modules and its first is open with no achievement; every id is unique within its slot; every hull has `cockpit`, `wing`, `engine` (1–4 entries), `tail`, `top` sockets and a `mounts` table with the keys modules.js reads (`pod corner pipe gun belly emitter badge fin ring` and `plate` or `belt`); every hull's `does.plant` is between 5 and 10; the three locks are as above.
- [ ] **Step 2:** fails.
- [ ] **Step 3:** Write the table. Plants: dart 7, saucer 8, hauler 10, needle 6. Engines: `twincans` 2 engines, `ring` 1, `quad` 4 (placed on the hull's first n engine sockets).
- [ ] **Step 4:** passes.
- [ ] **Step 5: Commit** `Shipyard: the modules`.

### Task 4: Builds (`build.js`)

**Files:**
- Create: `src/components/universe/shipyard/build.js`, `src/components/universe/shipyard/build.test.js`

**Interfaces:**
- Consumes: Task 3.
- Produces: `STOCK_BUILD` (first of each slot, seed 1), `readBuild(raw) → Build`, `rollBuild(seed: number, unlocked = []) → Build`, `statsOfBuild(build) → { boost, accel, cruise, agility, level, plant, mass, power }`, `writeBuild(build) → string[]` (slot order), `readBuildWire(data) → Build|null`, `buildCode(build) → string`, `parseBuildCode(code) → Build|null`, `HULL_KEY = 'tp-universe-hull'`, `readHulls(raw, crews: string[]) → { [crew]: Build|null }`.

- [ ] **Step 1: Write the failing tests:** `readBuild({ hull: 'nope', wings: 'delta' })` is stock but for `wings: 'delta'`; `rollBuild(42)` equals `rollBuild(42)` and differs from `rollBuild(43)` in some slot; over seeds 1…500 with every achievement unlocked every module appears; with none unlocked no locked module appears; `parseBuildCode(buildCode(b))` deep-equals `b` for 50 rolled builds; `readBuildWire([1, {}, 'x'])` is null and `readBuildWire(writeBuild(b))` equals `b` minus `seed`; `readHulls({ cruiser: 'stock', rv: {hull:'dart'}, zzz: 1 }, ['cruiser','rv'])` is `{ cruiser: null, rv: <dart build> }`.
- [ ] **Step 2:** fails.
- [ ] **Step 3:** mulberry32 for the seed; weighted pick by `weight` per slot. Code: `'GB-'` + each slot's index in base 36, then the seed in base 36 after a dot.
- [ ] **Step 4:** passes.
- [ ] **Step 5: Commit** `Shipyard: builds, rolled from a seed, read back and shared as codes`.

### Task 5: The modules in 3D (`modules3d.js`)

**Files:**
- Create: `src/components/universe/shipyard/modules3d.js`, `src/components/universe/shipyard/modules3d.test.js`
- Modify: `src/components/universe/hulls.js` (export `loft`, `turned` already are; export `panelMaps`)

**Interfaces:**
- Consumes: Tasks 3–4; `loft`, `turned`, `panelMaps` from hulls.js.
- Produces: `assemble(build, { maps = null }) → { group, stand, glow: [{ mat, color }], glowMesh, engines: [x,y,z][], mounts, nose: 0, dispose() }` — the same face shipModels.js's built ships have (`stand`, `glow`, `glowMesh`, `nose`), plus `engines` and `mounts`.

- [ ] **Step 1: Write the failing tests** (Node, `maps: null`): for 20 rolled builds the group's bounding box is no longer than `BUILT × 1.15` along z and centred within 0.02 on x; `engines.length` equals the engines module's count capped at the hull's engine sockets; every mesh's geometry has `position`, `normal`, `uv`; the mesh count is at most 8 (merged by material); left and right wings mirror (their bounding boxes' x ranges are opposite to 1e-6).
- [ ] **Step 2:** fails.
- [ ] **Step 3:** Build each module in its own frame (plug at origin), place by its socket (mirrored for wings, engines in pairs), merge by material: painted hull, dark metal, glass, glow. Materials from `panelMaps('build', …)` when `maps` is given (the browser), plain `MeshStandardMaterial`s otherwise. Scale the whole so the build is `BUILT` long.
- [ ] **Step 4:** passes. Then look at it: a scratch page renders 6 rolled builds in a row under the universe's lights; each reads as one ship at the chase camera's distance, no floating parts, no z-fighting.
- [ ] **Step 5: Commit** `Shipyard: the modules built in code, and a build put together on its sockets`.

### Task 6: Flying a build

**Files:**
- Modify: `src/components/universe/shipModels.js` (`buildShip(kind, T, { build })`), `src/components/universe/modules.js` (`buildModules(kind, loadout, engines, { fresh, mounts })`), `src/components/universe/outfit.js` (`statsOf(kind, loadout, build = null)`, `loadoutOf(saved, ship, unlocked, build = null)`, `fits(kind, loadout, build)`, `equip(kind, loadout, slot, id, unlocked, build)`), `outfit.test.js`

**Interfaces:**
- Consumes: Tasks 4–5.
- Produces: the above signatures; `capacityOf(kind, build) → number` (the build's plant, or `PLANT[kind]`).

- [ ] **Step 1: Write the failing tests** in `outfit.test.js`: `statsOf('rv', STOCK_LOADOUT, rollBuild(7))` multiplies the build's agility in (`agility` equals the build's when no parts); `capacityOf('rv', <needle build>)` is 6; `loadoutOf({ rv: <a 7 MW loadout> }, 'rv', all, <needle build>)` drops parts until power ≤ 6.
- [ ] **Step 2:** fails.
- [ ] **Step 3:** Implement; `buildShip` with a build uses `assemble(build, { maps })` in place of `BUILD[kind]`, skips `mount`, takes `ENGINES` from it, and `outfit()` passes the build's `mounts` to `buildModules`.
- [ ] **Step 4:** tests pass.
- [ ] **Step 5: Commit** `Shipyard: a build flies, with the hangar's parts on its own hardpoints`.

### Task 7: The scenes take the build

**Files:**
- Modify: `src/components/universe/scene.js` (`setBuild`, `setShip` builds with `state.build`; the cruiser's model only when there's no build; plumes from the build's engines), `src/pages/Universe.jsx` (hull state from `HULL_KEY`, passed to the map and the hangar), `src/components/universe/UniverseMap.jsx` (prop `build`), `src/components/galaxy/scene.js:391` and `src/pages/Galaxy.jsx` (the same build).

- [ ] **Step 1:** Wire it; switching Stock ↔ Garage build rebuilds the ship in place (as a ship change does, keeping position and heading).
- [ ] **Step 2:** In the browser: the build flies, boosts (plumes from its engines), takes the hangar's paint and parts, and the galaxy shows the same ship.
- [ ] **Step 3:** lint, tests, build clean.
- [ ] **Step 4: Commit** `Shipyard: the universe map and the galaxy fly the build`.

### Task 8: The Shipyard tab

**Files:**
- Modify: `src/components/universe/Hangar.jsx` (a `shipyard` tab first; props `build`, `onBuild`), `src/components/universe/universe.css` (its rows, reusing the part-list styles)

- [ ] **Step 1:** Stock / Garage build switch; a section per slot listing its modules (name, `does` in words as `partEffects` does, mass and power; locked ones with the lock and hint); Roll (new seed, `rollBuild(Date.now() >>> 0, unlocked)`); Code (shows `buildCode`, a paste box that applies `parseBuildCode` and says "Not a build code" otherwise).
- [ ] **Step 2:** Screenshot the tab with three rolled builds on the ship behind it; text fits at 375 px wide.
- [ ] **Step 3:** lint, tests, build clean.
- [ ] **Step 4: Commit** `Hangar: the shipyard tab`; push, PR, merge.

### Task 9: Builds online

**Files:**
- Modify: `src/components/universe/online/protocol.js` (`hi` carries `b`; the hello reader returns `build`), `protocol.test.js`, `online/useOnline.js` (`setBuild`), `online/pilots.js` (`buildShip(kind, T, { build })`; a changed build rebuilds that pilot's ship)

- [ ] **Step 1: Write the failing tests:** a hello with `b: writeBuild(b)` reads back `build` equal to `b` minus seed; with `b: [[1]]`, `b: 'x'.repeat(500)` or missing, `build` is null and the rest of the hello still reads.
- [ ] **Step 2:** fails. **Step 3:** implement. **Step 4:** passes; two browser tabs see each other's builds.
- [ ] **Step 5: Commit** `Online: other pilots see your build`; push, PR, merge.

## Part 3: the wardrobe (PRs 4a, 4b, 4c)

### Task 10: Looks (`looks.js`)

**Files:**
- Create: `src/components/rickmorty/wardrobe/looks.js`, `looks.test.js`

**Interfaces:**
- Produces: `WHO`, `BODIES` (`{ rick: [...], morty: [...] }`, each `{ id, name, asset, h, regions: string[] }`), `SWATCHES` (16: `{ id, name, hex }`), `GEAR` (`{ head: [...], face: [...], hand: [...] }`, each `{ id, name, bone, achievement?, hint? }`, `none` first), `LOOK_KEY = 'tp-wardrobe'`, `defaultLook(who)`, `readLook(who, raw)`, `readLooks(raw)`, `writeLook(look) → (string|null)[]`, `readLookWire(who, data) → Look|null`.
- Rick bodies: `rick` (coat, shirt, trousers, hair), `tinyrick` (coat, shirt, trousers, hair), `cowboyrick`, `factoryrick`, `constructionrick`, `sweaterrick`, `suitrick`, `detectiverick`, `councilrick-a`, `councilrick-b`, `councilrick-c` (regions found by screenshot in Task 11; at least `hair` each). Morty: `morty` (shirt, trousers, hair, shoes), `evilmorty` (shirt, trousers, hair), `copmorty` (hair).
- Swatch ids: `labwhite`, `portalgreen`, `mortyyellow`, `meeseeksblue`, `plumbuspink`, `squanchyorange`, `councilgrey`, `jerrygreen`, `summerpink`, `bethred`, `birdbrown`, `unitypurple`, `cromulonpeach`, `gazorpteal`, `voidblack`, `ricksblue`.

- [ ] **Step 1: Write the failing tests:** `readLook('rick', { body: 'cowboyrick', colors: { shirt: 'portalgreen', hair: 'voidblack' } })` keeps hair and drops shirt (if cowboyrick has no shirt region); unknown swatch or gear ids fall to defaults; `readLookWire('morty', writeLook(l))` round-trips for every body; `readLookWire('morty', [[]])` is null.
- [ ] **Step 2:** fails. **Step 3:** implement. **Step 4:** passes.
- [ ] **Step 5: Commit** `Wardrobe: the looks`.

### Task 11: Zones and regions (`dress.js`)

**Files:**
- Create: `src/components/rickmorty/wardrobe/dress.js`, `dress.test.js`

**Interfaces:**
- Consumes: Task 10.
- Produces: `zoneOf(boneName) → 0|1|2|3` (head, torso and arms, legs, feet), `addZones(geometry, boneNames: string[]) → geometry` (a `zone` float attribute from the strongest of JOINTS_0/WEIGHTS_0), `KEYS` (per body, per region: `{ zones: number[], hue: [lo, hi], sat: [lo, hi], val: [lo, hi] }`), `recolor(material, body, colors) → material` (the region swap through `onBeforeCompile`, uniforms per region, a program cache key per body), `dressColors(figure, look)`.

- [ ] **Step 1: Write the failing tests:** `zoneOf('Head') === 0`, `zoneOf('RightForeArm') === 1`, `zoneOf('LeftLeg') === 2`, `zoneOf('RightToeBase') === 3`; `addZones` on a hand-made geometry of 4 vertices weighted to Head, Spine, LeftLeg, LeftFoot gives zones `[0,1,2,3]`; every body in BODIES has a KEYS entry for each of its regions.
- [ ] **Step 2:** fails. **Step 3:** implement; tune KEYS by screenshot (each body, each region recoloured to `portalgreen`, nothing else changing colour).
- [ ] **Step 4:** passes; screenshots looked at.
- [ ] **Step 5: Commit** `Wardrobe: colours by region, told apart by the bones`.

### Task 12: Gear (`gear.js`)

**Files:**
- Create: `src/components/rickmorty/wardrobe/gear.js`, `gear.test.js`

**Interfaces:**
- Produces: `buildGear(id) → Object3D|null` (code-built, toon, smooth, one merged mesh per material, sized for a 1.0-tall head or hand), `wearGear(figure, look) → () => void` (attaches to the bone named by GEAR, sized by the figure's height and the body's `OFFSET[body][slot]`, returns undo).
- Gear ids: head `none`, `cowboyhat`, `partyhat`, `beanie`, `tophat`, `crown`, `headphones`; face `none`, `shades`, `goggles`, `eyepatch`; hand `none`, `portalgun`, `plumbus`, `laserpistol`.

- [ ] **Step 1: Write the failing tests:** every non-`none` id builds a group with at least one mesh and fewer than 6 materials; `buildGear('none')` is null; the portal gun's bounding box is longer along −z than it is tall.
- [ ] **Step 2:** fails. **Step 3:** implement; the portal gun to the show's design (grey body, green fluid chamber on top, the bulb at the front, glowing). **Step 4:** passes; screenshot each on Rick and on Morty.
- [ ] **Step 5: Commit** `Wardrobe: hats, glasses and the portal gun`.

### Task 13: The wardrobe panel

**Files:**
- Create: `src/components/rickmorty/wardrobe/Wardrobe.jsx`, `wardrobe.css`, `src/components/rickmorty/wardrobe/preview.js` (a small turntable renderer using createMeshyCast, dressFigure, drag to turn)
- Produces: `<Wardrobe open onClose looks onLooks />`, `useLooks() → [looks, setLooks]` (localStorage `tp-wardrobe`, `readLooks`).

- [ ] **Step 1:** Rick | Morty tabs; Body (cards with names), Colours (swatch rows per region the body has), Gear (per slot), Reset; preview updates live.
- [ ] **Step 2:** Screenshots at 1280 and 375 wide.
- [ ] **Step 3:** lint, tests, build clean.
- [ ] **Step 4: Commit** `Wardrobe: the panel, with a turntable`; push, PR, merge.

### Task 14: Dressed everywhere

**Files:**
- Modify: `src/components/rickmorty/world/scene.js` (Morty made as `bodyAsset(look)` and dressed; a Wardrobe button and `C` in `RmWorld.jsx`), `src/components/rickmorty/citadel/people.js` + `CitadelWorld.jsx` (Rick), `src/components/rickmorty/cruiser3d.js` (`buildCruiser({ ink, looks })`), `src/components/universe/footScene.js` (PARTY cruiser figures dressed), the galaxy surface's `loadPartyFigure` callers, `src/components/universe/Hangar.jsx` (a Crew button when the crew is Rick and Morty).

- [ ] **Step 1:** Wire `dressFigure` at each make; the clips play on every body (they share the skeleton).
- [ ] **Step 2:** In the browser, one look shows the same in the C-137 world, the Citadel, the cruiser's seats and on foot.
- [ ] **Step 3:** lint, tests, build clean.
- [ ] **Step 4: Commit** `Wardrobe: Rick and Morty dressed wherever they are`.

### Task 15: Looks online

**Files:**
- Modify: `online/protocol.js` (`hi.l = [writeLook(rick), writeLook(morty)]`), `protocol.test.js`, `useOnline.js`, `pilots.js` and `footScene.js`'s peers (dress others' crews)

- [ ] **Step 1: Write the failing tests:** a hello's `l` round-trips; `l: 7`, `l: [[1,2,3],[{}]]` read as null looks and the hello still reads.
- [ ] **Step 2–4:** implement, pass, check two tabs.
- [ ] **Step 5: Commit** `Online: other pilots' Ricks and Mortys wear their looks`; push, PR, merge.

## Part 4: HD presets (PR 5)

### Task 16: `hd` set in the Meshy script

**Files:**
- Modify: `scripts/meshy.mjs` (an `HD` table: `rick-hd`, `morty-hd`, `saucer-hd`, `poly: 40000`, `tex: 2048`, same prompts; the `hd` set name), `README.md` (one line under Scripts)

- [ ] **Step 1:** Add; `node scripts/meshy.mjs` with no key still says how to set it.
- [ ] **Step 2: Commit** `Meshy: HD presets for Rick, Morty and the cruiser`; push, PR, merge.
