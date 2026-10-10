# Star Wars Battlefront II (2017) (used with permission)

The owner’s extraction of EA DICE’s Star Wars Battlefront II (2017), used with permission on this non-commercial fan project ([the decision](../decisions/2026-10-10-battlefront-2017-assets.md)). It lives in two private buckets on the owner’s Supabase project:

- **`bf2017-assets`**: the 2017 game. `web/models/` (one GLB a model a LOD: `<name>_mesh.glb`, `<name>_mesh_lod1.glb` … `_lod5.glb`), `web/collision/` (a collision GLB a model), `web/textures/` (still uploading: KTX2 now, PNG perhaps later), `web/models.jsonl` (the manifest: one line a model, 13,871 of them, with the LOD chain, bounds, rig, textures and the derived maps’ recipe) and `data/` (Frostbite records, reference only).
- **`bf2-extract`**: the classic (2005) edition. Empty so far; `scripts/battlefront-import.mjs` is its importer if it fills with `.msh` and `.tga`.

The GLBs are `gltfpack` output (meshopt, quantised, metal-rough) whose textures are **not embedded**: each names a KTX2 by a path relative to itself (`../../../../../textures/<path>/<name>_cs.ktx2`). A model fetched without its textures draws nothing.

## Fetching

The keys: `SUPABASE_URL` and `BF2017_KEY`, a key that can read the bucket, in `.env.local` (never committed; `.env.example` names them). In a cloud session they are already in the environment, where the key may go by `SUPA_KEY`; the fetch takes either name and never prints it. Everything lands in `lab/assets/bf2017/` (git-ignored) in the bucket’s own layout.

```
node --env-file=.env.local scripts/bf2017-fetch.mjs manifest
node --env-file=.env.local scripts/bf2017-fetch.mjs --list 'characters/hero/luke/*'
node --env-file=.env.local scripts/bf2017-fetch.mjs <name> [--lod all|0,2] [--parts '*_cape_mesh'] [--no-textures] [--collision]
```

A texture the bucket has not got yet prints `missing`: the upload is still running.

## Importing

```
node scripts/bf2017-import.mjs <name> --kind <kind> --as '<what it is>' [--asis | --metres 1.83] [--rig] [--crew] [--hero] [--ultra] [--tex 1024] [--maps 512]
node scripts/glb-shot.mjs public/models/galaxy/surface/<kind>.glb out.png three
```

The import picks the site’s cuts from the LOD chain, turns the textures into WebP at the site’s sizes, grounds the model, writes the row into `src/components/galaxy/surface/catalog/bf2017.js` and the credit into `src/data/modelCredits.json`. Its header comment has every flag.

## What a texture is

Read from the uploader’s test PNGs (`inventory.md`, “What a texture is”):

| suffix | what |
| --- | --- |
| `_CS` | RGB colour, A smoothness (roughness = 1 − A) |
| `_NAM`, `_NOM`, `_NOS`, `_NAOS`, `_NMA`, `_NW`, `_NA` … | RG normal x and y (z rebuilt), B and A occlusion, metal or smoothness, as the manifest’s `derived` recipe names per material |
| `_N`, `_NM` | a plain normal |
| `_C` | plain colour |
| `_RGBA`, `_RGB`, `_M`, `_ID`, `_E`, `_H`, `_AOSL` | masks, IDs, emissive, height, AO slices: the Frostbite shaders’ extras, unused |

The uploader’s derived maps, `<map>__normal.ktx2` and `<map>__orm_<hash>.ktx2`, are already split for glTF; when only the raw PNG is there, the import rebuilds them from `derived` (`scripts/lib/bf2017-textures.mjs`).

## The rig

The people are on `Walrus_HumanMale`, about 250 joints named as Maya HumanIK names them, which is Mixamo’s naming without the `mixamorig:` prefix (`Hips`, `Spine`, `Spine1`, `LeftArm`, `LeftHandIndex1` …). The import’s `--rig` keeps it whole, as DICE made it (fingers, the 79 face bones, cloth physics, the `Wep_*` and `IK_Joint_*` sockets), and renames nothing, so the game’s clips can drive it as they were made to. A `grip` node is put under `Wep_Root` (the weapon socket in the right hand), or `IK_Joint_RightHand` where there is none.

## Credit

Every model: `author` EA DICE, `license: 'permission'`, and the permission text “From EA DICE’s Star Wars Battlefront II (2017), used with permission on this non-commercial fan project; Star Wars and everything in it belong to Lucasfilm.” The import writes it; never by hand. No sequel-era model ships: the import refuses those folders.

The counts, LOD chains and sets by world: [`docs/superpowers/evidence/bf2017-assets/inventory.md`](../superpowers/evidence/bf2017-assets/inventory.md).
