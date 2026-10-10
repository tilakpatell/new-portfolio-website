// The game's clouds in a world's sky (the fifth design, lane O): the drop's
// backdrop cloud cards (`forestbase_backdropcloud_01_*`, about 245 m wide
// and 55 tall, curved; catalog/bf2017-library.js's `game:` rows), set in a
// ring round you out by the sky dome, under the dome's own clouds. The game
// shades them in their shader preset from a cloud sheet the bucket has not
// got yet (T_ForestBase_BackdropCloud_01_C, HANDOFF-bf2017.md), and the
// import leaves them bare: so each is shaded here from its own shape (soft
// at its ends and its top, fuller at its foot) and the sky's noise tile,
// drifting, in the site's cloud colours and lit from the sun's side. Where a
// card's file does carry its sheet, the sheet's alpha shapes it instead.
//
// A site asks for them in its sky's clouds row, `clouds: { …, game: true }`
// (or `game: { n, el: [lo, hi], scale: [a, b] }`); drawn on high and ultra
// only, one instanced draw a card shape; none for a world with no clouds
// row, or on low and mid.
//
//   CARDS: the cards' `game:` names
//   cloudsWanted(site, level) → the row's settings, or null
//   cardPlacements(want, shapes) → [{ shape, yaw, el, scale, seed }]
//   createGameClouds(site, { level, models, load }) → null | { group, ready,
//     update(camera, t), dispose() }

import * as THREE from 'three';
import { noiseTexture } from './noiseTex';
import { SURFACE_MODELS, modelUrlFor } from './catalog';
import { dirOf } from './sky';

export const CARDS = [
  'game:objects/nature/forest/_forestbase/forestbase_backdropcloud_01/forestbase_backdropcloud_01_a_mesh',
  'game:objects/nature/forest/_forestbase/forestbase_backdropcloud_01/forestbase_backdropcloud_01_d_mesh',
  'game:objects/nature/yavin/_yavinbase/yavinbase_backdropcloud_01/forestbase_backdropcloud_01_b_mesh',
];

const TIERS = new Set(['high', 'ultra']);
const RADIUS = 860; // (metres: inside the dome's 1,000, drawn on the far plane as it is)
const DEFAULT = { n: 12, el: [0.05, 0.2], scale: [0.9, 1.5] };

export function cloudsWanted(site, level) {
  const row = site?.sky?.clouds;
  if (!row?.game || !TIERS.has(level)) return null;
  return { ...DEFAULT, ...(typeof row.game === 'object' ? row.game : {}), color: row.color ?? '#ffffff', shade: row.shade ?? '#9aa4b4', speed: row.speed ?? 0.01, cover: row.cover ?? 0.5 };
}

// (a seeded spread: the same sky every visit)
const rand = (seed) => {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0) / 4294967296);
};
export function cardPlacements(want, shapes) {
  const r = rand(0x5eed + want.n);
  return Array.from({ length: want.n }, (_, i) => ({
    shape: i % shapes,
    yaw: ((i + r() * 0.6) / want.n) * Math.PI * 2,
    el: want.el[0] + r() * (want.el[1] - want.el[0]),
    scale: want.scale[0] + r() * (want.scale[1] - want.scale[0]),
    seed: r(),
  }));
}

const VERT = `
attribute float aSeed;
varying vec3 vLocal;
varying vec3 vDir;
varying float vSeed;
void main() {
  vLocal = position;
  vSeed = aSeed;
  vec4 local = vec4(position, 1.0);
  #ifdef USE_INSTANCING
  local = instanceMatrix * local;
  #endif
  vec4 world = modelMatrix * local;
  vDir = world.xyz - cameraPosition;
  gl_Position = projectionMatrix * viewMatrix * world;
  gl_Position.z = gl_Position.w; // on the far plane, as the dome: behind everything
}`;

