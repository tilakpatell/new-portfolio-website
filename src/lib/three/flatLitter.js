// Fallen leaves for a world on level ground, Bruno Simon's (folio-2025's
// Leaves.js: ./leafSim.js has their rules), as a landing's are
// (universe/landings/litter.js) but with no planet under them: a world in
// metres, y up, each leaf lying on the world's own ground, its height there
// read on the CPU from the world's height function. A few hundred leaves
// round the focus, lying in clumps, kicked along by whoever walks through
// them (sent up by a run), let go by the world's gusts (./wind.js's: the
// same that bend its grass) to skate the wind's way, thrown out by a blast,
// and shed now and then from the crowns round about; off the ground they
// swing and tumble as they fall.
//
// One draw, an instanced quad (Bruno's, skewed, cut to a leaf in its
// fragment shader), each leaf's place the sim's own numbers and the ground
// under it a second number a leaf, worked out again only for a leaf that's
// moved (awake, or wrapped round the box): a leaf asleep where it lies
// costs nothing.
//
//   flatLeafCount(density, { max, half })
//   flatLitterShader(shader) → { vertexShader, fragmentShader, swapped } (pure)
//   createFlatLitter({ max, half, spec, wind, floorAt, crowns, reduced, seed, focus, lift })
//     → { mesh, material, sim, ground, update(dt, { focus, walkers }),
//       blast(x, z, r, strength), info(), dispose() }
//
// `spec` is a place's leaves (as landings.js has them): { colours: [a, b,
// accent], density (a m²), size (of a 1 m quad, Bruno's 0.25), shed (a
// second) }; `wind` the world's (createWind's), or null; `floorAt(x, z)`
// the height the leaves lie at, in metres; `crowns` [{ x, z, r, lo, hi }],
// lo and hi metres up off the ground; `lift` how far over the floor they're
// drawn (the drawn ground is the height function's in straight pieces).
// Walkers are [{ key, x, z, y }] (y how far off the ground: anyone in the
// air kicks nothing), each one's speed from where it was the frame before.
// With motion turned down the leaves lie as they were laid, kept round you.

import * as THREE from 'three';
import { seeded } from '../seeded';
import { facelessShader } from './foliage';
import { LEAF, blastLeaves, layLeaves, makeLeafSim, shedLeaf, stepLeafSim, wrapLeaves } from './leafSim';
import { sampleNoise, windOffsetAt } from './wind';

// (a place's density over its box, in 32s, never fewer than 32: litter.js's leafCount)
export const flatLeafCount = (density, { max, half }) => Math.min(max, Math.max(32, Math.round((density * (2 * half) ** 2) / 32) * 32));
const FAST = 8; // m/s: no walker's quicker (a step across the world isn't a kick)
const MOVED = 0.01; // (metres a leaf goes before the ground under it is looked at again)

// ── the shader ──

