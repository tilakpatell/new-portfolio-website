// The nature kit as it runs (catalog/nature.js: Quaternius's CC0 megakit,
// cut down by scripts/quaternius-nature.mjs).
//
// natureLook(gltf), once a file, as it loads (placer.js's loadModel):
//   - its materials shared by name across the page: every fern, plant and
//     flower is drawn from the one `Leaves` and the one `Flowers`, each
//     tree's species from its one bark and one leaf material, so a world
//     with ten plant kinds sends those pictures once (the copies, and their
//     pictures, freed). They're left as they came: the page keeps them for
//     every world, and each world dresses its own copies;
//   - its geometry stood in metres from its foot: meshopt keeps positions in
//     [-1, 1] with the node scaled and moved to the model's box, and the wind
//     and the push both read a vertex's height, so the node's transform is
//     baked into float positions and the node left at nothing.
//
// natureMaterials() → mine(material, sway), one a world (the placer's):
// that world's own copy of a shared material, made once for each sway and
// dressed (the copy shares the pictures; its world's look and fog are put
// on it, not on the page's):
//   - lit as leaves (lib/three/foliage: light that wraps past the edge and
//     comes through from behind, both faces lit as one), cut out by alpha to
//     coverage;
//   - in the page's wind (NATURE: one clock, one way it blows), every part of
//     a model by the model's own `sway`, so a tree's leaves move with its
//     branches and a bush's flowers with its leaves;
//   - pushed aside, what sways as a shrub or as grass: it leans away from you
//     as you walk through it, and springs back (pushShader);
//   - tintable (a scatter's colour pair, placer.js): the leaves, plants,
//     grass and stone, never the bark or the petals.
// mine.dispose() frees the copies, never the pictures.
//
// natureTick(kit, you) each frame (the placer's update): the page's wind
// takes the world's clock and way, and the push where you stand. The clock
// is the kit's, so under reduced motion (no kit.tick) it all stands still,
// the push too.
//
//   pushShader(shaders) (pure)   isTintable(material)

import * as THREE from 'three';
import { faceless, wind, wrapLighting } from '../../../lib/three/foliage';

// the page's own: one clock, the way the wind blows, where you are (far off
// till you're somewhere), and how near you push
const NOWHERE = 1e6;
export const NATURE = {
  time: { value: 0 },
  dir: { value: new THREE.Vector2(0.8, 0.6).normalize() },
  push: { value: new THREE.Vector3(NOWHERE, 0, NOWHERE) },
  pushR: { value: 1.6 },
};

// a material's family, by the pack's names (scripts/quaternius-nature.mjs has the same rule)
const familyOf = (name) =>
  name === 'Grass' ? 'grass' : name === 'Leaves' ? 'plant' : name === 'Flowers' ? 'flowers' : name.startsWith('Leaves_') || name.startsWith('Leaf_') ? 'leaves' : name.startsWith('Bark_') ? 'bark' : 'stone';
const LEAFY = new Set(['leaves', 'plant', 'flowers', 'grass']);
const TINTED = new Set(['leaves', 'plant', 'grass', 'stone']);
const MOVES = { tree: 'tree', shrub: 'shrub', grass: 'grass' };

const shared = new Map(); // `${name}|${vertexColors}` → the first material of that name

export const isTintable = (m) => Boolean(m?.userData?.tintable);

