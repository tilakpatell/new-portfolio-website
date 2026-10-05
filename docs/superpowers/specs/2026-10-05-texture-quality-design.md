# Texture and model quality across the worlds

Date: 2026-10-05 · Status: approved by the brief (autonomous session)

## The brief

> See how we can improve textures and quality throughout all the models and
> sites and do that without impacting performance or increasing it. Research
> the best way to generate things, load them, and use high-quality textures.

The research is in `docs/research/2026-10-05-textures-and-asset-quality.md`.
Its finding: the assets are already compressed well for download; what's
missing is consistency in how they're filtered, loaded and tuned, and a path
to GPU-compressed textures for the maps that deserve it. This spec is the
work that follows from it, in slices that each ship on their own.

## 1. One texture helper (`src/lib/three/textures.js`)

- `sharpen(texture, renderer?, { color, repeat, wrap, mipmaps })` applies the
  device budget's anisotropy (capped by the renderer's maximum when one is
  given), the colour space (`SRGBColorSpace` for colour, `NoColorSpace` for
  data), wrapping and repeat, and leaves mipmaps on unless told otherwise.
  Pure helpers (`anisotropyFor(budgetAniso, maxAniso)`, `variant(url, tier)`
  for `-sm`/`-512` suffixes) are unit-tested.
- `loadTexture(url, opts)` decodes through `ImageBitmapLoader`
  (`imageOrientation: 'flipY'`, `premultiplyAlpha: 'none'`) where
  `createImageBitmap` exists and the browser handles it (three's own
  GLTFLoader check: not Safari < 17, not Firefox < 98), else `TextureLoader`;
  then `sharpen`. One cache per URL and option set, with reference counts, so
  two scenes share one download and one decode; `release(texture)` disposes
  at zero.
- `warm(renderer, root | textures)` calls `renderer.initTexture` for each
  texture under a root, to be called from a scene's idle frames (the cockpit's
  `warm` pattern) so the first frame that shows a model doesn't pay its
  uploads.

## 2. One model loader (`src/lib/three/gltf.js`)

