# Textures, models and quality: what the site has, what helps, and what it costs

Date: 2026-10-05. An audit of every 3D asset and texture path in the repo, with measurements made in this session (file sizes, estimated GPU memory, and encode quality in PSNR against each file's current contents), and a reading of current practice (Khronos's KTX artist guide, three.js r186's loaders, the earlier `2026-10-04-webgl-portfolios.md`). Numbers are from this checkout; the sources the asset scripts download from (Poly Haven, ambientCG, Meshy, Sketchfab) were not reachable from the session, so nothing here was regenerated from its originals.

## What's in the repo

| | Count | On disk | Notes |
| --- | --- | --- | --- |
| GLB models | 478 | 133 MB | all meshopt-compressed; 359 quantized; 330 carry WebP textures (1,037 embedded images, every one WebP) |
| Loose WebP | 402 | 40 MB | planet maps, PBR sets, photos |
| Loose JPEG | 113 | 21 MB | the HQ games' normal and ARM maps, and the 4K sky photos |
| HDR / EXR | 13 / 3 | 5 MB | lighting, 512×256 |
| KTX2 | 0 | 0 | nothing GPU-compressed anywhere |

Texture sizes, loose and embedded: most are 512 or 1024; 9 at 2048, 14 at 4096, 2 at 8192 (Earth's day and night maps).

Estimated GPU memory if a folder's models were all resident at once, as RGBA8 with mipmaps (what WebP and JPEG become once uploaded):

| Folder | GPU est. | Image sizes |
| --- | --- | --- |
| `models/galaxy` | 540 MB | 162 × 512, 51 × 1024, ~200 smaller: many models with 20–40 materials each (`arena.glb` 40 materials, `snowspeeder.glb` 43 textures) |
| `models/sketchfab` | 446 MB | 136 × 512, 49 × 1024 |
| `games/meshy` | 251 MB | 33 × 1024, 12 × 768 |
| `games/caribbean` | 209 MB | 20 × 1024, 6 × 1536 |
| `models/albuquerque` | 165 MB | 31 × 1024 |
| `models/music` | 146 MB | 5 × 2048 |
| `models/universe` | 141 MB | 5 × 2048 |
| `models/invincible` | 125 MB | 5 × 2048 |
| `hq/models` + `hq/tex` | 105 MB + ~190 MB | `hq/tex` is 23 MB of files: 36 sets × 3 maps at 1024 (5.3 MB each resident) |
| Earth 8K day map alone | 171 MB | 8192×4096 RGBA8 + mips; loaded on a `high` desktop with `maxTextureSize ≥ 8192` |

Only a world's own models load, so no page reaches these totals, but the HQ games on a desktop (full-size sets, 40-odd textures) sit around the 256 MB desktop budget the AAA skill uses, and the galaxy's surfaces with their props can pass the 128 MB phone budget.

## How things load today

- **Models**: ~30 separate `new GLTFLoader().setMeshoptDecoder(...)` instances, four of them with caches (`lib/models.js`, `lib/three/rig.js`, `avengers/hq/assets.js`, `galaxy/surface/placer.js`). No Draco (not needed: meshopt), no KTX2, no `THREE.LOD`, no `BatchedMesh`.
- **Textures**: `TextureLoader` everywhere (decodes on the main thread; a 4K JPEG costs ~50–150 ms of jank per image on a phone). No `ImageBitmapLoader`. No `renderer.initTexture` warm-up except the cockpit's `warm`.
- **Settings**: `colorSpace` is set correctly in the shared helpers; anisotropy is budget-driven in `lib/cc0.js`, `lib/hdri.js`, `lib/stage3d.js` but **hardcoded to 8** in `lib/three/rig.js`, `avengers/hq/assets.js`, `universe/planets.js`, `universe/shipModels.js`, `universe/hulls.js`, `universe/footScene.js`, `cybertron/transform3d.js`, `earth/scene.js`, and to 4 in `galaxy/surface/placer.js`, `cockpit/kit.js`, `universe/trafficKit.js`. The `high` tier allows 16. Half the site's models never get anisotropy at all (GLTFLoader's default is 1), so any model's floor, deck or road blurs a few metres out at a glancing angle.
- **Normal maps as JPEG** (`public/hq/tex/*/normal.jpg`, ARM too): JPEG's 4:2:0 chroma subsampling throws away half the resolution of exactly the channels a normal map lives in. Measured below: re-encoding a normal map as JPEG q88 keeps 26.6 dB PSNR in R and G; WebP lossy is no better (27.1 dB) for the same reason.
- **Renderers**: five factories (`lib/three/renderer.js`, `lib/stage3d.js`, `avengers/hq/engine.js`, `office/stage3d.js`, bespoke ones in deathstar/cybertron/middleearth/rickmorty) and three degradation schemes (watchdog, LADDER, pace). Tone mapping is ACES in most scenes, Neutral in the HQ engine and the HQ games, none on the core pages.

## Measurements: GPU-compressed textures (KTX2) against what's there

Encoded with Basis Universal 1.16.3 (`basisu` from npm) from the files in the repo (so the source already carries the WebP or JPEG loss), mipmaps included, zstd on UASTC. PSNR is against the repo file; R and G only for normal and ARM maps. Decoded to BC7 (UASTC) and BC1 (ETC1S), which is what a desktop GPU gets; phones get ASTC and ETC1/ETC2 at the same bit rates.

| Map (1024²) | Now | UASTC (rdo λ=1) | UASTC (rdo λ=3) | ETC1S q200 | ETC1S q255 |
| --- | --- | --- | --- | --- | --- |
| asphalt colour | WebP q84 373 KB (a re-encode at that setting measures 41.4 dB) | 1,228 KB, **43.8 dB** | 1,209 KB, 38.7 dB | 222 KB, **27.1 dB** | 250 KB, 27.9 dB |
| asphalt normal | JPEG 587 KB (JPEG q88 re-encode: 26.6 dB; WebP q92: 27.1 dB; WebP near-lossless: 46 dB at 1,436 KB) | 1,295 KB, **34.1 dB** | 1,203 KB, 30.7 dB | 234 KB, 25.1 dB | |
| asphalt ARM | JPEG 333 KB | 1,255 KB, 37.6 dB (λ=4: 1,072 KB, 33.4 dB) | | 231 KB, 30.8 dB | |
| Earth day 4K | WebP 529 KB | 5,377 KB, 44.5 dB | | 982 KB, 34.8 dB | |
| HQ sky 4K photo | JPEG 1,588 KB (re-encode 41.7 dB) | 8,593 KB, 40.9 dB | | 1,552 KB, 31.5 dB | |

GPU memory, 1024² with mips: RGBA8 5.3 MB; UASTC/BC7/ASTC 4×4 1.3 MB; ETC1S/BC1 0.7 MB. Encode time on this machine: UASTC level 2 ≈ 5–6 s per 1K map, ETC1S ≈ 1.5 s; 4K maps 20–27 s and 6–8 s.

What that says:

1. **ETC1S fails the quality bar here.** 25–31 dB on everything but the smoothest map is visible banding and block noise at the distances these textures are seen from (ground under your feet, a model you walk up to). Its only honest use is maps nobody looks at closely with low contrast (a far planet, the inside of a distant station).
2. **UASTC is better than the WebP the site ships** (43.8 vs 41.4 dB on colour) and stays compressed on the GPU (4× less memory than WebP once uploaded, 4–8× faster upload, no main-thread decode), but it **costs about 3× the download per map** at the same resolution. On a static site that already asks phones before a 3 MB world, a blanket conversion would double most worlds' downloads, so it has to be chosen per map.
3. **Normal maps are the exception where UASTC is simply right.** A high-quality normal map costs ~1.2–1.4 MB at 1K in any format (WebP near-lossless 1.4 MB, UASTC 1.3 MB with mips); JPEG and lossy WebP only look cheap because they've thrown the normals away (26–27 dB). UASTC gives the quality at a quarter of the GPU memory. Where 1.3 MB per set is too much, a 512 UASTC normal (~330 KB) is a better buy than a 1K JPEG one. This needs the originals: re-encoding the shipped JPEGs can't bring back what they lost.
4. **Skies and planet maps stay JPEG/WebP**: UASTC at 4K is 5–9 MB a map, ETC1S bands. Their cost is the decode and the upload, which `ImageBitmapLoader` moves off the main thread.

## The report over the whole repo

`scripts/ktx2.mjs report` was run over every GLB and loose texture set (1,169 textures) with UASTC level 2, RDO λ 1, zstd 18, mipmaps. Per folder, the download if everything were converted, the GPU memory, and how many textures pass the rule (GPU down, bytes within 1.25×, 34 dB kept):

| Folder | Textures | Download now → UASTC | GPU now → UASTC | Pass the rule |
| --- | --- | --- | --- | --- |
| `hq/models` | 52 | 6.0 MB → 15.3 MB (×2.6) | 105 MB → 26 MB | 9 (every normal map at 512, and two at 1024) |
| `hq/tex` (loose sets, 1K + 512) | 78 | 18.2 MB → 67.4 MB (×3.7) | 392 MB → 98 MB | 1 |
| `games/models` (Poly Haven scans) | 45 | 2.9 MB → 19.9 MB (×6.8) | 108 MB → 27 MB | 0 |
| `games/tex` + `cc0/materials` | 79 | 7.8 MB → 54.4 MB (×7.0) | 421 MB → 105 MB | 0 |
| `games/meshy` (the casts) | 96 | 6.7 MB → 41.0 MB (×6.1) | 252 MB → 63 MB | 0 |
| `games/caribbean` | 36 | 7.9 MB → 39.9 MB (×5.0) | 210 MB → 52 MB | 0 |
| `models/galaxy` (ships) | 48 | 1.2 MB → 8.2 MB (×6.9) | 84 MB → 21 MB | 0 |
| `models/galaxy/surface` | 378 | 9.6 MB → 58.1 MB (×6.0) | 420 MB → 105 MB | 0 |
| `models/sketchfab` | 190 | 8.0 MB → 51.3 MB (×6.4) | 447 MB → 112 MB | 1 (a flat map) |
| `models/albuquerque` | 31 | 3.2 MB → 27.0 MB (×8.5) | 165 MB → 41 MB | 0 |
| the rest of `models/` | 136 | 12.2 MB → 80.6 MB (×6.6) | 686 MB → 172 MB | 1 (a flat map) |

So: across the site, UASTC would cost 5 to 8 times the download for a 4× cut in GPU memory, and only normal maps come out even, because a lossy WebP of a normal map is already large (its noise doesn't compress) while UASTC's size is fixed by the pixel count. The quality floor was met almost everywhere (UASTC held 37–57 dB against the shipped files); the bytes were the problem, not the encode.

**What was converted**: the normal maps of eight HQ models (`barrel`, `barrier`, `crate`, `lamp`, `rocks`, `shelves`, `toolchest`, `tyre`; `npm run ktx2:hq` repeats it after `hq-assets` regenerates them). Together they're 91 KB larger on disk, their normal maps take 11 MB less GPU memory with their mipmaps built offline, and they decode in a worker. The first visit to the compound also fetches the Basis transcoder once (about 280 KB, cached after). The fir sapling's were left (its twigs' normal would have grown 240 KB), and nothing else met the rule. Everything else stays WebP, and the loader reads both.

**Where KTX2 pays next**, if the download budget allows: the 2K colour maps seen close (the music room's instruments at 0.6–1 MB each are 21 MB apiece on the GPU; Spider-Man's two; the Pearl) would each drop to 5 MB of GPU memory for 3–4 MB more download, and normal maps regenerated from Poly Haven's PNGs as UASTC (the HQ texture sets' 36 JPEG normals) would gain quality as well as memory.

## What raises quality without raising cost

In order of visible gain per unit of work and per frame cost, all doable from what's in the repo:

1. **Anisotropic filtering from the device budget, everywhere.** The `high` tier allows 16 and most textured surfaces get 1, 4 or 8. Floors, roads, decks, runways, the Falcon's hull at a slant: all sharper to the horizon. Cost on a desktop GPU: negligible; phones keep 4 and weak devices 1 (already in `BUDGETS`). One helper, applied in every loader and to every loaded model's maps.
2. **One shared model loader.** One `GLTFLoader` with meshopt and a lazy `KTX2Loader` (three r186 loads its transcoder from its own module URL, so Vite bundles it; the loader only pulls the 300 KB transcoder when a `.ktx2` texture is actually met). Every model gets the same fix-ups: anisotropy from the budget, shadows where asked, `frustumCulled = false` on skinned meshes, Meshy's over-shiny defaults clamped. A page-lifetime cache by URL so two scenes never download or decode the same model twice.
3. **Decode images off the main thread.** `ImageBitmapLoader` with `imageOrientation: 'flipY'` where the browser has it (Chrome, Firefox ≥ 98, Safari ≥ 17), falling back to `TextureLoader`; `renderer.initTexture` on arrival, during the idle frames before a texture is first drawn, so a world's 40 maps don't each cost their first frame.
4. **Mipmaps and filters set on purpose.** Canvas textures get mipmaps (they default to them) and the budget's anisotropy through one helper (`lib/stage3d`'s `canvasTexture` already does this for the worlds that use it); skies and anything always magnified keep `generateMipmaps = false` (the universe map does this already); normal and ARM maps stay `NoColorSpace`.
5. **Breaking tiling on big grounds.** The compound's lawn repeats every 3.2 m over 200 m, the apron every 5 m; Roll out's desert and the music courtyard tile the same way. Two shader tricks, cheap enough for phones: blend the same map at a second, ~4× larger scale, weighted by low-frequency noise (one extra texture fetch, kills the repeat pattern), and a close-range detail normal from the existing `noiseAtlas` (one more fetch within a few metres of the camera). The `cloudy` cloud-shadow shader in the Avengers world shows the house pattern (`onBeforeCompile`, world-position varying).
6. **Materials tuned at load, consistently.** Meshy and Sketchfab exports arrive with `metalness: 1` on painted plastic, `roughness: 0` on cloth, `emissive` off on lamps; `galaxy/models.js`'s `tune` and the HQ `loadModel` each do part of this. One pass, by material name and map presence, in the shared loader.

Things that would help but are **not** free: ACES or Neutral tone mapping on the core pages (changes their look; a per-scene decision), SMAA or TAA on top of MSAA (a full-screen pass; only where MSAA is off), SSAO (expensive on phones; contact shadows baked into AO maps are cheaper), screen-space reflections (no).

## Making things: what works best for this site

The pipeline that's here is sound: scans and skies from Poly Haven and ambientCG (CC0), hero models from Sketchfab (CC BY, credited) and Meshy (owned), everything brought to web size offline with gltf-transform (dedup, prune, weld, simplify, quantize, meshopt, WebP), with built-in-code stand-ins while a model loads. What to change when the scripts are next run, where the sources can be reached:

- **Start from PNG, encode once.** Fetch Poly Haven's PNG (or EXR for height) maps, not the JPG, so the only lossy step is the last one. Resize with a Lanczos filter to the shipped size first, then encode. (`build-textures.py` and `hq-assets.mjs` fetch JPG today.)
- **Normals as UASTC KTX2** (`-uastc -uastc_level 2 -uastc_rdo_l 1 -mipmap -linear`, or `toktx --encode uastc --uastc_quality 2 --uastc_rdo_l 1 --genmipmap --zcmp 18`), at 1K where a world has the byte budget and 512 otherwise; ARM maps the same way where roughness detail matters (a wet road, brushed steel), JPEG-free WebP q90 otherwise; colour stays WebP q84–88 unless GPU memory is the problem (a scene with more than ~40 one-K maps resident, or any 2K+ map seen close), then UASTC with rdo λ=1–2.
- **Texture at the size it's seen.** The galaxy's surface props carry 20–40 materials and as many small textures each; `sketchfab-batch.mjs`'s atlas-and-merge (one sheet, one mesh) is the right treatment for anything seen below hero size, and would also cut their draw calls by an order of magnitude. Keep per-material maps only for hero models (`own: true`).
- **Meshy / Tripo / image-to-3D.** Meshy's text-to-3D with PBR maps at 2K then downsized to 1K WebP is what the Albuquerque, C-137 and Roll out casts are; it's the right tool for characters and bespoke buildings. Tripo (the `threejs-3d-generator` skill wraps its API) gives comparable quality with quad remesh and auto-rig, and its image-to-3D from a Gemini concept sheet (`threejs-image-generator`) is the better path for props with a specific look: generate a three-quarter front concept, inspect it, then image-to-3D, then rig. Both keep the texture quality of the input; ask for the largest texture size and shrink offline, never the reverse. Neither service was reachable from this session (`MESHY_API_KEY` is set in the environment, but `api.meshy.ai` and `api.tripo3d.ai` are blocked by its proxy).
- **Procedural where the surface is simple.** The site's own `lib/texture.js` (`surfaceMaps`: colour, normal and roughness from one function, tiling) and `lib/paint.js` already paint plaster, planks, stone and metal that read well at 512; they cost no download and can be regenerated at any size per tier. Prefer them for large plain surfaces, scans for anything with real structure (grass, gravel, bark, brick).
- **Impostors and baking for trees and crowds.** `scripts/hq-impostors.mjs` photographs Poly Haven's trees once into colour and normal cards; the same treatment suits the galaxy surfaces' forests and the Middle-earth towns' trees (today built in code, many triangles each).
- **Measure with the inspector.** Report draw calls, triangles, textures and estimated texture memory per world before and after a pass; the AAA skill's starting budgets (≤ 60 textures, ≤ 256 MB desktop / 128 MB phone) are good contracts for the worlds here.

## Sources

- [KTX Artist Guide (Khronos 3D Formats Guidelines)](https://github.com/KhronosGroup/3D-Formats-Guidelines/blob/main/KTXArtistGuide.md): UASTC for normals, ORM and high-contrast colour; ETC1S for flat colour; always mipmaps; start from PNG; quoted settings.
- [Choosing texture formats for WebGL and WebGPU (Don McCurdy, 2024)](https://www.donmccurdy.com/2024/02/11/web-texture-formats/): KTX2 uploads 4–8× faster and uses 4–8× less GPU memory than PNG/JPEG/WebP/AVIF; `ImageBitmapLoader` takes decode off the main thread; `initTexture` uploads ahead of first use.
- three.js r186: `KTX2Loader` (transcoder resolved from `import.meta.url` when no path is set; `detectSupport(renderer)`), `GLTFLoader.setKTX2Loader`, `ImageBitmapLoader.setOptions({ imageOrientation: 'flipY' })`.
- [three.js issue 28101](https://github.com/mrdoob/three.js/issues/28101): texture upload timing and `initTexture`.
- The repo's own `docs/research/2026-10-04-webgl-portfolios.md` (offline compression with gltf-transform and KTX2 presets per channel, as in Bruno Simon's folio; warm shaders and textures before reveal).
- Basis Universal 1.16.3 encoder (`basisu` on npm, Binomial LLC), for the measurements above.
