# Hoth's skies and probes, published for the lighting lane

Lane W builds no lighting (the owner's rule of 2026-10-10, 04:40); these are Battlefront II (2017)'s own files for Hoth, made the site's and left for the owner's lighting lane to use. Nothing on the site loads them yet. EA DICE's, used with permission on this non-commercial fan project.

## What the drop has for Hoth (2026-10-10)

- **The level**: `levels/mp/hoth_01` (the multiplayer Hoth: the plain before Echo Base, the trenches, the base itself).
- **Its probes**: six-face Radiance cube maps of the level's reflection volumes, 128² a face, `R16G16B16A16_FLOAT` in the game, in Frostbite's light units, under `web/textures/levels/mp/hoth_01/reflectionvolumetexture/`: `cloudy_vfx` (6 probes), `sunset_vfx` (8) and `prefabs/pf_hoth_rebelbase_01_lighting` (the base's insides). All are in the bucket.
- **Its panoramic skies**: `Levels/Lighting/Hoth/Sunny_01/T_Hoth_Sunny_01_Panoramic_C` and `T_Hoth_Sunny_02_C`, `Sunset_01/T_Hoth_Sunset_01_Panoramic_C` (8192 × 2048, `BC6U_FLOAT`), with their fog gradients (`T_Hoth_Sunny_02_Fog_C`, 512 × 256) and the night's moons and stars (`Night_01`), are in `web/textures.jsonl` but **not in the bucket**: `web/textures/levels/lighting/hoth/sunny_01/` holds only the colour-grading tables (`t_cc_hoth_sunny_01_000…032.png`), and the panorama's path answers 400 as `.png`, `.hdr`, `.ktx2` and `.exr`. So the 512, 1024 and 2048-wide sky files the plan asked for cannot be made yet: re-run when the upload reaches them.

## Published

The outdoor probe of the main arena on the cloudy day: **`cloudy_vfx/78e8837b-bc19-4917-80c7-fd21b3119ea6`**, chosen by looking at all six (`probe-78e8837b.png`: the open sky, the snow plain, the base far off; its −Y face is black, a sky probe with no ground in it). The other five cloudy probes are inside the hangar or under its roof.

| file | size | what |
| --- | --- | --- |
| `public/textures/galaxy/sky/hoth-probe-128-{px,nx,py,ny,pz,nz}.hdr` | 6 × 66.6 KB | the probe at the game's 128², run-length RGBE |
| `public/textures/galaxy/sky/hoth-probe-64-{px,nx,py,ny,pz,nz}.hdr` | 6 × 16.9 KB | the same halved (each 2 × 2 averaged), for a weak device |

- **Its light, scaled**: the faces' mean light was 101.2 in the game's units; they are scaled so it is 0.8 (`scripts/bf2017-sky.mjs`'s `--mean`, the brightness the site's sky dome sits at); multiply by 126.5 for the game's own. The faces' means after: +X 0.98, −X 0.79, +Y 1.11, −Y 0, +Z 0.77, −Z 1.14.
- **Its sun**: the brightest texel is on the −X face at (42, 25), linear RGB (105, 125, 154) after scaling: a pale blue-white glare through cloud about 30° up. Three samples a cube map turned round in x, so in the scene's frame that is about (+0.83, +0.50, −0.28).
- **Lighting it**: the trial on this branch (kept off the PR on the unpushed branch `claude/bf2017-levelsky-unpushed`: a loader, PMREM from the cube, the sun from the brightest texel) found that the sun at 30° up puts about 2.6 times the light on the snow that the dome's 11° sun does, so a sun intensity near 1.4 rather than Hoth's 2.6 keeps the snowfield where it was.

Made with:

```
node scripts/bf2017-sky.mjs web/textures/levels/mp/hoth_01/reflectionvolumetexture/cloudy_vfx 78e8837b-bc19-4917-80c7-fd21b3119ea6 --name hoth
```
