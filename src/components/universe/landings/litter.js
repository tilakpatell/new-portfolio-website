// The leaves on a landing's ground, Bruno Simon's (folio-2025's Leaves.js:
// lib/three/leafSim.js has their rules): a few hundred fallen leaves round
// you, lying in clumps, kicked along as you and your mate and the troops
// walk through them (sent up by a run), let go by the gusts to skate the
// wind's way (the canopy's wind, ./canopy.js: the same gusts that move the
// crowns), thrown out by a bolt into the ground, a landing on it, a jump
// coming down, shaken loose from a crown a bolt goes through, and shed now
// and then from the trees round you. Off the ground they swing and tumble
// as they fall.
//
// They live on a flat chart laid on the landing's frame, in metres (x along
// n × f, z along f, as place() and the scatter have it: foot.js), the
// ground's own lift under them, each put on the sphere where it is by the
// vertex shader; once you've walked far (a fifth of the planet's radius),
// the chart's laid again where you are. One draw, an instanced quad, its
// leaves' places sent each frame (10 KB at most).
//
//   LEAF_LEVELS, leafLevel({ tier, small }), leafCount(density, level)
//   chartOf(frame, R), toChart(chart, p), fromChart(chart, x, y, z), rechart(sim, from, to)
//   litterShader(shader) → { vertexShader, fragmentShader, swapped } (pure)
//   createLitter({ level, reduced }) → { mesh, sim, on, begin({ spec, R, frame, seed,
//     crowns, focus }), update(dt, { focusN, facing, walkers, hole }), blast(p, r,
//     strength), shake(p, v) → boolean, info(), end(), dispose() }
//
// `spec` is a landing's `leaves` (landings.js): { colours: [a, b, accent],
// density (a m²), size (of a 1 m quad, Bruno's 0.25), shed (a second) };
// crowns are furnish's ([{ x, z, r, lo, hi }], metres on the landing's
// frame), filled in as its trees arrive. Points handed in (p, v, n) are in
// the planet's space (footScene's root), arrays or vectors. With motion
// turned down the leaves lie as they were laid, kept round you.

import * as THREE from 'three';
import { seeded } from '../../../lib/seeded';
import { facelessShader } from '../../../lib/three/foliage';
import { LEAF, blastLeaves, layLeaves, makeLeafSim, shakeLeaves, shedLeaf, stepLeafSim, wrapLeaves } from '../../../lib/three/leafSim';
import { sampleNoise, windOffsetAt } from '../../../lib/three/wind';
import { METRE } from '../foot';
import { canopy } from './canopy';

// how many, how far round you each way (metres), by the device
export const LEAF_LEVELS = { high: { max: 640, half: 14 }, mid: { max: 320, half: 12 }, low: { max: 160, half: 10 } };
export const leafLevel = ({ tier, small }) => (tier === 'low' ? 'low' : small ? 'mid' : 'high');
// (a landing's density over its box, in 32s, never fewer than 32)
export const leafCount = (density, { max, half }) => Math.min(max, Math.max(32, Math.round((density * (2 * half) ** 2) / 32) * 32));
const GROUND_LIFT = 0.025; // the ground's own lift (footScene.js's PATCH): leaves lie on what's drawn
const RECHART = 0.2; // (of the planet's radius: how far you go before the chart's laid again)
const FAST = 8; // m/s: no walker's quicker (a respawn, a jump across, isn't a kick)
// (of half: the box moved further than this in a frame has jumped, out of
// the ship's door or back to it, and its leaves are laid again round where
// it's gone: else the patch the ship's landing cleared, wrapped, lies
// round you as you step out)
const JUMP = 0.5;

const V = THREE.Vector3;
const of = (p) => (Array.isArray(p) ? p : [p.x, p.y, p.z]);

