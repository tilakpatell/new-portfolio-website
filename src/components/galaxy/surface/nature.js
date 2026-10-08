// The nature kit as it runs (catalog/nature.js: Quaternius's CC0 megakit,
// cut down by scripts/quaternius-nature.mjs). Each file is made over once,
// as it loads (placer.js's loadModel):
//   - its materials shared by name across the page: every fern, plant and
//     flower is drawn with the one `Leaves` and the one `Flowers`, each
//     tree's species with its one bark and one leaf material, so a world
//     with ten plant kinds sends those pictures once and links one shader
//     for them (the copies, and their pictures, freed);
//   - lit as leaves (lib/three/foliage: light that wraps past the edge and
//     comes through from behind, both faces lit as one), cut out by alpha to
//     coverage;
//   - in one wind, the page's (NATURE: one clock, one way it blows), a tree's
//     leaves and its branches together, by the numbers its family moves by;
//   - pushed aside: the low plants, the flowers and the grass lean away from
//     you as you walk through them, and spring back (pushShader).
// natureTick(kit, you) each frame (the placer's update) gives the page's
// wind the world's clock and way, and the push where you stand. The clock
// is the kit's, so under reduced motion (no kit.tick) it all stands still.
//
//   natureLook(gltf, entry) → gltf   isTintable(material)   pushShader(shaders) (pure)

import * as THREE from 'three';
import { faceless, wind, wrapLighting } from '../../../lib/three/foliage';

// the page's own: one clock, the way the wind blows, where you are (far off
// till you're somewhere), and how near you push
export const NATURE = {
  time: { value: 0 },
  dir: { value: new THREE.Vector2(0.8, 0.6).normalize() },
  push: { value: new THREE.Vector3(1e6, 0, 1e6) },
  pushR: { value: 1.6 },
};

// a material's family, by the pack's names (scripts/quaternius-nature.mjs has the same rule)
const familyOf = (name) =>
  name === 'Grass' ? 'grass' : name === 'Leaves' ? 'plant' : name === 'Flowers' ? 'flowers' : name.startsWith('Leaves_') || name.startsWith('Leaf_') ? 'leaves' : name.startsWith('Bark_') ? 'bark' : 'stone';
const LEAFY = new Set(['leaves', 'plant', 'flowers', 'grass']);
const PUSHED = new Set(['plant', 'flowers', 'grass']);
const TINTED = new Set(['leaves', 'plant', 'grass']);
const MOVES = { plant: 'shrub', flowers: 'shrub', grass: 'grass' };

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

// a material the first time its name is seen: lit, in the wind, pushed
function dress(m, sway) {
  const family = familyOf(m.name);
  if (LEAFY.has(family)) {
    m.alphaToCoverage = m.alphaTest > 0;
    wrapLighting(m, { wrap: 0.45, backScatter: 0.35 });
    if (m.side === THREE.DoubleSide) faceless(m);
  }
  // (a tree's leaves and branches by the tree's numbers, whatever loaded
  // them first: a bush shares its leaves with a tree, and they must move
  // with the branches they're on)
  const moves = family === 'leaves' || family === 'bark' ? (sway ? 'tree' : null) : MOVES[family];
  if (moves) {
    wind(m, { kind: moves, time: NATURE.time, ...(family === 'bark' ? { leaf: 0 } : {}) });
    m.userData.wind.uWindDir = NATURE.dir;
  }
  if (PUSHED.has(family)) pushed(m);
  m.userData.tintable = TINTED.has(family);
}

export function natureLook(gltf, entry = {}) {
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
      if (!had) {
        shared.set(key, m);
        dress(m, entry.sway);
      }
      return m;
    });
    o.material = mats.length === 1 ? mats[0] : mats;
  });
  root.userData.nature = true;
  return gltf;
}

export function natureTick(kit, you) {
  if (kit?.wind) NATURE.time.value = kit.wind.value;
  if (kit?.windAngle != null) NATURE.dir.value.set(Math.cos(kit.windAngle), Math.sin(kit.windAngle));
  if (you) NATURE.push.value.set(you.x, 0, you.z);
}
