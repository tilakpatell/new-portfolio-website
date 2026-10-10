// Every ship's engines alight with its throttle: the hero ship's, the
// traffic's and the hunters', as one draw. Each engine is a small glow
// facing the camera where its exhaust is, its colour the ship's own, a
// paler core, flickering a little, and never smaller on the screen than
// three pixels (so a fighter far off still glints as it turns away).
//
// The engines sit under the ship (ENGINE_CAP): no glow brighter at its
// hottest than 0.8, below a lit hull's 1 and the bloom's threshold, so the
// ship is the brightest thing in its own picture and not its exhaust; and
// the hero's plumes (trail.js, capped by capPlume) never longer than 0.6 of
// the ship. The boost adds size and length, never brightness.
//
// HERO_ENGINES: { [kind]: [{ at: [x, y, z], r, colour }] }: the ships you
//   fly, in BUILT units inside their pivot (from where their plumes leave)
// ENGINES: { [kind]: [{ at, r, colour, box }] }: the traffic's and the
//   hunters', as shares of its model's box (`box`), nose +z, the radius a
//   share of its smaller side. A kind not listed has its engines guessed
//   (guessEngines); one listed empty has none
// enginesFor(kind, size) → that kind's engines in its model's own units
// guessEngines(size) → one engine in the middle of the stern face of a box
//   `size` ({ x, y, z }) whose nose is +z
// glowSize(throttle, boost, min, r) → an engine's half-size, pure:
//   max(min, r × (0.6 + 0.9 × throttle + 1.2 × boost))
// ENGINE_CAP: { length, luminance }: a plume's longest, as a share of the
//   ship's length, and an engine's brightest (linear luminance)
// plumeLength(throttle, boost, length) → how long the hero's plume is, in
//   the units of `length` (the ship's): a share of the cap, all of it boosting
// capPlume(look) → a trail.js look whose length at the boost's full stretch
//   (MAX_STRETCH) is the cap, with { cap: { length, peak } } for the trail
// enginePeak([r, g, b]) → an engine's luminance at its centre, glow and core
// createEngines({ parent, max }) → { add(kind, object, { size, list }) →
//   handle, set(handle, { throttle, boost }), remove(handle), update(t,
//   camera, viewport), count, dispose }: `object` is what the engines ride
//   on (their places are in its space), `parent` where the one mesh is drawn

import * as THREE from 'three';
import { FALCON_ENGINES, XWING_ENGINES } from './hulls';
import { ENGINES as PLUMES } from './shipModels';
import { LENGTH } from './scale';

export const ENGINE_CAP = { length: 0.6, luminance: 0.8 };
// how far the scene stretches a plume at the boost's full (scene.js's
// updatePlumes: 1 + 1.3 × the streak)
export const MAX_STRETCH = 2.3;

export function plumeLength(throttle, boost, length = LENGTH) {
  if (throttle <= 0) return 0;
  const b = Math.max(0, Math.min(1, boost));
  return (ENGINE_CAP.length * length * (1 + (MAX_STRETCH - 1) * b)) / MAX_STRETCH;
}

export function capPlume(look, length = LENGTH) {
  const cap = ENGINE_CAP.length * length;
  return { ...look, length: Math.min(look.length, cap / MAX_STRETCH), cap: { length: cap, peak: ENGINE_CAP.luminance } };
}

// the glow's core, as a share of its colour's brightest channel (FRAG below)
const CORE = 0.6;
export const enginePeak = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b + CORE * Math.max(r, g, b);

const at = (list, r, colour, box = false) => list.map((p) => ({ at: [...p], r, colour, box }));

// (a ring of exhausts round the back of a saucer's rim)
const ring = (n, radius, z, r, colour, box = false) => Array.from({ length: n }, (_, i) => ({ at: [Math.cos(((i + 0.5) / n) * Math.PI - Math.PI) * radius, 0, z], r, colour, box }));

