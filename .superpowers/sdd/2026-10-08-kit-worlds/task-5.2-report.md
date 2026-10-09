# Task 5.2 report: `scripts/vat-bake.mjs`

Branch `claude/kit-rigging`, not pushed.

## What was implemented

`scripts/vat-bake.mjs` (CLI, ~190 lines):

```
node scripts/vat-bake.mjs <body.glb> --clips own | <[name=]clip.glb[#Take]>,… [--only Run,WalkSlow] [--fps 24] [--name <base>] [--out <dir>]
```

- **Loading.** It uses three's `GLTFLoader.parse` in Node, the same way `scripts/ual-bake.mjs` does, with `setMeshoptDecoder` from `three/examples/jsm/libs/meshopt_decoder.module.js`. The header says so.
  - Before parsing, it strips images, textures, samplers, material texture references and `KHR_/EXT_texture_*` extensions out of the GLB's JSON chunk (`withoutImages`).
  - The reason: a textured body (any Meshy figure) makes GLTFLoader crash in Node with `self is not defined` inside `loadImageSource`. I hit this with an unstripped checker on `alanrails.glb`; with the strip the bake runs.
- **Skeleton.** The joints are the first `SkinnedMesh`'s `skeleton.bones` (the GLB skin's order). Every further skinned mesh is compared by bone identity and `bindMatrix`. If one differs, the script warns that the texture skins only the first's. The horse's two skinned meshes share one skeleton, so there is no warning.
- **Matrix.** `M_j = rootInverse × bone.matrixWorld × boneInverse_j × mesh.bindMatrix`, with root = `gltf.scene`. Packing and the layout come from vat.js's own `packSkinMatrix`, `vatTexel`, `vatLayout` and `toHalf`, so the layout formula lives in one place.
  - **Finding:** GLTFLoader always calls `mesh.bind(skeleton, identity)`, so `bindMatrix` is the identity for every GLB body. In attached bind mode three cancels the skinned mesh node's own transform.
  - The fixture moves its mesh node by 0.25 in z on purpose. The test checks that the bake ignores that offset, matching three's `applyBoneTransform` followed by `matrixWorld`.
- **Clips.**
  - `own` is the body's own animations; `--only` keeps a subset in the file's order and fails on a name the body doesn't have.
  - Borrowed files: each file's first clip, or its `#Take`. The clip is named by the file's base name (e.g. `ual-drive`) or by `name=`.
  - `own` and borrowed files can be mixed in one list. A duplicate clip name is an error.
- **Retarget.** Borrowed clips go through `clipLibrary.js`'s `retarget()`: quaternion tracks only, with `Hips.position` scaled by the body's Hips rest y over the file's Hips rest y (`RICK_HIPS` if the file has none). Those lines are **copied, not imported**: `clipLibrary.js` imports `./gltf` without an extension, which in turn imports `./textures`, and Node can't resolve either. The header says this. `faceForward` is not applied, because it runs only when a caller passes `up`.
- **Frames.** Each clip gets `length = max(1, round(duration × fps))` rows sampled at `k / fps` with `mixer.setTime`, one action at a time (`stopAllAction` between clips). Clips are laid end to end. More than 4096 rows is an error that exits 1.
- **Output.** Default `--out` is the body's folder.
  - `<name>.vat.bin`: Uint16 half floats, little-endian, written with `writeUInt16LE`.
  - `<name>.vat.json`: `{ bones, frames, fps, clips, names, bin }`.
  - It prints the byte count.

`scripts/fixtures/kit/make-tiny-rig.mjs` (gltf-transform, about 45 lines, the `make-tiny.mjs` pattern) writes `scripts/fixtures/kit/tiny-rig.glb` (2180 B):
- An Armature at (1,0,0) with the bones Root → Tip (0,1,0).
- A 6-vertex, 4-triangle quad skinned to them (bottom row on Root, middle row split 0.5/0.5, top row on Tip), on a mesh node offset by (0,0,0.25).
- One clip, `pose`, 1 s long: Root rises 0.5 and Tip turns 90° about z at 0.5 s, then both go back.

## Tests: `scripts/vat-bake.test.mjs` (3 tests, run through the CLI with execFileSync into a temp dir)

1. **`--clips own`.**
   - The JSON equals `{ bones: 2, frames: 24, fps: 24, clips: { pose: [0, 24] }, names: ['Root','Tip'], bin: 'tiny-rig.vat.bin' }`.
   - The bin is `texels × 8` bytes and the log prints 1152 bytes.
   - `vatSample(bin, layout, 1, 12)` matches the mixer's matrix at t = 0.5 within 1e-2.
   - The same holds for both bones at all 24 frames.
   - Every quad vertex, CPU-skinned with `skinVertex` on the baked matrices, matches three's `applyBoneTransform` followed by `matrixWorld` within 1e-2 at every frame.
