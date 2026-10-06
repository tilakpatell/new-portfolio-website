// What burns: a ship shot down goes up in a fireball that swells to 2.2
// times its size across, cools from
// white through orange to smoke and is gone in 1.4 s, with shards of it
// flung out tumbling and, for anything bigger than a fighter, a ring of
// light running out. Pooled: a few blasts made once and reused, so a fight
// costs a fireball draw a blast and one draw each for all the shards and all
// the rings while they play, and nothing after. On a weak device or when the
// pace has stepped down (`pop`), nothing bursts (the scene's own pop does).
//
// explosionPlan(size, tint, t) → { fire: { radius, colour: [r, g, b], alpha },
//   shards, ring }: what a blast `size` across (map units) looks like `t`
//   seconds in; `tint` ([r, g, b] or null) colours its fire a little. Pure.
// createExplosions({ parent, small, pool }) → { burst(at, size, tint),
//   update(dt), setMode('full' | 'pop'), active, dispose }

import * as THREE from 'three';
import { NOISE } from './noiseGlsl';

const LIFE = 1.4; // seconds
const SWELL = 0.4; // to its full size
const SHARDS = 24; // a blast's
const WHITE = [1, 0.97, 0.9];
const ORANGE = [1, 0.48, 0.12];
const SMOKE = [0.2, 0.18, 0.17];

const mix3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function explosionPlan(size, tint = null, t = 0) {
  // swells fast and keeps a little growth as it burns out
  const swell = 1 - (1 - Math.min(1, t / SWELL)) ** 3;
  // (2.2 times its size across: a fighter's is a few of your ships wide)
  const radius = 1.1 * size * swell * (1 + 0.15 * smooth(SWELL, LIFE, t));
  // white, to orange (a third of the way to its tint) by 0.45 s, to smoke by 1.4 s
  const hot = tint ? mix3(ORANGE, tint, 0.35) : ORANGE;
  const colour = t < 0.45 ? mix3(WHITE, hot, smooth(0.05, 0.45, t)) : mix3(hot, SMOKE, smooth(0.45, LIFE, t));
  const alpha = t >= LIFE ? 0 : 1 - smooth(0.6, LIFE, t);
  return { fire: { radius, colour, alpha }, shards: size < 0.1 ? 0 : SHARDS, ring: size > 0.3 };
}

// the fireball: a quad facing the camera, a ball of noise that churns
const FIRE_VERT = /* glsl */ `
uniform float uRadius;
varying vec2 vUv;
void main() {
  vUv = position.xy;
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mv.xy += position.xy * uRadius;
  gl_Position = projectionMatrix * mv;
}`;
const FIRE_FRAG = /* glsl */ `
uniform vec3 uColour;
uniform float uAlpha;
uniform float uAge;
${NOISE}
varying vec2 vUv;
void main() {
  float d = length(vUv);
  if (d > 1.0) discard;
  // billows: noise over the disc, churning as it ages
  float n = noise(vec3(vUv * 2.6, uAge * 1.8)) * 0.6 + noise(vec3(vUv * 6.0 + 7.0, uAge * 3.0)) * 0.4;
  float body = smoothstep(1.0, 0.35, d + n * 0.28);
  // a white-hot heart early on, past what the bloom picks out
  float heart = smoothstep(0.5, 0.0, d + n * 0.15) * (1.0 - smoothstep(0.0, 0.5, uAge)) * 2.0;
  float a = body * uAlpha;
  gl_FragColor = vec4((uColour * (0.8 + 0.6 * n) + vec3(heart)) * a, a);
}`;

// the rings: a quad facing the camera, a thin ring of light running out
const RING_VERT = /* glsl */ `
attribute float aAge;
varying vec2 vUv;
varying float vAge;
varying vec3 vColour;
void main() {
  vUv = position.xy;
  vAge = aAge;
  vColour = instanceColor;
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mv.xy += position.xy * length(instanceMatrix[0].xyz);
  gl_Position = projectionMatrix * mv;
}`;
const RING_FRAG = /* glsl */ `
varying vec2 vUv;
varying float vAge;
varying vec3 vColour;
void main() {
  float d = length(vUv);
  float ring = smoothstep(0.82, 0.95, d) * (1.0 - smoothstep(0.95, 1.0, d));
  float a = ring * (1.0 - vAge);
  gl_FragColor = vec4(vColour * a, a);
}`;