export const HERO_ENGINES = {
  falcon: at(FALCON_ENGINES, 0.035, '#8fd0ff'),
  xwing: at(XWING_ENGINES, 0.03, '#ffb0c8'),
  rv: at(PLUMES.rv, 0.035, '#ffb060'),
  cruiser: ring(5, 0.12, PLUMES.cruiser[0][2], 0.025, '#7dff9a'),
};

export const ENGINES = {
  // by hand where its engines aren't one in the middle of its stern, or its
  // glow isn't the guess's
  xwing: at([[-0.13, 0.12, -0.45], [0.13, 0.12, -0.45], [-0.13, -0.12, -0.45], [0.13, -0.12, -0.45]], 0.1, '#ffb0c8', true),
  tie: at([[0, 0, -0.3]], 0.25, '#ff8a6a', true),
  interceptor: at([[0, 0, -0.3]], 0.22, '#ff8a6a', true),
  tiebomber: at([[-0.22, 0, -0.45], [0.22, 0, -0.45]], 0.18, '#ff8a6a', true),
  awing: at([[-0.3, 0, -0.5], [0.3, 0, -0.5]], 0.16, '#9fd8ff', true),
  ywing: at([[-0.35, 0, -0.5], [0.35, 0, -0.5]], 0.14, '#ff9a6a', true),
  slave1: at([[-0.2, -0.3, -0.5], [0.2, -0.3, -0.5]], 0.14, '#ffb36a', true),
  corvette: at([[-0.25, 0, -0.5], [0.25, 0, -0.5], [0, 0.3, -0.5], [0, -0.3, -0.5]], 0.12, '#ff7f6a', true),
  destroyer: at([[-0.2, 0.25, -0.5], [0.2, 0.25, -0.5], [0, 0.4, -0.5]], 0.08, '#9fd8ff', true),
  saucer: ring(4, 0.45, -0.3, 0.1, '#7dff9a', true),
  federation: ring(3, 0.35, -0.48, 0.1, '#7dff9a', true),
  // no jets: a balloon goes by the wind, a Meeseeks floats
  balloon: [],
  meeseeks: [],
  birdperson: [],
};

// the colour of a guessed engine: the side's own light
const GUESS = '#ffc080';

export function guessEngines(size) {
  const s = size ?? { x: 1, y: 1, z: 1 };
  return [{ at: [0, 0, -s.z / 2], r: 0.18 * Math.min(s.x, s.y), colour: GUESS }];
}

export function enginesFor(kind, size = null) {
  const list = ENGINES[kind];
  if (!list) return guessEngines(size);
  const s = size ?? { x: 1, y: 1, z: 1 };
  return list.map((e) => (e.box ? { at: [e.at[0] * s.x, e.at[1] * s.y, e.at[2] * s.z], r: e.r * Math.min(s.x, s.y), colour: e.colour } : e));
}

// how bright an engine burns, 0.35 idle to 1 at full throttle and 1.5 boosting
export const burn = (throttle, boost) => 0.35 + 0.65 * throttle + 0.5 * boost;

export function glowSize(throttle, boost, min = 0.004, r = 1) {
  return Math.max(min, r * (0.6 + 0.9 * throttle + 1.2 * boost));
}

