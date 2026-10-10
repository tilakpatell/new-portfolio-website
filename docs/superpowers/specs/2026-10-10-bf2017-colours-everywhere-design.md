# The game’s colours, correct, on every Star Wars world. The design

Date: 2026-10-10 (night). Status: **design and the first slice, in one PR** (`claude/bf2017-colours-everywhere`), written by a session that could not reach the bucket (no `SUPABASE_URL` or `SUPA_KEY` in its environment) and so built everything that needs no network, measured the files already on `main`, and wrote the bucket-bound steps as commands for the next session. The plan: `docs/superpowers/plans/2026-10-10-bf2017-colours-everywhere.md`. The evidence: `docs/superpowers/evidence/bf2017-colour/`. The hand-off: `HANDOFF-bf2017.md`, “The colours, everywhere”. It sits on the pipeline design (#802), the surfaces design (#844, lanes Q1 to Q6), the accuracy design’s colour lane (#877, `-accuracy-lane-colour.md`) and lane W’s roles (#823), and repeats none of them.

## What the owner asked

“There are BF2 2017 assets in the Supabase. Take all of those assets’ textures and make sure the pipeline has all the colours and they are correct, and then apply them to all of the Star Wars galaxy and worlds. Do this and architect it.”

**What I understood** (the owner corrects any of it):

- *All the colours*: every colour map the drop holds reaches the site through one pipeline, in the colour space the game stored it in, with the game’s own tints (the variation chain) on top; nothing is re-encoded, nothing is guessed.
- *Correct*: measurable. A map is correct when the file says what it is (sRGB for colour, linear for data), every loader reads it that way, and the material multiplies the game’s tints in linear light as Frostbite does. The audit is the gate.
- *Apply them to all the Star Wars galaxy and worlds*: every one of the seventeen landable worlds wears the game’s maps, not only the three on level packs: the people and vehicles already do (`--native`), the props’ trims and the grounds’ grain do once the world’s look says `scanned: 'bf2017'` (lane W made the 29 roles in #823; no world had turned them on).

## The colour chain, end to end

Who decides what a map is, from the game to the pixel. Every row is a place a colour can go wrong; the measured column is what this session found on `main`.

| step | where | what decides the colour space | measured on `main` |
| --- | --- | --- | --- |
| the game’s maps | `textures.jsonl`’s `format` (BC7_SRGB for colour, BC7_UNORM, BC5 for the rest) | the game | 7,104 sRGB colour, 7,037 linear (the surfaces design) |
| the desktop’s encode | `tool/ktx2_encode.py`: ETC1S for colour, UASTC for the rest | the KTX2’s data format descriptor (DFD) transfer function | **the UASTC colour maps are tagged linear**: of the 312 colour maps in the three packs on `main`, 180 said linear |
| the level packs | `scripts/bf2017-level.mjs` drops mips, writes `tex/<slug>.<size>.ktx2` | copied the DFD as it came | the same 180 |
| the crew’s and the recipes’ maps | `scripts/bf2017-recipes.mjs` (`crew/tex/`, published) | copied as it came | not on disk here; the same encode, so the same fault is expected on the emissive maps |
| the native figures and vehicles | `scripts/bf2017-import.mjs --native` embeds the KTX2 in the GLB | copied as it came; three’s GLTFLoader sets sRGB on `baseColor` and `emissive` slots regardless | right by luck of the loader |
| the level loader | `levelGltf.js`’s `bindSlot` | forces sRGB on `map` and `emissiveMap`, “whatever the file says” (its comment records the washed-pale symptom) | right for the GLB’s slots; **a recipe’s emissive map went by the file** |
| the crew’s game material | `crewSurface.js` through `recipeMaps` | by the file | the same gap |
| the roles | `scripts/bf2017-textures.mjs` → WebP; `lib/three/core.js` sets sRGB on the colour map only | the loader | right |
| the tints | `ObjectVariation` vectors (`PaintColour`, `MetalColour`, `ColorTint`) multiplied in `gameMaterial.js` | linear floats, multiplied in linear light | right where read; **no variation is read yet** (the colour lane) |
| the shader depots | hashed parameter names | djb2-xor of the lower-cased name | the dictionary did not exist |

## The design

**1. The files say what they are.** `scripts/lib/ktx2-colour.mjs` reads and stamps a KTX2’s transfer function (one byte in the DFD; nothing re-encoded, every other byte and the level index unchanged, pinned by its test), and knows which of DICE’s suffixes are colour (`_cs`, `_c`, `_co`, `_ca`, `_cw`, `_e`, `_em` …) and which are data (the normals, the packed masks, `_aosl`, `_rgb`, the uploader’s `__normal` and `__orm_<hash>`). Every writer in the pipeline stamps as it writes: the level packs (`bf2017-level.mjs`), the recipes’ and the crew’s maps (`bf2017-recipes.mjs`), the native cuts (`bf2017-import.mjs`, by the glTF slot the map fills). The 180 mislabelled files on `main` are stamped in this PR (`node scripts/bf2017-colour-check.mjs --fix`): the bytes change, the pictures do not, and the mirror manifest does not list them (so nothing is served stale).

**2. The loaders keep their belt.** `bindSlot`’s rule stays, and `recipeMaps` gains the same for a recipe’s colour maps (`families.js`’s `COLOUR_MAP_KEYS`: the emissive; the breakup overlay stays as the file says, its neutral grey being 0.5 read linear). A file stamped right and a loader that forces right agree; a file the bucket still holds unstamped (the crew’s `tex/`, until re-published) is read right anyway.

**3. The audit is the gate.** `node scripts/bf2017-colour-check.mjs --check` walks every KTX2 under the packs and any folder named, says per folder how many colour maps say sRGB and linear, how many data maps say linear, and names each wrong file; it also holds every role to its three maps and its credit. `--formats web/textures.jsonl` takes the game’s own `format` ahead of the suffix rule and decides the maps the rule calls unknown (seven swatches on `main`). It runs with the other checks before a PR; a wrong map fails it.

**4. Every Star Wars world wears the game’s roles.** `sites/index.js`’s `siteOf` gives every galaxy site `look.scanned: 'bf2017'` unless the site says otherwise, so the seventeen worlds’ props and grounds wear lane W’s roles (`public/textures/galaxy/bf2017/`, 29 roles, 16 MB, each from a named map in the drop, credited EA DICE’s) in place of the Poly Haven scans. `sites.test.js` pins it for every landable world; `galaxy-check.mjs` counts the scan fetches per world (`scans cc0 n game n` on its line and in its JSON) and `SCANS=game` fails a surface that fetched a cc0 file. Before-and-after shots of three worlds are in the evidence folder. The Mandalorian-era worlds (nevarro, mandalore, sorgan, lothal) and Coruscant have no game kit, but the roles are generic ground and trim grain, so they wear them too: the owner’s rule is every texture in a Star Wars world is the game’s.

**5. The variation chain, as the colour lane planned it.** The accuracy design’s lane colour (`-accuracy-lane-colour.md`) is the right design for the tints and the per-level texture overrides and is adopted whole: `variations.json` per pack from the MVDBs and ObjectVariations, `levelVariations.js` into Q1’s game material, the material audit per world. Its task 1, the djb2-xor dictionary, is built here (`scripts/lib/bf2017-shader-names.mjs`, `scripts/bf2017-shader-names.mjs`): `hashName` lower-cases as the design says, `hashExact` keeps the case, which is how the type names hash (`Vec` is `0b87fa95` as written, `0b877b75` lower-cased: the design listed the first, the plan’s test the second; both are kept and the depot decides). Its tasks 2 to 6 need the MVDB records and the pack’s textures from the bucket and are the next session’s, with the commands in the plan.

**6. What needs the bucket, and the names it needs.** The next session that holds `SUPABASE_URL` and `SUPA_KEY` (or `BF2017_KEY`) in its environment runs: `--raw textures.jsonl` and the audit with `--formats` (the seven unknowns decided, and the rule checked against the game’s word on every map); `--raw materials.jsonl` and `data 'Objects/**/*Variation*'` and the dictionary CLI (`shaderParams.json`); the colour lane’s writer on Hoth; `bf2017-recipes.mjs --crew all` and `assets-publish.mjs` so the crew’s published maps carry the stamp; `bf2017-textures.mjs` again if any role is re-chosen on its sheet.

## Rules this design keeps

- Nothing re-encoded: a stamp is a byte; the game’s KTX2 stays the game’s (the native rule, section 6 of the pipeline design).
- No run-time call to a service; the roles are committed, the packs published by hash; the key lives in the environment, never printed.
- A world wears one art: the roles are the same roles under the same `wear`/`dress` interface, so `art-mix` counts nothing new.
- A test beside each file, no network; files under 800 lines; British spelling, curly quotes.
- Another session’s open work untouched: the colour lane’s branch (`claude/bf2017-colour`) did not exist on `origin` when this session looked (2026-10-10, 22:00 UTC); this PR takes its task 1 only and says so in the hand-off.

## Departures

- The design’s colour lane said the vehicles’ hand table (#866) is retired by the MVDB binder (task 6). Not here: it needs the bundles’ MVDBs from the bucket.
- The breakup overlay’s colour map is left in the file’s space: making it sRGB would darken every overlay 2.4× at its neutral grey, and the game’s `format` for `BreakUpColorRGBA` is not on disk here; `--formats` settles it.

## What the owner decides next

1. Whether the Mandalorian-era worlds and Coruscant keep the game’s roles (section 4) or a site may opt out (`look: { scanned: 'cc0' }` does it).
2. Whether to put `SUPABASE_URL` and `SUPA_KEY` into the cloud environment’s secrets so the next session finishes sections 5 and 6 without the desktop.
