# The nature kit on the Star Wars worlds: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quaternius's Stylized Nature MegaKit (CC0), cut down for the web, growing on seven Star Wars surfaces: meadows, ferns, mushrooms, trails and trees that move in the wind and part as you walk through them.

**Architecture:** the catalogue group `catalog/nature.js` is the one table: the import script reads it to write optimized GLBs, the placer reads it to draw them. A small run-time module (`surface/nature.js`) shares the kit's materials page-wide and adds the wind and the push. Scatter entries learn four options (`tint`, `around`, `clumps`, `path`) through a pure `surface/layout.js`.

**Tech Stack:** three 0.186.1, @gltf-transform 4.5.1, meshoptimizer 1.3.0, sharp 0.35.5, vitest 5.

**Spec:** `docs/superpowers/specs/2026-10-08-nature-kit-star-wars-design.md`

## Global Constraints

- Kind names `nk` + lowercase letters and digits (`/^nk[a-z0-9]+$/`); never a kind `PROPS` or `SCATTER` builds.
- Every nature GLB under 600 KB; its `.lod1.glb` under 0.7× its size (catalog test).
- Textures WebP, at most 512² (grass 256²).
- At most 14 distinct texture images on any one world from the kit, 22 across it (shared by material name at run time).
- Added per world at high: at most 500k triangles drawn, at most 30 draw calls.
- Don't touch Kashyyyk's block in `sites/forest.js`, nor Mustafar/Nevarro in `sites/edge.js`/`sites/nevarro.js`.
- New scatter entries go at the end of each world's `scatter` list (earlier entries' positions must not move).
- Comments and docs in the repo's plain style (full sentences, parentheses for asides, no jargon).

## Review Focus

