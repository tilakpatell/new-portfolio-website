# CC0 assets

Everything in this folder is CC0 (public domain): free to use, no credit required.

- `lab.exr`, `workshop.exr`, `studio.exr`: HDRIs from [Poly Haven](https://polyhaven.com/hdris), resized to 512x256 and DWAB-compressed by [@pmndrs/assets](https://github.com/pmndrs/assets) 1.7.0. Used as image-based lighting and reflections in the 3D games.
- `cloud.webp`: a soft cloud puff from @pmndrs/assets, used for steam and smoke.
- `materials/<name>/{color,normal,arm}.webp`: 1K PBR sets (colour, OpenGL normal, and AO/roughness/metalness packed in R/G/B).
  - `rv-wall`: Poly Haven `japanese_cedar_planks`
  - `rv-floor`: Poly Haven `old_linoleum_flooring_01`
  - `rv-bench`: Poly Haven `wood_table_001`
  - `lab-floor`: Poly Haven `concrete_floor_worn_001`
  - `lab-wall`: ambientCG `Tiles010`
  - `lab-bench`: ambientCG `Metal009`
  - `casa-wall`: Poly Haven `beige_wall_001` (Dimitrios Savva, Rico Cilliers)
  - `casa-floor`: Poly Haven `floor_tiles_08` (Rob Tuytel)

## Not CC0: made for this site

These live outside this folder and are not public domain.

- `../models/metherria/{drum-base,drum-blue,hammer}.glb`: Walt's two chemical drums and his ball-peen hammer in Metherria, generated for this site by Tilak Patel with Meshy AI (meshy.ai, a paid plan: the output is the site owner's). Made by `scripts/meshy-albuquerque.mjs` (concept image, then a textured model, baked into the scene's frame with 1K WebP textures); the Meshy task ids are in `scripts/meshy-albuquerque-tasks.json`.
- `../models/albuquerque/<id>.glb`: Albuquerque's people (Walt and Jesse in hazmat, Metherria's customers, Hank, Hector and the nurse), generated for this site by Tilak Patel with Meshy AI in the same way, then rigged by Meshy: stylized figures described by look and costume, not likenesses of anyone real.