// The rewrite, as pure strings: after three's begin_vertex, each vertex moved
// away from you by where its plant stands (so the whole plant leans as one,
// never torn), more the higher it is (its height squared, a metre and a bit
// at most), nothing past uPushR; and a little down, as a stem bent over is.
// In the instance's own frame: the push turned and scaled back into it.
export function pushShader({ vertexShader, fragmentShader }) {
  if (!vertexShader.includes('#include <begin_vertex>')) return { vertexShader, fragmentShader, swapped: { push: false } };
  const vs = vertexShader.replace('#include <common>', '#include <common>\nuniform vec3 uPush;\nuniform float uPushR;').replace(
    '#include <begin_vertex>',
    `#include <begin_vertex>
    {
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
      vec3 pDir = transpose(pTurn) * vec3(pAway.x, 0.0, pAway.y) / max(pD * pS * pS, 1e-3);
      float pBend = pK * pH * pH;
      transformed.xz += pDir.xz * (0.55 * pBend);
      transformed.y -= 0.25 * pBend / pS;
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
  material.needsUpdate = true;
}

// a world's copy, dressed for the model's sway
function dress(m, sway) {
  const family = familyOf(m.name);
  if (LEAFY.has(family)) {
    m.alphaToCoverage = m.alphaTest > 0;
    wrapLighting(m, { wrap: 0.45, backScatter: 0.35 });
    if (m.side === THREE.DoubleSide) faceless(m);
  }
  const moves = family === 'stone' ? null : MOVES[sway];
  if (moves) {
    wind(m, { kind: moves, time: NATURE.time, ...(family === 'bark' ? { leaf: 0 } : {}) });
    m.userData.wind.uWindDir = NATURE.dir;
  }
  if ((moves === 'shrub' || moves === 'grass') && family !== 'bark') pushed(m);
  m.userData.tintable = TINTED.has(family);
}

// every mesh's geometry in float metres under the file's root, its own and
// its parents' transforms baked in, and those left at nothing
function stoodUp(root) {
  root.updateMatrixWorld(true);
  const toRoot = root.matrixWorld.clone().invert();
  const meshes = [];
  root.traverse((o) => o.isMesh && meshes.push(o));
  const done = new Set();
  for (const o of meshes) {
    if (done.has(o.geometry)) o.geometry = o.geometry.clone();
    const g = o.geometry;
    for (const name of ['position', 'normal']) {
      const a = g.attributes[name];
      if (!a || (a.array instanceof Float32Array && !a.normalized)) continue;
      const f = new Float32Array(a.count * 3);
      for (let i = 0; i < a.count; i++) f.set([a.getX(i), a.getY(i), a.getZ(i)], i * 3);
      g.setAttribute(name, new THREE.BufferAttribute(f, 3));
    }
    g.applyMatrix4(toRoot.clone().multiply(o.matrixWorld));
    done.add(g);
  }
  root.traverse((o) => {
    if (o === root) return;
    o.position.set(0, 0, 0);
    o.quaternion.identity();
    o.scale.set(1, 1, 1);
  });
  root.updateMatrixWorld(true);
}

export function natureLook(gltf) {
  const root = gltf?.scene;
  if (!root || root.userData.nature) return gltf;
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = [o.material].flat().map((m) => {
      const key = `${m.name}|${m.vertexColors}`;
      const had = shared.get(key);
      if (had && had !== m) {
        for (const [k, v] of Object.entries(m)) if (v?.isTexture && had[k] !== v) v.dispose();
        m.dispose();
        return had;
      }
      if (!had) shared.set(key, m);
      return m;
    });
    o.material = mats.length === 1 ? mats[0] : mats;
  });
  stoodUp(root);
  root.userData.nature = true;
  return gltf;
}

export function natureMaterials() {
  const made = new Map(); // the page's material → sway → this world's copy
  const mine = (m, sway) => {
    let bySway = made.get(m);
    if (!bySway) made.set(m, (bySway = new Map()));
    const key = sway ?? '';
    let copy = bySway.get(key);
    if (!copy) {
      copy = m.clone();
      // (none of the marks another world's look or fog left on the page's)
      copy.userData = {};
      dress(copy, sway);
      bySway.set(key, copy);
    }
    return copy;
  };
  mine.all = (material, sway) => (Array.isArray(material) ? material.map((m) => mine(m, sway)) : mine(material, sway));
  mine.dispose = () => {
    for (const bySway of made.values()) for (const copy of bySway.values()) copy.dispose();
    made.clear();
  };
  return mine;
}

let lastClock = null;
export function natureTick(kit, you) {
  const clock = kit?.wind?.value ?? null;
  const moving = clock === null || clock !== lastClock;
  lastClock = clock;
  if (clock !== null) NATURE.time.value = clock;
  if (kit?.windAngle != null) NATURE.dir.value.set(Math.cos(kit.windAngle), Math.sin(kit.windAngle));
  if (!moving) NATURE.push.value.set(NOWHERE, 0, NOWHERE);
  else if (you) NATURE.push.value.set(you.x, 0, you.z);
}
