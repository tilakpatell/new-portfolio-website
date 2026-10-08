# The nature kit on the Star Wars worlds

Date: 2026-10-08. Branch `claude/portfolio-assets-integration-298166`.

## What was asked

"We have a lot of new assets like nature. See how we can use these optimized assets in our worlds like the Star Wars worlds to make them lively. There is a lot of research on Bruno Simon's worlds, so see how we can use these asset packs and implement them."

The packs are the owner's Quaternius CC0 packs (`tilakpatell/tilakverse-assets`, and the `assets-quaternius` release). The worlds are the 17 walkable Star Wars planets under `src/components/galaxy/surface/`.

**Success:** walking on Naboo, Endor, Yavin 4, Dagobah, Sorgan, Lothal and Scarif, the ground reads as growing: flower meadows, mixed shrubs and ferns, mushrooms, pebbles and stepping-stone trails, trees with their own leaves. The plants move in the wind and lean away when you push through them. No frame over budget (`lib/budgets.js`), no new textures past the contract (`docs/research/2026-10-05-textures-and-asset-quality.md`: at most 60 live textures), and nothing breaks on low or on a phone.

## What exists (2026-10-08)

- **No optimized copies exist.** "Optimized" has to be made: the megakit is 116 glTF models, 342k triangles, 24.6 MB of float geometry and 52.9 MB of PNG (bark 2048², normal maps 2048²). Nothing from it is in `public/`.
- **The surface already scatters models.** `site.scatter` entries go through `scene.js`'s annulus scatter into `placer.scatter(kind, items)`, which draws a catalogue model (`catalog/*.js`, `public/models/galaxy/surface/<kind>.glb`) as one `InstancedMesh` per part, with a far light copy (`.lod1.glb`, `wantsLod`) and near-only shadow casters.
- **Wind exists for code-built plants only.** `lib/three/foliage.js` `wind()`, `wrapLighting()`, `faceless()` go on the kit's leaf materials (`kit.js`). A scattered GLB gets none of it: Sorgan's firs and Scarif's palms stand still.
- **The megakit's materials are shared by name.** Every fern, plant, clover and flower uses `Leaves` and `Flowers`; every rock `Rocks`; every path and pebble `PathRocks`; each tree species one bark and one leaf material. Trees are two primitives (bark, leaves).
- **Its vertex colours are shader masks, not colours.** Grass 0 at the root to 1 at the tip, bark 0.08 to 1, plants 0 to 0.96. three.js multiplies them into the colour: grass comes out black at the root, bark near-black at the foot.
- **Bruno's 2025 folio** (`docs/research/2026-10-08-folio-2025-physics-terrain-streaming.md`): two-tone colour pairs per species, one wind function for everything, grass flattened where the car goes, props that react, everything instanced.
- **Open work on the same files:** PR #656 (cells for put things; it does not touch `scatter`'s body), PR #566 (Mustafar and Nevarro lava, `sites/outer.js`), the Kashyyyk session (`sites/forest.js` Kashyyyk block). This work avoids Kashyyyk and keeps its edits to `placer.js` and `scene.js` small and local.

## Design

### 1. The import: `scripts/quaternius-nature.mjs`

One script, like `scripts/galaxy-surface-lod.mjs` (gltf-transform, meshoptimizer, sharp):

```
node scripts/quaternius-nature.mjs [--from <megakit glTF dir>] [kind …]
```

`--from` defaults to the asset repo's clone (`$TMPDIR/tilakverse-assets/quaternius/stylized-nature-megakit/glTF`), then `lab/assets/naturemega/…/glTF` (`scripts/assets-fetch.mjs naturemega`). For each pick in its table (`kind → source file`), it:

1. reads the glTF, keeps the one mesh, stands it on y = 0 with x and z as the pack has them (the foot of the trunk at the origin, where the placer puts its solid);
2. **turns the vertex masks into light:** each material family's mask remapped to a grey multiplier (grass and plants: darker at the root, as ambient occlusion; bark: a little darker at the foot; leaves: dropped, they're all 1). The grey keeps the instance tint (below) as the colour;
3. **fixes the alpha:** leaves and flowers MASK at cutoff 0.35 (the cherry's BLEND too: no sorting), bark and rocks OPAQUE and single-sided;
4. **shrinks the pictures:** WebP, bark and its normal map 512², leaf cards and sheets 512², grass 256², rocks 512², all by `textureCompress`;
5. welds, quantizes and meshopt-compresses (`level: 'medium'`);
6. writes `public/models/galaxy/surface/<kind>.glb`; for trees, a `.lod1.glb` beside it (`makeLod` from `galaxy-surface-lod.mjs`, the line lowered for these: any tree over 3,000 triangles).

Kind names are `nk` + species + number (`nkbirch1`, `nkfern1`, `nkflowers2`): never a kind the code builds (`fern`, `rock`, `bush`), so the code-built ones keep working.

### 2. The catalogue: `catalog/nature.js`

A group of its own. Each entry: `{ cc0: 'quaternius', from: 'Birch_1', as, metres, sway, lod, tris, tex }`.

- `sway` is how it moves: `tree` (bark still, leaves sway and flutter), `shrub`, `grass`, or nothing (rocks, paths, pebbles, mushrooms).
- `catalog.test.js` takes a third source: `cc0: 'quaternius'`, no uid, listed in `public/cc0/README.md` (a `models/galaxy/surface/{…}.glb` line in its CC0 part, which `madeKinds` already reads), and present in `public/games/credits.json` once as the pack, so `scripts/credits.mjs` names Quaternius in CREDITS.md.

### 3. The look at run time: `surface/nature.js`

`natureLook(gltf, entry)`, called once per loaded file from `placer.loadModel` (one line, beside `look` and `tint`):

- **Shared by name, page-wide.** Each material is swapped for the first one of its name (`Leaves`, `Bark_Birch` …), its own textures freed. A planet with ten plant kinds uploads `Leaves` and `Flowers` once and links one shader for them. A world uses at most 14 of the kit's textures.
- **Leaves lit as leaves:** `wrapLighting` and `faceless` on the leaf, flower and grass materials, `alphaToCoverage` on their cut-outs.
- **One wind:** `wind()` with `sway`'s numbers (a new `grass` row in `foliage.js` `WIND`: height 1.2, stiff root, quick tips), all on one page clock, `NATURE.time`, which the placer sets from the kit's clock each frame (so reduced motion, which stops `kit.tick`, stops these too) and whose direction it sets from the world's wind.
- **Pushed aside:** a second vertex rewrite on the shrub and grass materials, `pushShader`: within `uPushR` (1.6 m) of `uPush` (you), each vertex is moved away from you by its height squared, so ferns, flowers and grass part as you walk through and spring back. `placer.update(t, dt, you)` sets `uPush`. Pure string rewrite, tested like `windShader`.
- **Tintable:** leaf and grass materials are marked `userData.tintable`.

### 4. Colour pairs: `tint` on a scatter entry

`{ kind: 'nkfern1', n: 400, tint: ['#4c6232', '#6e7d3a'] }`: each instance's colour picked between the two (Bruno's colour pair a species), drawn through three's `instanceColor` on the tintable parts only (the bark stays bark). The near/far split (`fillSplit`) copies the colours with the matrices, so they don't shuffle as you walk. Without `tint`, nothing changes.

### 5. Trails: `path` on a scatter entry

`{ kind: 'nkpath1', path: [[x, z], …], spacing: 1.6, jitter: 0.3 }`: the items laid along the polyline in place of the annulus, each turned along it, a little off the line, sunk 3 cm, never solid. The scatter loop in `scene.js` gets the branch (a few lines). Stepping stones from the landing to the places people walk to.

### 6. The worlds

What each gets (counts at high; `amounts.scatter` scales them, 0.5 at low, 0.6 on a phone):

| world | what it gets | why |
| --- | --- | --- |
| Naboo | flower meadows (`Flower_*_Group`, two colour pairs), flowering bushes, clover, a few cherry blossoms round Varykino's lawn, round rocks in the grass, a stepping-stone trail from the landing toward the farm and Theed | the meadow picnic in *Attack of the Clones*; Naboo's lake country |
| Endor | mushrooms (red caps, bracket fungi) on the floor, big-leaf plants and clover between the ferns, pebbles, a trail toward the bunker | the forest floor of *Return of the Jedi* |
| Yavin 4 | big jungle plants, large bushes, oyster mushrooms, twisted trees on the jungle's edge | the Massassi jungle |
| Dagobah | dead and twisted trees in the bog, red caps and common toadstools, low plants | Yoda's swamp |
| Sorgan | Sorgan's own birches at last (the megakit's, with Sketchfab's firs), wispy grass clumps, flowers, mushrooms, pebbles, a trail to the village | *The Mandalorian* chapter 4 |
| Lothal | tall wheat grass and wispy tall grass in drifts, big rocks | Lothal's grass plains (*Rebels*) |
| Scarif | low broad plants and long bushes at the jungle's edge | the beach jungle of *Rogue One* |

Kashyyyk, Hoth, Tatooine, Mustafar, Geonosis, Bespin, Coruscant, Kamino, Mandalore and Nevarro get nothing: no fitting plants, or another session's work.

### Budgets

- Per world added, at high: at most 500k triangles drawn (the full models near, light copies far), at most 30 draw calls (each kind is one or two parts; shadow casters near only).
- Textures: shared by name, so at most 14 live textures on a world from the kit (22 across all of it).
- Download: at most 6 MB for a world's nature kinds (each GLB under 600 KB; trees with their LOD).
- `lowerQuality` and low tier keep working as they do: the scatter count already scales.

## Testing

- `catalog.test.js`: the third source; every nature GLB present, small enough, LOD beside each marked one.
- `nature.test.js`: `pushShader` rewrites (and leaves a shader without `begin_vertex` alone); `natureLook` shares materials by name, frees duplicates, marks tintable, applies wind once.
- `placer.test.js`: `tint` sets instance colours on tintable parts only; a split copies colours with matrices.
- A test for the trail layout (pure: `trailItems(path, { spacing, jitter, seed })`).
- `sites.test.js` already checks every scatter kind is placeable.
- In a browser (headless Chromium on Metal with `--disable-gpu-vsync --disable-frame-rate-limit`): before and after shots of the seven worlds; `npm run perf` on a surface journey for frame times.

## Out of scope

The other packs (space kit, farm animals, city kits), Middle-earth and the Expanse, falling petals and leaves, physics on plants, grass flattening under feet (the grass's own `tracks` already does that for vehicles).
