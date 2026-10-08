# Quaternius packs (CC0)

The owner's Quaternius packs, bought or downloaded on 2026-10-08, kept as the GitHub release [`assets-quaternius`](https://github.com/tilakpatell/tilakpatell.com/releases/tag/assets-quaternius) instead of in the repo. Together the archives come to about 1.5 GB, and most of each pack is source files (`.blend`, FBX, OBJ, engine projects) the site never serves. Every pack is CC0 1.0 (public domain): the GLBs can be served on the site, and credit is optional. When a pack's models go into a world, their credits go into `public/games/credits.json` (as `quaternius/<model>`), which `scripts/credits.mjs` lists under Quaternius in CREDITS.md.

Unpacked, exactly as downloaded (Blender sources, FBX, glTF, textures, engine exports), the same packs are in their own repo, [tilakpatell/tilakverse-assets](https://github.com/tilakpatell/tilakverse-assets): clone it whole (about 2.2 GB), or one pack with a sparse checkout (its README shows how). It's public, so a session on any machine or account can get it.

Or fetch a pack's zip from the release into `lab/assets/<pack>/` (git-ignored):

```
node scripts/assets-fetch.mjs list
node scripts/assets-fetch.mjs ual2 city
```

Then import only what a world uses into `public/models/…`, compressed (meshopt, WebP), as the other import scripts do (`scripts/sketchfab-import.mjs`, `scripts/kenney.mjs`). The planet landings' trees, rocks, flowers and street furniture come in through `scripts/quaternius.mjs`: a GLB a family of models under `public/models/quaternius/`, a node a model, with a manifest of each one's size, triangles, collider and body, and its credit:

```
QUATERNIUS=/path/to/tilakverse-assets/quaternius npm run quaternius [nature/trees …]
```

## In the site

**The nature megakit** (`naturemega`) is on the galaxy's green worlds (Naboo, Endor, Dagobah, Yavin 4, Sorgan, Lothal, Scarif): 42 of its models, cut down to 5.7 MB in all. The design is `docs/superpowers/specs/2026-10-08-nature-kit-star-wars-design.md`.

- `src/components/galaxy/surface/catalog/nature.js` is the one table: each kind's pack file, how it moves in the wind, whether it throws a shadow, a triangle cut, its pictures' size, and the colours of the leaves and grass.
- `node scripts/quaternius-nature.mjs [kind …]` writes them to `public/models/galaxy/surface/<kind>.glb` (and the trees' `.lod1.glb`), from a clone of tilakverse-assets in the temp folder or `lab/assets/naturemega`. The pack's vertex colours are masks for its own shader, not colours: the script turns them into a grey that darkens what's low down, gives the leaves the pack's grey cut-outs and a colour, and never blends a cut-out.
- `src/components/galaxy/surface/nature.js` makes each one over as it loads: materials shared by name across the page (so a world's ten plant kinds send `Leaves` and `Flowers` once), lit as leaves, in one wind, and the low plants, flowers and grass pushed aside as you walk through.
- A world's `scatter` entries use them like any kind, with four more options (`layout.js`): `tint: [a, b]` (a colour pair, an instance's colour between them, on the leaves and grass only), `around: [x, z]` (the ring round a place), `clumps: [count, spread]` (in patches), and `path: [[x, z], …]` with `spacing` and `jitter` (stepping stones along a path).

To bring in another of the pack's models: add its row to `catalog/nature.js`, run the script for that kind, and add its name to the `public/cc0/README.md` line.

## What's in each

| pack | archive | what | best for |
| --- | --- | --- | --- |
| `ual1` | Universal Animation Library (source, 49 MB) | 120+ clips on the same rig, in one GLB (`Unreal-Godot/UAL1.glb`, and `UAL1_RM.glb` with root motion): walking and jogging in 8 directions, crouch-walking in 8, crawling, climbing, sitting (three idles, talking, nodding) and sitting on the ground, hits to the head, chest, shoulders and stomach, deaths, dodges, a pistol's aim, shot and reload, punches, spells, swimming, driving, a shop counter. The free Standard pack's 45 of these are already baked (`public/games/meshy/ual-*.glb`) | every rigged figure, through `scripts/ual-bake.mjs` |
| `ual2` | Universal Animation Library 2 (source, 53 MB) | 130+ clips on Quaternius's universal humanoid rig, in one GLB (`Unreal-Godot/UAL2.glb`, and `UAL2_RM.glb` with root motion): melee combos with recoveries, strafes and backpedals, parkour and climbing, deaths, hits, talking, waving, carrying, farming, fishing, zombie walks. Also the female mannequin and the `.blend` | every rigged figure on the site, baked onto the Meshy skeleton through `scripts/ual-bake.mjs` as the first library's clips are |
| `city` | Downtown City MegaKit (standard, 235 MB) | modular city blocks: brick and metal facades, windows and doors, cornices and trims, slate roofs, three whole buildings, 2- and 4-lane streets with curbs, sidewalks and corners, road decals (crosswalks, arrows, lines), AC units, bollards, planters, drains | Albuquerque's downtown streets, Invincible's city, the office's Scranton exterior |
| `street` | Street Pack (4 MB) | road tiles (straights, curves, 3- and 4-ways, bridges, ramps, elevated roads), traffic lights, street lights, stop and no-parking signs | Albuquerque's roads, Invincible's city grid |
| `furniture` | Furniture Pack (3 MB) | beds, sofas, armchairs, chairs, stools, tables, coffee tables, bookcases (empty and full), closets, lamps, vases, a pot plant | interiors: the White house and Casa Tranquila (Albuquerque), the Grayson home (Invincible), the office, the Smith house (C-137) |
| `space` | Ultimate Space Kit (37 MB) | four astronauts and four mechs (rigged), four enemy creatures, rovers, spaceships, geodesic domes and base modules, solar panels, antennas, alien trees, rocks, eleven planets, pickups | the Rick and Morty dimensions, toy-style space props, the universe map's small craft |
| `farm` | Farm Animals (7 MB) | horse, cow, sheep, pig, llama, zebra, pug, rigged and animated | Middle-earth's ponies, the Shire's sheep and Maggot's farm, Rohan's horses |
| `nature` | stylized nature pack (414 MB) | birch, maple, pine, palm and dead trees with bark and leaf maps, bushes, flowers, grass, rocks | the Shire, Lothlórien, Naboo, Yavin 4 |
| `naturemega` | Stylized Nature MegaKit (source, 718 MB) | five of each tree (birch, cherry blossom, pine, giant pine, twisted, dead, common), bushes, ferns, clover, flowers, grasses, wheat, mushrooms, rocks, rock paths, pebbles | the same worlds' ground cover and paths |

The toy-like, low-poly style of the city, space and nature kits suits the stylized worlds (Middle-earth, the Rick and Morty dimensions, Dot Matrix) more than the photo-real ones. For Albuquerque and Invincible, the modular city and street kits work as layout and filler, under the site's own baked look (`lib/three/house.js`).
