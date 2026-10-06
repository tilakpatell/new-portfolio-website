# Foliage, trees and landscapes on every galaxy world — design

Date: 2026-10-06. Status: final, owner decisions taken (below). Plan:
`docs/superpowers/plans/2026-10-06-foliage-landscape.md`. Scope: the 17
landable worlds in `src/components/galaxy/surface/`.

This spec merges the design brief (`scratchpad/foliage/brief.md`) with every
correction of its adversarial review (`scratchpad/foliage/critique.md`).
Where the two disagreed, the review won. The research behind both is in the
same folder: r-bruno, r-stylized, r-ground (techniques), r-films-forest,
r-films-open (film colours and shapes), m-foliage, m-ground, m-worlds (the
code as it is). Appendix A lists each of the review's 40 corrections and
where it lands here.

It builds on `2026-10-06-ground-grass-foliage-design.md` (Albuquerque):
the same modules (`lib/three/foliage.js`, `lod.js`, `grounding.js`), carried
to the galaxy surface and pushed further.

Allowed sources: Original Trilogy, prequels, Clone Wars, Rebels and the
Mandalorian era. Nothing from Episodes VII–IX (no Mustafar irontrees, no
Corvax Fen).

Every hex is measured from a film still or location photo, or marked
*(derived)*. Every triangle or millisecond figure marked *est.* is an
estimate that `scripts/galaxy-check.mjs` confirms at each checkpoint.

## What the owner asked for

Bruno-Simon-style cohesion with film-accurate plants, trees and landscapes
on every world, within the performance budget.

## Owner decisions (taken 2026-10-06)

1. **Budget gate.** Each world is held to `lab/baseline/surface-merged.json`
   +10% (calls and triangles), and never over 600 calls or 2.5M triangles.
   That is what `galaxy-check.mjs` already does with
   `BUDGET=lab/baseline/surface-merged.json`. A further goal, checked at
   their world checkpoints: Lothal, Dagobah, Yavin, Mandalore and Nevarro
   come back under the original `lab/baseline/surface-high.json` caps.

   | World | Merged calls / tris | Gate (+10%) | Original cap (goal) |
   |---|---|---|---|
   | Tatooine | 91 / 536,141 | 100.1 / 589,755 | – |
   | Naboo | 324 / 856,102 | 356.4 / 941,712 | – |
   | Hoth | 139 / 993,722 | 152.9 / 1,093,094 | – |
   | Endor | 81 / 1,125,800 | 89.1 / 1,238,380 | – |
   | Kashyyyk | 91 / 898,045 | 100.1 / 987,849 | – |
   | Dagobah | 85 / 1,385,777 | 93.5 / 1,524,354 | **83.6 / 1,465,380** |
   | Yavin | 59 / 1,734,766 | 64.9 / 1,908,242 | **62.7 / 1,691,089** |
   | Coruscant | 206 / 940,456 | 226.6 / 1,034,501 | – |
   | Kamino | 78 / 540,284 | 85.8 / 594,312 | – |
   | Geonosis | 131 / 623,399 | 144.1 / 685,738 | – |
   | Mustafar | 85 / 595,816 | 93.5 / 655,397 | – |
   | Scarif | 107 / 1,275,275 | 117.7 / 1,402,802 | – |
   | Bespin | 158 / 305,484 | 173.8 / 336,032 | – |
   | Nevarro | 45 / 914,244 | 49.5 / 1,005,668 | **132 / 515,184** |
   | Mandalore | 107 / 692,551 | 117.7 / 761,806 | **116.6 / 515,764** |
   | Lothal | 72 / 768,988 | 79.2 / 845,886 | **79.2 / 565,566** |
   | Sorgan | 58 / 1,065,285 | 63.8 / 1,171,813 | – |

2. **Sketchfab vegetation GLBs leave bulk scatter.** yavintree,
   dagocypress, palm, sorganbirch, sorganfir and sorganfern are replaced in
   scatter by code-built, film-accurate species. Each may stay as a
   restyled *placed hero* where a side-by-side shot (same view, built vs
   GLB) prefers it. The shot is recorded in that world's checkpoint.
   Retired GLBs get no lod1 (no wasted work); a kept hero gets one then.
   dagoroots, lavarock and glassshard are not vegetation and stay, with
   lod1.
3. **Grades.**
   - Dagobah: the compromise horizon/fog `#7d8f96`, between the Blu-ray teal
     `#4B6972` and the 1980 grey-green.
   - Yavin 4: ANH dawn. The Rogue One mist is a `sky.mood` option.
   - Lothal: golden afternoon (McQuarrie).
   - Hoth: cream overcast (ESB).
4. **Sorgan huts** move to dry ground ringed by ponds, as the film shows.
   The place text changes from "Huts on stilts over the ponds" to say so.
5. **Endor's gas giant** stays, as artistic licence, but smaller and
   higher in the sky.
6. **Kashyyyk wroshyr** stay 80–140 m tall, with one optional 300 m backdrop
   hero (canon puts Wawaatt wroshyr at 300–400 m).
7. **Per-world values live in a new `flora/palette.js`** (`FLORA[id]`:
   `air`, `fog`, `ground`, `grade`, `scatter`, `under`, `grass`, ramps).
   `scene.js` reads it with `site.*` as the fallback. `sites/*.js` are
   edited only in a world's own checkpoint, after that world's planets
   overhaul checkpoint (CP3–CP11) has merged. **Tatooine's palette stays
   owned by its colour workflow (wf_62561f47)**: this pass adds only
   scatter, rock and the fog conversion there.

## Where things stand (re-checked in the repo, `1680c256`, three 0.186.1)

- The surface renders through `WebGLRenderer` with GLSL `onBeforeCompile`
  hooks (`src/runtime/backend.js`). No TSL, no WebGPU.
- `universe/post.js:156` multisamples with
  `samples = getPixelRatio() >= 1.75 ? 0 : small ? 2 : 4`, and
  `runtime.js build()` caps the ratio at 1.5 before `module.create`. Every
  tier, phones included, gets MSAA 2 or 4, so alpha-to-coverage (A2C)
  works everywhere.
- `FINAL` writes `vec4(clamp(c), 1.0)`, so A2C leaves can't fringe onto the
  page. **FINAL is not identity below 0.8**: `uSat 1.06` and
  `uContrast 0.07` (`post.js:68-69`) apply after the Neutral shoulder. So
  film targets are authored pre-divided (§1.5).
- `groundwork.js` `LIT()` accepts Lambert. `wrapShader` already patches
  `lights_lambert_pars_fragment`. The `faceless` precedent is at
  `middleearth/towns/weathertop/props.js:2614`.
- `InstancedMesh.setColorAt` multiplies vertex colour. An InstancedMesh with
  `count 0` issues no draw.
- The floor bake renders casters through three's shadow map (BasicShadowMap
  with a depth texture, `grounding-bake.js:390`). It honours
  `object.customDepthMaterial` and skips `userData.noBake`
  (`grounding-bake.js:200`). The stock depth material multiplies by
  `texture2D(map).a` and forces `alphaTest 0.5` on A2C materials, so leaf
  cards cast correct cut-outs **only** with the channel-aware depth
  material of §2c.
- `lib/three/foliage.js` and `lib/three/lod.js` are tested and imported by
  nothing.
- Scatter is placed once, round the origin (`scene.js:197-213`). The player
  walks anywhere within `REACH = 590` m (`terrain.js:21`). The floor bake
  covers ±170 m round the landing (`scene.js:1654`); the shadow pass is off.
- Fog today is `FogExp2(site.fog.color, site.fog.density)`
  (`scene.js:153`), and `actors.js fogCutoff` hides creatures at
  `sqrt(−ln 0.03)/ρ`.

## Goals

1. Every forest and open world reads as its film location: silhouettes,
   palettes and air from the films, lit by one cohesive stylised lighting
   look on every plant.
2. Every world passes the gate (decision 1) at the landing and at its
   "worst" spot. The five named worlds come back under the original caps.
3. Missions and races still work: no new obstacle on any route.
4. Each checkpoint ships on its own: green tests and lint, before/after
   shots, a budget run and a draw-ledger line per world.

## Non-goals

- New gameplay, new places, new missions.
- Tatooine's colours (wf_62561f47).
- The space side and the universe's own post grade (the grade hook defaults
  to identity, so the universe is unaffected).
- Sequel-trilogy content.

---

## 1. Art direction

### 1.1 The style in one sentence

**"A painted film still":** silhouettes, palettes and air taken from the
films, rendered with Bruno Simon's rules for a cohesive stylised world: one
lighting look on every plant, tinted shadows, fog that *is* the sky, crowns
lit as soft volumes, grass in the ground's own colour. The dial sits at
about **60% film target / 40% physical light**, not Bruno's 100% neon.

### 1.2 What we take, and our version of it

| Rule | Bruno (folio-2025) | Our version |
|---|---|---|
| One lighting function for everything | albedo × warm sun; shadow = albedo × shadowColor; wide terminator | **`foliageLook()`** on every plant material: the lit luminance (sun, hemisphere, floor mask, wrap, back-light) ramps into a per-world shadow→lit pair. The ground stays three's PBR (roughness 0.94) and is the reference the plants are tuned against. |
| Tinted shadows | violet by day | Shadow = the world's measured dark sample (Endor `#272E2D`, Kashyyyk `#1D2C20`, Yavin `#1D2610`). Shade hue −0.02…−0.04 (toward teal), lit +0.02…+0.04 (toward yellow). |
| Fog is the sky | background = fog colour | **`skyFog`** chunk: fog colour = the dome's own colour in that view direction, sun lobe included. Exponential with a clear zone, plus analytic height fog with its own colour. |
| Crowns light as one volume | 80 cards in a sphere, normals 0.85 toward centre | Blob-card crowns **round an opaque core**, billboarded in the vertex shader (our camera is free). Normal = 0.15 corner + 0.55 clump + 0.30 crown. Interior darkened in vertex colour. |
| Leaf texture as a distance field | 128² SDF, cut 0.4, wind rotates the UV | One **256² RGBA SDF atlas built as a `DataTexture`**, one leaf type per channel, the channel chosen per vertex. Coverage-preserving mips, `alphaTest 0.4` + A2C, Bruno's UV-rotation flutter. |
| Grass = ground | one-triangle blades, ground colour, floor painted in the root shade | **`surface/grass.js`**: one-triangle blades round the player, root = the shared `groundColour()`, ground under grass darkened to the root colour. One draw. |
| One data texture drives the ground | terrain.png R/G/B | **`surface/cover.js`**: 512² RGBA `DataTexture` over ±640 m (R green cover, G grass height or lava, B dryness, A litter/flowers). |
| Limited palette | one swatch texture | Per world, every green from one ramp; rock shares the soil's hue. A unit test enforces the film guardrail. |
| No LOD | world is 192 m | Rings: near cards → mid (same cards, flagged half shrinks away) → one far tier → fog. Cards shrink; they never swap. |

### 1.3 How realistic, how stylised

- **Shapes:** botanically faithful silhouettes and proportions (redwood
  branch-free to 0.5 h; wroshyr a giant conifer bonsai with flat pads; ceiba
  an umbrella crown 30–45 m wide and 8–12 m deep; Italian cypress 1:7).
  Leaf masses are drawn on cards (blobs 0.15–0.35 m on screen at 10 m),
  never single botanical leaves.