export function createExplosions({ parent, small = false, pool = 6 } = {}) {
  const n = small ? Math.max(2, Math.floor(pool / 2)) : pool;
  const quad = new THREE.PlaneGeometry(2, 2);
  const blasts = Array.from({ length: n }, (_, i) => {
    const u = { uRadius: { value: 0 }, uColour: { value: new THREE.Color() }, uAlpha: { value: 0 }, uAge: { value: 0 }, uSeed: { value: new THREE.Vector3(i * 13 + 5, i * 7 + 2, i * 3 + 11) } };
    const mat = new THREE.ShaderMaterial({ vertexShader: FIRE_VERT, fragmentShader: FIRE_FRAG, uniforms: u, transparent: true, depthWrite: false, premultipliedAlpha: true, blending: THREE.NormalBlending, toneMapped: false });
    const mesh = new THREE.Mesh(quad, mat);
    mesh.visible = false;
    mesh.frustumCulled = false;
    mesh.renderOrder = 6;
    mesh.name = 'blast';
    parent?.add(mesh);
    return { mesh, u, live: false, t: 0, size: 0, tint: null, at: new THREE.Vector3(), flung: [] };
  });
  // every blast's shards, one draw: small hot bits of hull, tumbling out and cooling
  const shardGeo = new THREE.TetrahedronGeometry(1, 0);
  const shardMat = new THREE.MeshBasicMaterial({ toneMapped: false });
  const shards = new THREE.InstancedMesh(shardGeo, shardMat, SHARDS * n);
  shards.count = 0;
  shards.frustumCulled = false;
  shards.visible = false;
  shards.name = 'blast-shards';
  shards.setColorAt(0, new THREE.Color());
  parent?.add(shards);
  // and every ring, one draw
  const ringGeo = new THREE.PlaneGeometry(2, 2);
  const age = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
  ringGeo.setAttribute('aAge', age);
  const ringMat = new THREE.ShaderMaterial({ vertexShader: RING_VERT, fragmentShader: RING_FRAG, transparent: true, depthWrite: false, premultipliedAlpha: true, blending: THREE.AdditiveBlending, toneMapped: false });
  const rings = new THREE.InstancedMesh(ringGeo, ringMat, n);
  rings.count = 0;
  rings.frustumCulled = false;
  rings.visible = false;
  rings.name = 'blast-rings';
  rings.setColorAt(0, new THREE.Color());
  parent?.add(rings);

  let mode = 'full';
  let next = 0;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const c = new THREE.Color();
  let rand = 0x9e3779b9;
  const r = () => {
    rand = (rand * 1664525 + 1013904223) >>> 0;
    return rand / 4294967296;
  };

  return {
    // `at` in the parent's space; `size` across, map units; `tint` [r, g, b] or null
    burst(at, size, tint = null) {
      if (mode === 'pop' || !(size > 0)) return;
      const b = blasts[next];
      next = (next + 1) % n;
      Object.assign(b, { live: true, t: 0, size, tint });
      b.at.copy(at);
      b.mesh.position.copy(at);
      // the shards' ways out, spins and sizes, drawn now
      const count = explosionPlan(size, tint, 0).shards;
      b.flung = Array.from({ length: count }, () => {
        const z = r() * 2 - 1;
        const a = r() * Math.PI * 2;
        const k = Math.sqrt(1 - z * z);
        const v = size * (1.4 + r() * 2.2);
        return { v: [Math.cos(a) * k * v, z * v, Math.sin(a) * k * v], spin: [r() * 6, r() * 6, r() * 6], s: size * (0.04 + r() * 0.08) };
      });
    },
    setMode(m) {
      mode = m === 'pop' ? 'pop' : 'full';
      if (mode === 'pop') for (const b of blasts) b.live = false;
    },
    get active() {
      return blasts.filter((b) => b.live).length;
    },
    update(dt) {
      let ns = 0;
      let nr = 0;
      for (const b of blasts) {
        if (b.live) b.t += dt;
        if (b.live && b.t >= LIFE) b.live = false;
        b.mesh.visible = b.live;
        if (!b.live) continue;
        const plan = explosionPlan(b.size, b.tint, b.t);
        b.u.uRadius.value = plan.fire.radius;
        b.u.uColour.value.setRGB(...plan.fire.colour);
        b.u.uAlpha.value = plan.fire.alpha;
        b.u.uAge.value = b.t / LIFE;
        // the shards: out and slowing, tumbling, cooling from orange to dark
        const k = b.t / LIFE;
        const out = (1 - Math.exp(-b.t * 2.2)) / 2.2;
        c.setRGB(...mix3([1, 0.6, 0.25], [0.12, 0.11, 0.1], smooth(0, 0.7, k)));
        for (const f of b.flung) {
          p.set(b.at.x + f.v[0] * out, b.at.y + f.v[1] * out, b.at.z + f.v[2] * out);
          q.setFromEuler(e.set(f.spin[0] * b.t, f.spin[1] * b.t, f.spin[2] * b.t));
          s.setScalar(f.s * (1 - smooth(0.6, 1, k)));
          shards.setMatrixAt(ns, m4.compose(p, q, s));
          shards.setColorAt(ns, c);
          ns++;
        }
        if (plan.ring) {
          const rr = b.size * 3.5 * (1 - (1 - Math.min(1, b.t / 0.9)) ** 2);
          rings.setMatrixAt(nr, m4.compose(b.at, q.identity(), s.setScalar(Math.max(1e-4, rr))));
          rings.setColorAt(nr, c.setRGB(...mix3([1, 0.85, 0.6], b.tint ?? [1, 0.6, 0.3], 0.4)));
          age.array[nr] = Math.min(1, b.t / 0.9);
          nr++;
        }
      }
      shards.count = ns;
      shards.visible = ns > 0;
      shards.instanceMatrix.needsUpdate = true;
      if (shards.instanceColor) shards.instanceColor.needsUpdate = true;
      rings.count = nr;
      rings.visible = nr > 0;
      rings.instanceMatrix.needsUpdate = true;
      if (rings.instanceColor) rings.instanceColor.needsUpdate = true;
      age.needsUpdate = true;
    },
    // for the warm-up: every blast's, shard's and ring's shader made before
    // the first fight (they're hidden until then)
    get meshes() {
      return [...blasts.map((b) => b.mesh), shards, rings];
    },
    dispose() {
      for (const b of blasts) {
        b.mesh.removeFromParent();
        b.mesh.material.dispose();
      }
      quad.dispose();
      shards.removeFromParent();
      shardGeo.dispose();
      shardMat.dispose();
      shards.dispose();
      rings.removeFromParent();
      ringGeo.dispose();
      ringMat.dispose();
      rings.dispose();
    },
  };
}