- A material shared by name between a primitive with vertex colours and one without: the second would read a missing attribute as black. The import gives every primitive `COLOR_0`; `natureLook` keys by name and `vertexColors`. Test in Task 3.
- Reduced motion: the wind and the push must stand still when `kit.tick` isn't called. Test in Task 3 (`natureTick` copies the kit's clock, never advances its own).
- The near/far split reorders instances: tints must follow their matrices. Test in Task 4 (`copyInstances` with colours).
- A trail across water or a cliff: its stones must be left out there, not floating. Test in Task 4 (`trailItems` then the scene's `ok` filter) and seen in Task 6.
- Leaving a world and entering another: the shared materials keep working (their textures aren't freed by the first world's dispose). Seen in Task 6 (Naboo → Endor in one page).

---

### Task 1: The catalogue table and the import

**Files:**
- Create: `src/components/galaxy/surface/catalog/nature.js`
- Create: `scripts/quaternius-nature.mjs`
- Create: `scripts/quaternius-nature.test.mjs`
- Output: `public/models/galaxy/surface/nk*.glb` (+ `.lod1.glb` for trees)

**Interfaces:**
- Produces: `MODELS` (kind → `{ cc0: 'quaternius', from, as, metres, sway?, lod?, shadow?, tris?, tex }`), `NATURE_COLOURS` (material name → sRGB hex), `greyOf(family, v)`, `familyOf(materialName)`.

- [ ] **Step 1: Write `catalog/nature.js`** with the picks:

| kind | from | sway | lod | shadow |
| --- | --- | --- | --- | --- |
| nkbirch1, nkbirch3, nkbirch5 | Birch_1/3/5 | tree | yes | |
| nkcherry1, nkcherry4 | CherryBlossom_1/4 | tree | yes | |
| nkcommon1, nkcommon3 | CommonTree_1/3 | tree | yes | |
| nkpine2, nkpine5 | Pine_2/5 | tree | yes | |
| nktwisted1, nktwisted3 | TwistedTree_1/3 | tree | yes | |
| nkdead1, nkdead3 | DeadTree_1/3 | tree | yes | |
| nkbush, nkbushflowers, nkbushlarge, nkbushlong | Bush_Common, Bush_Common_Flowers, Bush_Large, Bush_Long_1 | shrub | | |
| nkfern1, nkplant1big, nkplant2, nkplant3, nkplant7, nkclover1 | Fern_1, Plant_1_Big, Plant_2, Plant_3, Plant_7, Clover_1 | shrub | | false |
| nkflowers2, nkflowers3, nkflower3, nkflower6, nkflower7 | Flower_2_Group, Flower_3_Group, Flower_3_Single, Flower_6, Flower_7_Single | shrub | | false |
| nkgrass, nkgrasswide, nkgrasswispy, nkwheat | Grass_Common_Tall, Grass_Wide_Short, Grass_Wispy_Tall, Grass_Wheat | grass | | false |
| nkredcap, nkmushroom, nkoyster | Mushroom_RedCap, Mushroom_Common, Mushroom_Oyster | | | false |
| nkrock1, nkrock3, nkrockbig | Rock_Medium_1, Rock_Medium_3, Rock_Big_1 | | | |
| nkpath1, nkpath2 | RockPath_Square_Small_2, RockPath_Round_Small_3 | | | false |
| nkpebble, nkpebblesq | Pebble_Round_1, Pebble_Square_3 | | | false |

`metres` is each model's height from the inventory (`scratchpad/inventory/mega.json`); `tris` the cut where one is wanted (flower groups 600, paths 300, others none); `tex` 512 (grass 256).

```js
// Quaternius's Stylized Nature MegaKit (CC0 1.0: quaternius.com), on the
// galaxy's green worlds: what scripts/quaternius-nature.mjs cuts down from
// the pack's glTF (`node scripts/quaternius-nature.mjs`), each written to
// public/models/galaxy/surface/<kind>.glb standing on y = 0, in metres.
// `from` is the pack's file, `sway` how it moves in the wind (surface/
// nature.js: tree, shrub, grass, or still), `shadow: false` for what's too
// low to throw one worth drawing. Their colours are set here too, by
// material (the pack paints its leaves in its own shader; here they're
// white cut-outs given a colour), and the placer draws each scatter's
// colour pair over them (a scatter's `tint`).
export const NATURE_COLOURS = { Leaves_Birch: '#94b04e', Leaves_NormalTree: '#5f8f3a', Leaves_Pine: '#3f6b3a', Leaves_GiantPine: '#3a5f38', Leaves_TwistedTree: '#6f8e3c', Leaves_CherryBlossom: '#f2b8cc', Grass: '#86a24c' };
const q = (from, as, metres, more = {}) => ({ cc0: 'quaternius', from, as, metres, tex: 512, ...more });
export const MODELS = {
  nkbirch1: q('Birch_1', 'birches', 13.7, { sway: 'tree', lod: true }),
  // … one line per row of the table above
};
```

- [ ] **Step 2: Write the failing test** `scripts/quaternius-nature.test.mjs`:

```js
import { describe, expect, it } from 'vitest';
import { MODELS, NATURE_COLOURS } from '../src/components/galaxy/surface/catalog/nature.js';
import { familyOf, greyOf } from './quaternius-nature.mjs';

describe('the nature kit import', () => {
  it('names each kind nk-something, from a file of the pack', () => {
    for (const [kind, m] of Object.entries(MODELS)) {
      expect(kind).toMatch(/^nk[a-z0-9]+$/);
      expect(m.cc0).toBe('quaternius');
      expect(m.from).toMatch(/^[A-Za-z0-9_]+$/);
    }
  });
  it('sorts the materials into families', () => {
    expect(familyOf('Grass')).toBe('grass');
    expect(familyOf('Leaves')).toBe('plant');
    expect(familyOf('Leaves_Birch')).toBe('leaves');
    expect(familyOf('Bark_Pine')).toBe('bark');
    expect(familyOf('Rocks')).toBe('stone');
  });
  it('turns the masks into light: dark at the root, full at the tip, leaves untouched', () => {
    expect(greyOf('grass', 0)).toBeCloseTo(0.42);
    expect(greyOf('grass', 1)).toBe(1);
    expect(greyOf('bark', 0.08)).toBeGreaterThan(0.6);
    expect(greyOf('leaves', 0.3)).toBe(1);
    expect(greyOf('stone', 0)).toBe(1);
  });
  it('colours only materials the pack has', () => {
    for (const name of Object.keys(NATURE_COLOURS)) expect(['leaves', 'grass']).toContain(familyOf(name));
  });
});
```

- [ ] **Step 3: Run it to see it fail** — `npx vitest run scripts/quaternius-nature.test.mjs` → FAIL (module missing).

- [ ] **Step 4: Write `scripts/quaternius-nature.mjs`:**

```js
// … header comment: what it does, the --from lookup, how to run it
import { existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { MODELS, NATURE_COLOURS } from '../src/components/galaxy/surface/catalog/nature.js';
import { bounds, simplified, triangles } from './lib/surface-model.mjs';
import { makeLod } from './galaxy-surface-lod.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'models', 'galaxy', 'surface');
const PACK = 'quaternius/stylized-nature-megakit/glTF';
const FROM = [join(tmpdir(), 'tilakverse-assets', PACK), join(ROOT, 'lab', 'assets', 'naturemega', 'glTF')];

export const familyOf = (name) => (name === 'Grass' ? 'grass' : name === 'Leaves' ? 'plant' : name.startsWith('Leaves_') ? 'leaves' : name.startsWith('Bark_') ? 'bark' : name === 'Flowers' ? 'flowers' : 'stone');
// the pack's masks (0 at a blade's root to 1 at its tip; bark 0.08 at the foot)
// as a grey to multiply the colour by: darker low down, as light under a plant is
const FLOOR = { grass: 0.42, plant: 0.5, bark: 0.62, flowers: 0.7 };
export const greyOf = (family, v) => (FLOOR[family] == null ? 1 : FLOOR[family] + (1 - FLOOR[family]) * Math.min(1, Math.max(0, v)));

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linear = (hex) => [1, 3, 5].map((i) => srgbToLinear(parseInt(hex.slice(i, i + 2), 16) / 255));

// every primitive given a grey COLOR_0 (VEC3), from its mask where it has one
const greys = () => (doc) => {
  for (const mesh of doc.getRoot().listMeshes())
    for (const p of mesh.listPrimitives()) {
      const family = familyOf(p.getMaterial()?.getName() ?? '');
      const n = p.getAttribute('POSITION').getCount();
      const mask = p.getAttribute('COLOR_0');
      const out = new Float32Array(n * 3);
      const el = [];
      for (let i = 0; i < n; i++) {
        const v = mask ? mask.getElement(i, el)[0] : 1;
        out.fill(greyOf(family, v), i * 3, i * 3 + 3);
      }
      mask?.dispose();
      p.setAttribute('COLOR_0', doc.createAccessor().setType('VEC3').setArray(out).setBuffer(doc.getRoot().listBuffers()[0]));
    }
};
// leaves white cut-outs given their colour; cut-outs MASK at 0.35, never
// BLEND; what's solid single-sided and OPAQUE
const looks = (dir) => async (doc) => {
  for (const m of doc.getRoot().listMaterials()) {
    const name = m.getName();
    const family = familyOf(name);
    if (family === 'leaves') {
      const tex = m.getBaseColorTexture();
      const white = tex?.getURI()?.replace(/_C\.png$/, '.png');
      if (tex && white && existsSync(join(dir, white))) tex.setImage(await sharp(join(dir, white)).png().toBuffer()).setMimeType('image/png');
    }
    if (NATURE_COLOURS[name]) m.setBaseColorFactor([...linear(NATURE_COLOURS[name]), 1]);
    const cut = family === 'leaves' || family === 'plant' || family === 'flowers';
    m.setAlphaMode(cut ? 'MASK' : 'OPAQUE').setAlphaCutoff(0.35).setDoubleSided(cut || family === 'grass');
    m.setRoughnessFactor(1).setMetallicFactor(0);
  }
};

// stood on y = 0, its x and z left where the pack has them (the foot of
// the trunk: the placer's solid circle is round the origin)
const standing = () => (doc) => {
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const { min } = bounds(doc, scene);
  for (const n of scene.listChildren()) n.setTranslation([n.getTranslation()[0], n.getTranslation()[1] - min[1], n.getTranslation()[2]]);
};

const io = async () => {
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
};

export async function importOne(kind, m, dir, node) {
  const doc = await node.read(join(dir, `${m.from}.gltf`));
  doc.setLogger(new Logger(Logger.Verbosity.ERROR));
  const before = triangles(doc);
  await doc.transform(standing(), greys(), looks(dir), weld(), ...(m.tris ? [simplified(m.tris)] : []), dedup(), prune());
  await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [m.tex, m.tex], quality: 82 }));
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const to = join(OUT, `${kind}.glb`);
  await node.write(to, doc);
  const lod = m.lod ? await makeLod(to, join(OUT, `${kind}.lod1.glb`), { over: 1500 }) : null;
  return { kind, before, after: triangles(doc), bytes: statSync(to).size, lod };
}

async function main() {
  const args = process.argv.slice(2);
  const at = args.indexOf('--from');
  const dir = at >= 0 ? args.splice(at, 2)[1] : FROM.find((d) => existsSync(d));
  if (!dir) throw new Error(`no megakit glTF folder: clone tilakpatell/tilakverse-assets into ${tmpdir()}, or node scripts/assets-fetch.mjs naturemega`);
  const node = await io();
  for (const [kind, m] of Object.entries(MODELS)) {
    if (args.length && !args.includes(kind)) continue;
    const r = await importOne(kind, m, dir, node);
    console.log(`${kind.padEnd(14)} ${String(r.before).padStart(6)} → ${String(r.after).padStart(6)} tris  ${(r.bytes / 1024).toFixed(0).padStart(4)} KB${r.lod ? `  lod ${r.lod.low} tris ${(r.lod.bytes / 1024).toFixed(0)} KB` : ''}`);
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(e); process.exitCode = 1; });
```

- [ ] **Step 5: Run the test** — PASS.
- [ ] **Step 6: Run the import** — `node scripts/quaternius-nature.mjs`; every kind under 600 KB, each tree with a LOD. Fix the table (`tex`, `tris`) where one isn't.
- [ ] **Step 7: Look at three of them** — `node scripts/glb-shot.mjs` on `nkbirch1`, `nkflowers2`, `nkgrasswispy` (colours right, no black roots).
- [ ] **Step 8: Commit** the script, test, catalogue and GLBs.

### Task 2: The catalogue knows the third source

**Files:**
- Modify: `src/components/galaxy/surface/catalog/index.js` (import `nature`, add to `GROUPS`)
- Modify: `src/components/galaxy/surface/catalog/catalog.test.js` (the cc0 branch)
- Modify: `public/cc0/README.md` (the kit's line), `public/games/credits.json` (the pack), `docs/assets/quaternius.md`

- [ ] **Step 1: Failing test** — in `catalog.test.js`'s "credits each Sketchfab model" loop, before the `m.made` branch:

```js
      if (m.cc0) {
        // (CC0, brought in by scripts/quaternius-nature.mjs: listed in public/cc0/README.md)
        expect(m.cc0, kind).toBe('quaternius');
        expect(m.uid, kind).toBeUndefined();
        expect(made.has(kind), `${kind} in public/cc0/README.md`).toBe(true);
        // (its colours are its materials', shared: never tinted, looked or detailed per kind)
        expect(m.tint ?? m.look ?? m.detail, kind).toBeUndefined();
        continue;
      }
```

and a new test: `it('credits the nature kit once, as CC0', …)` reading `public/games/credits.json` for an entry whose `source` is `https://quaternius.com/packs/stylizednaturemegakit.html` and licence `CC0 1.0`.

- [ ] **Step 2: Run** — FAIL (README line, credits entry missing; group not in GROUPS).
- [ ] **Step 3:** add `nature` to `GROUPS` (before `battlefront`), the README line under "Elsewhere, also CC0" — `` - `../models/galaxy/surface/{nkbirch1,…}.glb` (and their `.lod1.glb` light copies): Quaternius's [Stylized Nature MegaKit](https://quaternius.com/packs/stylizednaturemegakit.html), cut down by `scripts/quaternius-nature.mjs`. Listed in `src/components/galaxy/surface/catalog/nature.js`. `` — and the credits entry `{ "source": "https://quaternius.com/packs/stylizednaturemegakit.html", "id": "quaternius-nature-megakit", "name": "Stylized Nature MegaKit", "authors": ["Quaternius"], "license": "CC0 1.0" }`.
- [ ] **Step 4: Run** `npx vitest run src/components/galaxy/surface/catalog scripts/quaternius-nature.test.mjs` — PASS.
- [ ] **Step 5: Commit.**

### Task 3: The kit's look at run time

**Files:**
- Create: `src/components/galaxy/surface/nature.js`, `src/components/galaxy/surface/nature.test.js`
- Modify: `src/lib/three/foliage.js` (`WIND.grass`)
- Modify: `src/components/galaxy/surface/placer.js` (loadModel: `natureLook`; scatter: part `shadow`; update: `natureTick`)
- Modify: `src/components/galaxy/surface/kit.js` (return `windAngle`)

**Interfaces:**
- Produces: `NATURE` (`{ time, dir, push, pushR }` uniform objects), `natureLook(gltf, entry)` → gltf, `natureTick(kit, you)`, `pushShader({ vertexShader, fragmentShader })` → `{ vertexShader, fragmentShader, swapped: { push } }`, `isTintable(material)`.

- [ ] **Step 1: Failing tests** `nature.test.js`:

```js
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { NATURE, isTintable, natureLook, natureTick, pushShader } from './nature';

const mesh = (name, { vc = true } = {}) => new THREE.Mesh(new THREE.BufferGeometry(), Object.assign(new THREE.MeshStandardMaterial({ name, vertexColors: vc, map: new THREE.Texture() })));
const file = (...meshes) => ({ scene: Object.assign(new THREE.Group(), {}).add(...meshes) });

describe('the nature kit at run time', () => {
  it('pushes a vertex away from you, and leaves a shader without begin_vertex alone', () => {
    const out = pushShader({ vertexShader: '#include <common>\nvoid main(){\n#include <begin_vertex>\n}', fragmentShader: '' });
    expect(out.swapped.push).toBe(true);
    expect(out.vertexShader).toContain('uniform vec3 uPush;');
    expect(out.vertexShader.indexOf('uPushR')).toBeGreaterThan(out.vertexShader.indexOf('#include <begin_vertex>'));
    expect(pushShader({ vertexShader: 'void main(){}', fragmentShader: '' }).swapped.push).toBe(false);
  });
  it('shares each material by its name (and vertex colours) across the files, freeing the copy', () => {
    const a = file(mesh('Leaves'));
    const b = file(mesh('Leaves'), mesh('Flowers'));
    const copy = b.scene.children[0].material;
    natureLook(a, { sway: 'shrub' });
    natureLook(b, { sway: 'shrub' });
    expect(b.scene.children[0].material).toBe(a.scene.children[0].material);
    expect(b.scene.children[0].material).not.toBe(copy);
    expect(b.scene.children[1].material.name).toBe('Flowers');
  });
  it('never shares one with vertex colours with one without', () => {
    const a = file(mesh('Rocks', { vc: true }));
    const b = file(mesh('Rocks', { vc: false }));
    natureLook(a, {});
    natureLook(b, {});
    expect(b.scene.children[0].material).not.toBe(a.scene.children[0].material);
  });
  it('puts the wind on what sways, once, and marks the leaves and grass tintable', () => {
    const g = file(mesh('Leaves_Birch'), mesh('Bark_Birch'));
    natureLook(g, { sway: 'tree' });
    natureLook(g, { sway: 'tree' });
    const [leaves, bark] = g.scene.children.map((o) => o.material);
    expect(leaves.userData.wind).toBeTruthy();
    expect(bark.userData.wind).toBeTruthy();
    expect(isTintable(leaves)).toBe(true);
    expect(isTintable(bark)).toBe(false);
    const still = file(mesh('Mushrooms'));
    natureLook(still, {});
    expect(still.scene.children[0].material.userData.wind).toBeUndefined();
  });
  it('takes the kit’s clock (still when reduced motion stops it) and where you are', () => {
    natureTick({ wind: { value: 3.5 } }, { x: 2, z: -4 });
    expect(NATURE.time.value).toBe(3.5);
    expect(NATURE.push.value.x).toBe(2);
    expect(NATURE.push.value.z).toBe(-4);
    natureTick({ wind: { value: 3.5 } }, null);
    expect(NATURE.time.value).toBe(3.5);
  });
});
```

(Material names in the tests that `natureLook` doesn't know, such as `Mushrooms`, fall to the `stone` family: no wind, not tintable.)

- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Write `nature.js`:**

```js
// The nature kit (catalog/nature.js: Quaternius's CC0 megakit) as it runs:
// … header: shared by name, lit as leaves, one wind, pushed aside
import * as THREE from 'three';
import { faceless, wind, wrapLighting } from '../../../lib/three/foliage';

// the page's: one clock, one way the wind blows, where you are
export const NATURE = { time: { value: 0 }, dir: { value: new THREE.Vector2(0.8, 0.6) }, push: { value: new THREE.Vector3(1e6, 0, 1e6) }, pushR: { value: 1.6 } };
const family = (name) => (name === 'Grass' ? 'grass' : name === 'Leaves' ? 'plant' : name === 'Flowers' ? 'flowers' : name.startsWith('Leaves_') ? 'leaves' : name.startsWith('Bark_') ? 'bark' : 'stone');
const SWAY = { grass: 'grass', plant: 'shrub', flowers: 'shrub', leaves: null, bark: null };
const shared = new Map(); // `${name}|${vertexColors}` → the first such material
export const isTintable = (m) => Boolean(m?.userData?.tintable);

export function pushShader({ vertexShader, fragmentShader }) {
  if (!vertexShader.includes('#include <begin_vertex>')) return { vertexShader, fragmentShader, swapped: { push: false } };
  const vs = vertexShader.replace('#include <common>', '#include <common>\nuniform vec3 uPush;\nuniform float uPushR;').replace(
    '#include <begin_vertex>',
    `#include <begin_vertex>
    {
      // (pushed away from you, by where it stands: the whole plant leans)
      vec3 pRoot = vec3(0.0);
      mat3 pTurn = mat3(1.0);
      #ifdef USE_INSTANCING
        pRoot = instanceMatrix[3].xyz;
        pTurn = mat3(instanceMatrix);
      #endif
      pRoot = (modelMatrix * vec4(pRoot, 1.0)).xyz;
      vec2 pAway = pRoot.xz - uPush.xz;
      float pD = length(pAway);
      float pK = 1.0 - smoothstep(uPushR * 0.3, uPushR, pD);
      float pS = max(length(pTurn[0]), 1e-3);
      float pH = clamp(transformed.y * pS, 0.0, 1.2);
      vec3 pDir = transpose(pTurn) * vec3(pAway.x, 0.0, pAway.y) / max(pD * pS, 1e-3);
      transformed.xz += pDir.xz / pS * (0.55 * pK * pH * pH);
      transformed.y -= 0.25 * pK * pH * pH / pS;
    }`,
  );
  return { vertexShader: vs, fragmentShader, swapped: { push: true } };
}
function pushed(material) {
  if (material.userData.push) return;
  const before = material.onBeforeCompile;
  material.onBeforeCompile = (sh, r) => {
    before?.call(material, sh, r);
    Object.assign(sh.uniforms, { uPush: NATURE.push, uPushR: NATURE.pushR });
    sh.vertexShader = pushShader(sh).vertexShader;
  };
  const key = material.customProgramCacheKey;
  material.customProgramCacheKey = () => `${key ? key.call(material) : ''}|push`;
  material.userData.push = true;
}
// a material the first time its name is seen: lit, swaying, pushed
function dress(m, sway) {
  const f = family(m.name);
  const kind = f === 'leaves' || f === 'bark' ? (sway ? 'tree' : null) : SWAY[f];
  if (f === 'leaves' || f === 'plant' || f === 'flowers' || f === 'grass') {
    m.alphaToCoverage = m.alphaTest > 0;
    wrapLighting(m, { wrap: 0.45, backScatter: 0.35 });
    if (m.side === THREE.DoubleSide) faceless(m);
  }
  if (kind) wind(m, { kind, time: NATURE.time, dir: NATURE.dir.value, ...(f === 'bark' ? { leaf: 0 } : {}) });
  if (kind === 'shrub' || kind === 'grass') pushed(m);
  m.userData.tintable = f === 'leaves' || f === 'plant' || f === 'grass';
}
export function natureLook(gltf, entry = {}) {
  if (!gltf?.scene || gltf.scene.userData.nature) return gltf;
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    o.material = [o.material].flat().map((m) => {
      const key = `${m.name}|${m.vertexColors}`;
      const had = shared.get(key);
      if (had && had !== m) {
        for (const v of Object.values(m)) if (v?.isTexture) v.dispose();
        m.dispose();
        return had;
      }
      shared.set(key, m);
      dress(m, entry.sway);
      return m;
    });
    if (o.material.length === 1) o.material = o.material[0];
  });
  gltf.scene.userData.nature = true;
  return gltf;
}
export function natureTick(kit, you) {
  if (kit?.wind) NATURE.time.value = kit.wind.value;
  if (kit?.windAngle != null) NATURE.dir.value.set(Math.cos(kit.windAngle), Math.sin(kit.windAngle));
  if (you) NATURE.push.value.set(you.x, 0, you.z);
}
```

(`wind()` clones `dir` into a uniform of its own; right after the `wind(m, …)` call, `m.userData.wind.uWindDir = NATURE.dir` swaps in the page's, before the first compile reads it, so `natureTick` turns every material's wind at once. A tree-leaf material is shared by the bushes that use it (`Leaves_TwistedTree` is `Bush_Common`'s too), so a `leaves` or `bark` material always takes the `tree` row whatever loads first: leaves and their branches move together; only `plant`, `flowers` and `grass` are pushed.)

- [ ] **Step 4:** `foliage.js` `WIND.grass = { height: 1.1, strength: 0.07, trunkHz: 0.9, leafHz: 3.8, leaf: 0.018 }`; `kit.js` return `windAngle: blow?.angle ?? null`; `placer.js`: in `loadModel`'s `.then`, `if (gltf && SURFACE_MODELS[kind]?.cc0) natureLook(gltf, SURFACE_MODELS[kind]);` first; in `scatter`'s GLB parts, `shadow: SURFACE_MODELS[kind].shadow` (undefined stays casting); in `update`, `natureTick(kit, you)`.
- [ ] **Step 5: Run** `npx vitest run src/components/galaxy/surface/nature.test.js src/components/galaxy/surface/placer.test.js src/components/galaxy/surface/kit.test.js src/lib/three` — PASS.
- [ ] **Step 6: Commit.**

### Task 4: Colour pairs, clumps, places and trails

**Files:**
- Create: `src/components/galaxy/surface/layout.js`, `layout.test.js`
- Modify: `src/components/galaxy/surface/placer.js` (scatter: instance colours on tintable parts; `copyInstances` copies colours; export `copyInstances`)
- Modify: `src/components/galaxy/surface/scene.js` (scatter loop)
- Test: `placer.test.js`

**Interfaces:**
- Produces: `spotMaker(s, rand, reach)` → `() => [x, z]`; `trailItems(path, { spacing, jitter, rand })` → `[{ at, yaw }]`; `tintOf(pair, t)` → `[r, g, b]` linear; `copyInstances(mesh, src, which, colours?)`.

- [ ] **Step 1: Failing tests** `layout.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { rng } from './noise';
import { spotMaker, tintOf, trailItems } from './layout';

describe('where scattered things go', () => {
  it('draws an annulus round the origin exactly as before (two numbers a spot)', () => {
    const a = rng(5);
    const b = rng(5);
    const next = spotMaker({ within: [10, 20] }, a, 590);
    const [x, z] = next();
    const ang = b() * Math.PI * 2;
    const d = Math.sqrt(100 + b() * 300);
    expect(x).toBeCloseTo(Math.cos(ang) * d);
    expect(z).toBeCloseTo(Math.sin(ang) * d);
  });
  it('rings a place with `around`', () => {
    const next = spotMaker({ within: [28, 40], around: [372, 330] }, rng(1), 590);
    for (let i = 0; i < 50; i++) {
      const [x, z] = next();
      const d = Math.hypot(x - 372, z - 330);
      expect(d).toBeGreaterThanOrEqual(28 - 1e-9);
      expect(d).toBeLessThanOrEqual(40 + 1e-9);
    }
  });
  it('gathers `clumps` into patches', () => {
    const next = spotMaker({ within: [20, 500], clumps: [6, 8] }, rng(2), 590);
    const spots = Array.from({ length: 300 }, next);
    // (every spot within its patch's spread of one of at most six centres)
    const centres = [];
    for (const [x, z] of spots) if (!centres.some(([cx, cz]) => Math.hypot(x - cx, z - cz) <= 16)) centres.push([x, z]);
    expect(centres.length).toBeLessThanOrEqual(6);
  });
  it('lays a trail along its path, a stone every spacing, turned along it', () => {
    const items = trailItems([[0, 0], [10, 0], [10, 10]], { spacing: 2, jitter: 0, rand: rng(3) });
    expect(items).toHaveLength(11);
    expect(items[0].at).toEqual([0, 0]);
    expect(items[2].yaw).toBeCloseTo(Math.PI / 2);
    expect(items[8].at[0]).toBeCloseTo(10);
  });
  it('mixes a colour pair, in linear light', () => {
    const [r, g, b] = tintOf(['#000000', '#ffffff'], 1);
    expect([r, g, b]).toEqual([1, 1, 1]);
    expect(tintOf(['#ff0000', '#ff0000'], 0.4)[1]).toBe(0);
  });
});
```

and in `placer.test.js`:

```js
describe('the near and far split', () => {
  it('copies the colours with the matrices, so a tint stays on its plant', () => {
    const mesh = new THREE.InstancedMesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial(), 3);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(9), 3);
    const src = new Float32Array(48).map((_, i) => i);
    const colours = Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    copyInstances(mesh, src, [2, 0], colours);
    expect(mesh.count).toBe(2);
    expect([...mesh.instanceColor.array.slice(0, 6)]).toEqual([0, 0, 1, 1, 0, 0]);
    expect(mesh.instanceMatrix.array[0]).toBe(32);
  });
});
```

- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Write `layout.js`:**

```js
// Where a world's scattered things go (scene.js's scatter, sites/*.js's
// `scatter` entries), pure so it's tested:
//   spotMaker(s, rand, reach)  a spot at a time: an annulus `within` round
//     the origin (or round `around`), or gathered into `clumps: [count, spread]`
//   trailItems(path, { spacing, jitter, rand })  stones along a path
//   tintOf([a, b], t)  a colour between a scatter's pair, linear
import * as THREE from 'three';

const TAU = Math.PI * 2;
export function spotMaker(s, rand, reach) {
  const [r0, r1] = s.within ?? [20, reach];
  const [cx, cz] = s.around ?? [0, 0];
  const ring = () => {
    const a = rand() * TAU;
    const d = Math.sqrt(r0 * r0 + rand() * (r1 * r1 - r0 * r0));
    return [cx + Math.cos(a) * d, cz + Math.sin(a) * d];
  };
  if (!s.clumps) return ring;
  const [count, spread] = s.clumps;
  const centres = Array.from({ length: count }, ring);
  return () => {
    const [x, z] = centres[Math.floor(rand() * count) % count];
    const a = rand() * TAU;
    const d = spread * rand() ** 1.5; // (thick in the middle, thinning out)
    return [x + Math.cos(a) * d, z + Math.sin(a) * d];
  };
}
export function trailItems(path, { spacing = 1.6, jitter = 0.3, rand = Math.random } = {}) {
  const out = [];
  let carry = 0;
  for (let i = 0; i + 1 < path.length; i++) {
    const [ax, az] = path[i];
    const [bx, bz] = path[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const yaw = Math.atan2(bx - ax, bz - az);
    for (let d = carry; d <= len + 1e-9; d += spacing) {
      const t = d / len;
      const side = (rand() - 0.5) * 2 * jitter;
      out.push({ at: [ax + (bx - ax) * t + Math.cos(yaw) * side, az + (bz - az) * t - Math.sin(yaw) * side], yaw: yaw + (rand() - 0.5) * 0.6 * Math.min(1, jitter * 3) });
      carry = d + spacing - len;
    }
  }
  return out;
}
const c = new THREE.Color();
const d = new THREE.Color();
export const tintOf = ([a, b], t) => c.set(a).lerp(d.set(b), t).toArray();
```

(three's `Color.set` from a hex string converts sRGB to linear under the default colour management, so `toArray` is linear.)

Check the yaw in the test (`Math.atan2(dx, dz)`: along +x is π/2) and the stone count (0…10 every 2 on the first leg: 6, then 2…10 on the second: 5 = 11).

- [ ] **Step 4: placer.js** — in `scatter`: `const tints = items.some((it) => it.tint) ? Float32Array.from(items.flatMap((it) => it.tint ?? [1, 1, 1])) : null;` after `mats`; in `instanceParts`, for a part whose material `isTintable` and `tints`: `mesh.instanceColor = new THREE.InstancedBufferAttribute(tints.slice(), 3); col = tints;` returning `{ mesh, src, col }`; `fillSplit` passes `f.col`/`l.col` to `copyInstances`; `copyInstances(mesh, src, which, colours = null)` also copies `colours` into `mesh.instanceColor.array` and flags it; export it.

- [ ] **Step 5: scene.js** — the scatter loop:

```js
  const scattered = site.scatter.map((s, i) => {
    const items = [];
    // (a trail's stones along its path; a scatter's colour pair drawn from
    // its own numbers, so a tint never moves what comes after it)
    const own = rng((site.ground.seed ?? 1) * 31 + i);
    const ok = (x, z) => !(s.flat && grid.normalAt(x, z)[1] < s.flat) && !(wade != null && s.dry !== false && grid.heightAt(x, z) < wade + (s.above ?? 0.2));
    if (s.path) {
      for (const it of trailItems(s.path, { spacing: s.spacing, jitter: s.jitter, rand: own }))
        if (ok(...it.at)) items.push({ ...it, scale: (s.scale?.[0] ?? 1) + ((s.scale?.[1] ?? 1) - (s.scale?.[0] ?? 1)) * own(), sink: s.sink ?? 0.03 });
    } else {
      const next = spotMaker(s, r, site.reach);
      let tries = 0;
      while (items.length < Math.round(s.n * amounts.scatter) && tries++ < s.n * 20 * Math.max(1, amounts.scatter)) {
        const [x, z] = next();
        if (avoid.some((v) => Math.hypot(x - v.at[0], z - v.at[1]) < v.r + (s.clear ?? 4))) continue;
        if (!ok(x, z)) continue;
        const [lo, hi] = s.scale ?? [1, 1];
        items.push({ at: [x, z], yaw: r() * Math.PI * 2, scale: lo + (hi - lo) * r() ** 1.6, sink: s.sink ?? 0.1, stretch: s.stretch ? s.stretch[0] + r() * (s.stretch[1] - s.stretch[0]) : 1 });
      }
    }
    if (s.tint) for (const it of items) it.tint = tintOf(s.tint, own());
    return { s, items };
  });
```

(The annulus's draws and the per-item draws are in the same order as before, so the existing entries land where they did.)

- [ ] **Step 6: Run** `npx vitest run src/components/galaxy/surface` — PASS.
- [ ] **Step 7: Commit.**

### Task 5: The worlds

**Files:** `sites/core.js` (Naboo, end of its `scatter`), `sites/forest.js` (Endor and Dagobah only), `sites/yavin.js`, `sites/outer.js` (Sorgan and Lothal only), `sites/edge.js` (Scarif only).

- [ ] **Step 1: Naboo** (meadows, Varykino, a trail to the farm):

```js
      // Quaternius's nature kit (catalog/nature.js): the meadows of the
      // lake country, flowers in patches as in the picnic in Attack of the
      // Clones, flowering bushes, clover, round stones in the grass, cherry
      // trees round Varykino's lawn, and a path of stepping stones from the
      // landing toward the farm
      { kind: 'nkflowers2', n: 140, within: [36, 420], clumps: [22, 9], scale: [0.7, 1.2], solid: false, clear: -6, tint: ['#ffffff', '#cfe0a8'] },
      { kind: 'nkflowers3', n: 120, within: [36, 420], clumps: [18, 8], scale: [0.7, 1.2], solid: false, clear: -6 },
      { kind: 'nkflower7', n: 160, within: [30, 360], clumps: [26, 6], scale: [0.6, 1.1], solid: false, clear: -6 },
      { kind: 'nkbushflowers', n: 70, within: [40, 520], scale: [0.7, 1.3], solid: false, tint: ['#e8f0d0', '#b8cc90'] },
      { kind: 'nkclover1', n: 160, within: [30, 400], clumps: [30, 5], scale: [0.6, 1.1], solid: false, clear: -6, tint: ['#ffffff', '#d0dcb0'] },
      { kind: 'nkrock1', n: 40, within: [40, 520], scale: [0.4, 0.9] },
      { kind: 'nkcherry1', n: 5, within: [30, 46], around: [372, 330], scale: [0.6, 0.8], clear: -40 },
      { kind: 'nkcherry4', n: 4, within: [30, 46], around: [372, 330], scale: [0.6, 0.8], clear: -40 },
      { kind: 'nkpath1', path: [[24, 10], [-6, 14], [-16, 18]], spacing: 1.5, jitter: 0.25, scale: [0.9, 1.15], solid: false },
```

(The farm's people stand at [-20, 14] (the `life` list); a trail from the pad's edge to them. The pad's flat is 30 m: the trail starts at 24 m… check in the browser that it meets the pad's edge and the farm; adjust the points.)

- [ ] **Step 2: Endor** (after its last entry): red caps and oyster brackets in clumps on the floor, clover, pebbles, a trail toward the bunker (`[[28, -6], [120, -28], [218, -38]]`).
- [ ] **Step 3: Yavin 4**: `nkplant1big` 200, `nkbushlarge` 110, `nkoyster` 60, `nktwisted1`/`nktwisted3` 20 each on [420, 620] (the jungle's edge, light copies far).
- [ ] **Step 4: Dagobah**: `nkdead1`/`nkdead3` 30 each [40, 520], `nktwisted3` 16, `nkredcap` 150 clumps, `nkmushroom` 100 clumps, `nkplant3` 120.
- [ ] **Step 5: Sorgan**: `nkbirch1/3/5` 30 each [50, 600] (green), `nkgrasswispy` 160 clumps tinted to Sorgan's grass (`#5f6236`–`#7f7c4a` lifted toward white so it multiplies to those), `nkflowers3` 80 clumps, `nkflower7` 120 clumps, `nkredcap` 40, `nkpebble` 150, trail to the village `[[26, 16], [100, 70], [140, 96]]`.
- [ ] **Step 6: Lothal**: `nkwheat` 150 clumps [40, 560], `nkgrasswispy` 150 clumps, `nkrockbig` 30, `nkrock3` 40, `nkflower6` 120 clumps.
- [ ] **Step 7: Scarif**: `nkplant7` 300 [20, 560], `nkbushlong` 150, `nkplant2` 120.
- [ ] **Step 8: Run** `npx vitest run src/components/galaxy/surface/sites` — PASS (every kind placeable).
- [ ] **Step 9: Commit.**

### Task 6: In a browser

**Files:** `scripts/nature-shots.mjs` (scratch, not committed unless kept as a tool).

- [ ] **Step 1:** a node script in the worktree that starts Vite in-process (`createServer({ server: { hmr: false, watch: null } })`), launches the cached Chromium (`playwright-core`, `--use-angle=metal --disable-gpu-vsync --disable-frame-rate-limit`), sets `tp-3d=on`, `tp-intro=1`, `tp-sound=off`, opens `/galaxy/<system>/surface` for naboo, endor, yavin, dagobah, sorgan, lothal, scarif, waits for the veil to go, and saves a shot plus `renderer.info` (calls, triangles, textures) through the surface's debug handle.
- [ ] **Step 2:** the same on `main` for before shots (the base checkout's server, read-only, or a `git stash`-free second worktree checkout of `main`).
- [ ] **Step 3:** compare: added triangles and calls inside the budget; textures count; no black roots, no floating stones, leaves sway (two shots 0.5 s apart differ in the canopy), the push (walk the player through a meadow).
- [ ] **Step 4:** tune counts and points; commit.

### Task 7: Docs and the PR

- [ ] `docs/assets/quaternius.md`: the megakit is in, how to bring in more (`catalog/nature.js` row, `node scripts/quaternius-nature.mjs <kind>`).
- [ ] `node scripts/credits.mjs` (CREDITS.md names the pack).
- [ ] `npx eslint .`, `npx vitest run src/components/galaxy scripts/quaternius-nature.test.mjs`, `npx vite build`.
- [ ] Ask before pushing; open the PR against `main` with the before/after shots.