// The chart on a frame ({ n, f }, the planet's space) of a planet of radius R
export function chartOf({ n, f }, R) {
  const n0 = new V(...of(n)).normalize();
  const e2 = new V(...of(f));
  e2.addScaledVector(n0, -e2.dot(n0)).normalize();
  const e1 = new V().crossVectors(n0, e2).normalize();
  return { n0, e1, e2, R, Rm: R / METRE };
}
// a point of the planet's space on it: x and z along it, y its height off the sphere (metres)
export function toChart(c, p, out = { x: 0, y: 0, z: 0 }) {
  const [px, py, pz] = of(p);
  const d = Math.hypot(px, py, pz) || 1;
  out.x = (c.Rm * (px * c.e1.x + py * c.e1.y + pz * c.e1.z)) / d;
  out.z = (c.Rm * (px * c.e2.x + py * c.e2.y + pz * c.e2.z)) / d;
  out.y = (d - c.R) / METRE;
  return out;
}
export function fromChart(c, x, y, z, out = new V()) {
  const u = x / c.Rm;
  const w = z / c.Rm;
  out.copy(c.n0).multiplyScalar(Math.sqrt(Math.max(0, 1 - u * u - w * w))).addScaledVector(c.e1, u).addScaledVector(c.e2, w);
  return out.multiplyScalar(c.R + y * METRE);
}
// every leaf from one chart onto another, where it is on the ground (its
// height and its speed kept)
const tv = new V();
const tc = { x: 0, y: 0, z: 0 };
export function rechart(s, from, to) {
  for (let i = 0; i < s.count; i++) {
    fromChart(from, s.p[4 * i], 0, s.p[4 * i + 2], tv);
    toChart(to, tv, tc);
    s.p[4 * i] = tc.x;
    s.p[4 * i + 2] = tc.z;
  }
}

// ── the shader ──