const FRAG = `
uniform vec3 uMin, uMax, uColor, uShade, uSun;
uniform float uTime, uSpeed, uCover;
uniform sampler2D uNoise;
varying vec3 vLocal;
varying vec3 vDir;
varying float vSeed;
void main() {
  vec3 k = (vLocal - uMin) / max(uMax - uMin, vec3(1e-3));
  // soft at its ends and its top, fuller at its foot
  float edge = smoothstep(0.0, 0.16, k.x) * smoothstep(1.0, 0.84, k.x) * smoothstep(0.0, 0.18, k.y) * smoothstep(1.0, 0.5, k.y);
  vec2 p = vec2(k.x * 2.6 + vSeed * 7.0 + uTime * uSpeed, k.y * 0.9 + vSeed * 3.0);
  float n = texture2D(uNoise, p).r * 0.65 + texture2D(uNoise, p * 2.7 + 0.31).r * 0.35;
  float a = edge * smoothstep(0.5 - uCover * 0.35, 0.85, n);
  if (a < 0.01) discard;
  float lit = clamp(0.35 + 0.45 * k.y + 0.35 * max(dot(normalize(vDir), uSun), 0.0), 0.0, 1.0);
  gl_FragColor = vec4(mix(uShade, uColor, lit), a * 0.85);
}`;

export function createGameClouds(site, { level, models = SURFACE_MODELS, load } = {}) {
  const want = cloudsWanted(site, level);
  // (the cards that are published: none, no clouds)
  const cards = CARDS.filter((c) => models[c]);
  if (!want || !cards.length || !load) return null;
  const group = new THREE.Group();
  group.name = 'game-clouds';
  group.renderOrder = -9;
  const sun = dirOf(site.sky.suns?.[0]?.az ?? 0, site.sky.suns?.[0]?.el ?? 0.8);
  const noise = noiseTexture();
  const time = { value: 0 };
  const owned = [];
  let dead = false;
  const placements = cardPlacements(want, cards.length);
  const ready = Promise.all(
    cards.map((kind, s) =>
      Promise.resolve(load(modelUrlFor(kind, level, models)))
        .then((gltf) => {
          let mesh = null;
          gltf?.scene?.traverse((o) => (mesh ||= o.isMesh ? o : null));
          if (dead || !mesh) return;
          const geometry = mesh.geometry.clone();
          geometry.computeBoundingBox();
          const box = geometry.boundingBox;
          const mine = placements.filter((p) => p.shape === s);
          geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(Float32Array.from(mine, (p) => p.seed), 1));
          const material = new THREE.ShaderMaterial({
            vertexShader: VERT,
            fragmentShader: FRAG,
            transparent: true,
            depthWrite: false,
            fog: false,
            side: THREE.DoubleSide,
            uniforms: { uMin: { value: box.min.clone() }, uMax: { value: box.max.clone() }, uColor: { value: new THREE.Color(want.color) }, uShade: { value: new THREE.Color(want.shade) }, uSun: { value: sun }, uTime: time, uSpeed: { value: want.speed * 6 }, uCover: { value: want.cover }, uNoise: { value: noise } },
          });
          const inst = new THREE.InstancedMesh(geometry, material, mine.length);
          const m = new THREE.Matrix4();
          const q = new THREE.Quaternion();
          mine.forEach((p, i) => {
            const at = new THREE.Vector3(Math.sin(p.yaw) * RADIUS, Math.tan(p.el) * RADIUS - box.min.y * p.scale, Math.cos(p.yaw) * RADIUS);
            // (its broad side toward you: the card's long axis is its x)
            q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw + Math.PI);
            inst.setMatrixAt(i, m.compose(at, q, new THREE.Vector3(p.scale, p.scale, p.scale)));
          });
          inst.frustumCulled = false;
          inst.renderOrder = -9;
          inst.name = kind;
          group.add(inst);
          owned.push(geometry, material);
        })
        .catch(() => {}),
    ),
  );
  return {
    group,
    ready,
    update(camera, t) {
      group.position.copy(camera.position);
      // (the ring turns, slowly, with the wind)
      group.rotation.y = t * want.speed * 0.4;
      time.value = t;
    },
    dispose() {
      dead = true;
      for (const o of owned) o.dispose();
      group.removeFromParent();
    },
  };
}