- `loadGltf(url, { renderer })`: a single `GLTFLoader` with
  `MeshoptDecoder`, and a `KTX2Loader` attached lazily the first time a
  renderer is given (`detectSupport(renderer)`), its transcoder resolved
  from three's own module URL (Vite bundles `basis_transcoder.{js,wasm}`;
  checked in the production build). Page-lifetime cache by URL. A failed load
  resolves `null` (the callers' stand-ins carry on) and drops out of the cache.
- `prepare(root, { shadows, anisotropy, tune })`: every mesh casts and
  receives shadows if asked, skinned meshes skip frustum culling, every map
  goes through `sharpen`, and `tune` clamps generator defaults by material
  name and maps: roughness in [0.35, 0.9] where no roughness map, metalness 0
  where no metalness map and the name doesn't say metal, `emissive` copied
  from `color` on materials named glow/light/engine/lamp with intensity from
  the caller. Idempotent (marks `userData.prepared`).
- Migration, in this slice: `lib/three/rig.js`, `lib/models.js`,
  `avengers/hq/assets.js`, `galaxy/surface/placer.js`, `galaxy/models.js`,
  `universe/glbFleet.js`, `universe/planets.js`, `earth/scene.js`,
  `lib/cc0.js`, `lib/hdri.js`, `lib/stage3d.js`'s `canvasTexture`, and the
  hardcoded anisotropy in `universe/shipModels.js`, `universe/hulls.js`,
  `universe/footScene.js`, `cybertron/transform3d.js`, `cockpit/kit.js`,
  `universe/trafficKit.js`, `middleearth/Ring3D.js`. Behaviour otherwise
  unchanged: same URLs, same fallbacks, same clones.

## 3. GPU-compressed textures where they pay (`scripts/ktx2.mjs`)

- A Node script on the `basisu` encoder (npm, a dev dependency; no KTX-Software
  install needed): `node scripts/ktx2.mjs <glb|png|webp|jpg …> [--uastc|--etc1s]
  [--normal] [--out dir]`. Normal and ARM maps default to UASTC level 2, RDO
  λ 1, linear mipmaps, zstd; colour to UASTC unless `--etc1s`. For a GLB it
  rewrites each chosen texture in place as `image/ktx2` under
  `KHR_texture_basisu` with gltf-transform's core API, keeping meshopt and the
  rest of the file as it is. `--report` prints, per texture, bytes before and
  after, GPU bytes before and after, and PSNR against the input, and changes
  nothing.
- Policy, from the measurements: UASTC for normal maps and for any map at
  2048 or above that's seen close; nothing to ETC1S by default; skies and
  planet maps stay WebP/JPEG. The asset scripts (`hq-assets.mjs`, `cc0.mjs`,
  `build-textures.py`) gain a note and an option to write normals as UASTC
  when they're next run against their sources, which this session couldn't
  reach.
- Only assets that the report shows to be a net win (GPU memory down, bytes
  within 1.25× of today, PSNR ≥ 34 dB) are converted and committed here.

## 4. Breaking tiling on big grounds (`src/lib/three/surface.js`)

- `antiTile(material, { scale = 0.23, strength = 0.6, detail = null })` via
  `onBeforeCompile`: the map, normal and roughness maps are sampled a second
  time at `uv * scale` and blended with the first by a smooth low-frequency
  noise of world position (the `cloudy` pattern), so the repeat never lines
  up; with `detail` (a tiling normal texture, by default a `noiseAtlas`
  texture), a close-range detail normal fades in within `detail.range`
  metres. Cost: one or two texture fetches per fragment, no extra passes.
- Applied to: the Avengers compound's lawn, forest floor, roads and apron;
  Roll out's desert and asphalt; the music courtyard's paving; any other
  `pbr`/`cc0.material` surface with a repeat over its extent greater than
  about 20. Screenshots before and after through the preview harness in
  headless Chromium, on `high` and `low`.

## Status (2026-10-05)

All four slices shipped, each as its own pull request:

1. `src/lib/three/textures.js`: `sharpen`, `loadTexture` (ImageBitmap decode, one texture per URL, `.ktx2` through the KTX2 loader), `warm` (idle-spread uploads), `variant`, `imageBitmapOk`. Tests for the pure parts.
2. `src/lib/three/gltf.js`: `gltfLoader()` (a GLTFLoader subclass whose `parse` waits for the KTX2 loader only for a file that names `KHR_texture_basisu`), `loadGltf`, `prepare`, `tune`, `usesBasisu`. Every model and loose texture on the site goes through these two modules; no `new GLTFLoader()`, `new TextureLoader()` or hardcoded anisotropy is left in a world.
3. `scripts/ktx2.mjs` (`report`, `convert`) on `basisu`; the report over the repo and the eight HQ models converted are in the research doc.
4. `src/lib/three/surface.js`: `antiTile`, `detailNormal`, applied to the compound's floor, lawn and apron, Roll out's desert and the music courtyard's dunes.

Also: the HQ games' `preload` warms its textures with the engine's renderer; the galaxy surfaces ask for `PCFShadowMap` (three r186 dropped `PCFSoftShadowMap`).

## Out of scope

Tone-mapping changes on the core pages; new post-processing passes; regenerating
assets from their sources (needs Poly Haven, ambientCG, Meshy or Sketchfab);
atlasing the galaxy surface props (worth its own pass, noted in the research).

## Testing

Vitest for every pure helper (anisotropy choice, variant naming, material
tuning rules on plain objects, the shader string transforms applied to a
stub shader). `npm run lint`, `npm test`, `npm run build` before each PR, and
a check that the built bundle carries the Basis transcoder only in a chunk a
scene loads lazily.