const PARS = /* glsl */ `
attribute vec4 aLeaf; // x, its height, z (the chart's metres), its colour
attribute vec4 aLeafSeed; // its turn, its size, its two tilts
uniform vec3 uLeafN;
uniform vec3 uLeafE1;
uniform vec3 uLeafE2;
uniform vec4 uLeafPlanet; // the ground's radius, the planet's in metres, a metre, the leaves' size
uniform vec3 uLeafFocus; // where the box is (x, z) and its half
uniform float uLeafClock;
uniform vec3 uLeafHole; // none at (x, z) within its r (the parked ship)
varying float vLeafMix;
varying vec2 vLeafUv;
vec2 leafTurn(vec2 v, float a) { float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }
`;
// up where the leaf is on the sphere, and Bruno's static random normal
// (Leaves.js): a leaf lying flat lit as if tilted, each its own way
const NORMAL = /* glsl */ `
vec2 lfXz = aLeaf.xz / uLeafPlanet.y;
vec3 lfUp = normalize(uLeafE1 * lfXz.x + uLeafE2 * lfXz.y + uLeafN * sqrt(max(0.0, 1.0 - dot(lfXz, lfXz))));
vec3 lfX = normalize(uLeafE1 - lfUp * dot(uLeafE1, lfUp));
mat3 lfBasis = mat3(lfX, lfUp, cross(lfX, lfUp));
vec3 lfN = vec3(0.0, 1.0, 0.0);
lfN.yz = leafTurn(lfN.yz, aLeafSeed.z);
lfN.xy = leafTurn(lfN.xy, aLeafSeed.w);
vec3 objectNormal = lfBasis * lfN;
`;
// his flutter (by how high it is: none lying down), its turn, gone toward
// the box's edge (no pop as it wraps) and under the ship, stood on the sphere
const BEGIN = /* glsl */ `
float lfH = max(aLeaf.y, 0.0);
float lfT = uLeafClock * (2.0 + 2.0 * fract(float(gl_InstanceID) * 0.618)) * clamp((aLeaf.y - ${LEAF.floor.toFixed(3)}) * 2.0, 0.0, 1.0);
vec3 transformed = position * (uLeafPlanet.w * aLeafSeed.y);
transformed.xy = leafTurn(transformed.xy, sin(aLeaf.x * 3.0 + lfT) * lfH);
transformed.yz = leafTurn(transformed.yz, sin(aLeaf.z * 3.0 + lfT * 1.3) * lfH);
transformed.xz = leafTurn(transformed.xz, aLeafSeed.x);
vec2 lfOff = abs(aLeaf.xz - uLeafFocus.xy);
transformed *= 1.0 - smoothstep(uLeafFocus.z * 0.8, uLeafFocus.z, max(lfOff.x, lfOff.y));
transformed *= step(uLeafHole.z, length(aLeaf.xz - uLeafHole.xy));
transformed = lfBasis * (transformed * uLeafPlanet.z) + lfUp * (uLeafPlanet.x + aLeaf.y * uLeafPlanet.z);
vLeafMix = aLeaf.w;
vLeafUv = vec2(position.x + 0.3 * position.z, -position.z); // (the quad unskewed, -0.5…0.5)
`;
// a leaf cut out of the quad (broad toward its stalk, pointed at its tip,
// skewed with the quad), its colour its own, a little darker at its edge
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
export function litterShader({ vertexShader, fragmentShader }) {
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

export function createLitter({ level = 'high', reduced = false } = {}) {
  const L = LEAF_LEVELS[level] ?? LEAF_LEVELS.high;
  const sim = makeLeafSim(L.max);
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
  geometry.setAttribute('aLeaf', aLeaf);
  const aSeed = new THREE.InstancedBufferAttribute(sim.seed, 4);
  geometry.setAttribute('aLeafSeed', aSeed);
  geometry.instanceCount = 0;
  const uniforms = {
    uLeafN: { value: new V(0, 1, 0) },
    uLeafE1: { value: new V(1, 0, 0) },
    uLeafE2: { value: new V(0, 0, 1) },
    uLeafPlanet: { value: new THREE.Vector4(1, 1 / METRE, METRE, 0.2) },
    uLeafFocus: { value: new V(0, 0, L.half) },
    uLeafClock: { value: 0 },
    uLeafHole: { value: new V(0, 0, 0) },
    uLeafA: { value: new THREE.Color() },
    uLeafB: { value: new THREE.Color() },
    uLeafC: { value: new THREE.Color() },
  };
  const material = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
  material.name = 'leaves';
  material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    const out = litterShader(sh);
    sh.vertexShader = out.vertexShader;
    sh.fragmentShader = out.fragmentShader;
    if (import.meta.env?.DEV && !Object.values(out.swapped).every(Boolean)) console.warn('leaves: a shader without the lines they look for', out.swapped);
  };
  material.customProgramCacheKey = () => 'foot-leaves';
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'leaves';
  mesh.frustumCulled = false;
  mesh.visible = false;

  let on = false;
  let spec = null;
  let land = null; // the landing's chart (its crowns are on it)
  let chart = null; // the leaves' (land's, until you've walked far)
  let crowns = null;
  let rand = Math.random;
  let shed = 0;
  const focus = { x: 0, z: 0 };
  const here = { x: 0, z: 0 }; // (where you are on the chart, not looking ahead)
  const last = { x: 0, z: 0 }; // (and where you were last frame)
  const blasts = []; // (this frame's, kept to throw again if the box is laid again)
  const seen = new Map(); // a walker's key → { x, z, tick }: where they were, when
  let tick = 0;
  const walkers = [];
  const near = []; // (crowns in the box: one picked to shed)
  const at = { x: 0, y: 0, z: 0 };
  const lp = { x: 0, y: 0, z: 0 };
  const off = { x: 0, z: 0, k: 0 };
  const p3 = new V();
  // a point on the landing's chart, on the leaves'
  const fromLand = (x, z, out) => {
    if (chart === land) {
      out.x = x;
      out.z = z;
      return out;
    }
    return toChart(chart, fromChart(land, x, 0, z, p3), out);
  };
  const toLand = (x, z, out) => {
    if (chart === land) {
      out.x = x;
      out.z = z;
      return out;
    }
    return toChart(land, fromChart(chart, x, 0, z, p3), out);
  };
  const cq = { x: 0, z: 0 };
  // the crowns all inside the box (on the leaves' chart, into `near`)
  const crownsIn = () => {
    near.length = 0;
    for (const c of crowns ?? []) {
      fromLand(c.x, c.z, cq);
      if (Math.max(Math.abs(cq.x - focus.x), Math.abs(cq.z - focus.z)) < L.half - c.r) near.push({ x: cq.x, z: cq.z, r: c.r, lo: c.lo, hi: c.hi });
    }
    return near;
  };
  // the wind's gate where a leaf is: its slow noise, a long way across,
  // drifting downwind (his scrolls the other way, which reads as backward
  // this close)
  const gate = (x, z) => {
    const u = canopy().uniforms;
    const d = u.uWindDir.value;
    const t = u.uWindTime.value;
    const q = toLand(x, z, lp);
    return sampleNoise(u.uWindNoise.value.image, q.x * LEAF.wind.frequency - d.x * t, q.z * LEAF.wind.frequency - d.y * t);
  };
  const wind = { strength: 0, dir: [1, 0], gate };
  // `count` laid round the focus, in his clumps (the canopy's noise)
  // (each leaf's turn and size sent again: the page's warm-up may have
  // drawn them before they were laid, and they're sent only when told)
  const lay = (count) => {
    const img = canopy().uniforms.uWindNoise.value.image;
    layLeaves(sim, count, { half: L.half, focus, rand, clump: (u, v) => sampleNoise(img, u, v) - 0.5 });
    aSeed.needsUpdate = true;
    last.x = here.x;
    last.z = here.z;
  };
  const send = () => {
    uniforms.uLeafFocus.value.set(focus.x, focus.z, L.half);
    aLeaf.clearUpdateRanges();
    aLeaf.addUpdateRange(0, 4 * sim.count);
    aLeaf.needsUpdate = true;
  };
  const aim = () => {
    uniforms.uLeafN.value.copy(chart.n0);
    uniforms.uLeafE1.value.copy(chart.e1);
    uniforms.uLeafE2.value.copy(chart.e2);
    uniforms.uLeafPlanet.value.set(chart.R + GROUND_LIFT * METRE, chart.Rm, METRE, spec.size ?? 0.2);
  };
  // the box's middle: where you are, a little ahead the way you face (the camera's behind you)
  const focusOn = (n, f) => {
    toChart(chart, n, at);
    here.x = focus.x = at.x;
    here.z = focus.z = at.z;
    if (f) {
      const [fx, fy, fz] = of(f);
      focus.x += 0.3 * L.half * (fx * chart.e1.x + fy * chart.e1.y + fz * chart.e1.z);
      focus.z += 0.3 * L.half * (fx * chart.e2.x + fy * chart.e2.y + fz * chart.e2.z);
    }
  };

  return {
    mesh,
    sim,
    get on() {
      return on;
    },
    begin({ spec: s, R, frame, seed = 1, crowns: list = null, focus: n = frame.n }) {
      spec = s;
      land = chart = chartOf(frame, R);
      crowns = list;
      rand = seeded(seed * 7 + 3);
      shed = 0;
      seen.clear();
      focusOn(n, null);
      lay(leafCount(s.density ?? 0.3, L));
      const [a, b, c] = s.colours ?? ['#8a6a2e', '#c89a3c', '#b4622c'];
      uniforms.uLeafA.value.set(a);
      uniforms.uLeafB.value.set(b);
      uniforms.uLeafC.value.set(c ?? b);
      uniforms.uLeafClock.value = 0;
      uniforms.uLeafHole.value.set(0, 0, 0);
      aim();
      geometry.instanceCount = sim.count;
      on = true;
      send();
    },
    // a frame: `focusN` where you are (or the ship, till you're out), the
    // way you face, who's walking ([{ key, n, h }]), the parked ship ({ n, r } or null)
    update(dt, { focusN, facing = null, walkers: who = [], hole = null }) {
      if (!on) return;
      focusOn(focusN, facing);
      if (Math.hypot(focus.x, focus.z) > RECHART * chart.Rm) {
        // (walked far: the chart laid again where you are, the way it faced)
        const next = chartOf({ n: of(focusN), f: chart.e2 }, chart.R);
        rechart(sim, chart, next);
        chart = next;
        seen.clear();
        blasts.length = 0;
        aim();
        focusOn(focusN, facing);
        last.x = here.x;
        last.z = here.z;
      }
      // (moved further than a walk could in a frame, out of the ship to its
      // door or back: laid again round you, and this frame's blasts thrown
      // again, which the laying would have put back on the ground; a turn
      // that swings the look-ahead isn't a move)
      if (Math.hypot(here.x - last.x, here.z - last.z) > JUMP * L.half) {
        lay(sim.count);
        for (const b of blasts) blastLeaves(sim, ...b, rand);
      }
      blasts.length = 0;
      last.x = here.x;
      last.z = here.z;
      // (and none under the parked ship)
      if (hole) {
        toChart(chart, hole.n, at);
        uniforms.uLeafHole.value.set(at.x, at.z, hole.r / METRE);
      } else uniforms.uLeafHole.value.set(0, 0, 0);
      if (reduced || !(dt > 0)) {
        if (reduced) wrapLeaves(sim, focus, L.half);
        send();
        return;
      }
      // who's walking, and how fast (from where they were last frame)
      walkers.length = 0;
      tick += 1;
      for (const w of who) {
        toChart(chart, w.n, at);
        const was = seen.get(w.key);
        let vx = 0;
        let vz = 0;
        if (was) {
          vx = (at.x - was.x) / dt;
          vz = (at.z - was.z) / dt;
          if (Math.hypot(at.x - was.x, at.z - was.z) > 2 || !Number.isFinite(vx + vz)) vx = vz = 0;
          const sp = Math.hypot(vx, vz);
          if (sp > FAST) {
            vx *= FAST / sp;
            vz *= FAST / sp;
          }
          was.x = at.x;
          was.z = at.z;
          was.tick = tick;
        } else seen.set(w.key, { x: at.x, z: at.z, tick });
        walkers.push({ x: at.x, z: at.z, y: (w.h ?? 0) / METRE, vx, vz });
      }
      // (those not seen this frame forgotten)
      for (const [key, w] of seen) if (w.tick !== tick) seen.delete(key);
      const u = canopy().uniforms;
      wind.strength = u.uWindStrength.value;
      wind.dir[0] = u.uWindDir.value.x;
      wind.dir[1] = u.uWindDir.value.y;
      stepLeafSim(sim, dt, { focus, half: L.half, wind, walkers });
      // shed from the crowns round you, more in a gust
      if (spec.shed > 0 && crowns?.length) {
        const q = toLand(focus.x, focus.z, lp);
        windOffsetAt(u, q.x, q.z, off);
        shed += spec.shed * dt * (1 + (2 * Math.max(0, off.k)) / Math.max(0.05, wind.strength));
        if (shed >= 1) {
          const list = crownsIn();
          if (!list.length) shed = 0;
          for (; shed >= 1 && list.length; shed -= 1) shedLeaf(sim, list[Math.floor(rand() * list.length)], { focus, half: L.half, rand });
        }
      }
      uniforms.uLeafClock.value += dt;
      send();
    },
    // thrown out from p (on or near the ground) within r metres, at most
    // `strength` m/s; nothing with motion turned down, or out of the box
    blast(p, r, strength = LEAF.blast.strength) {
      if (!on || reduced) return 0;
      toChart(chart, p, at);
      if (!(Math.max(Math.abs(at.x - focus.x), Math.abs(at.z - focus.z)) <= L.half + r)) return 0;
      blasts.push([at.x, at.z, r, strength]);
      return blastLeaves(sim, at.x, at.z, r, strength, rand);
    },
    // a bolt at p, going v (the planet's space): through a crown in the box,
    // a few of its leaves shaken loose its way. Whether it was
    shake(p, v) {
      if (!on || reduced || !crowns?.length) return false;
      toChart(chart, p, at);
      if (!(Math.max(Math.abs(at.x - focus.x), Math.abs(at.z - focus.z)) < L.half)) return false;
      for (const c of crowns) {
        if (at.y <= c.lo || at.y >= c.hi) continue;
        fromLand(c.x, c.z, cq);
        if (Math.hypot(at.x - cq.x, at.z - cq.z) >= c.r) continue;
        const [vx, vy, vz] = of(v);
        let dx = vx * chart.e1.x + vy * chart.e1.y + vz * chart.e1.z;
        let dz = vx * chart.e2.x + vy * chart.e2.y + vz * chart.e2.z;
        const l = Math.hypot(dx, dz) || 1;
        dx /= l;
        dz /= l;
        shakeLeaves(sim, at.x, at.y, at.z, dx, dz, 6, { focus, half: L.half, rand });
        return true;
      }
      return false;
    },
    // how many there are, in the air, asleep; and (with p, a point of the
    // planet's space) how many lie within r metres of it, and where it and
    // the box's middle are on the chart
    info(p = null, r = 3) {
      let airborne = 0;
      let asleep = 0;
      let near = 0;
      const q = p && on ? toChart(chart, p, { x: 0, y: 0, z: 0 }) : null;
      for (let i = 0; i < sim.count; i++) {
        if (sim.p[4 * i + 1] > LEAF.floor + 0.005) airborne += 1;
        if (sim.rest[i]) asleep += 1;
        if (q && Math.hypot(sim.p[4 * i] - q.x, sim.p[4 * i + 2] - q.z) <= r) near += 1;
      }
      return { on, level, count: on ? sim.count : 0, half: L.half, airborne, asleep, ...(q && { near, at: [q.x, q.z], focus: [focus.x, focus.z] }) };
    },
    end() {
      on = false;
      geometry.instanceCount = 0;
      mesh.visible = false;
      crowns = null;
      seen.clear();
      blasts.length = 0;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