2. **Borrowed clip.** `--clips again=<rig>#pose --fps 12` gives `clips.again [0, 12]`. At frame 6, Root sits at its rest matrix (its translation track was dropped by the retarget) and Tip still has its quarter turn.
3. **`--fps 5000`** (5000 rows) fails with a message that mentions 4096.

Timing: 179 ms, 131 ms and 128 ms per test; the file takes about 0.93 s in vitest. Each CLI run is about 0.14 s.

Mutation checks:
- Keeping position tracks in `retarget` makes test 2 fail.
- Removing `× bindMatrix` makes no difference, because `bindMatrix` is always the identity from GLTFLoader (see the finding above).

### TDD evidence
- RED: `npx vitest run scripts/vat-bake.test.mjs` gave 3/3 failing with `MODULE_NOT_FOUND` for `scripts/vat-bake.mjs`. This was expected, since the script did not exist yet.
- GREEN: the same command gave `Tests 3 passed (3)`, Duration 945 ms. The one intermediate failure was my own wrong expected byte count in the test (384 instead of 1152); I fixed the test, not the script.

### Real bodies (scratch output in the scratchpad, nothing committed)
- `public/kit/farm/horse.glb --clips own --only Run,WalkSlow` gives 45,696 bytes (28 bones × 68 frames: WalkSlow 48, Run 20) in 0.14 s.
- All six horse clips give 231,168 bytes (344 frames). A scratch check CPU-skinned every 7th vertex of both skinned meshes at the start, middle and end of each clip against three's own skinning. The worst error was 0.0023 units on a model 8.3 units across (half precision).
- `public/games/meshy/alanrails.glb --clips ride=ual-drive.glb,idle=ual-idle.calm.glb,own` gives 58,176 bytes (24 bones × 101 frames: ride 40, idle 60, plus its own one-frame clip). `names` starts with `Hips, Spine02, …`. The run was quiet, with no loader noise.

## Files
- `scripts/vat-bake.mjs` (new)
- `scripts/vat-bake.test.mjs` (new)
- `scripts/fixtures/kit/make-tiny-rig.mjs` (new)
- `scripts/fixtures/kit/tiny-rig.glb` (new, generated)

## Self-review / concerns
- `eslint` ignores `scripts/fixtures/**`, so the generator is not linted; the other two files lint clean.
- The default name for a borrowed clip is the file's base name, a choice the brief left open. 5.3 and 5.4 can rename with `name=`.
- With several borrowed clips, nothing turns them to face the walk's heading (`faceAhead`) as the live animator does when given `up`. Callers that need this should say so; it was not in the brief.
- No new dependency. No docs/stack page is needed, because only three and gltf-transform are used.

## Verification before commit
- `npx eslint scripts/vat-bake.mjs scripts/vat-bake.test.mjs`: clean. The fixture generator is under an eslint ignore pattern, which gave 1 "file ignored" warning.
- `npx vitest run` (whole suite): Test Files 800 passed (800), Tests 9893 passed | 1 skipped.
- Commit: `2861a634 feat(scripts): bake a figure's clips into a vertex-animation texture`

## Fix round 1
Finding: vat-bake.mjs carried a copy of `retarget()` and `RICK_HIPS` from clipLibrary.js.

Changed:
- `src/lib/three/retarget.js` (new): `RICK_HIPS` and `retarget()` moved here verbatim, with a prose header; imports only three.
- `src/lib/three/clipLibrary.js`: imports both and re-exports them (`export { RICK_HIPS, retarget }`), so every caller and `clipLibrary.test.js` (unchanged) work as before.
- `scripts/vat-bake.mjs`: the copies are gone; it imports from `../src/lib/three/retarget.js`; header comment updated.
- `src/lib/three/retarget.test.js` (new): hips position scaled by hipsY / RICK_HIPS (source clip untouched), scaling from `from`, non-quaternion tracks other than Hips.position dropped, null clip, and clipLibrary re-exports the identical functions.
- Not added to vat-bake.test.mjs: the tiny-rig fixture has no Hips bone, so the CLI cannot exercise the path; it is now the same function the unit test covers.

Command: `npx vitest run src/lib/three/retarget.test.js src/lib/three/clipLibrary.test.js scripts/vat-bake.test.mjs src/components/rickmorty/portal/clips.test.js`
Output: Test Files 4 passed (4), Tests 22 passed (22). `npx eslint` on the four changed files: clean. Whole suite (`npx vitest run`): Test Files 801 passed (801), Tests 9897 passed | 1 skipped.
