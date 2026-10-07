# Minecraft tribute implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, directly in the session (the owner wants work done directly, not through implement/review/fix agent loops). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Minecraft-style survival world on Dot Matrix island, built on the world runtime, with the game's own numbers, look and rules, shipped in seven pull requests to main.

**Architecture:** Pure, tested rules in `src/components/minecraft/rules/` run at a fixed 20 Hz and also inside a Web Worker that generates, lights and meshes chunks. `scene/` draws chunk sections from the worker's typed arrays in one custom block material over a `DataArrayTexture` built from a resource pack by `scripts/mc-atlas.mjs`. `module.js` is the world module, `Minecraft.jsx` the UI over it.

**Tech Stack:** React 19, three 0.186, vitest, `src/runtime`, Web Workers (Vite's `new Worker(new URL(…), { type: 'module' })`, as `universe/online/nostr.js` does), `sharp` in the atlas script, `fflate` for zips in the page (add it; 8 kB).

**Spec:** `docs/superpowers/specs/2026-10-07-minecraft-world-design.md`

## Global Constraints

- No Mojang asset in the repository. The shipped pack is Pixel Perfection (CC BY-SA 4.0), credited in `public/games/credits.json` as `mc/pixel-perfection`, in `public/cc0/README.md` under "Not CC0", and on the page. If the owner supplies a written Mojang permission, the vanilla pack goes through the same script and this line changes.
- The rules never import three.js or touch the DOM; they run in vitest and in the worker.
- One block is 1 m. A chunk is 16 × 16 × 256. Bedrock at y = 0; sea level 63 (water's top surface); clouds at y = 128; build limit 255. Chunk coordinates are `Math.floor(x / 16)`.
- The sim ticks at 20 Hz. Gravity 0.08 blocks/tick², drag 0.98, jump 0.42, walk 4.317 m/s (0.21585 blocks/tick), sprint 5.612, sneak 1.295, step 0.6, player 0.6 × 1.8, eyes 1.62 (1.27 sneaking), reach 4.5.
- Face shade: top 1.0, bottom 0.5, north and south (±z) 0.8, east and west (±x) 0.6. AO: four levels, 1.0, 0.8, 0.6, 0.4 by the count of the three neighbours.
- Light 0–15. Torch 14, glowstone 15, lava 15, lit furnace 13. Night floor 4.
- A day is 24000 ticks. Sunrise 0, noon 6000, sunset 12000, night 13000, midnight 18000.
- Save key `tp-mc`, version 1.
- Module `{ id: 'minecraft', shading: 'glsl', mb: 2 }`. Route `/dot-matrix/minecraft`. Island kind `'craft'`. `WORLD_MB['/dot-matrix/minecraft'] = 2`.
- British spelling, curly quotes, plain sentences, comments say why. Header comments like `dotmatrix/rules.js`.
- `npm run lint`, `npm test`, `npm run build` pass before every push. Never `git add -A` after a build (it rewrites `public/github.json`).
- Each phase is a branch from `origin/main`, a PR, merged with a merge commit once CI is green (`gh pr merge N --merge`). Merge `origin/main` in just before the last push.

## Review Focus

1. **A hidden tab coming back** (a `dt` of seconds). The sim takes at most 4 ticks a frame and drops the rest; the water and lava cellular updates are per tick, so they do not explode. Test in Task 1.10.
2. **Standing on a chunk border or a block edge** (x exactly 16.0). The physics resolves against both chunks; `findChunk` floors, never rounds. Test in Task 1.7.
3. **A chunk arriving after the player has moved on** (a worker job for a column now out of range). The job is cancelled or its result dropped; nothing is added to the scene. Test in Task 1.9.
4. **A pack that is missing tiles** (a 1.12 pack without `oak_log`, a jar from a version with renamed files). Every id resolves through the alias table, and a missing tile falls back to a magenta-and-black checker so it is seen, not thrown. Test in Task 1.3.
5. **Placing a block inside yourself or a mob, or past the reach** (right-click while standing in the target). Refused silently; the cursor's block is recomputed every tick from the current eye. Test in Task 2.4.

---

## Phase 1: blocks and a chunk you can walk on (PR 1)

Branch: `claude/minecraft-phase-1`.

**As built (Phase 1 is merged; where the code differs from the tasks below, the code is right and later tasks build on it):**
- *Vertex (1.6, 1.11):* six 16-bit numbers, 12 bytes, not the 8 the task names (its own list was 9 bytes and had no texel corner or sub-block height): `x, y, z` in sixteenths of a block within the chunk (y is the height in the column, 0–4096), `layer`, `face | ao << 3 | tint << 5 | light << 8`, `u | v << 5`. Face 6 is a plant's cross. Tints are six: none, grass, foliage, water, birch, spruce (birch and spruce leaves have the game's fixed colours).
- *Meshes (1.11):* one mesh per pass per chunk column, its sixteen sections laid end to end, not a mesh per section (that was 630 draws on hills at distance 10, over the task's own 600; the column is 400–450). `scene/chunks.js` keeps sections apart and rebuilds a column's mesh on `flush()`; it detaches the shared index before disposing a geometry (three deletes the index buffer with it).
- *Worker (1.9):* `{ type: 'chunk', key, seed, cx, cz, priority }` generates a chunk and meshes all sixteen sections against its eight neighbours, which the worker generates itself (cached), rather than `generate` then `mesh` with page-sent borders (the page has no neighbours when a chunk is first made, so every edge would be drawn as a wall). `mesh` with borders stays for edits. `makeClient` is in `rules/jobs.js`.
- *Trees (1.5):* no `Feature` lists: every chunk grows the trees of the nine chunks round it from their deterministic lists and keeps the cells inside itself; `generate` returns `{ features: [] }`.
- *Physics (1.7):* the walking test measures 20 ticks after a 20-tick run-up (from rest the game's 0.546 friction needs a few ticks, so 20 from rest is 4.06). A ladder clamps falls to 0.15 a tick and climbs at the game's 0.1176 (2.35 m/s). `world.boxes(x, y, z)` gives a cell's boxes for the shapes Phase 4 adds.
- *Pack (1.3):* Pixel Perfection Legacy 25.4-75.1 (Nova_Wostra's continuation, Modrinth, modern 1.21 names), with the 1.12 aliases kept for visitors' packs. The atlas also writes `public/mc/sprites/` (sun, moon phases, clouds, hotbar, its selection, crosshair, hearts, food, air, and the grass and foliage colormaps) and `--vanilla <jar>` refuses any tile 90% the same as the game's. Chest and bed tiles are cut from their entity sheets.
- *Tints (1.11):* grass and foliage come from the pack's colormaps at the biome's climate (`pack/colormap.js`), as the game reads them; Pixel Perfection's plains grass is 0x6dc475.
- *Shaders:* three r186's GLSL3 has no `gl_FragColor`: each fragment shader declares `out highp vec4 outColour`.
- *Island (1.12):* the table is two across and two high (top 2, too high to jump), at x 33–34, z 10–11, east of the N64, played from its south side. `universes.test.js` lists the world pages, so it gains the route.
- *Save (1.10):* Phase 1 keeps only `{ seed }` under `tp-mc` v1, so the same world comes back; Task 2.5 grows it.

### Task 1.1: The block registry

**Files:**
- Create: `src/components/minecraft/rules/blocks.js`
- Test: `src/components/minecraft/rules/blocks.test.js`

**Interfaces:**
- Produces:
  - `AIR = 0`.
  - `BLOCKS: Array<{ id, name, faces: { top, bottom, north, south, east, west } (texture ids, e.g. 'grass_block_top'), shape: 'cube' | 'cutout' | 'cross' | 'liquid' | 'torch' | 'ladder' | 'slab' | 'stairs' | 'door' | 'none', opaque: bool, light: 0–15, hardness: number | Infinity, tool: 'pickaxe' | 'axe' | 'shovel' | 'sword' | 'shears' | null, tier: 0–4, drops: (state, tool) → [{ item, count }], sound: 'grass' | 'stone' | 'wood' | 'sand' | 'gravel' | 'cloth' | 'glass' | 'snow', tint: 'grass' | 'foliage' | 'water' | null, solid: bool, gravity: bool }>`, indexed by id, `BLOCKS[0]` is air.
  - `byName: Map<string, block>`; `block(id)`.
  - Every block from the spec's *Blocks* list, with the game's hardness and drops (stone drops cobblestone; grass block drops dirt; leaves drop a sapling 1 in 20, oak also an apple 1 in 200; ores drop their item, except iron and gold which drop the ore block; glass drops nothing; ice drops nothing).
  - `TEXTURES: string[]`: every texture id any face names, sorted, deduplicated. Its index is the texture array layer.

- [ ] **Step 1: Write the failing tests.**
  - `air is 0 and has no faces`.
  - `every block has six faces, a shape, a hardness and a sound`.
  - `every face texture id is in TEXTURES exactly once`.
  - `stone drops cobblestone with any pickaxe and nothing by hand` (hand = tool null, tier 0; stone needs tier 0 pickaxe).
  - `diamond ore drops nothing with a stone pickaxe and a diamond with an iron one`.
  - `grass block drops dirt`.
  - `oak leaves drop a sapling about 1 in 20 over 2000 tries with a seeded random` (drops takes `rand` as a third argument).
  - `bedrock is unbreakable` (hardness Infinity).
  - `torch gives 14, glowstone 15, lava 15`.
  - `sand and gravel fall; dirt does not`.
  - `water and glass are not opaque; oak leaves are not; stone is`.
- [ ] **Step 2:** Run `npx vitest run src/components/minecraft/rules/blocks.test.js`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement.** A table literal with a small `cube(name, tex, opts)` helper and a `column(name, side, top, bottom, opts)` helper for logs and the grass block. Hardness from the game: dirt 0.5, grass 0.6, sand 0.5, gravel 0.6, stone 1.5, cobblestone 2, ores 3, obsidian 50, logs and planks 2, leaves 0.2, glass 0.3, bedrock Infinity, torch 0, water and lava Infinity (not broken, replaced).
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit: `Minecraft: the block registry`.

### Task 1.2: Chunk storage and the edit log

**Files:**
- Create: `src/components/minecraft/rules/chunk.js`
- Test: `src/components/minecraft/rules/chunk.test.js`

**Interfaces:**
- Produces:
  - `W = 16, H = 256`. `index(x, y, z) = (y * 16 + z) * 16 + x` for local 0 ≤ x, z < 16, 0 ≤ y < 256.
  - `makeChunk(cx, cz) → { cx, cz, ids: Uint8Array(65536), light: Uint8Array(65536), state: Uint8Array(65536), edits: Map<index, [id, state]>, dirty: Set<sectionY>, generated: false, lit: false }`.
  - `get(chunk, x, y, z) → id` (0 outside 0–255), `getState`, `set(chunk, x, y, z, id, state = 0, { log = true })` marks `dirty` with the section and, when `log`, records the edit.
  - `skyLight(chunk, x, y, z)` (high nibble), `blockLight` (low nibble), `setLight(chunk, x, y, z, sky, block)`.
  - `packEdits(chunk) → number[]` run-length: `[index, id, state, run, …]` where `run` is how many consecutive indices share `id, state`; `applyEdits(chunk, packed)`.
  - `key(cx, cz) → string` (`${cx},${cz}`), `chunkOf(x) → Math.floor(x / 16)`, `local(x) → x - 16 * Math.floor(x / 16)`.

- [ ] **Step 1: Write the failing tests.**
  - `index covers every cell once` (65536 distinct values over the ranges).
  - `set then get at every corner (0,0,0), (15,255,15)`.
  - `get above 255 and below 0 is air`.
  - `set marks the section dirty (y 40 is section 2)`.
  - `edits round trip: 100 random sets pack and apply to an equal ids array`.
  - `a run of 50 identical sets packs to one entry`.
  - `chunkOf(-1) is -1 and local(-1) is 15`.
- [ ] **Step 2:** Run the test. Expected: FAIL.
- [ ] **Step 3: Implement** in `chunk.js`.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `Minecraft: chunk storage and the edit log`.

### Task 1.3: The atlas builder and the shipped pack

**Files:**
- Create: `src/components/minecraft/pack/atlas.js`, `src/components/minecraft/pack/aliases.js`, `scripts/mc-atlas.mjs`
- Create (output, committed): `public/mc/blocks.webp` (a vertical strip, 16 wide, 16 × N tall, lossless), `public/mc/items.webp` (the same), `public/mc/skins/<mob>.webp`, `public/mc/manifest.json`
- Modify: `public/games/credits.json`, `public/cc0/README.md`, `package.json` (script `mc:atlas`; dependency `fflate`)
- Test: `src/components/minecraft/pack/atlas.test.js`

**Interfaces:**
- Consumes: `TEXTURES` from Task 1.1; `ITEM_TEXTURES` (Task 2.2; until then the script takes an empty list).
- Produces:
  - `aliases.js`: `ALIASES: Record<modernId, string[]>`, the file names a modern id may be found under in a 1.12-era pack (`grass_block_top: ['grass_top']`, `oak_log: ['log_oak']`, `oak_log_top: ['log_oak_top']`, `oak_planks: ['planks_oak']`, `oak_leaves: ['leaves_oak']`, `cobblestone: []`, and so on for every id in `TEXTURES`).
  - `atlas.js`, pure over an abstract file source: `buildAtlas(read: (path) => Promise<Uint8Array | null>, { blocks: string[], items: string[], skins: Record<name, path>, decode: (bytes) => Promise<{ width, height, data: Uint8ClampedArray }> }) → { blocks: { width: 16, height: 16, layers: N, data: Uint8ClampedArray }, items, skins: Record<name, { width, height, data }>, missing: string[], manifest: { blocks: string[], items: string[], skins: string[], source } }`. A missing tile is a 16 × 16 magenta-and-black checker. A tile taller than wide (an animated water strip) takes its first frame; `frames` records how many for water and lava (Task 4.3 animates them).
  - `scripts/mc-atlas.mjs <pack folder or zip> [--name pixel-perfection]`: reads with `node:fs` or `fflate`, decodes with `sharp`, writes the files above and the credit; prints the missing list and fails if more than 0 block tiles are missing unless `--allow-missing`.
  - `manifest.json`: `{ name, source, license, blocks: string[], items: string[], skins: string[], frames: { water_still: 32, lava_still: 20, … } }`.

- [ ] **Step 1: Write the failing tests** for `atlas.js` with a fake `read` that returns a 16 × 16 solid colour per path, and a fake `decode`.
  - `every id in blocks gets a layer in order`.
  - `an id found under its alias is used`.
  - `a missing id makes the checker and is listed in missing`.
  - `a 16 × 512 strip takes its first frame and records 32 frames`.
  - `skins keep their own size (64 × 64 and 64 × 32)`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Implement** `atlas.js` and `aliases.js`.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Download Pixel Perfection Legacy** (XSSheep, CC BY-SA 4.0; the Modrinth or Planet Minecraft release that targets 1.12) into `scripts/gen3d/cache/mc/` or anywhere outside the repo, check its licence file says CC BY-SA 4.0, and run `node scripts/mc-atlas.mjs <path>`. Fill `ALIASES` until `missing` is empty for the blocks. Expected: `public/mc/blocks.webp` exists, under 300 kB, and `manifest.json` lists every id in `TEXTURES`.
- [ ] **Step 6:** Add the credit to `public/games/credits.json` (`mc/pixel-perfection`: source URL, name, author XSSheep, license `CC BY-SA 4.0`, what it is used for) and a line under "Not CC0" in `public/cc0/README.md`. `npm run credits` if the script checks the file.
- [ ] **Step 7:** Commit: `Minecraft: the texture atlas from Pixel Perfection` (the pack's files are not committed; the built strips are).

### Task 1.4: Noise

**Files:**
- Create: `src/components/minecraft/rules/noise.js`
- Test: `src/components/minecraft/rules/noise.test.js`

**Interfaces:**
- Produces: `makeNoise(seed) → { noise2(x, y), noise3(x, y, z) }` (simplex, −1 to 1), `octaves(n, { octaves, lacunarity = 2, persistence = 0.5 }) → (x, y, z?) => number`, `hashSeed(string | number) → int32`, `chunkRandom(seed, cx, cz) → () => number` (lib/seeded over a hash of the three).

- [ ] **Step 1: Tests.** `same seed same value`, `different seeds differ`, `range within -1..1 over 10000 samples`, `octaves of a constant is the constant`, `chunkRandom is stable per chunk and differs between chunks`, `hashSeed('pumpkin') is an integer and equals itself again`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement (simplex 2D and 3D from Stefan Gustavson's reference, seeded permutation from `lib/seeded`). **Step 4:** PASS. **Step 5:** Commit: `Minecraft: seeded noise`.

### Task 1.5: Terrain generation, first pass

**Files:**
- Create: `src/components/minecraft/rules/worldgen.js`, `src/components/minecraft/rules/trees.js`
- Test: `src/components/minecraft/rules/worldgen.test.js`

**Interfaces:**
- Consumes: Tasks 1.1, 1.2, 1.4.
- Produces:
  - `makeGenerator(seed) → { height(x, z) → number, biome(x, z) → 'plains' | 'forest' | 'birch_forest' | 'taiga' | 'mountains' | 'desert' | 'savanna' | 'swamp' | 'jungle' | 'snowy' | 'ocean' | 'beach', generate(chunk) → { features: Feature[] } }`.
  - `generate` fills `ids`: bedrock at 0 and by noise to 4; stone to the height; the biome's surface (grass block on 3 dirt; sand on 3 sand then sandstone in desert and beach; snow layer on grass in snowy; podzol… use grass for now); water from the height to 63 where height < 63; then the trees and plants from `chunkRandom` through `trees.js`. Marks `generated`.
  - Height: `63 + 12 × continentalness + erosion × peaks × 40`, clamped 40 to 160, with the ocean where continentalness < −0.25 and beach within 2 of 63 on land. Plains 64 to 72 at erosion low.
  - `trees.js`: `placeTree(kind, x, y, z, put)` where `put(x, y, z, id)` writes anywhere (the chunk, or a neighbour via a feature). Oak: trunk 4 to 6, leaves a 5 × 5 at the top two trunk levels minus corners, a 3 × 3 above, a plus on top. Birch the same with 5 to 7. Spruce: the layered cone. A tree whose leaves cross the chunk's edge is returned as a `Feature { kind, x, y, z }` for the neighbour to apply on load (`applyFeatures(chunk, features)`).
  - Tree density per biome: forest 1 in 24 columns, plains 1 in 200, birch forest 1 in 24 birch, taiga 1 in 24 spruce, none in desert, ocean, beach.

- [ ] **Step 1: Tests.**
  - `the same chunk generated twice is byte-identical`.
  - `bedrock at y 0 everywhere, none above y 4`.
  - `a column on land has a grass block on dirt on stone` (find one by scanning).
  - `a column in the ocean has water from its floor to 63 and air above`.
  - `no leaf block without a log within 3 blocks` (no floating trees).
  - `the chunk at (1000, 1000) with seed 1 has the same height as height(16000, 16000) says`.
  - `height stays within 40..160 over 1000 samples`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS. **Step 5:** Commit: `Minecraft: the first terrain pass with trees`.

### Task 1.6: The mesher

**Files:**
- Create: `src/components/minecraft/rules/mesher.js`
- Test: `src/components/minecraft/rules/mesher.test.js`

**Interfaces:**
- Consumes: Tasks 1.1, 1.2.
- Produces:
  - `meshSection(chunk, sectionY, neighbours: { nx, px, nz, pz } (chunks or null), { textures: Map<id, layer> }) → { opaque: Mesh, cutout: Mesh, water: Mesh }` where `Mesh = { data: Uint8Array (8 bytes a vertex), count }` or null when empty.
  - A vertex: `x, y, z` (bytes, 0–16 within the section), `face` (0–5: top, bottom, north, south, east, west; the shade is read from it in the shader), `ao` (0–3), `layer` (the texture index, two bytes), `light` (sky << 4 | block), `tint` (0 none, 1 grass, 2 foliage, 3 water). Four vertices a face, index buffer implied (0 1 2, 0 2 3 per quad, built once in the scene).
  - A face is emitted when the neighbour is air, a cutout, a liquid (for a non-liquid), or outside a null neighbour chunk (drawn, so the world edge is not a hole; re-meshed when the neighbour loads).
  - AO per vertex: of the three blocks touching that vertex on the face's side (two edges and the corner), `3 − count` when both edges are solid gives 0 (the game's rule); otherwise `3 − count`.
  - Shapes: `cube`, `cutout` (same as cube, but never culls its own kind's faces away: leaves next to leaves show both), `cross` (two diagonal quads, no culling), `liquid` (top face only when the block above is not liquid, lowered to 14/16 for a source), `torch`, `ladder`, `slab`, `stairs`, `door` (Phase 4 adds the last four; until then they mesh as cubes).

- [ ] **Step 1: Tests.** `a lone stone block has 6 faces (24 vertices)`, `two stones side by side have 10 faces`, `glass beside stone keeps the stone's face and its own`, `water with air above has one top face at 14/16`, `tall grass is two crossed quads`, `a vertex in a concave corner has ao 0 and in the open 3`, `a face on the section's edge with a null neighbour is drawn`, `each face index matches its direction`, `a grass block's top has tint 1 and its side tint 0`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS. **Step 5:** Commit: `Minecraft: the chunk mesher with smooth lighting`.

### Task 1.7: Physics and the player

**Files:**
- Create: `src/components/minecraft/rules/physics.js`, `src/components/minecraft/rules/player.js`
- Test: `src/components/minecraft/rules/physics.test.js`

**Interfaces:**
- Produces:
  - `physics.js`: `moveBox(world, box: { x, y, z, w, h }, vel: { x, y, z }, { step = 0.6 }) → { x, y, z, onGround, hitX, hitZ, hitHead }` sweeping each axis against `world.solid(x, y, z) → bool` over the cells the box covers, with the step-up when a horizontal hit is at most `step` high and the stepped box is free; `inWater(world, box)`, `onLadder(world, box)`.
  - `player.js`: `makePlayer({ x, y, z }) → { x, y, z, vx, vy, vz, yaw, pitch, onGround, sneak, sprint, health: 20, hunger: 20, air: 300, fallFrom, swing }`; `stepPlayer(world, p, input: { forward, strafe, jump, sneak, sprint, yaw, pitch }) → events[]` one tick: the game's numbers from the Global Constraints; in water 0.02 of gravity, 0.8 drag and 0.04 up on jump; on a ladder vy clamped to ±0.15; fall damage on landing `floor(fallFrom − y − 3)` half-hearts; sneaking refuses a horizontal move whose foot box would have no floor; `events` carry `{ type: 'land', fell }`, `{ type: 'hurt', amount }`, `{ type: 'step' }` every 1.3 blocks walked.

- [ ] **Step 1: Tests.**
  - `a jump from flat ground peaks between 1.25 and 1.26 above` (tick until vy < 0).
  - `walking 20 ticks on flat ground covers 4.317 ± 0.05 blocks`.
  - `a 0.6 step is taken; a 1-block step is not`.
  - `sneaking at an edge stops at the edge`.
  - `a 3-block fall hurts 0; a 4-block fall hurts 1`.
  - `a box at x exactly 16.0 resolves against both chunks` (world.solid is a spy; the cells touched include x 15 and 16).
  - `in water the player sinks slowly and rises on jump`.
  - `on a ladder vy is clamped to 0.15`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS. **Step 5:** Commit: `Minecraft: the player's physics`.

### Task 1.8: The game sim, phase 1 scope

**Files:**
- Create: `src/components/minecraft/rules/game.js`, `src/components/minecraft/rules/world.js`
- Test: `src/components/minecraft/rules/game.test.js`

**Interfaces:**
- Consumes: all above.
- Produces:
  - `world.js`: `makeWorld() → { chunks: Map<key, chunk>, get(x, y, z), set(x, y, z, id, state), solid(x, y, z), chunkAt(cx, cz), neighbours(cx, cz) }`: `get` outside a loaded chunk is stone below 63 and air above (so the player never falls through an unloaded edge), `solid` by the block's `solid`.
  - `game.js`: `newGame({ seed, save }) → g` with `g.world, g.player, g.time, g.seed, g.renderDistance, g.wanted: Set<key>` (the columns in range, spiral order); `tick(g, input) → events` (one 20 Hz tick: the player, the time); `wantedChunks(g) → key[]` (within `renderDistance` of the player's chunk, nearest first, bounded by `maxChunks`); `addChunk(g, chunk)`, `dropChunk(g, key)`; `spawnPoint(gen) → { x, y, z }` (the first land column scanning out from 0, 0; stands on its surface).
  - `drain(g) → events[]` (the events since the last drain).

- [ ] **Step 1: Tests.** `wantedChunks within distance 2 is 25 keys nearest first`, `a chunk beyond distance + 2 is dropped`, `spawn is on land above 63 with air above`, `tick advances time by 1`, `the player stands on the generated surface after 100 ticks` (generate the spawn chunk in the test), `tick with no chunks under the player holds him (unloaded ground is stone)`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS. **Step 5:** Commit: `Minecraft: the sim with chunk loading`.

### Task 1.9: The worker

**Files:**
- Create: `src/components/minecraft/worker.js`, `src/components/minecraft/rules/jobs.js`
- Test: `src/components/minecraft/rules/jobs.test.js`

**Interfaces:**
- Produces:
  - `jobs.js` (pure, the queue the worker and the page share the protocol of): `makeQueue() → { push(job), cancel(key), next(), size }` ordered by `priority` (distance), with `cancel` dropping a queued job; messages: `{ type: 'generate', seed, cx, cz, features }` → `{ type: 'chunk', cx, cz, ids, state, features }`; `{ type: 'mesh', cx, cz, sectionY, chunk: { ids, state, light }, neighbours: { … borders only: 4 × Uint8Array(16 × 256) ids and light } }` → `{ type: 'mesh', cx, cz, sectionY, opaque, cutout, water }`; `{ type: 'cancel', key }`.
  - `worker.js`: `onmessage` runs the queue; `generate` then meshes all 16 sections of the chunk in one go and posts the chunk and its meshes with transferables.
  - A page-side wrapper `workerClient(worker) → { generate(seed, cx, cz, features) → Promise<chunk>, mesh(args) → Promise<meshes>, cancel(key) }` in `src/components/minecraft/scene/chunks.js` (Task 1.11).

- [ ] **Step 1: Tests** for `jobs.js`: `nearest first`, `cancel removes a queued job`, `a result for a cancelled key is ignored by the client` (the client's map has no resolver).
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS. **Step 5:** Commit: `Minecraft: a worker for generating and meshing`.

### Task 1.10: The module

**Files:**
- Create: `src/components/minecraft/module.js`
- Test: `src/components/minecraft/module.test.js` (after `mario64/module.test.js`: the module's shape and `mb` against `WORLD_MB`)

**Interfaces:**
- Produces: the default export `{ id: 'minecraft', shading: 'glsl', mb: 2, label, create(rt, props) }`. `create` binds `KEYS = { forward: ['KeyW', 'ArrowUp'], back: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], jump: ['Space'], sneak: ['ShiftLeft', 'ShiftRight'], sprint: ['ControlLeft', 'ControlRight'], inventory: ['KeyE'], drop: ['KeyQ'], debug: ['F3'], view: ['F5'], pause: ['Escape'], slot1…slot9: ['Digit1'…'Digit9'] }`, makes the game, the scene (Task 1.11), the worker client, ticks at 20 Hz with at most 4 ticks a frame and an accumulator, syncs the scene with `alpha`, emits `hud` at most 10 times a second and `ui` on change, exposes `world.game`, `world.look(dx, dy)` (pointer-lock deltas from the page), `world.press(name, down)` and `world.stick(x, y)` for touch, and restores the renderer's tone mapping and shadow settings on dispose.
- [ ] **Step 1: Tests.** `the module has id minecraft, glsl, mb 2 matching WORLD_MB`, `the tick accumulator runs at most 4 ticks for a 1 s frame` (export `ticksFor(accumulated) → { ticks, left }` and test it).
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS. **Step 5:** Commit: `Minecraft: the world module`.

### Task 1.11: The scene: terrain, material, sky

**Files:**
- Create: `src/components/minecraft/scene.js`, `src/components/minecraft/scene/chunks.js`, `src/components/minecraft/scene/shaders.js`, `src/components/minecraft/scene/sky.js`, `src/components/minecraft/scene/atlasTexture.js`

**Interfaces:**
- Produces:
  - `atlasTexture.js`: `loadBlockArray(rt, manifest) → Promise<THREE.DataArrayTexture>` from `public/mc/blocks.webp` (decode with `createImageBitmap`, draw to a canvas, read the pixels, 16 × 16 × N, `NearestFilter` mag, `NearestMipmapLinearFilter` min, `generateMipmaps`, sRGB colour space); `tintTexture()` the grass and foliage colour maps as the game's (a 256 × 256 gradient from temperature and humidity; drawn in code).
  - `shaders.js`: `blockMaterial({ array, tints, pass: 'opaque' | 'cutout' | 'water' }) → THREE.ShaderMaterial` reading the 8-byte vertex (`position` as three bytes, `face`, `ao`, `layer` as two bytes, `light`, `tint`) through `InterleavedBuffer`; uniforms `daylight`, `fogColor`, `fogNear`, `fogFar`, `time`; colour = texel × shade[face] × brightness(max(sky × daylight, block)) × ao / 3 × tint; `cutout` discards alpha < 0.5; `water` is transparent at 0.8 with a slow vertex wave and the water tint. Brightness: the game's curve, `b = l / 15; b = b / (4 − 3 b)` then lerp to the night floor.
  - `chunks.js`: `createChunks(scene, rt, { material }) → { setMesh(cx, cz, sectionY, meshes), drop(cx, cz), cull(camera), stats() }`: one `THREE.Mesh` per pass per section, positioned at `(cx × 16, sectionY × 16, cz × 16)`, the shared index buffer, frustum culled by three.
  - `sky.js`: `createSky(scene) → { update(timeOfDay, camera) }`: a sky dome (an inverted sphere in a gradient material), a square sun and moon sprite on a 300 m orbit, the cloud layer (a 12 × 12 blocks-a-cell noise mask at y = 128 drifting at 0.05 blocks a second), stars. Phase 1 holds noon.
  - `scene.js`: `createScene(renderer, rt, { manifest }) → { ready, sync(g, alpha), render(camera?), resize(w, h), setRenderDistance(n), chunks, dispose() }`: a `PerspectiveCamera` at 70° fov, the eye at the player's interpolated position, fog from `renderDistance × 16 × 0.8` to `× 16`.
- [ ] **Step 1: Build it** against the module; run the dev server through the preview tool and open `#/dot-matrix/minecraft` (Task 1.12 adds the route first; build the route stub in this task if needed).
- [ ] **Step 2: Check:** the terrain draws, 60 fps at the high tier with `rt.gfx.renderer.info.render.calls` under 600 at distance 10 (one draw per non-empty pass per section; a flat world is about 2 sections per column), no console errors, chunks load as you walk and drop behind.
- [ ] **Step 3:** Commit: `Minecraft: the scene draws the chunks`.

### Task 1.12: The page, the route, the island and the registries

**Files:**
- Create: `src/components/minecraft/Minecraft.jsx`, `src/components/minecraft/minecraft.css`, `src/pages/Minecraft.jsx`
- Modify: `src/App.jsx` (lazy page, `<Route path="/dot-matrix/minecraft">`), `src/components/universe/universes.js` (`pages` of `gaming` gains `{ to: '/dot-matrix/minecraft', world: 'Minecraft' }`), `src/components/worlds/worlds.js` (`WORLD_MB`), `src/components/guide/routes.js`, `src/components/guide/pages.js`, `src/components/CommandPalette.jsx` (an entry `w-mc`), `src/components/dotmatrix/rules.js` (a legend char `C: { kind: 'craft', ground: 0, top: 1 }`, a `CRAFT` footprint beside `N64`, `nearAction` → `{ kind: 'craft', id: 'craft' }`), `src/components/dotmatrix/scene.js` (a crafting table drawn in code: a cube with the pack's `crafting_table_top` and sides as canvas textures, two blocks across), `src/components/dotmatrix/DotMatrixWorld.jsx` (the overlay state gains `'minecraft'`, the prompt "Play Minecraft"), `README.md` (the world table row and the disclaimer), `src/data/modelCredits.json` is not touched (the test enforces Sketchfab sources; the pack is credited in `credits.json`).
- Test: `src/components/dotmatrix/rules.test.js` (`nearAction` at the table), `src/components/universe/universes.test.js` passes as it is (it checks every page has a route).

**Interfaces:**
- `Minecraft.jsx`: `<Minecraft mode="page" | "overlay" onExit />` after `Mario64.jsx`: `useWorld(module, …)`, the crosshair, the hotbar (nine empty slots in Phase 1), pointer lock on click (`host.requestPointerLock()`), `mousemove` deltas to `world.look`, the touch stick and buttons on a coarse pointer, the title (Continue, New world, Sound, the disclaimer), Esc to the pause with Back, Save and quit.
- `pages/Minecraft.jsx` after `pages/Mario64.jsx`: the title, the about section with the credit line (Pixel Perfection, CC BY-SA 4.0, XSSheep; Minecraft is Mojang's and Microsoft's; not affiliated), the links back, `WorldSwitcher`.
- [ ] **Step 1:** Write the `nearAction` test for the table. FAIL. Implement the island changes. PASS.
- [ ] **Step 2:** Build the page and the component. Check in the browser: the route, the title, pointer lock, walking; on the island, B at the table opens it full-screen and Esc from the title returns; the command palette finds it; `npm run build` prerenders `/dot-matrix/minecraft` (the sitemap has it).
- [ ] **Step 3:** `npm run lint && npm test && npx vite build`. Then `node scripts/autopilot-check.mjs --routes /dot-matrix/minecraft` and look at the screenshot.
- [ ] **Step 4:** Commit: `Minecraft: the page, the route and the island's crafting table`.

### Task 1.13: The browser check and the hand-off

**Files:**
- Create: `scripts/mc-check.mjs` (after `scripts/m64-check.mjs`: open the route, wait for `window.__RUNTIME__.current.module.id === 'minecraft'` and 25 loaded chunks, start, hold W for 3 s, screenshot, print the player's position and the chunk count, fail on page errors).
- Create: `docs/superpowers/HANDOFF-minecraft-world.md` (Done with the PR, Left in order from this plan, Checking it).
- Modify: `docs/architecture.md` (one paragraph under a new "Minecraft's world" heading, after Albuquerque's).
- [ ] **Step 1:** Run the check with the dev server up: `npx vite --port 5188 --strictPort --host 127.0.0.1` then `OUT=<scratch> node scripts/mc-check.mjs`. Expected: a screenshot of terrain, no errors.
- [ ] **Step 2:** Commit, merge `origin/main`, push, open the PR (`gh pr create`), wait for CI, `gh pr merge --merge`.

## Phase 2: dig and build (PR 2)

Branch `claude/minecraft-phase-2` from `origin/main`.

**As built (Phase 2):**
- *Break times (2.3)* are whole ticks, as the game counts them: stone with a wooden pickaxe is 23 ticks, 1.15 s (the task's 0.5625 contradicts its own formula, 1.125), obsidian with diamond 188 ticks, 9.4 s. Shears take leaves at once. Five ticks between breaks.
- *Where the hands live:* `rules/build.js` (breaking, placing, falling blocks, dropped items, Q, using a crafting table), re-exported by `game.js`; `rules/breaking.js` the times. The cursor is recomputed from the eye every tick (`g.cursor`).
- *State drawn now:* logs lie along their axis and furnaces, chests and jack o'lanterns face where they were set (the mesher reads `state`), not in Phase 4.
- *Saves (2.5):* chunk jobs carry the player's edits for the chunk and its eight neighbours, so an edited chunk arrives meshed with them; `mesh` jobs with borders re-mesh what an edit touches, first in the queue; an edit on a chunk's edge dirties the neighbour too.
- *The screens:* `rules/gui.js` is the containers' click logic (tested); `Minecraft.jsx` draws the inventory and the crafting table on the pack's own panels (`gui/container/inventory`, `crafting_table`, added to the sprites). Using a crafting table opens the 3 × 3 now (the plan put 3 × 3 recipes in Phase 4, but a pickaxe needs it, and Phase 2's "done" asks for one). Paper joined the items for the book.

### Task 2.1: The raycast and the cursor

**Files:** `rules/raycast.js`, `rules/raycast.test.js`; `scene/cursor.js`.
**Interfaces:** `raycast(world, eye: {x,y,z}, dir: {x,y,z}, reach = 4.5) → { x, y, z, face: 0–5, id, t } | null` by Amanatides–Woo DDA, passing through air, liquids and `cross`/`cutout` only where the block's own `pick` says (leaves and glass are picked; water is not). `cursor.js`: `createCursor(scene) → { set(hit | null, crack: 0–9 | -1) }`: the black 1-px outline box (a `LineSegments` of the block's bounds, slightly inflated) and the crack as a cutout quad on each visible face using `destroy_stage_0…9` from the atlas.
- Tests: `hits the near face of a block 3 away with face 2 (north) when looking +z`, `misses at 5`, `picks the face by the entry axis at a corner`, `passes through water`, `a cross block is picked`.

### Task 2.2: Items and the inventory

**Files:** `rules/items.js`, `rules/inventory.js`, `rules/inventory.test.js`; `scene/icons.js`.
**Interfaces:** `ITEMS: { [name]: { name, kind: 'block' | 'tool' | 'food' | 'material', block?: id, tool?: { type, tier, speed, durability }, food?: { hunger, saturation }, stack: 64 | 16 | 1, texture } }` (wood 2/59, stone 4/131, iron 6/250, gold 12/32, diamond 8/1561; every block in the registry is an item with `stack: 64`); `ITEM_TEXTURES` (for the atlas script; rebuild `public/mc/items.webp`). `makeInventory() → { slots: Array(36) of { item, count, damage } | null, selected: 0–8 }`; `give(inv, item, count) → leftover`, `take(inv, slot, count)`, `move(inv, from, to)` (merge or swap), `split(inv, from)` (half to the cursor), `held(inv)`. `icons.js`: `iconFor(item) → canvas` (a block: an isometric cube from its three faces with the shades 1.0 / 0.8 / 0.6, 32 × 32; a tool or food: its item tile at 32 × 32 nearest).
- Tests: `give 70 cobblestone fills a slot to 64 and 6 into the next`, `give 17 eggs (stack 16) spills`, `move merges like stacks and swaps unlike`, `split takes the larger half`, `every ITEMS block refers to a block in the registry`.

### Task 2.3: Breaking and placing

**Files:** `rules/game.js` (extend), `rules/game.test.js`; `rules/breaking.js`, `rules/breaking.test.js`.
**Interfaces:** `breakTime(block, heldItem, { onGround, inWater }) → seconds`: by hand `hardness × 1.5`; a block that needs a tool you lack `hardness × 5`; the right tool at tier or above `hardness × 1.5 / speed`; × 5 in water or off the ground; 0 for hardness 0; Infinity for Infinity. `startBreak(g, hit)`, `tick` advances `g.breaking.progress` while the button is held on the same block and clears it otherwise; at 1, `breakBlock(g, x, y, z)` sets air, spawns the drops as entities (`g.drops`), damages the tool, emits `{ type: 'break', id, x, y, z }`. `placeBlock(g, hit, item) → bool`: at `hit` moved by its face normal, refused when the cell is not air or liquid, when the player's or any mob's box overlaps it, or past the reach; sets facing state for stairs, logs, torches (the face it hangs from); consumes one from the stack; emits `{ type: 'place' }`. `gravity` blocks fall: `set` of air under sand schedules a fall in `g.updates` (a queue of `(x, y, z, tick)` run in `tick`). Dropped items: `{ item, count, x, y, z, vx, vy, vz, age }` on the player's physics with a 0.25 box, picked up within 1 block after 10 ticks, merged, gone at 6000 ticks.
- Tests: `dirt by hand is 0.75 s`, `stone by hand is 7.5 s and with a wooden pickaxe 0.5625 s`, `obsidian with a diamond pickaxe is 9.375 s`, `releasing the button resets the crack`, `placing inside the player is refused`, `placing at 4.6 blocks is refused`, `sand with air below falls next tick`, `a dropped item is picked up and stacks`, `breaking damages the tool and a tool at 0 is gone`.

### Task 2.4: The 2 × 2 crafting and the recipe table

**Files:** `rules/crafting.js`, `rules/recipes.js`, `rules/crafting.test.js`.
**Interfaces:** `RECIPES: Array<{ shape?: string[] (rows, letters), key?: { [letter]: item | item[] }, items?: item[] (shapeless), result: { item, count } }>`; `match(grid: (item | null)[], size: 2 | 3) → { result, consume: index[] } | null` (shaped recipes match at any offset and mirrored; a 2 × 2 recipe matches in a 3 × 3). The table: planks (any log → 4), sticks (2 planks → 4), the crafting table (4 planks), the five tool tiers with their shapes, torches (coal or charcoal over a stick → 4), the furnace (8 cobblestone), the chest (8 planks), ladders (7 sticks → 3), the door (6 planks → 3), the fence (4 planks 2 sticks → 3), slabs (3 → 6), stairs (6 → 4), wool to a bed (3 wool 3 planks), bookshelf, TNT, glass… each as the game has it.
- Tests: `a log anywhere in a 2 × 2 gives 4 planks`, `a pickaxe matches only its shape and in a 3 × 3 at any offset`, `an axe matches mirrored`, `every recipe's result is in ITEMS`, `every key letter maps to items in ITEMS`.

### Task 2.5: The inventory UI and the save

**Files:** `Minecraft.jsx` (the inventory panel, drag and drop, the crafting grid, the hotbar with icons and counts, the held item's icon), `rules/save.js`, `rules/save.test.js`, `module.js` (persist edits on a 5 s timer and on quit).
**Interfaces:** `save.js`: `SAVE = 'tp-mc'`, `SAVE_VERSION = 1`, `pack(g) → { v, seed, time, player, inventory, edits: { [key]: packed }, chests }`, `restore(saved) → { seed, …, edits }`; `newGame` applies the edits to a chunk when it arrives from the worker (`applyEdits`, Task 1.2) and relights it (Phase 3).
- Tests: `a save round-trips the inventory and 100 edits`, `an edit in an unloaded chunk is applied when the chunk arrives`, `a save from a newer version is refused with a fresh game`.
- Browser check: cut a tree, planks, table, pickaxe; build; reload; it is there. Screenshot. Merge as PR 2.

## Phase 3: light and the day (PR 3)

### Task 3.1: Light
**Files:** `rules/light.js`, `rules/light.test.js`, `worker.js` (lights a chunk after generating, before meshing), `rules/game.js` (relights on `set` and sends the affected sections to re-mesh).
**Interfaces:** `lightChunk(chunk, neighbours)` (sky columns from the top, then the flood), `relight(world, x, y, z) → Set<sectionKey>` (the game's removal-then-spread with a queue; returns the sections touched for re-meshing).
- Tests from the spec's `light` list: `15 under the open sky`, `0 under a solid roof`, `14 beside a torch, 13 one block on`, `placing a roof darkens below and removing it lights again`, `a torch under a roof lights to 14 and removing it returns to 0`, `no light through bedrock`, `sky light falls by 1 through leaves`.

### Task 3.2: Time, the sky and the brightness
**Files:** `rules/time.js`, `rules/time.test.js`, `scene/sky.js` (extend), `shaders.js` (the `daylight` uniform).
**Interfaces:** `daylight(time) → 0…1` (1 from 1000 to 11000, falling to the floor over 13000 to 13500 as the game's curve, up again at 22500 to 23500), `sunAngle(time)`, `skyColour(time, biome) → { sky, fog, horizon }`, `moonPhase(time) → 0–7`. The sky's dome follows it; the stars fade in under 0.3 daylight; the horizon turns orange at the two ends.
- Tests: `daylight at noon is 1, at midnight the floor`, `a day is 24000 ticks and wraps`, `moon phase advances each day`.

### Task 3.3: Torches, glowstone, the bed
**Files:** `rules/blocks.js` (torch shape and state), `rules/mesher.js` (torch and bed meshes), `rules/game.js` (sleep: in a bed from 12541 to 23458 sets time to 0 and spawn to the bed).
- Tests: `sleeping at night sets morning and the spawn`, `the bed refuses by day`. Browser: a night, a torch, the morning. Merge as PR 3.

## Phase 4: underground (PR 4)

### Task 4.1: Caves, ores and lava
**Files:** `rules/worldgen.js` (extend), `rules/worldgen.test.js`.
- Cheese: 3D noise at 1/64 over threshold 0.55 (0.45 under y 30); spaghetti: `|n1 × n2| < 0.03` at 1/32; lava replaces air below 10. Ores: blobs of 4 to 12 placed from `chunkRandom` at the game's counts a chunk (coal 20 × 17, iron 20 × 9, gold 2 × 9, redstone 8 × 8, lapis 1 × 7, diamond 1 × 8), replacing stone only.
- Tests: `some air below y 40 in a 5 × 5 chunk sample`, `every ore in its depth range`, `diamond count per chunk between 0 and 12 on average over 50 chunks`, `lava only below 10`.

### Task 4.2: Water and lava flow, sand, obsidian
**Files:** `rules/fluids.js`, `rules/fluids.test.js`, `rules/game.js` (the update queue).
- `state` is the level: 0 source, 1 to 7 flowing (water), 1 to 3 (lava); an update every 5 ticks (water) and 30 (lava); spread sideways to level + 1 when under 7, fall straight down as 1 first; a source beside two sources becomes a source (infinite water); lava meets water: flowing lava → cobblestone, lava source → obsidian.
- Tests: `a source on flat ground reaches 7 blocks out in 35 ticks`, `water falls before it spreads`, `two sources make a third`, `lava on water makes obsidian`, `lava flows 4`.

### Task 4.3: The shapes: slabs, stairs, doors, ladders, torches drawn
**Files:** `rules/mesher.js`, `rules/mesher.test.js`, `shaders.js` (animated water and lava: `frames` from the manifest, the layer advanced by `time`).
- Tests: `a bottom slab is half high and culls nothing beside it`, `stairs face by state`, `a door is two blocks and swings`, `a ladder is one thin face on its wall`.

### Task 4.4: The furnace, the chest, hunger, food, death
**Files:** `rules/furnace.js`, `rules/chests.js`, `rules/player.js` (hunger, regen, death), `Minecraft.jsx` (the three panels, hearts and hunger, the death screen).
- Furnace: 200 ticks an item; fuel in ticks: coal 1600, planks 300, log 300, stick 100, lava bucket 20000 (no buckets yet: lava 20000 as a placeholder is wrong; leave lava out until buckets). Hunger: −1 every 80 ticks sprinting, −0.2 a jump… use the game's exhaustion: 4 exhaustion = 1 hunger; sprint 0.1 a metre, jump 0.05, attack 0.1, hurt 0.1; regen 1 health every 80 ticks at hunger 18+; starve at 0 to 1 health. Death drops the inventory as entities, respawn at the bed or spawn with full stats.
- Tests: `a furnace with coal smelts 8 iron`, `a chest holds 27 and saves`, `sprinting 40 m costs 1 hunger`, `health regenerates at hunger 18`, `death drops the inventory and respawns at the bed`. Merge as PR 4.

## Phase 5: mobs (PR 5)

### Task 5.1: Box models from data
**Files:** `scene/models.js`, `scene/models.test.js` (the UV net is pure: test it), `rules/mobs/shapes.js` (the part tables).
**Interfaces:** `PART = { name, size: [w, h, d] (pixels), pivot: [x, y, z], offset: [x, y, z], tex: [u, v], mirror?: bool, inflate?: number }`; `MODELS = { player: { texture: 64 × 64, parts: [head (8,8,8) pivot (0,24,0) offset (−4,0,−4) tex (0,0); hat (8,8,8) tex (32,0) inflate 0.5; body (8,12,4) pivot (0,12,0) tex (16,16); rightArm (4,12,4) pivot (−5,22,0) tex (40,16); leftArm tex (32,48); rightLeg (4,12,4) pivot (−1.9,12,0) tex (0,16); leftLeg tex (16,48)] }, zombie: player with tex 64 × 64, skeleton: arms and legs (2,12,2), creeper: { 64 × 32, head (8,8,8) pivot (0,18,0) tex (0,0); body (8,12,4) pivot (0,6,0) tex (16,16); four legs (4,6,4) tex (0,16) at (±2, 0, ±4) }, pig: { 64 × 32, head (8,8,8) tex (0,0) pivot (0,12,−6); snout (4,3,1) tex (16,16); body (10,16,8) tex (28,8) rotated 90° about x; legs (4,6,4) tex (0,16) }, cow, sheep (with the wool overlay inflated 1.75 on the body and 0.6 on the head), chicken, spider, enderman, villager }` with the game's values. `uvFor(part, textureSize) → Float32Array` by the standard net: top `(u+d, v)` w × d; bottom `(u+d+w, v)` w × d; right `(u, v+d)` d × h; front `(u+d, v+d)` w × h; left `(u+d+w, v+d)` d × h; back `(u+2d+w, v+d)` w × h; `mirror` flips u on every face. `buildModel(model, skin: THREE.Texture) → { group, parts: { [name]: THREE.Object3D } }` in `MeshBasicMaterial`-like lighting (the block light at the mob's position × the face shade, through the same brightness curve, as a uniform on a small shader).
- Tests: `the player's head front face maps to (8,8)-(16,16) of 64 × 64`, `a mirrored part reverses u`, `every part's net fits inside the texture`.

### Task 5.2: Mob rules and spawning
**Files:** `rules/mobs/index.js`, `rules/mobs/animals.js`, `rules/mobs/hostile.js`, `rules/spawn.js`, tests for each.
**Interfaces:** `makeMob(kind, x, y, z) → { kind, x, y, z, vx, vy, vz, yaw, health, box: { w, h }, state: 'idle' | 'wander' | 'look' | 'chase' | 'flee' | 'fuse' | 'attack' | 'burn' | 'dead', timer, target }`, `stepMob(g, mob) → events` on `physics.moveBox`; `spawnTick(g)` every tick: the hostile cap 70 ÷ (chunks ÷ 289)… use the game's: a cap of 70 hostile and 10 animals per 289 loaded chunks scaled; a try a tick at a random loaded chunk, a random column, light ≤ 7 for hostile on a solid block with two air, ≥ 24 and ≤ 128 from the player; despawn at > 128 at once and 1 in 800 a tick beyond 32.
- The numbers from the spec's table. Combat: the player's hit is 1 by hand, sword 4/5/6/7 by tier (wood 4, stone 5, iron 6, diamond 7), with 0.5 s of invulnerability after a hit and knockback 0.4; mobs flash red 10 ticks and die with a fall-over over 20 ticks.
- Tests from the spec's list, plus `a creeper within 3 blocks fuses for 30 ticks then explodes, removing blocks within 3 by hardness` and `a zombie in daylight burns 1 a second`.

### Task 5.3: Drawn, animated, heard
**Files:** `scene/entities.js`, `sounds.js`, `Minecraft.jsx` (the arm swing and hit).
- Limb swing: legs ±45° × sin(distance walked × 0.6662), arms opposite; the head turns to the target; the creeper swells 30% over its fuse; a hurt mob tints red; the first-person arm from the player model's right arm, swinging on a dig over 6 ticks.
- `sounds.js`: `createSounds(bus, ctx) → { play(name, { x, y, z }?), mute }` for `dig_grass, dig_stone, dig_wood, dig_sand, dig_gravel, dig_cloth, dig_glass, dig_snow, step_<same>, place, pop, hurt, fall, splash, swim, creeper_hiss, explode, zombie, skeleton, spider, enderman, pig, cow, sheep, chicken, door, levelup, eat, bow` synthesised, and `ambient()` the piano. Positional through a `PannerNode` per play.
- Browser: survive a night. Merge as PR 5.

## Phase 6: biomes and builds (PR 6)

### Task 6.1: The biome set
`rules/worldgen.js`: temperature and humidity noises at 1/256; the table from the spec; surfaces, tints (the `tints` texture sampled by the shader from the vertex's biome, passed as two bytes in place of `tint` when non-zero… keep `tint` and add `temp, humid` bytes: the vertex grows to 10 bytes, or pack them in the two spare bits; decide in the task), trees per biome, plants, sugar cane, cacti, pumpkins, snow and ice, the swamp's water colour. Tests: `the desert has sand and cactus and no trees`, `the taiga's trees are spruce`, `a tundra's water freezes`.

### Task 6.2: The village
`rules/structures/village.js`: a 2-to-6-house village on flat plains or desert (the biome's materials), laid out from a well with paths, a farm with wheat, lamps (torches on fences), doors; houses as templates (`{ size, blocks: string rows per layer }`); placed as features so they span chunks; villagers spawned inside. Tests: `a village has a well and at least two houses`, `no house floats or sinks (its floor is at the surface ± 1)`.

### Task 6.3: Block statues of the site's own models
`scripts/mc-voxelize.mjs <glb> <name> --size 24 [--blocks wool|stone]`: loads the GLB with `@gltf-transform/core`, rasterises triangles into a grid at `size` blocks on the longest side (a conservative triangle-box test), fills the inside by parity, picks the nearest block by the triangle's base colour (vertex colour or the material's `baseColorFactor` sampled from its texture's average under the triangle) from a palette (the 16 wools, the coloured blocks, stone, planks), writes `src/components/minecraft/rules/structures/statues/<name>.json` (`{ size, blocks: [[x, y, z, id], …] }`). Three statues placed as features near spawn: `public/models/gen3d/x-wing.glb`, Optimus (the Cybertron model, whichever is a plain mesh), the Ring's band (`public/models/universe/ring…`, check the path). A sign in front of each. Tests: `a unit cube GLB voxelises to a solid size × size × size`, `a hollow sphere is filled`.

### Task 6.4: The visitor's own pack
`pack/packStore.js` (IndexedDB after `n64/romStore.js`), `pack/zip.js` (`fflate` unzip to a `read` function), `Minecraft.jsx` (the Textures panel), `scene/atlasTexture.js` (`rebuild(atlas)` swaps the arrays and the skins without a reload; the mesher's layer indices are the manifest's order, which `buildAtlas` keeps from the `blocks` list, so no re-mesh). Tests: `a zip with assets/minecraft/textures/block/stone.png is read`, `a jar (zip) is read the same`, `the store round-trips a File`. Browser: load a pack, see the textures change. Merge as PR 6.

## Phase 7: polish (PR 7)

- `scene/particles.js`: break crumbs (16 from the block's texture, 1/4 block, on the physics), torch smoke, splash.
- Third person (F5): the player model from Task 5.1 with the camera 4 m back, colliding with blocks.
- F3's debug line: `XYZ`, chunk, biome, light (sky, block), facing, fps, chunks loaded and drawn, draw calls.
- Ghosts: `useTravellers` on a `minecraft` room; each ghost is the player model with their skin (the default) and the held item's icon over their head.
- Touch layout options: the stick's size, the buttons' side.
- The pause menu's "The real thing" link to https://classic.minecraft.net, opening a new tab.
- `scripts/mc-check.mjs` grows: dig, place, craft, a night, a mob in view, each screenshotted.
- The handoff's Left list emptied or carried; `docs/architecture.md`'s paragraph brought up to date; the README row.

## Self-review notes

- Every spec section maps to a task: textures (1.3, 6.4), the real thing (7), rules and worker (1.x), the look (1.11), performance (1.9, 1.11), phones (1.12, 7), the world's generation (1.5, 4.1, 6.1), light (3.1), blocks (1.1, 4.3), breaking and placing (2.3), fluids (4.2), time (3.2), mobs (5.x), the player (1.7, 4.4), inventory and crafting (2.2, 2.4), saves (2.5), ghosts (7), UI (1.12, 2.5, 4.4), entry and registries (1.12), phases as PRs (each phase's last task), testing (every task), rules (Global Constraints).
- Names used across tasks: `makeChunk/get/set/packEdits/applyEdits` (1.2) in 1.5, 1.8, 2.5; `meshSection` (1.6) in 1.9; `moveBox` (1.7) in 2.3, 5.2; `raycast` (2.1) in 2.3; `match` (2.4) in 2.5; `relight` (3.1) in 2.3's break and place; `uvFor/buildModel` (5.1) in 5.3 and 7.
- The vertex format decision in 6.1 (biome bytes) is left to the implementer with two named options; everything else is fixed.