// (three declares instanceMatrix and instanceColor for an instanced mesh's shader)
const VERT = /* glsl */ `
uniform float uTime;
uniform float uMinPx; // the least half-size on the screen, in the drawing's pixels
uniform float uHalfH; // half the drawing's height, in its pixels
varying vec2 vUv;
varying vec3 vColour;
varying float vFlick;
void main() {
  vUv = position.xy;
  vColour = instanceColor;
  // where the engine is, and its half-size (the matrix's scale)
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float size = length(instanceMatrix[0].xyz);
  // three pixels at least: what that size is on the screen, raised to it
  float px = size * projectionMatrix[1][1] * uHalfH / max(-mv.z, 1e-4);
  size *= max(1.0, uMinPx / max(px, 1e-6));
  // a flicker of its own (gl_InstanceID: no attribute for it)
  float id = float(gl_InstanceID);
  vFlick = 0.88 + 0.12 * sin(uTime * 23.0 + id * 7.31) * sin(uTime * 9.7 + id * 3.17);
  mv.xy += position.xy * size;
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
varying vec2 vUv;
varying vec3 vColour;
varying float vFlick;
void main() {
  float d = dot(vUv, vUv);
  if (d > 1.0) discard;
  // a soft glow in its colour and a paler core, held under the bloom's
  // threshold (its colour carries how hard it's burning, capped: dim at idle)
  float level = max(vColour.r, max(vColour.g, vColour.b));
  float glow = pow(1.0 - d, 2.2);
  float core = exp(-d * 18.0) * ${CORE.toFixed(2)} * level;
  gl_FragColor = vec4((vColour * glow + vec3(core)) * vFlick, 1.0);
}`;

export function createEngines({ parent, max = 256 } = {}) {
  const geo = new THREE.PlaneGeometry(2, 2);
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: { uTime: { value: 0 }, uMinPx: { value: 1.5 }, uHalfH: { value: 360 } },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, max);
  mesh.count = 0;
  mesh.frustumCulled = false; // (its instances are anywhere: the matrices place them)
  mesh.renderOrder = 4;
  mesh.name = 'engines';
  mesh.setColorAt(0, new THREE.Color());
  parent?.add(mesh);
  const live = new Set();
  const m4 = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const one = new THREE.Quaternion();
  const col = new THREE.Color();
  const inv = new THREE.Matrix4();
  return {
    mesh,
    add(kind, object, { list = null, size = null } = {}) {
      const h = { kind, object, list: list ?? enginesFor(kind, size), throttle: 0.4, boost: 0 };
      live.add(h);
      return h;
    },
    set(h, { throttle = h?.throttle, boost = h?.boost } = {}) {
      if (!h) return;
      h.throttle = Math.max(0, Math.min(1, throttle));
      h.boost = Math.max(0, Math.min(1, boost));
    },
    remove(h) {
      live.delete(h);
    },
    get count() {
      return mesh.count;
    },
    // each frame, after everything has moved: `viewport`, the drawing's
    // height in its own pixels (for the three-pixel floor)
    update(t, camera, viewport = 720) {
      mat.uniforms.uTime.value = t;
      mat.uniforms.uHalfH.value = viewport / 2;
      inv.copy(mesh.parent?.matrixWorld ?? m4.identity()).invert();
      let n = 0;
      for (const h of live) {
        const o = h.object;
        if (!o.parent || !o.visible || !h.list.length) continue;
        // (anywhere up the tree hidden: none of it)
        let shown = true;
        for (let a = o.parent; a && shown; a = a.parent) shown = a.visible;
        if (!shown) continue;
        o.updateWorldMatrix(true, false);
        const s = o.matrixWorld.getMaxScaleOnAxis();
        for (const e of h.list) {
          if (n >= max) break;
          p.set(e.at[0], e.at[1], e.at[2]).applyMatrix4(o.matrixWorld).applyMatrix4(inv);
          const half = glowSize(h.throttle, h.boost, 0.004, e.r) * s;
          m4.compose(p, one, sc.set(half, half, half));
          mesh.setMatrixAt(n, m4);
          // (how hard it burns: a third at idle, all of it at full throttle, more boosting)
          col.set(e.colour).multiplyScalar(burn(h.throttle, h.boost));
          // (no brighter than the cap, however hard it burns)
          col.multiplyScalar(Math.min(1, ENGINE_CAP.luminance / Math.max(1e-6, enginePeak([col.r, col.g, col.b]))));
          mesh.setColorAt(n, col);
          n++;
        }
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.visible = n > 0;
    },
    dispose() {
      mesh.removeFromParent();
      geo.dispose();
      mat.dispose();
      mesh.dispose();
      live.clear();
    },
  };
}