const PARS = /* glsl */ `
attribute vec4 aLeaf; // x, its height off the ground, z (metres), its colour
attribute vec4 aLeafSeed; // its turn, its size, its two tilts
attribute float aLeafGround; // the ground's height where it is
uniform vec3 uLeafFocus; // where the box is (x, z) and its half
uniform vec2 uLeafLook; // the leaves' size, how far over the ground they're drawn
uniform float uLeafClock;
varying float vLeafMix;
varying vec2 vLeafUv;
vec2 leafTurn(vec2 v, float a) { float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }
`;
// Bruno's static random normal (Leaves.js): a leaf lying flat lit as if
// tilted, each its own way
const NORMAL = /* glsl */ `
vec3 objectNormal = vec3(0.0, 1.0, 0.0);
objectNormal.yz = leafTurn(objectNormal.yz, aLeafSeed.z);
objectNormal.xy = leafTurn(objectNormal.xy, aLeafSeed.w);
`;
// his flutter (by how high it is: none lying down), its turn, gone toward
// the box's edge (no pop as it wraps), and put where it is over the ground
const BEGIN = /* glsl */ `
float lfH = max(aLeaf.y, 0.0);
float lfT = uLeafClock * (2.0 + 2.0 * fract(float(gl_InstanceID) * 0.618)) * clamp((aLeaf.y - ${LEAF.floor.toFixed(3)}) * 2.0, 0.0, 1.0);
vec3 transformed = position * (uLeafLook.x * aLeafSeed.y);
transformed.xy = leafTurn(transformed.xy, sin(aLeaf.x * 3.0 + lfT) * lfH);
transformed.yz = leafTurn(transformed.yz, sin(aLeaf.z * 3.0 + lfT * 1.3) * lfH);
transformed.xz = leafTurn(transformed.xz, aLeafSeed.x);
vec2 lfOff = abs(aLeaf.xz - uLeafFocus.xy);
transformed *= 1.0 - smoothstep(uLeafFocus.z * 0.8, uLeafFocus.z, max(lfOff.x, lfOff.y));
transformed += vec3(aLeaf.x, aLeafGround + uLeafLook.y + aLeaf.y, aLeaf.z);
vLeafMix = aLeaf.w;
vLeafUv = vec2(position.x + 0.3 * position.z, -position.z); // (the quad unskewed, -0.5…0.5)
`;
// a leaf cut out of the quad (broad toward its stalk, pointed at its tip,
// skewed with the quad), its colour its own, a little darker at its edge
// (litter.js's, line for line: the same leaf on a landing and here)
const COLOUR = /* glsl */ `
{
  float lfT = vLeafUv.x + 0.5;
  float lfW = 0.46 * pow(max(sin(3.14159265 * pow(lfT, 0.8)), 0.0), 0.8);
  float lfV = abs(vLeafUv.y);
  if (lfV > lfW) discard;
  diffuseColor.rgb = (vLeafMix > 1.5 ? uLeafC : mix(uLeafA, uLeafB, vLeafMix)) * mix(1.0, 0.78, smoothstep(0.5 * lfW, lfW, lfV));
}
`;

// The rewrite, as pure strings (a Lambert's shaders): each leaf stood where
// it is, its colour its own, both its faces lit as its front
export function flatLitterShader({ vertexShader, fragmentShader }) {
  const swapped = { leaf: false, colour: false, faceless: false };
  let vs = vertexShader;
  let fs = fragmentShader;
  if (['#include <common>', '#include <beginnormal_vertex>', '#include <begin_vertex>'].every((s) => vs.includes(s))) {
    vs = vs.replace('#include <common>', `#include <common>\n${PARS}`).replace('#include <beginnormal_vertex>', NORMAL).replace('#include <begin_vertex>', BEGIN);
    swapped.leaf = true;
  }
  if (swapped.leaf && fs.includes('#include <common>') && fs.includes('#include <color_fragment>')) {
    fs = fs.replace('#include <common>', '#include <common>\nvarying float vLeafMix;\nvarying vec2 vLeafUv;\nuniform vec3 uLeafA;\nuniform vec3 uLeafB;\nuniform vec3 uLeafC;').replace('#include <color_fragment>', `#include <color_fragment>\n${COLOUR}`);
    swapped.colour = true;
  }
  const f = facelessShader({ vertexShader: vs, fragmentShader: fs });
  swapped.faceless = f.swapped.faceless;
  return { vertexShader: vs, fragmentShader: f.fragmentShader, swapped };
}

// ── the leaves ──