- **Textures:** no photo textures on foliage. Scans only on bark and on
  cliffs within 80 m (the desaturated CC0 scans, tinted by the palette).
  Large-scale ground colour stays procedural.
- **Light:** three's lights (sun, hemisphere, PMREM 0.4, the floor mask)
  stay for plausibility. The look pulls 60% toward the film targets:
  `uStylize` 0.6 by default, 0.55 on phones, 0.4 on bark.

### 1.4 Value structure

1. **Trees are darker than the air** on every forest world: trunks and
   crowns V 0.15–0.36, fog and sky V ≥ 0.45.
2. **Depth planes step toward the fog**: near darkest and most saturated,
   each ridge behind one value step lighter. Exponential fog does this;
   exp² does not.
3. **Bases dark and cool, tips light and warm**, for grass, ferns, bushes
   and crowns. Crown interiors 0.55× to 1.0× at the rim, undersides 0.75×.
4. **Highlights capped** (enforced by `flora/palette.test.js`):

   | Surface | Saturation | Value |
   |---|---|---|
   | Forest foliage (Endor, Kashyyyk, Dagobah, Yavin, Sorgan) | ≤ 0.58 | ≤ 0.63 |
   | Forest backlit rims | – | ≤ 0.71 |
   | Open-world foliage (Naboo incl. Sacred Place, Scarif) | ≤ 0.65 | ≤ 0.72 |
   | Open-world rims | – | ≤ 0.82 |
   | Lothal straw (golden lit highlight exempt) | ≤ 0.45 | ≤ 0.88 |
   | Lit bark, dark-barked species only (redwood, conifer, wroshyr, jungle2) | – | ≤ 0.40 |
   | Forest fog and horizon | – | ≥ 0.45 |

   Pale-barked species (ceiba `#A29A9A`, beech `#7C8470`, gungan `#695851`,
   gnarltree `#6a665c`) are exempt from the bark cap: the films' trees really
   are that pale.
5. **Accents rare (< 3% of the frame) and complementary:** Naboo yellow
   `#F4E27A` flowers, Varykino geraniums `#C8323A`, Mustafar lava on
   near-black, Sorgan blue krill specks, Dagobah warm-white motes
   **`#fff8e0`**.

### 1.5 Palette rules

- **Each world its own foliage hue** (today all four forest worlds share
  H 91–102°). Hue bands are per species where a world has several:

  | World | Hue band |
  |---|---|
  | Endor | 55–82° (yellow-olive) |
  | Yavin | 72–86° (dark olive) |
  | Kashyyyk | 112–147° (dusty blue-green, S ≤ 0.35) |
  | Dagobah | no dominant green (moss about 60°, air teal or lavender-grey) |
  | Naboo | 50–92° (plane crowns reach 53–57°) |
  | Sorgan | 55–65° (dark olive conifers) |
  | Scarif | 100–130° (frond lit 107°, back 102°) |
  | Lothal | straw at about 42°, not green |

- **No forest floor is green.** Endor cinnamon duff `#996E43` / rust
  `#633C24`; Dagobah mauve-brown mud `#6B5A57`; Yavin soil `#5F4B3A` with
  litter `#8C7061`; Kashyyyk grey-white sand `#C5C4BB`. Green ground cover
  exists only where the cover mask says so.
- **Foliage, ground and sky relate three fixed ways:** grass roots = ground
  colour, tips = ground × tip lift; plant undersides near the floor take the
  ground colour under them (bounce), not `light.ground`; shadow tint = the
  world's dark sample and the hemisphere sky = the dome's zenith/horizon mix.
- **Tone map and grade.** Keep the Neutral shoulder. Add a per-world
  split-tone grade within ±6% in `post.js` FINAL (`uShadeTint`,
  `uLightTint`, identity by default). Never ACES or AgX.
- **Authoring through the grade.** FINAL applies sat 1.06 and contrast 0.07
  after the shoulder, and the grade multiplies on top. So every film target
  (`uLookShadow`, `uLookLit`, ground and grass hexes) is stored as measured
  and converted at load by `authored(hex, grade)` in `flora/palette.js`,
  the inverse of grade ∘ contrast ∘ sat. The final pixel then equals the
  measured hex. A test round-trips every FLORA hex through the forward FINAL
  maths within 1/255.
- **Far colours are not pre-hazed.** The far tier's ramp = the near crown
  ramp × 0.85–0.9; skyFog supplies the blue-grey. The hazed film samples
  (Endor `#2C4145 → #4B643F`, Yavin `#1D2610 → #515C51`, Dagobah
  `#212B30 → #4d5658`) are kept only as the colour-check targets for far
  crops.

---

## 2. Shared systems

### 2.0 File plan

```
src/lib/three/foliage.js        + faceless(), foliageLook(), translucency in wrapShader, WIND_GLSL (windAt, world space), windShader v2
src/lib/three/leaves.js         NEW  leafAtlas() 256² RGBA SDF DataTexture, coverageMips() on typed arrays, leafDepth() depth material
src/lib/three/grounding.js      + understory(material, bake), setUnderstoryMask()
src/components/universe/post.js FINAL uShadeTint / uLightTint (identity default)
src/components/galaxy/surface/
  skyfog.js         NEW  skyFog(material, air), skyFogScene(scene), fogFor({ d50, start }), fogFromExp2(ρ), FOG_EDGE
  sky.js            export SKY_FN (horizon, zenith, haze, sun lobe GLSL) used by the dome and by skyFog
  cover.js          NEW  cover mask (Uint8 RGBA DataTexture) + canopy-shade (R8 DataTexture), CPU dab painters
  plan.js           NEW  placement patterns, corridors, static extent, solidsOf(), worstSpot() (all pure)
  grass.js          NEW  one-triangle blade field round the player
  flora/palette.js  NEW  FLORA[id], floraOf(id, site), authored(), guardrail data
  flora/materials.js NEW createFlora(kit, site, { small, time }) → cards, bark, proxy materials; flora.update(t); flora.sort(at)
  flora/cards.js    NEW  blobCards (with core), crownNormals, crownAO, frondStrip, cutSpray, crossStrips, vineCurtain, liana, bigLeaf
  flora/patch.js    NEW  player-following wrapped patches for understory (ferns, bushes, reeds, xate, bog plants, tufts)
  flora/trees.js    NEW  redwood2, conifer, gnarl2, wroshyr2, karst2, ceiba, jungle2, cohune, coconut, cypress, plane, holmoak, gungan, beech, spire
  flora/under.js    NEW  swordfern, bush, reeds2, beachscrub, pandanus, xate, bogleaf, log2, nebkha
  flora/far.js      NEW  one far-tier InstancedMesh per world (aShape lathe), stochastic collapse
  flora/shell.js    NEW  canopy shell over the far forest annulus (Yavin; available to Endor and Kashyyyk)
  ground.js         groundColour() chunk; bounded cover read; cavity; heightBlend; canopy shade; triplanar (textureGrad); lava emissive
  terrain.js        heightGrid → per-vertex cavity (1-cell and 3-cell rings); later: erode, Nevarro channels
  placer.js         pooled InstancedMeshes per kind; setColorAt tints; createLodSet rings; 3-way GLB split; per-world GLB material clones
  kit.js            split `leaf` → `plant` (creatures keep `leaf`)
  actors.js         fogCutoff from fogFor's d97
  scene.js          FLORA read; plan.js scatter; cover; grass; patches; flora clock; post grade; skyFogScene before warm
  water.js          skyFog; local water planes (`site.waters[]`)
scripts/galaxy-surface-lod.mjs  foliage path for MASK primitives
scripts/galaxy-check.mjs        AT=<x,z> spots; draw ledger dump
```

`teanila` is dropped (no world in our canon window uses it).

### 2.1 Material hook order

Hooks chain with `before?.call`, so the earlier-attached hook runs first.
All of them are attached **when the material is created** (kit, flora,
`placer.prepared`, water, weather, actors), before `groundWorld`:

1. `skyFog` (fog chunks and cache key)
2. `wind` (vertex, world space)
3. `cards` (vertex billboard + SDF map with per-vertex channel)
4. `wrapLighting` (needs the unexpanded `#include <lights_*_pars_fragment>`)
5. `faceless`
6. `understory`
7. `foliageLook`

`groundWorld` later appends `bounce` at `opaque_fragment`, after the look,
so undersides show the true ground colour. A test checks the order and that
each hook is idempotent.

### 2.2 Sky fog and the grade hook

**`skyfog.js`** replaces `fog_pars_vertex`, `fog_vertex`,
`fog_pars_fragment` and `fog_fragment`, with `customProgramCacheKey
…|skyfog`. It is installed when each material is made (`kit.std`,
`createFlora`, `placer.prepared` for GLBs, water and weather constructors,
`createActors` and figures, grass, patches, far tier). `skyFogScene(scene)`
runs once before the first `warm()` as a safety net for anything missed.
A test asserts `renderer.info.programs.length` doesn't grow after frame 1.
`lightshafts` is a ShaderMaterial with `fog: false` and is left alone.

```glsl
// vertex
#ifdef USE_FOG
  vFogDepth = -mvPosition.z;
  vFogOff = transpose(mat3(viewMatrix)) * mvPosition.xyz;   // world-space camera → vertex (instancing and billboards included)
#endif
// fragment
#ifdef USE_FOG
if (uSkyFog > 0.5) {
  float dist = length(vFogOff); vec3 rd = vFogOff / max(dist, 1e-4);
  vec3 sky = skyColour(rd);                                   // SKY_FN from sky.js
  float d = max(dist - uFogStart, 0.0);
  float fogK = 1.0 - exp(-uFogK * d);
  fogK = max(fogK, smoothstep(0.55 * FOG_EDGE, 0.85 * FOG_EDGE, dist));   // FOG_EDGE = terrain FAR (9 km): no ring at the edge
  float ry = abs(rd.y) < 1e-3 ? 1e-3 : rd.y;
  float hf = uHF.x * exp(-(uFogEye.y - uHF.z) * uHF.y) * (1.0 - exp(-d * ry * uHF.y)) / (ry * uHF.y);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, sky, fogK);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, uHFColor, 1.0 - exp(-max(hf, 0.0)));
} else {
  float f = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);  // stock exp², for zones
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, f);
}
#endif
```