export function createFlatLitter({ max = 512, half = 14, spec = {}, wind = null, floorAt = () => 0, crowns = [], reduced = false, seed = 1, focus: start = { x: 0, z: 0 }, lift = 0.02 } = {}) {
  const sim = makeLeafSim(max);
  const ground = new Float32Array(max); // (the ground's height under each leaf)
  const looked = new Float32Array(2 * max); // (where each leaf was when it was looked at)
  // Bruno's quad: a 1 m square, skewed, lying flat
  const quad = new THREE.PlaneGeometry(1, 1);
  const qp = quad.attributes.position.array;
  qp[0] += 0.15;
  qp[3] += 0.15;
  qp[6] -= 0.15;
  qp[9] -= 0.15;
  quad.rotateX(-Math.PI / 2);
  const geometry = new THREE.InstancedBufferGeometry().copy(quad);
  quad.dispose();
  const aLeaf = new THREE.InstancedBufferAttribute(sim.p, 4).setUsage(THREE.DynamicDrawUsage);
  const aGround = new THREE.InstancedBufferAttribute(ground, 1).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aLeaf', aLeaf);
  geometry.setAttribute('aLeafSeed', new THREE.InstancedBufferAttribute(sim.seed, 4));
  geometry.setAttribute('aLeafGround', aGround);
  const [a, b, c] = spec.colours ?? ['#8a6a2e', '#c89a3c', '#b4622c'];
  const uniforms = {
    uLeafFocus: { value: new THREE.Vector3(start.x, start.z, half) },
    uLeafLook: { value: new THREE.Vector2(spec.size ?? 0.2, lift) },
    uLeafClock: { value: 0 },
    uLeafA: { value: new THREE.Color(a) },
    uLeafB: { value: new THREE.Color(b) },
    uLeafC: { value: new THREE.Color(c ?? b) },
  };
  const material = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
  material.name = 'leaves';
  material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    const out = flatLitterShader(sh);
    sh.vertexShader = out.vertexShader;
    sh.fragmentShader = out.fragmentShader;
    if (import.meta.env?.DEV && !Object.values(out.swapped).every(Boolean)) console.warn('leaves: a shader without the lines they look for', out.swapped);
  };
  material.customProgramCacheKey = () => 'flat-leaves';
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'leaves';
  mesh.frustumCulled = false;

  const rand = seeded(seed * 7 + 3);
  const focus = { x: start.x, z: start.z };
  const seen = new Map(); // a walker's key → { x, z, tick }: where they were, when
  let tick = 0;
  let shed = 0;
  const kickers = [];
  const pool = []; // (kickers' own objects, kept from frame to frame)
  const near = []; // (crowns in the box: one picked to shed)
  const off = { x: 0, z: 0, k: 0 };
  // the wind's gate where a leaf is: its slow noise, a long way across,
  // drifting downwind (his scrolls the other way, which reads as backward
  // this close)
  const gate = (x, z) => {
    const u = wind.uniforms;
    const d = u.uWindDir.value;
    const t = u.uWindTime.value;
    return sampleNoise(u.uWindNoise.value.image, x * LEAF.wind.frequency - d.x * t, z * LEAF.wind.frequency - d.y * t);
  };
  const gust = { strength: 0, dir: [1, 0], gate };
  // the ground under every leaf that's moved since it was last looked at
  // (and sent, those alone)
  const settle = (all = false) => {
    let lo = -1;
    let hi = -1;
    for (let i = 0; i < sim.count; i++) {
      const x = sim.p[4 * i];
      const z = sim.p[4 * i + 2];
      if (!all && Math.abs(x - looked[2 * i]) + Math.abs(z - looked[2 * i + 1]) < MOVED) continue;
      looked[2 * i] = x;
      looked[2 * i + 1] = z;
      ground[i] = floorAt(x, z);
      if (lo < 0) lo = i;
      hi = i;
    }
    if (lo < 0) return 0;
    aGround.clearUpdateRanges();
    aGround.addUpdateRange(lo, hi - lo + 1);
    aGround.needsUpdate = true;
    return hi - lo + 1;
  };
  const send = () => {
    uniforms.uLeafFocus.value.set(focus.x, focus.z, half);
    aLeaf.clearUpdateRanges();
    aLeaf.addUpdateRange(0, 4 * sim.count);
    aLeaf.needsUpdate = true;
    settle();
  };
  // laid round the focus, in his clumps (the wind's own noise), at rest
  const img = wind?.uniforms.uWindNoise.value.image;
  layLeaves(sim, flatLeafCount(spec.density ?? 0.3, { max, half }), { half, focus, rand, clump: img ? (u, v) => sampleNoise(img, u, v) - 0.5 : null });
  geometry.instanceCount = sim.count;
  settle(true);

  return {
    mesh,
    material,
    sim,
    ground,
    // a frame: `focus` the box's middle ({ x, z }), who's walking
    // ([{ key, x, z, y }])
    update(dt, { focus: f = focus, walkers = [] } = {}) {
      focus.x = f.x;
      focus.z = f.z;
      if (reduced || !(dt > 0)) {
        if (reduced) wrapLeaves(sim, focus, half);
        send();
        return;
      }
      // who's walking, and how fast (from where they were last frame)
      kickers.length = 0;
      tick += 1;
      for (const w of walkers) {
        const was = seen.get(w.key);
        let vx = 0;
        let vz = 0;
        if (was) {
          vx = (w.x - was.x) / dt;
          vz = (w.z - was.z) / dt;
          if (Math.hypot(w.x - was.x, w.z - was.z) > 2 || !Number.isFinite(vx + vz)) vx = vz = 0;
          const sp = Math.hypot(vx, vz);
          if (sp > FAST) {
            vx *= FAST / sp;
            vz *= FAST / sp;
          }
          was.x = w.x;
          was.z = w.z;
          was.tick = tick;
        } else seen.set(w.key, { x: w.x, z: w.z, tick });
        const k = pool[kickers.length] ?? (pool[kickers.length] = { x: 0, z: 0, y: 0, vx: 0, vz: 0 });
        k.x = w.x;
        k.z = w.z;
        k.y = w.y ?? 0;
        k.vx = vx;
        k.vz = vz;
        kickers.push(k);
      }
      // (those not seen this frame forgotten)
      for (const [key, w] of seen) if (w.tick !== tick) seen.delete(key);
      if (wind) {
        const u = wind.uniforms;
        gust.strength = u.uWindStrength.value;
        gust.dir[0] = u.uWindDir.value.x;
        gust.dir[1] = u.uWindDir.value.y;
      }
      stepLeafSim(sim, dt, { focus, half, wind: wind ? gust : null, walkers: kickers });
      // shed from the crowns round you, more in a gust
      if (spec.shed > 0 && crowns.length) {
        const k = wind ? windOffsetAt(wind.uniforms, focus.x, focus.z, off).k : 0;
        shed += spec.shed * dt * (1 + (2 * Math.max(0, k)) / Math.max(0.05, gust.strength));
        if (shed >= 1) {
          near.length = 0;
          for (const cr of crowns) if (Math.max(Math.abs(cr.x - focus.x), Math.abs(cr.z - focus.z)) < half - cr.r) near.push(cr);
          if (!near.length) shed = 0;
          for (; shed >= 1 && near.length; shed -= 1) shedLeaf(sim, near[Math.floor(rand() * near.length)], { focus, half, rand });
        }
      }
      uniforms.uLeafClock.value += dt;
      send();
    },
    // thrown out from (x, z) within r metres, at most `strength` m/s;
    // nothing with motion turned down, or out of the box
    blast(x, z, r, strength = LEAF.blast.strength) {
      if (reduced) return 0;
      if (!(Math.max(Math.abs(x - focus.x), Math.abs(z - focus.z)) <= half + r)) return 0;
      return blastLeaves(sim, x, z, r, strength, rand);
    },
    // how many there are, in the air, asleep; where the box is
    info() {
      let airborne = 0;
      let asleep = 0;
      for (let i = 0; i < sim.count; i++) {
        if (sim.p[4 * i + 1] > LEAF.floor + 0.005) airborne += 1;
        if (sim.rest[i]) asleep += 1;
      }
      return { count: sim.count, half, airborne, asleep, focus: [focus.x, focus.z], reduced };
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