`uFogEye` is the camera position passed as a uniform (in the bake pass
`cameraPosition` is the light's). Zones (`lighting()`) set `uSkyFog = 0`
and keep their exp² density.

`fogFor({ d50, start })` returns `{ k: ln2/(d50 − start), d95: start +
ln20/k, d97: start + ln(33.3)/k, d98: start + 3.912/k, density:
0.8326/d50 }`. `density` feeds `scene.fog.density`, the exp² fallback for any
unpatched material.

**F1 converts today's fog without lengthening it.** `fogFromExp2(ρ)` picks
`start = 0.5622/ρ` and `k = 2.5635·ρ`. Then d50 = 0.8326/ρ and
d95 = 1.7308/ρ, both **equal to today's FogExp2** (so the new d95 is never
past today's), and fog at 1.5·d50 is 83% against today's 79%. Height fog is
0 everywhere in F1.

| World | ρ today | start | d50 | d95 | d97 (creatures) | d98 | Static extent `REACH + d98` |
|---|---|---|---|---|---|---|---|
| Tatooine | 0.00055 | 1,022 | 1,514 | 3,147 | 3,509 | 3,797 | 4,387 |
| Naboo | 0.00075 | 750 | 1,110 | 2,308 | 2,573 | 2,784 | 3,374 |
| Hoth | 0.0011 | 511 | 757 | 1,573 | 1,754 | 1,898 | 2,488 |
| Endor | 0.0042 | 134 | 198 | 412 | 459 | 497 | 1,087 |
| Kashyyyk | 0.0017 | 331 | 490 | 1,018 | 1,135 | 1,228 | 1,818 |
| Dagobah | 0.0105 | 54 | 79 | 165 | 184 | 199 | 789 |
| Yavin 4 | 0.0022 | 256 | 378 | 787 | 877 | 949 | 1,539 |
| Coruscant | 0.0016 | 351 | 520 | 1,082 | 1,206 | 1,305 | 1,895 |
| Kamino | 0.0034 | 165 | 245 | 509 | 568 | 614 | 1,204 |
| Geonosis | 0.0009 | 625 | 925 | 1,923 | 2,144 | 2,320 | 2,910 |
| Mustafar | 0.0012 | 469 | 694 | 1,442 | 1,608 | 1,740 | 2,330 |
| Scarif | 0.00042 | 1,339 | 1,982 | 4,121 | 4,594 | 4,972 | 5,562 |
| Bespin | 0.0007 | 803 | 1,189 | 2,473 | 2,757 | 2,983 | 3,573 |
| Nevarro | 0.0012 | 469 | 694 | 1,442 | 1,608 | 1,740 | 2,330 |
| Mandalore | 0.0014 | 402 | 595 | 1,236 | 1,378 | 1,492 | 2,082 |
| Lothal | 0.0008 | 703 | 1,041 | 2,163 | 2,412 | 2,610 | 3,200 |
| Sorgan | 0.0018 | 312 | 463 | 962 | 1,072 | 1,160 | 1,750 |

(metres; Tatooine's d50 ≈ 1.5 km is only this conversion, with no sky,
haze or grade change.)

The far land's colour moves from `site.fog.color` to the sky's own colour
in that direction: that is the mechanism, not a palette change.
`site.fog.color` stays as the exp² fallback and the zone colour. Per-world
`air` (d50, start, height fog, sky colours) is set only in each world's
checkpoint, and fog is **lengthened only after the far tier (F9) exists**.

**Creatures** (`actors.js`): `createActors` takes `fogCut: () => air.d97`,
the distance where exponential fog reaches 97%. The exp² formula stays only
for zones.

**Grade hook** (`post.js` FINAL): `c *= mix(uShadeTint, uLightTint,
smoothstep(0.15, 0.7, luma(c)))`, inserted before sat/contrast. Defaults are
(1, 1, 1), so the universe and every world are unchanged until a world's
checkpoint sets `FLORA[id].grade`.

### 2.3 Plant material core

- **`foliageLook()`** replaces `#include <opaque_fragment>` with the look
  block, then the include:

  ```glsl
  {
    float lum = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));
    vec3 tone = diffuseColor.rgb / max(1e-3, dot(diffuseColor.rgb, vec3(1.0/3.0)));
    vec3 ramp = mix(uLookShadow, uLookLit, smoothstep(uLookBand.x, uLookBand.y, lum)) * mix(vec3(1.0), tone, uLookHue);
    outgoingLight = mix(outgoingLight, ramp, uLookK);
    float ndv = saturate(dot(normal, normalize(vViewPosition)));
    outgoingLight += uLookRimColor * uLookRim * pow(1.0 - ndv, 4.0);
  }
  ```

  `uLookHue` = 0.35. `uLookK` = stylise (0.6, phones 0.55, bark 0.4). Rim
  ≤ 0.14. `uLookShadow`/`uLookLit` are the world's film samples through
  `authored()` (§1.5).
- **`lookBand`** is measured, not derived: once per world, render a
  0.3-albedo Lambert sphere (32² offscreen, the world's sun, hemisphere and
  env) and read the luminance facing away from and toward the sun:
  `uLookBand = [0.25·Lshade, 0.9·Llit]`.
- **`faceless()`** removes `normal *= faceDirection` from
  `normal_fragment_begin`.
- **Translucency** extends `wrapShader` with `trans: { power 3, scale,
  distort 0.5, tint (1.2, 1.25, 0.75) }` (Frostbite's term next to wrap and
  back-scatter in `RE_Direct_Lambert`). Scale: fronds and ferns 0.7, crowns
  0.5, needles 0.3, bark 0.
- **`understory`** reads the baked floor mask at the plant root, nudged
  toward the sun by plant radius + 1 m, fading out between 2 and 6 m of
  height. The root:

  ```glsl
  #ifdef USE_INSTANCING
    vec3 root = (modelMatrix * instanceMatrix[3]).xyz;
  #else
    vec3 root = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  #endif
  vUnder = vec3(root.xz + uSunXZ * uNudge, transformed.y);
  ```

  Wrapped patches pass their slot's world position. Outside every mask rect
  (and everywhere when the bake can't run) it reads the canopy-shade texture
  (§2.7). The mask lands after the bake through `setUnderstoryMask(flora,
  lit)`.
- **Kit split:** `kit.mats.leaf` is shared with creatures (shaak, bongo,
  aiwha, acklay, fambaa, bogwing), Ewok thatch and vines. Plants move to a
  new `plant` material; creatures keep `leaf`, untouched.
- **GLB restyle per world.** `gltfCache` is module-level, so
  `placer.prepared` clones each GLB material per world (a per-world
  `Map(original → clone)`) before adding hooks. That also fixes the latent
  `bounce` leak (a previous world's `uBounceColor` and disposed mask left on
  the cached material). GLB leaf `MASK` materials get A2C; `sorganfern`'s
  `BLEND` becomes `MASK` + A2C. GLB coverage mips are made offline in
  `galaxy-textures.mjs` (not at load through a canvas).
- **Variation without draws:** per-instance hue ±0.02 and value ±10%, region
  noise at 0.02/m baked into the instance tint, outliers (1 in 30 Yavin
  crowns bronze `#8a5a4a` *(derived)*, 10% weathered-grey redwood bark
  `#6D676A`), a static lean of 0–3° from `hash(instance xz)`, per-instance
  card shrink 0–15%. At most 2 geometry variants for hero species
  (redwood, wroshyr, ceiba), 1 for the rest.

### 2.4 Wind: one clock, one direction, world space

`flora.update(t, dt)` advances `uWindTime` (held under `reduced`). Shared
uniforms: `uWindDir`, `uWindStrength`, `uGust` (vec4), `uWindNoise`
(`noiseTexture()`), `uWindHeight`. One GLSL block, in the `#include
<common>` part:

```glsl
float wPhase, wGust, wRegion;
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 windAt(vec3 base, vec3 p, float tip) {        // base: instance foot (world); p: world point; tip 0..1
  wPhase  = dot(base.xz, vec2(0.071, 0.113)) + hash12(base.xz) * 1.7;
  wGust   = smoothstep(0.55, 1.0, 0.5 + 0.5 * sin(dot(base.xz, uWindDir) * uGust.x - uWindTime * uGust.y));
  wRegion = texture2D(uWindNoise, base.xz * uGust.w - uWindDir * uWindTime * 0.01).r;
  float k = uWindStrength * (0.55 + 0.9 * wRegion) * (1.0 + uGust.z * wGust);
  float t = uWindTime * uWindTrunk * 6.2832 + wPhase;
  float sway = 0.6 + 0.4 * sin(t) + 0.25 * sin(t * 2.3 + 1.7);
  float flutter = sin(uWindTime * 16.34 + dot(p, vec3(3.1, 1.7, 2.3)) + wPhase) * uWindLeafAmp;
  return vec3(uWindDir.x, 0.0, uWindDir.y) * (sway * k * tip) + vec3(flutter, 0.0, -flutter * 0.7) * tip;
}
```

Every user (trunk bend, card centres, fronds, grass, far tier) applies it
**in world space** after `modelMatrix * instanceMatrix`, so sway doesn't
rotate with yaw or scale with instance size. `tip` = `aWind²` where the
geometry has `aWind`, else `clamp(localY / uWindHeight, 0, 1)²` from the
untransformed position. A unit test (a JS mirror of `windAt`) asserts that
trunk-top and crown-card displacement are equal at the same point, so
crowns never float off limbs.

Presets (`WIND` in foliage.js; h = tree height): crown bend 0.6 h, strength
0.012·h, trunk 0.25 Hz; conifer 0.6 h, 0.008·h, 0.22 Hz; frond 1.1 Hz by
`aWind²`; strand 0.8 Hz; shrub unchanged. Gusts: trees `(0.06, 0.5, 0.6,
0.004)`, Lothal grass `(0.45, 1.8, 0.8, 0.01)`. Per-world strength: Lothal
1.0, Scarif 0.8, Naboo 0.5, Kashyyyk 0.5, Yavin 0.3, Endor 0.25, Sorgan 0.15,
Dagobah 0.1, barren worlds 0.

### 2.5 Cards: leaf atlas, crowns and bushes

**Atlas (`lib/three/leaves.js`).** A 256² `Uint8Array` RGBA `DataTexture`,
built once (about 10 ms a channel), `NoColorSpace`, `premultiplyAlpha
false`. Not a canvas: a 2D canvas is premultiplied and would zero R, G and B
wherever A (strands) is 0. Each texel = `max over shapes of clamp(1 −
d/halfWidth, 0, 1)`; shapes stay inside r < 0.45 so a rotated UV never
clips. `coverageMips(levels, { cut: 0.4 })` works on the typed arrays per
channel (a binary search of each level's alpha scale) and fills
`tex.mipmaps`, `generateMipmaps = false`, `LinearMipmapLinearFilter`.

| Channel | Content | Coverage at 0.4 | Used by |
|---|---|---|---|
| R | 24–28 pointed ovals | 0.30–0.36 | broadleaf crowns, bushes, cypress, holm oak, plane, beech |
| G | twig + side twigs + needle capsules (and a scale-leaf variant) | 0.20–0.30 | redwood, fir, spruce, pine, **wroshyr pads** |
| B | pinnate frond | 0.35–0.45 | sword fern, palm, cohune, xate |
| A | 10–16 wavy vertical strands | 0.15–0.25 | hanging moss, vine curtains, aerial roots, Lothal phone tufts |

**Channel per vertex.** Every card vertex carries `aChan` (a one-hot vec4;
default R). The fragment does `diffuseColor.a *= dot(texture2D(map, q),
vChan)`. Opaque parts in the same draw (a crown core, a palm or cohune
trunk, a fern stem) use the sentinel `uv = (−1, −1)` and get alpha 1. So
each world has **one card material**, and any parts of a species drawn with
cards share one draw.

**Channel-aware depth.** Every flora mesh gets `customDepthMaterial =
leafDepth(atlas)`: a `MeshDepthMaterial` (`alphaTest 0.4`, DoubleSide) whose
vertex shader runs the same billboard and wind and whose fragment does the
same `dot(texel, vChan)` and sentinel. It is used by the floor bake and by
the shadow pass on GPUs that keep it (no `EXT_color_buffer_float`,
`groundwork.js:127`).

**`blobCards(n, { R, radii, core, card, lodShare 0.5, seed })`.**
- Centres at `Spherical(1 − rnd³, 2π·rnd, acos(1 − 1.6·rnd))` × radii.
- **Card size as a share of crown radius:** bushes s = 0.8 R (Bruno);
  crowns s = min(2.5 m, 0.35 R). Bigger crowns get more blobs, never bigger
  cards.
- **Opaque core:** an icosphere detail 1 (80 triangles) at 0.6–0.7 R,
  spherified normals, same material through the sentinel, **its triangles
  first in the index buffer** (early-Z). The old "lily pad" came from a flat,
  faceted, ×0.55-dark core, not from having one.
- **Fringe layers:** `L = n·s²·0.33/(πR²)` ≈ 1.2. Overdraw ≤ 6× on desktop,
  ≤ 4× on phones. `cards.test.js` asserts both.
- Per card: `position` = a real, randomly oriented card (so depth casts it),
  `aCentre`, `aCard` = (spin, size, lod flag), `aChan`, `uv` = corner + 0.5.
  4 vertices and 2 triangles per card, indexed. Merged with
  `mergeGeometries` + `mergeVertices`, never `trafficKit.bake` (which
  de-indexes and drops custom attributes); every part carries the same
  attribute set with defaults.
- **Normals:** `normalize(0.15·corner + 0.55·(centre − clump) + 0.30·(centre
  − crown))`. **Crown AO** in vertex colour: × `mix(0.55, 1, smoothstep(0.1,
  1.05, |p − c|/R)) · mix(0.75, 1, heightInCrown)`.

**Vertex hook `cards()`** (after `#include <project_vertex>`):

```glsl
#ifdef USE_INSTANCING
  mat4 im = instanceMatrix;
#else
  mat4 im = mat4(1.0);
#endif
vec4 c = modelMatrix * im * vec4(aCentre, 1.0);
vec3 base = (modelMatrix * im[3]).xyz;
float tip = pow(clamp(aCentre.y / uWindHeight, 0.0, 1.0), 2.0);
c.xyz += windAt(base, c.xyz, tip);
float iS = length(im[0].xyz);
float k = smoothstep(uCardFade.x, uCardFade.y, distance(base.xz, uCamXZ));  // the same metric as createLodSet
float size = aCard.y * iS * (aCard.z > 0.5 ? 1.0 - k : 1.0 + 0.414 * k);     // keepers ×√2: area kept
vec4 mv = viewMatrix * c;
float cs = cos(aCard.x), sn = sin(aCard.x);
mv.xy += mat2(cs, sn, -sn, cs) * (uv - 0.5) * size * step(0.0, uv.x);        // the core (uv −1) isn't expanded
mvPosition = mv;
gl_Position = projectionMatrix * mv;
float a = uFlutter * (wGust * uGust.z + wRegion - 0.5) * 0.5 + 0.1 * sin(uWindTime * 1.9 + wPhase + aCard.x);
vFlutter = vec2(cos(a), sin(a));
```

For core vertices, `c` is the core vertex itself (they carry `aCentre =
position`). `uCardFade` = (45, 60) m, phones (30, 40).

**See-through** (bushes and ferns only): within a screen ellipse round the
player, and only where the plant is nearer than the player,
`alpha = sdf·(fade·0.6 + 0.4) − 0.4`.

**Billboard risk:** cards turn with the camera. Mitigations: cards ≤ 2.5 m,
random roll, many blobs per crown. Fallback: `uBillboard` (0.85 view-aligned,
0.15 fixed), or fixed cards on crowns over 20 m.

### 2.6 Sprays, fronds, strands, lianas, big leaves, trunks

| Builder | Geometry | Triangles | Channel | Wind |
|---|---|---|---|---|
| `cutSpray(len, w, droop)` | arrowhead/hexagon card, 6–8 vertices, 2 drooping segments | 4–6 | G | bob 0.05 m at 1.2 Hz × aWind² |
| `frondStrip(len, w, rows, arch, droop, fold)` | V-fold strip, 3 vertices a row | 4 per row (fern 16, palm 24) | B | palm 0.25 m, fern 0.06 m, 0.9–1.4 Hz × aWind² |
| `crossStrips(len, w, rows)` | X of 2 strips, 3–4 rows | ≈16 | A | pendulum 0.15 m, 0.6–1.0 Hz |
| `vineCurtain(n, len)` | n strand cards, 5–15 m long | 2 each | A | pendulum |
| `liana(p0, p1, sag, r)` | catenary tube (8 × 4) + leaf cards every 0.7–1 m | 64 + cards | R | 0.05 m |
| `bigLeaf(len, w)` | 8-triangle outline fan, sentinel (opaque) | 8 | – | hinged at its base: rotate `transformed − aBase`, never translate |

Lianas and epiphyte tufts are merged into their host species' geometry (in
the bark and card materials), not drawn on their own. Moss strips are part
of the host's card geometry.

Fern counts: sword fern LOD0 15–25 fronds (240–400 triangles), LOD1 6 flat
fronds (48). Palm crown 16–22 fronds × 24 + trunk 8–10 × 8 with a ring
stripe (in the card material through the sentinel) + coconuts; dead lower
fronds `#8C7A4A`.

**Trunks and bark.** Lathe trunks emit cylindrical UVs, `u = angle/2π ×
round(circumference / 1 m)`, `v = y / 1 m` (constant wrap per trunk), not
`boxUV`. Lathe segments ≥ 2× the flute count (redwood 16 / 8). Fine furrows
from the `bark_brown_02` normal map (`normalScale 1.4`) plus a stripe term.
Feet by species: redwood flare 1.6× over 0–3 m, 2–4 burls, goosepen char
`#1a1612` on 1 in 5; ceiba 4–6 plank buttresses 3–5 m high; jungle tree 3–4
low planks; gungan 6–10 rope roots to 2.5× radius; gnarltree braided strands
**to 0.6–1.0 m** (hut hero ≤ 2 m) with 6–10 arching prop roots making a
root mass 6–10 m across; wroshyr 6–8 spiralling flutes and 8–12 buttress
roots, mangrove arches at water. Vertex colour: foot × `mix(0.6, 1,
smoothstep(0, 4, y))`, north-side moss band, pale root tops on gnarltrees
`#a2a6a8`. Bark colour = film target ÷ 0.78 (the scan's mean). Bark goes
through `foliageLook` at stylise 0.4, wrap 0.25, no translucency.

### 2.7 Ground (`ground.js`, `terrain.js`, `cover.js`)

1. **`groundColour(vec3 wpos, vec3 n)`** becomes an exported GLSL chunk
   (height ramp, three noise scales, accent, deep, rock, wet, grain), with no
   visual change. Ground, grass, patches and bounce call it.
2. **Cover mask** (`cover.js`): a 512² (phones 256²) `Uint8Array` RGBA
   `DataTexture` over ±640 m, baked on the CPU after the grid and places
   (20–40 ms *est.*). Dabs (litter under trees r = crown × 1.2, damp rings
   1.3 R, flower drifts) are painted into the typed array, never with
   `createRadialGradient`. Linear filtering, no mips, 1-texel blur.

   | Channel | Meaning | Rule |
   |---|---|---|
   | R | green cover | slope < 0.35, above water + 0.3, outside flats and paths, × patch noise 60–120 m |
   | G | grass height; **on lava worlds, the lava mask** | taller in hollows; lava rasterised from the `channels` layer's beds |
   | B | dryness | crests, sun-facing slopes, near rock |
   | A | litter or flowers | painted as instances are placed |

3. **Bounded read** (the ground runs to ±9 km):

   ```glsl
   float inC = 1.0 - smoothstep(600.0, 640.0, max(abs(vGround.x), abs(vGround.z)));
   vec4 cv = mix(uCoverFar, texture2D(uCover, clamp((vGround.xz + 640.0) / 1280.0, 0.0, 1.0)), inC);
   ```

4. **Cavity:** `heightGrid` adds `aCav` (vec2) = mean(h over the ring) − h at
   **1-cell and 3-cell rings** (5/15 m on high, 8/24 m on small), 0 on the
   growing outer cells.
5. **Ground block additions** (+1 fetch, about 20 ALU). `heightBlend()`
   lives in the `#include <common>` block, not inside `main()`; strata is
   `gTex(...).b` as today:

   ```glsl
   c = heightBlend(c, nMid, uCoverColour, nFine, cv.r, 0.15);
   c = mix(c, uLitter, cv.a * 0.65);
   c *= mix(vec3(1.0), uDryTint, cv.b * 0.5);
   float cav = vCav.x + 0.5 * vCav.y;
   c = mix(c, c * uHollowTint, smoothstep(0.2, 2.0, cav) * 0.45);
   c = mix(c, c * uCrestTint,  smoothstep(-0.2, -2.0, cav) * 0.30);
   c = heightBlend(c, nFine, rockC, strata, rock, 0.08);
   ```

   All tints default to identity until `FLORA[id].ground` sets them.
6. **Canopy shade:** a 256² R8 `DataTexture` over ±640 m. Each crown
   footprint (r = crown radius) is CPU-dabbed, offset along −sunXZ × crown
   height × cot(sun elevation). It is read where `gRead` falls outside every
   mask rect, and everywhere when `!canBake`: on the ground (`gSun = 1 −
   0.75·canopy` in `floorShadow`), on understory and on grass. It fixes the
   sunlit duff under closed canopy beyond ±170 m.
7. **Triplanar rock near cliffs:** the `detail.js` UDN logic inlined where
   `rock > 0.05 && dist < 80 m`. The `dFdx`/`dFdy` of the three projected
   coordinates are computed **before** the branch and `textureGrad` used
   inside (or the fetches are unconditional and weighted, as `detail.js`
   does). One tinted scan per world (`public/games/tex/mesa-rock` for
   Tatooine and Geonosis, `public/cc0/galaxy/rock` elsewhere). Off on phones.
   Off by default; enabled per world in its checkpoint.
8. **Emissive lava** (Mustafar; Nevarro after its channels layer): cover G
   on a lava world → `totalEmissive += mix(#9B331F, #DF852F, crack²)·2`.
   Never from dryness.
9. **Lothal wave tint** beyond the grass patch: `c *= 1 + 0.08 *
   (texture2D(uNoise, xz·0.012 − windDir·t·0.05).r − 0.5)`.

### 2.8 Placement (`plan.js`, pure, deterministic per seed)

- `uniform` (default) reproduces today's `scene.js:197-213` annulus exactly,
  same RNG sequence (a regression test pins it).
- `cluster`: jittered grid at spacing `s = 100/√(peak stems/ha)` m; accept
  with probability `smoothstep(1 − cover, 1 − cover + 0.18, fbm(x/scale))`
  (0–1; `density` is not a probability). Scale tracks the local accept value:
  big plants at a clump's heart.
- `rows`: plantation rows (Scarif palms 7–9 m apart, Naboo cypress along
  paths). `edge`: a wall along the iso-line `cover.R = 0.5` (or `flat.r + 4
  m` of places), Sorgan conifers 4–8 m apart. `ring`: Endor fairy rings.
  `satellite`: children round another kind (stones at R·(1.1–2.9),
  power-law size, biased downhill, sunk 20–40%).
- **Static extent** = `min(within[1], REACH + d98)` (table §2.2). Never a
  clip at d98 from the origin: the player walks 590 m out.
- **Corridors** from every `MISSIONS[*].waypoints` and every `race` step's
  `gates` (missions, `sites/quests.js`, site quests): half-width 10 m for
  speeders, 8 m for kaadu, 5 m on foot. Trees allowed from 6 m off the line.
  Routes today: Endor chase (60,250)…(236,−28), Endor `bikechase`
  (90,220)…(250,−20), Lothal star map (−30,20)…(−295,62), Dagobah "Do or Do
  Not" (−10,−70)…(−58,−114), Naboo kaadu run (60,60)…(−130,290), Tatooine
  Beggar's Canyon, Bespin platforms.
- **Solids**: trunk radius at 1 m height only (never crown or buttress
  spread). Understory, logs and roots stay `solid: false`.
- `solidsOf(placed)` and `worstSpot(placed, levels, bands)` (the 20 m grid
  position with the largest Σ ring count × triangles) are exported for tests
  and for the worst views.

### 2.9 Grass field (`grass.js`)

A port of `avengers/world/grass.js` (wrapped patch, R2 layout), with:
- **One triangle per blade**: a new 3-vertex blade (the avengers blade is 5
  vertices, 3 triangles).
- `mesh.userData.noBake = true`, `castShadow = false` (its displacement is
  shader-only, so the depth pass would draw a stack at the origin).
- **Heights match the drawn ground:** the grid uploaded as R32F with
  `NearestFilter` and read with `texelFetch` (R32F linear needs
  `OES_texture_float_linear`, which many phones lack), size (n+1)²: 257² on
  high, 161² on small. The vertex shader runs `groundY()` with the same
  3-corner split as `heightGrid`.
- Root colour = `groundColour(p, up)` × `uRootAO` 0.5; tip = root ×
  `uTipLift` (1.5, 1.45, 1.15). Normals up. The ground under grass darkened
  toward the root colour. Flowers as tip colour on 1.5–3% of blades in drifts
  (cover A).
- Cover R sets presence (blades shrink, never pop), G height. Shared wind,
  gust tip sheen × mix(1, 1.15, gust·t), push-aside within 1.4 m, clumps at
  3.1 m.
- Triangle counts include every submitted blade.

| Tier | Blades (one triangle) | Patch | Shading |
|---|---|---|---|
| high | per world (table below), default 80k | 56 m (Lothal 64 m) | MeshStandard roughness 0.94 |
| small | 16k | 28 m | vertex-lit, unlit material |

Per-world blade counts (high): Naboo 80k, Lothal 80k, Sorgan 60k, Scarif 40k,
Yavin 30k (clearings only), Kashyyyk 30k (shore), Dagobah 20k (waterline).
**Lothal on small** uses 6k A2C tuft cards (4 triangles, 0.6 m wide, A
channel) in a 60 m patch (≈24k triangles), so the straw sea doesn't end
9–14 m away. Optional later: +12k three-triangle hero blades within 10 m.

None on Tatooine, Hoth, Mustafar, Geonosis, Bespin, Coruscant, Kamino,
Nevarro, Mandalore or Endor (Endor's sorrel is painted into the ground).

### 2.10 Understory patches (`flora/patch.js`)

Film-density understory can't be a static world scatter (sword-fern
islands at 1,200–2,000/ha over 145 ha would be ≈100k instances and a 100k
sort every 0.5 s). Ferns, bushes, reeds, xate, bog plants, saplings and
tufts are **player-following wrapped patches**, the grass mechanism:
- An `InstancedBufferGeometry` with a per-slot `aSlot`; slot = world cell
  origin + `hash(cell)` jitter, so plants are world-locked and
  deterministic. Accept by `cover.R × clusterNoise`, else scale 0.
- Two patches per species: **LOD0** 40 m square, full plant, circular fade
  12–20 m; **LOD1** 100 m square, lite plant (6-frond fern, 48 triangles),
  fade 20–50 m. Beyond, the darker cover-mask floor carries it.
- `userData.noBake = true`, `castShadow = false`. 0 CPU sorting, 1 draw per
  patch.
- Densities live in `FLORA[id].under`. Endor: sword ferns 0.12–0.2/m²
  inside islands, island cover 0.45, cluster scale 24 m, LOD0 ≤ 20 m, LOD1 to
  50 m; salal/huckleberry bush 0.02/m² along trunks and logs. Endor at 0.12
  slots/m²: LOD0 192 × 320 = 61k, LOD1 1,200 × 48 = 58k, ≈120k submitted.

Trees stay static placements plus `createLodSet` (7–10k items per world at
`REACH + d98` is fine).

### 2.11 Rings, LOD, far tier and canopy shell

- **Built species:** `createLodSet` with `bands: [Dnear, Dmid, d98]`; band 3
  is never listed, so it has 0 instances and 0 draws. Near ring 0–60 m
  (giants 0–90), mid to 220 m (phones ×0.65), far tier to d98.
- **Re-sort cadence:** near band `move: 8`, mid/far `move: 30`; species
  staggered across frames; `instanceMatrix.addUpdateRange` for the changed
  span.
- **`flora.sort(landAt)` runs synchronously before `groundWorld`**, so the
  first bake sees the trees.
- **GLB kinds:** `placer.js fillSplit` becomes 3-way: `d < lodDistance` →
  full, `d < d98` → lod1 (or full when there is no lod1), else hidden. It
  already re-sorts every 8 m.
- **GLB lod1 (foliage path)** in `galaxy-surface-lod.mjs`: decimate only
  opaque primitives; for `MASK` primitives drop about 50% of connected
  components (cards) and scale survivors ×1.41 about their centroids;
  `over: 0` for these kinds. Retired GLBs get none.
- **Far tier (`flora/far.js`): one InstancedMesh per world.** A 24-triangle
  lathe reshaped in the vertex shader by a per-instance `aShape` (vec4: base
  radius, crown bottom, crown top, top radius) covers column, cone,
  umbrella, round, palm and spire. Lambert, no texture, no discard; normals
  up and out (y 0.55), AO by height. Instance colour = region noise between
  the world's far shadow and mid (near ramp × 0.85–0.9). Stochastic
  collapse between 0.8·d95 and d98 (phones 0.6–0.7·d95): `transformed *=
  step((d − from)/(to − from), hash12(root.xz))` with `d` from `uFogEye`.
  `noBake`, `castShadow = false`.
- **Canopy shell (`flora/shell.js`)** for Yavin's closed carpet beyond 120 m
  (3,500 proxies would give 27% cover; 80% would need ≈25,000). Built on the
  terrain's own grid lines in that annulus at y = ground + 22–40 m (noise per
  10–25 m cell), per-cell Worley domes for normals and AO, cover-mask gaps
  (clearings, plaza, river, landing) dropped below ground, lit by
  `foliageLook`. 1 draw, 60–120k triangles (8 m cells on small). Near and mid
  card crowns sit 1–2 m above it. Available to Endor and Kashyyyk if their
  far forests read thin.
- **No octahedral impostors** (11–45 MB a species).

### 2.12 The draw ledger

Draws per species = materials × non-empty rings × geometry variants; the
far tier is 1 per world; each understory patch is 1. F0 records, per world,
today's vegetation draws by kind (from a `__surfaceDo('draws')` dump of
visible meshes by kind) in `lab/foliage/ledger.json`; every checkpoint
updates it, and a world checkpoint may not close if `merged calls − today's
veg draws + planned veg draws` exceeds the gate.

Planned vegetation draws (high):

| World | Planned (species: draws) | Total | Note |
|---|---|---|---|
| Endor | redwood2 2 var × (bark, cards) × 2 rings 8; conifer 4; swordfern patches 2; bush patches 2; log2 (bark, cards) 2; stumps 1; far 1 | 20 | today ≈16 → ≈85 / 89.1 |
| Yavin | jungle2 4 (climbing fern merged); ceiba 4 (lianas, epiphytes merged); cohune 2 (trunk via sentinel); xate LOD0 1; fern patches 2; philodendron LOD0 1; saplings LOD0 1; logs 1; clearing grass 1; far 1; shell 1 | 19 | today ≈22 → ≈56 / 62.7 (original) |
| Dagobah | gnarl2 4 (moss in strand cards); hero gnarls 2; shoots 1; dagoroots 2 levels; reeds2 2; bog plants 2; fungus 1; logs 1; floating weed 1; edge grass 1; far 1; cypress heroes ≤ 2 (optional) | 18–20 | ≤ 83.6 (original) |
| Kashyyyk | wroshyr2 2 var × 2 × 2 8 (aerial roots, moss merged); karst2 2 + near-top scrub 1; bigLeaf patches 2; fern patches 2; shore grass 1; far 1 | 17 | ≤ 100.1 |
| Naboo | cypress 2; plane 4; holmoak 4; gungan 4; beech 4; meadow grass 1; reeds/lily 1; boulders 1; far 1 | 22 | 24 grove draws and lumps retired |
| Scarif | coconut 2 (trunk via sentinel); pandanus 1; beachscrub 2; creepers LOD0 1; dune grass 1; far 1 | 8 | palm GLB, sorganfern, tufts retired |
| Sorgan | conifer 4; swordfern 2; meadow grass 1; reeds 1; pond water 1; berms 1; logs 1; far 1; optional pine variant +4, broadleaf filler +4 | 12–20 | ≤ 63.8; options only if the ledger allows |
| Lothal | grass 1; far cards 1 (high) or tuft patch 1 (small); spire kit 1; shrubs 1 | 4 | cone grass, lothtemple copies retired |

Worlds without vegetation change by 0–2 draws (lava planes, slab or shard
kits, planters).

---

## 3. Per world

`FLORA[world]` holds ramps (`shadow → lit` for crown, under, bark, far),
`back` (translucency tint), `grade`, `air` (sky colours, d50, start, height
fog `hf` = [density, 1/falloff, base] and colour), `ground`, `grass`,
`under`, `scatter` (patterns, retirements). Height fog base "ground" means
`site.land` height; Dagobah's is the water level (0).

### Endor (ROTJ: Jedediah Smith / Grizzly Creek redwoods)
- **`redwood2`** (LOD0 ≈1.6k, ≤ 2.5k; mid ≈500): 45–75 m, DBH 3–5 m, 16
  segments / 8 flutes, flare 1.6×, burls, char on 1 in 5, branch-free to
  0.45–0.55 h with 2–4 dead stubs, narrow crown in the top 30–40%: 10–14
  drooping limbs × 12–16 cut sprays 1.5–2.5 m (G). Two variants.
- Fairy rings: 30% in rings of 3–7 on a 5–15 m ring round a charred stump.
  Groves at 20–30 stems/ha (cluster scale 110 m, cover 0.55), clearings round
  places, corridors kept.
- **`conifer`** (Douglas-fir/hemlock) 25–50 m, about 10% of near trees. Far
  ridges in the far tier as `cone`.
- **Understory:** `swordfern` patches (15–25 pinnate fronds 0.6–1.4 m),
  `bush` patches (salal/huckleberry, Bruno blob, 0.5–2 m), `log2` (1.5–3.5 m
  across, 15–40 m long, moss top `#96954C`/`#666025`, fern row, 20% root
  plates `#3a2a1a`), sorrel as ground (cover R patches 1–6 m `#7f9a6a`, lit
  `#BAD6A8`).

| Ramp | Shadow | Lit | Other |
|---|---|---|---|
| crown sprays | `#272E2D` | `#6a7a3a` *(derived: `#6F9231` desaturated to S 0.52)* | back/rim `#9AB44D`; measured canopy `#6F9231` mid, `#41501B` dark |
| fern | `#3e3a1c` | `#8F8F6E` | mid `#5E5D28` |
| bush | `#272819` | `#8C916D` | mid `#565B3B` |
| bark | `#29211A` | `#5C4232` | weathered `#6D676A` on 10% |
| far | crown × 0.85–0.9 | | colour check `#2C4145 → #4B643F` |

- **Ground:** duff `#6b4f35`, fern floor `#4a4a2a`, paths `#996E43` (packed
  `#B98F60`), deep `#2a1f14`, litter `#3a2a1c` / rust `#633C24`.
- **Air:** zenith `#7f9fd6`, horizon `#b8cad8`, haze `#8e9c90` (hazeK 0.8);
  d50 140 m, start 20, floor haze (0.006, 1/30, ground) `#9aa89a`; light
  shafts `#fff0c8 → #d8e6da`; hemisphere sky `#a7b8c0`, ground `#6b4f35`;
  grade shade (0.96, 1.02, 0.98), light (1.04, 1.02, 0.94). Gas giant kept,
  smaller and higher (decision 5).
- **Wind** 0.25.
- **Rebuilt placed and composite:** the 5 `ewoktree` (`forest.js:642`) and
  the placed `TREES` redwood heroes (`forest.js:481`) go through `redwood2`
  and its pools.
- **Remove:** the near `spruce`, the `lo` redwood ring at 600–1,300 m, fern
  rings beyond 90 m, solid-strip ferns, greens `#3f6230…#4a7430`, the bare
  brown accent floor.

### Kashyyyk (ROTS: Kachirho; Guilin and Phang Nga karst)
- **`wroshyr2` "giant conifer bonsai"** (LOD0 ≈2.1k, hero ≤ 4k): **80–140 m**
  (one optional 300 m backdrop hero), trunk 0.16–0.2 h wide, 6–8 spiralling
  flutes, 8–12 buttress roots, splits at 0.35–0.55 h into 3–6 limbs that
  rise 30–60° then level, **4–10 flat cloud pads of needle or scale-leaf
  cards (G)**, 0.25–0.45 h wide × 0.05–0.08 h thick; hanging aerial roots and
  moss strands (A); bridge rods between neighbours. Kachirho stays placed.
- **`karst2` towers:** height:width 1.5–3:1, domed tops, 70–90° walls, tidal
  notch; vertex colour by slope (vegetation `#273730 → #425554`, bare
  `#585E5A`, streaks `#3B443D`, lichen `#9EA4B0`); 3–8 per cluster in 2–4
  receding layers 300 m–2 km; card scrub on near tops; **mangrove clumps at
  the waterline**.
- **Understory:** `bigLeaf` plants and ferns (patches) on shore and forest
  edge, mossy roots `#4e5a44`, shore grass.

| Ramp | Shadow | Lit | Other |
|---|---|---|---|
| pads | `#1D2C20` | `#4A6054` | mid `#354832`, back `#74887D` |
| under | `#2F3E3C` | `#74887D` | mid `#57695D` |
| bark | `#30332A` | `#50554E` | ridges `#6e7066` |

- **Ground:** sand `#C5C4BB`, wet `#8a8a80`, jungle floor `#2F3E3C`, banks
  `#57695D`. **Water:** `#7B8575`, deep `#3a4a40`.
- **Air:** zenith `#a9c3d6`, horizon `#ECF6FD`; d50 500 m, start 30, sea mist
  (0.004, 1/20, sea 0) `#e6eeee`; grade shade (0.97, 1.0, 1.04), light (1.0,
  1.0, 0.98). **Wind** 0.5.
- **Rebuilt:** wroshyr heroes in `TREES`, Kachirho's `canopy()` crowns, pod
  vines (`tiers()`, `forest.js:1600`).
- **Remove:** flat dark `canopy()` cores, beige karst `#a8a493` and its
  faceted scrub, bark `#7a6a54`, leaf `#4a6a2c`, plants `#4a7030`.

### Dagobah (ESB studio swamp; TCW "Voices")
- **`gnarl2`** (LOD0 ≈2.2k, mid ≈400): **14–18 m**, braided trunk 0.6–1.0 m
  (hut hero ≤ 2 m), 6–10 arching prop roots making a root mass 6–10 m across
  with walk-in hollows, 2–4 twisted horizontal limbs, **no leafy canopy**,
  15–40 vine-curtain strands 5–15 m (A, `#212829`) and moss strips on limbs,
  pale root tops `#a2a6a8`. Hero gnarls (hut, cave, training) ≈3k. Young
  pale shoots 3–6 m `#9a968a` by the water. A tangle with visibility 30–60 m:
  30–50 trunks/ha within 230 m, clustered.
- **Understory:** `reeds2` (bent blade cards with seed heads) `#5a5c44` in a
  band 0–1.2 m above water; bog leaves and low ferns `#474931`; fungus kept;
  half-sunk logs; floating weed; edge grass; motes `#fff8e0`.

| Ramp | Shadow | Lit | Other |
|---|---|---|---|
| bark | `#1d2124` | `#6a665c` | mid `#4e4a42` |
| strands/moss | `#141615` | `#585844` | mid `#474931` |
| reeds | `#2e3022` | `#6a6c50` | – |
| far | crown × 0.85–0.9 | | colour check `#212B30 → #4d5658` |

- **Ground:** mud `#4A3A30` (wet), `#6B5A57` (dry), waterline `#22241a`,
  mossy rocks `#595350`/`#2E2B2B`. **Water:** `#7f8f98` *(derived)*, deep
  `#1A3848`.
- **Air (decision 3):** zenith `#8e9ca4`, horizon/fog **`#7d8f96`**, d50 60 m,
  start 8, dry-ice layer 0–1.2 m (0.05, 1/0.9, water 0) `#b4bcc0`; grade shade
  (0.96, 1.0, 1.04). **Wind** 0.1.
- **Rebuilt:** `cavetree` (`forest.js:1462`), Yoda's hut gnarltree, X-wing
  weed cones.
- **GLBs:** dagocypress leaves scatter; at most 12 restyled fog silhouettes
  at 60–200 m if the side-by-side shot prefers them. dagoroots restyled with
  lod1.
- **Remove:** gnarltree leaf canopies and moss cones, the far gnarl ring,
  scatter beyond the static extent.

### Yavin 4 (ANH Tikal; Rogue One; Andor S2)
- **Canopy:** crowns 10–25 m at 22–40 m height, 75–85% cover. Near ≤ 120 m:
  card crowns (≈300 tris) on `jungle2` trunks; mid: same cards minus the
  flagged half; beyond 120 m: the **canopy shell**; gaps over clearings, the
  plaza, rivers and the landing. From the ground the canopy is closed; from
  the temple top it's the broccoli sea.
- **`ceiba`** emergents (LOD0 ≈1.6k): 45–60 m, smooth grey `#87807F`/
  `#A29A9A` (mauve option `#7d7280`), 4–6 plank buttresses, branch-free to
  0.65 h, flat umbrella 30–45 m × 8–12 m, dark underside, epiphytes and 4–8
  lianas merged in; 1 per 2–3 ha; emergent `umbrella` far shapes above the
  shell.
- **`jungle2`** 25–40 m, bark `#605B4F → #898274`; **`cohune`** 10–15 m with
  8–15 fronds of 6–9 m; **`xate`** 0.5–1.5 m; catenary lianas `#3c4a26`.
- **Understory** (thin): saplings, ferns `#4a5230`, philodendron `bigLeaf`,
  climbing-fern cards on trunks.

| Ramp | Shadow | Lit | Other |
|---|---|---|---|
| canopy | `#1D2610` | `#94A162` | mid `#38441E`–`#56613A`; dawn tops `#4A4B2A`; bronze 1 in 30 `#8a5a4a` *(derived)*; back `#a8b46a` |
| under | `#2b3018` | `#6e7a44` | – |
| bark (ceiba) | `#726B6A` | `#A29A9A` | – |
| far | crown × 0.85–0.9 | | colour check `#1D2610 → #515C51`, haze `#6A7B72` |

- **Ground:** `#4a3a26` / `#3a4228`, litter `#8C7061`, dark `#2B220E`,
  limestone `#B7C0AC`/`#5C5C4D`. **Water:** `#3a4228` / `#1d2414`. Temple
  moss `#4e5a38`, lichen `#26271E`.
- **Air (ANH dawn, decision 3):** zenith `#A8A8D5`, horizon `#9896AB`, haze
  `#b0aec4`, far tree line `#4A4E54`, gas giant `#d8763e`; d50 300 m, start
  30, valley mist (0.005, 1/18, river −3) `#c9c6d8`; grade shade (0.97, 0.98,
  1.05), light (1.05, 1.0, 0.95). `sky.mood: 'mist'` (Rogue One: sky
  `#F5F7E4`, mist `#FDF8DA`/`#9AA699`). **Wind** 0.3.
- **Rebuilt:** the `ruin` jungletree (`forest.js:1694`), temple vines
  (0.3 m slabs in `tiers()`).
- **Remove:** `yavintree` scatter (≤ 2 placed restyled heroes if the shot
  prefers them), plate cores, rod lianas, the 640–1,400 m ring, greens
  `#3e6428`/`#355a26`.

### Naboo (TPM, AOTC)

| Zone | Where | Plants | Ground |
|---|---|---|---|
| Great Grass Plains | `battle` (260, −250), open hills | no trees; turf 0.15–0.3 m `#768B38`/`#8CA043` | scarps `#9A9176 → #7C7852` |
| Lake Country / Varykino | (372, 330) | `cypress` 12–20 m in rows and pairs (`#1F2A17 → #24301B → #374723`); `plane` umbrella (trunk `#8C8470`, crown `#3E4926 → #9B962E`/`#B2A74D`); `holmoak`; meadow 0.4–0.8 m, ≤ 3% flowers; boulders `#716240`/`#9C8861` in 3–7s | meadow |
| Theed | (−235…−130, 300) | `holmoak` 8–14 m (`#293D2C → #566F40 → #839D5F`); moss and creepers on the cliff | cliff `#2A1F16 → #765337`, triplanar |
| Gungan Sacred Place | (−320, −230) | `gungan` 30–50 m with rope roots (bark `#49352F`/`#695851`, moss `#526F4E → #8EB278`, canopy `#1A2615`), 10–20; `beech` wood (trunk `#7C8470`, canopy `#5B7E2A → #86B049`, litter `#755D29`); reeds and lily pads `#3C5A2E` | swamp |

- Grass base `#405138`, mid `#718332`, tip `#8EA33D`; open-world caps apply
  everywhere on Naboo, Sacred Place included.
- **Ground:** `#5f7034` / `#8a9e40`, deep `#4a5a2e`, scarp `#9A9176`.
  **Water:** lake `#2c3d3e` / `#172526`; falls pools `#79A7B0`/`#517C79`.
- **Air:** zenith `#79A2C9`, horizon `#cfe4ef`, haze `#8CA5B2`; d50 1.5 km,
  start 40, lake mist (0.003, 1/15, lake 0) `#dfeaee`; grade shade (0.97,
  0.99, 1.04), light (1.04, 1.01, 0.95). **Wind** 0.5.
- **Remove:** `nabootree` and `grove` lump canopies, grass cones and flower
  spheres, uniform scatter, 24 placed-grove draws.
- Kaadu run corridor kept (8 m half-width).

### Lothal (Rebels; Ahsoka): the early win
- **Grass is the hero:** straw 1.0–1.4 m; base `#81683D`/`#8E754F`, body
  `#C6AF79`, tip `#D9CA9C`, olive drifts `#C5B56A`/`#A89B69` by cover B,
  golden lit `#F7D2A6`. Travelling waves 8–20 m long. Ground wave tint
  beyond the patch; 2,000 far cross cards 30–150 m on high; tuft cards on
  small (§2.9). Round dirt clearings at `capital`, `factory`, `tower`
  `#B3998A` (lit `#DABEA8`).
- **`spire` kit** (replacing the `lothtemple` copies): lathe 16–24 segments,
  200–600 tris, rounded fingers and cones 5–40 m, horizontal strata (world-Y
  stripe `#4F5357`/`#8B8674`), shade `#3B434C`, sunlit `#ECCFAA`, clusters of
  3–9 with mist at the feet. The real temple at `spires` (−140, 230) stays.
  Spires keep 12 m clear of the star-map gates.
- No trees; a few low shrubs by water `#A89B69`/`#6C715C`.
- **Ground:** `#8E754F` / `#A89B69`, accent `#B3998A`, rock `#7a7268`.
- **Air (golden afternoon):** zenith `#7f97d4`, horizon `#f2d9b4`, haze
  `#F7D5AA`; d50 1.2 km, start 40, spire mist (0.002, 1/10, ground)
  `#e8d8c8`; grade shade (0.97, 0.97, 1.05), light (1.06, 1.0, 0.92). Lothal
  may lengthen its fog before F9: it has no forest to thin. **Wind** 1.0.

### Sorgan (The Mandalorian ch. 4)
- **Conifer wall:** `conifer` fir/spruce 25–35 m, 6–9 drooping tiers of cut
  sprays (G), ramp `#1C2016 → #23271D → #4E4F33`, trunk `#4A3F33`; `edge`
  pattern 4–8 m apart round clearings; far tier `cone` for the treeline.
  Optional, ledger permitting: 25–30% pine variant (tufted top `#606345`),
  10–20% round broadleaf filler (`#4D512D`/`#606345`).
- **Krill ponds:** a levelled pond field round the village (180, 120)
  (`flats` at pond level −0.3 m) with a **raised dry flat for the huts in the
  middle**, one water plane over the whole field (`site.waters[]`), and dykes
  as built low berms (≈20 triangles each, grass top `#615834`, sides
  `#473A26`). Water `#334749`/`#2D352F` reflecting `#B7C9CB`, faint krill
  specks `#3FA0E0`, reeds `#5A5A38` on 30% of edges. The place text becomes
  huts on dry ground ringed by ponds (decision 4).
- **Understory:** `swordfern` (`#2a3020 → #606345`) under the forest edge,
  logs, mossy boulders; meadow grass `#514D2F → #615834 → #66593E`.
- **Ground:** `#514D2F` / `#615834`, forest floor `#2f3324`.
- **Air:** zenith `#9CACB3`, horizon/fog `#B7C9CB`; d50 450 m, start 25,
  forest mist (0.004, 1/15, ground) `#c4d2d2`; grade shade (0.97, 1.0, 1.03),
  light (1.0, 1.0, 0.98). **Wind** 0.15.
- **GLBs (decision 2):** sorganbirch, sorganfir and sorganfern leave
  scatter; sorganfir may stay as a restyled placed hero if the shot prefers.

### Scarif (Rogue One: Laamu Atoll, Bovingdon)
- **`coconut`** (LOD0 ≈620): 15–25 m, curved leaning trunk `#8C8470 →
  #B8AE96` with a ring stripe, 16–22 drooping V-fronds. Plantation rows 7–9
  m apart on the big islands plus leaning singles along shores.
  **`pandanus`** (stilt roots + spiral `bigLeaf` straps, ≈500), a few per
  island.
- **Understory:** `beachscrub` fringe, a continuous 3–8 m band at the top of
  every beach (`#303C25 → #55664B`); creepers; dune grass inland and on dune
  backs.

| Ramp | Shadow | Lit | Other |
|---|---|---|---|
| fronds | `#303C25` | `#719767` | mid `#437145`, back `#9fcf8a`, dead `#8C7A4A` |
| scrub | `#1f2a1a` | `#55664B` | – |

- **Ground:** beach `#ece8d6`, inland `#ddd6bc`, green `#7f8f5a` only where
  cover R > 0, wet `#c8c2a6`; reef flats by depth optional.
- **Air:** zenith `#7fa3bd`, horizon `#d6e4e2`; d50 2 km, start 60, sea haze
  (0.0015, 1/25, sea 0) `#d6e4e2`; grade shade (0.97, 1.0, 1.04), light
  (1.03, 1.01, 0.97). **Wind** 0.8.
- **Remove:** the uniform 420-palm field, `sorganfern` on Scarif, tufts and
  grass cones. The `palm` GLB may stay as a near hero if the shot prefers.

### Worlds with no vegetation (correct per the films)

| World | Ground and rock | Palette (low / high / rock / accent) | Air and grade |
|---|---|---|---|
| **Tatooine** (colours owned by wf_62561f47) | **Nebkha** hummocks (mound + dry twig shrub, ≤ 200 tris, `#8D764C`/`#5D4E28`), **1–3 per 1,000 m², at most 40**, only on the salt flat within 150 m of `homestead` (−170, 150); black melons near `tuskens`; Jundland boulders at cliff feet (satellites); triplanar `mesa-rock` within 80 m; cavity | unchanged (the workflow's) | only the F1 conversion |
| **Hoth** | drifts on the lee of rocks (satellites); blue ice faces `#9FB2CF` on the Echo Base cliffs (triplanar tint); nunataks `#2D3D40`/`#54686C` | snow `#d6d3c2` / `#ece8d8`, rock `#2D3D40` | cream overcast `#A0A699`/`#C8C9B7`; hemisphere `#4E666B`; d50 900 m, blowing snow (0.003, 1/12, ground) `#e6e6dc`; grade shade (0.94, 0.98, 1.08), light (1.0, 1.0, 1.02) |
| **Nevarro** | cool blue-black lava fields; basalt slab kit (50–200 tris) clustered; `lavarock` with lod1; steam. **The lava river is F18** (needs a `channels` layer) | `#161B25` / `#272631`, rock `#21282C`, ash `#60615E`, cliffs `#354249`/`#565F64` | sky `#5A6D8E → #9DAFC6`, city haze `#D7E2E4`; d50 700 m, steam (0.003, 1/12, ground); grade shade (0.96, 0.98, 1.06) |
| **Mandalore** (S3) | glassed crust, pale dust in hollows via cavity; roughness 0.45 + sparkle 0.5; built shard and plate kit (20–80 tris) as satellites round mesas and Sundari, ≈8/ha; triplanar mesa cliffs | `#384749` / `#55605F`, rock `#1C2528`, dust `#ACB2AB`, deep `#273133` | sky `#738B9E`/`#9FB2C1`; d50 600 m, dust (0.002, 1/15, ground) `#ACB2AB` |
| **Mustafar** | broad lava rivers from the existing `channels` beds (cover G) + local lava planes, in place of 900 `lavacrack` dashes; black ash slopes | rock `#13080A`, hot `#2F0B0E`/`#581113`, lava `#E03020`/`#F3582B`, core `#FAB743` | fog = sky (orange), d50 500 m, ash (0.004, 1/20, lava 2.5) `#581113`; grade light (1.08, 0.98, 0.9) |
| **Geonosis** | denser built spire clusters near the arena (300–800 tris), rock at mesa feet, triplanar | `#9D5428`/`#B2632E`, dark `#512816`; spires `#B8753E`/`#AD6D34`, highlight `#DBA04E`, shade `#62361E` | sky `#D09246`/`#E5AC55`; d50 900 m, dust (0.002, 1/25, ground) `#d6a549` |
| **Coruscant** | optional deck planters (Bruno blob topiary `#3a4a2a → #6a7a44`, 1–2 small ornamental trees). **No outdoor gold-leaved trees** (they grow inside the Room of a Thousand Fountains; `#C8A84A` *(derived)*) | – | haze `#78848A`, dusk `#5F57A0`; d50 520 m |
| **Kamino** | none; bigger waves | sea `#4C4F50`, Tipoca `#F3EEE2` | sky `#31343A → #505459`; d50 250 m, spray (0.004, 1/10, sea 0) `#8a949a` |
| **Bespin** | none | – | sky `#5173AB → #98ABC8`, clouds `#CAD0D2`; d50 1.2 km, cloud sea (0.01, 1/25, −380) `#CAD0D2` |

---

## 4. Performance

**Gate:** decision 1, at the landing **and** at a worst spot per forest
world (`AT=` in galaxy-check; spots from `worstSpot`, plus the Yavin
summit). A unit test per forest world asserts that the maximum over a 20 m
grid of Σ(ring count × triangles) ≤ gate − non-vegetation triangles.

**Estimated high tier at the landing** (*est.*, confirmed per checkpoint):

| World | Now calls / tris | Removed | Added | Est. after |
|---|---|---|---|---|
| Endor | 81 / 1,126k | veg ≈ −630k | redwood2 near ≈32–100k (worst spot), mid 140k, far tier 38k, conifer 42k, swordfern patches 120k, bush 21k, logs 24k, stumps 6k ≈ +490k | ≈85 / ≈0.99M |
| Kashyyyk | 91 / 898k | wroshyr −284k, karst −32k, plants and ferns −74k | wroshyr2 118k, karst2 51k, patches 96k, shore grass 30k | ≈92 / ≈0.80M |
| Dagobah | 85 / 1,386k | ≈ −1.18M | gnarl2 ≈120k, dagoroots lod1 63k, ≤ 12 cypress 23k, reeds 29k, bog 30k, fungus 23k, logs 15k, edge grass 20k | ≈75 / ≈0.53M (under original) |
| Yavin | 59 / 1,735k | yavintree −760k, jungletree −387k, under −150k | near/mid crowns 66k, shell 120k, trunks 50k, ceiba 36k, cohune 30k, patches 90k, lianas 13k, grass 30k, far 12k | ≈56 / ≈0.88M (under original) |
| Naboo | 324 / 856k | lumps and groves −270k, cone grass −116k | species ≈ +85k, gungan +25k, grass 80k, boulders 10k | ≈315 / ≈0.69M |
| Scarif | 107 / 1,275k | palm −593k, sorganfern −123k, tufts −25k | coconut 57k, scrub 60k, pandanus 10k, dune grass 40k, creepers 5k | ≈105 / ≈0.71M |
| Sorgan | 58 / 1,065k | GLBs ≈ −640k | conifer wall 179k, swordfern 45k, grass 60k, reeds 8k | ≈56 / ≈0.71M |
| Lothal | 72 / 769k | cone grass −175k, temple spires ≈ −192k | grass 80k, far cards 8k, spire kit 12k | ≈71 / ≈0.50M (under original) |
| Nevarro | 45 / 914k | lavarock full LOD −300k | basalt 40k, river +1 draw (F18) | ≈47 / ≈0.47–0.65M (under original if lavarock is fully replaced) |
| Mandalore | 107 / 693k | 198 GLB shards −297k | 2,000 built shards 120k | ≈105 / ≈0.52M (at the original) |
| Tatooine | 91 / 536k | old rocks −16k | boulders + pebbles 56k, ≤ 40 nebkhas 8k | ≈93 / ≈0.58M |
| Mustafar | 85 / 596k | 900 dashes −22k | lava planes +2k (+1 draw) | ≈85 / ≈0.58M |
| Hoth, Geonosis, Coruscant, Kamino, Bespin | – | – | ≤ +50k each | within +10% |

**Frame time:** p50 ≤ baseline × 1.1 on the same machine (SwiftShader times
are comparisons only). Fog +20 ALU/px, look +15, translucency +8; grass
0.3–1.2 ms; crown overdraw ≤ 6× desktop, ≤ 4× phones.

**Real phone check** before the grass/patch (F5) and cards (F7) checkpoints
close: a Pixel 6a or iPhone 12, mid tier, 1.5 DPR, ≥ 30 fps on Lothal and on
Endor. The owner runs it; the checkpoint records the result.

**Small tier:** scatter × 0.6, ring radii × 0.65, card counts × 0.5,
`FOLIAGE_LITE` (no rim, no translucency), stylise 0.55, grass 16k
vertex-lit in 28 m (Lothal tuft cards), no triplanar, cover 256², far
collapse 0.6–0.7·d95, Yavin crowns opaque blobs from 0 m, swordfern LOD0
within 15 m.

**Memory:** atlas 350 KB, cover 1 MB, canopy shade 64 KB, heights R32F
264 KB (104 KB small), cavity 1.2 MB, GLB lod1 +25% of each kept GLB.
**Load time** (`loaded` in galaxy-check) ≤ +1 s per world.

---

## 5. Verification

- **Dev server:** already running at `http://127.0.0.1:5188`. Renders use
  software GL and take minutes; one render command at a time.
- **Shots:** `OUT=lab/foliage/<cp> lab/foliage/shots.sh <worlds>` (views in
  `lab/foliage/views.txt`), at high and with `QUALITY=low`. Before-shots
  are in `lab/foliage/before/`.
- **Budgets:** `BUDGET=lab/baseline/surface-merged.json
  OUT=lab/foliage/<cp> JSON=1 node scripts/galaxy-check.mjs surface
  <worlds>`. Exit 0; p50 compared with F0's run.
- **Tests:** `npx vitest run <files>`, `npx vitest run`, `npm run lint`.
- **Colour check:** fixed pixel rects per view, kept in
  `lab/foliage/views.txt` as `rect=<name>:x,y,w,h`; `magick shot.png -crop
  WxH+X+Y -resize 1x1 txt:`; ΔE is CIEDE2000, ≤ 8 against the target.
- **Motion:** read `__surfaceDo('floraTime')` twice 1 s apart (moves; frozen
  under `reduced`), or diff a foliage crop with weather and life off. Never
  "two shots differ".
- **No pop:** hold the camera, move `uCardFade` and the ring bands through
  `__surfaceDo('floraFade', near, mid)`, diff the crown crop (< 2% of
  pixels).
- **Programs:** `renderer.info.programs.length` the same at frame 1 and
  frame 60.

---

## 6. Risks and remaining questions

1. **Billboarded cards turning** on a huge near crown: §2.5 mitigations and
   fallback.
2. **Lambert foliage loses PMREM ambient:** `lookBand` absorbs it; switch the
   card material to MeshStandard roughness 0.9 if Naboo or Scarif read flat.
3. **Exponential fog's long tail** shows more land: the far tier (F9) comes
   before any world lengthens its fog; the edge clamp hides the terrain end;
   the coarse far mesh may need refining (F19).
4. **Overdraw** under closed canopies on tile GPUs: opaque cores, mid
   geometry, `FOLIAGE_LITE`, the phone check.
5. **Floor mask only ±170 m:** the canopy-shade texture covers beyond; a
   second coarse bake area is F19 polish.
6. **Hook order** and `trafficKit.bake` de-indexing: covered by tests and
   by building flora with `mergeGeometries` + `mergeVertices`.
7. **Concurrent work:** wf_62561f47 (Tatooine colours) and CP3–CP11 edit
   `sites/*.js`. Per-world values go in `FLORA`; site files are touched only
   in a world's own checkpoint after its CP merges; Tatooine's palette never.
8. **Height changes** (Sorgan pond field, Nevarro channels, `erode`) move
   places and routes: each is checked against corridors and place flats in
   its own checkpoint.
9. **Unverified facts:** Scarif island names, the Sorgan backlot, Tatooine
   scrub limited to the Chott el Djerid hummocks, Dagobah stills being
   post-1997 grades, botanical sizes from standard references.

Optional film touches, not scheduled (F19 candidates): Lothal's shallow
inland sea near Capital City, Sorgan's river and oxbows, Varykino's terraced
gardens, Dagobah's giant fungus shelves.

---

## 7. Checkpoints

Each ships on its own; details and commands are in the plan.

| # | Checkpoint |
|---|---|
| F0 | Gate, views (incl. Yavin summit, worst spots support), draw ledger |
| F1 | Sky fog (identity conversion, edge clamp, installed at creation, actors' d97) + grade hook (identity) + `flora/palette.js` skeleton |
| F2 | Plant material core (look, faceless, translucency, world-space wind, understory, kit split, per-world GLB clones, A2C, leaf atlas and depth material) |
| F3 | Budget reclaim (static extent, camera-relative cull, pooling, LOD rings, 3-way GLB split, foliage-aware lod1) |
| F4 | Ground (groundColour chunk, cover DataTexture, bounded read, cavity, heightBlend, canopy shade, triplanar mechanism) + `plan.js` with corridors |
| F5 | Grass field + player-following understory patches |
| F6 | Lothal |
| F7 | Card crowns and bushes (cores, channel-aware depth, horizontal-distance fade, world-space wind) |
| F8 | Fronds, sprays, strands, lianas, big leaves |
| F9 | Far tier (one InstancedMesh per world, `aShape`) + canopy shell + real mid geometry |
| F10 | Endor |
| F11 | Naboo |
| F12 | Dagobah |
| F13 | Yavin 4 |
| F14 | Kashyyyk |
| F15 | Scarif |
| F16 | Sorgan |
| F17 | No-vegetation worlds (Tatooine scatter and rock, Hoth, Mandalore, Mustafar, Geonosis, Coruscant, Kamino, Bespin, Nevarro without its river) |
| F18 | Nevarro lava river (`channels` layer; heights change) |
| F19 | Optional polish (erode, second bake area, hero blades, dithered cross-fade, optional film touches) |

---

## Appendix A: the review's corrections and where they land

| # | Correction | Where |
|---|---|---|
| 1 | No static d98 clip; static extent `min(within[1], REACH + d98)`; camera-relative cull | §2.8, §2.11, F3 |
| 2 | Understory as player-following patches | §2.10, F5 |
| 3 | Channel-aware depth material; atlas and cover as `DataTexture`s | §2.5, §2.7, F2, F4 |
| 4 | Draw ledger; parts merged into hosts; one far mesh per world; 2nd variant only for heroes | §2.12, §2.3, §2.11, F0 |
| 5 | One-triangle blades; `noBake`; R32F nearest + texelFetch; 257²/161² | §2.9, F5 |
| 6 | Card size as share of R; opaque core first in the index; L ≈ 1.2; overdraw caps | §2.5, F7 |
| 7 | Card fade on horizontal distance; keepers ×√2 | §2.5, F7 |
| 8 | Wind in world space; declared globals; trunk = card test | §2.4, F2, F7 |
| 9 | Canopy shell for Yavin | §2.11, F9, F13 |
| 10 | Endor understory per hectare in `FLORA.endor.under` | §2.10, F10 |
| 11 | Canopy-shade texture beyond the bake | §2.7, F4 |
| 12 | Bounded cover read | §2.7, F4 |
| 13 | Edge clamp; d95 ≤ today's in F1; lengthen after F9; actors' d97 | §2.2, F1 |
| 14 | skyFog at material creation; `skyFogScene` before warm; programs test | §2.2, F1 |
| 15 | Foliage lod1 path; none for retired GLBs | §2.11, F3 |
| 16 | Guardrail caps per species and world | §1.4, §1.5, F2 |
| 17 | Far ramp = near × 0.85–0.9; targets pre-divided by grade and FINAL; FINAL not identity | §1.5, §2.11 |
| 18 | `FLORA` with `site.*` fallback; Tatooine fog conversion only; site edits per world | decision 7, §2.2, plan |
| 19 | Corridors; trunk-only solids; route tests | §2.8, F4, world checkpoints |
| 20 | Placed heroes and composites rebuilt | §3, F10, F12–F14 |
| 21 | Wroshyr pads in G (conifer); aerial roots; mangroves | §3 Kashyyyk, F14 |
| 22 | Worst spot views and max-load test | §4, F0, F4 |
| 23 | Per-world GLB material clones | §2.3, F2 |
| 24 | Sorgan pond field, one plane, berms | §3 Sorgan, F16 |
| 25 | Lava from cover G / channels; Nevarro channels its own checkpoint | §2.7, F17, F18 |
| 26 | Triplanar with `textureGrad` or unconditional fetches | §2.7, F4 |
| 27 | Nebkha 1–3 per 1,000 m², ≤ 40 | §3, F17 |
| 28 | No outdoor gold-leaved trees on Coruscant | §3, F17 |
| 29 | Gnarltree 14–18 m, trunk 0.6–1.0 m | §2.6, §3 Dagobah |
| 30 | Derived marks; motes `#fff8e0` | §1.4, §3 |
| 31 | `flora.sort` before `groundWorld` | §2.11, F3 |
| 32 | Depth material covers the shadow-pass GPUs; `castShadow = false` on patches | §2.5, §2.10 |
| 33 | `understory` root under `#ifdef USE_INSTANCING` | §2.3, F2 |
| 34 | `heightBlend` in the common block; strata from `gTex` | §2.7, F4 |
| 35 | `lookBand` measured; `uLookHue` 0.35; cluster/edge/height-fog definitions; CIEDE2000; reference phone | §2.3, §2.8, §3, §4, §5 |
| 36 | Motion and pop tests that can fail | §5, F2, F7 |
| 37 | Sort cadence, stagger, update ranges | §2.11, F3 |
| 38 | Lothal tuft cards on small | §2.9, F6 |
| 39 | Optional film touches listed | §6, F19 |
| 40 | `teanila` dropped; cavity in cells; GLB mips offline; Lothal right after F5; `lightshafts` left alone | §2.0, §2.7, §2.3, F6, §2.2 |
