// A portal a ship flies through, as the show has Rick's cruiser do it: the
// portal gun's green shot out ahead, a disc of the show's goo opening where
// it lands (settling as it opens, its lip glowing, motes of light drifting
// into its eye), the ship flying into it and sinking into the green (its
// materials clip at the gate's plane, so nothing shows past it), and the
// gate pinching shut with a flash behind it. At the far end the same thing
// the other way round: a gate opens, the ship comes out of it nose first,
// and it shuts. The universe map (universe/scene.js) and the galaxy
// (galaxy/scene.js) fly the cruiser's jumps through these, under the page's
// staged portal (components/jumps/PortalJump.jsx, timing.js stagedAt).
//
// The choreography, as numbers (pure, tested): distances in ship lengths,
// times in seconds.
//   GATE                     the numbers
//   intoAt(t)                how far along its heading the ship is, t seconds
//                            into the jump (0 at the start)
//   gateAhead()              where the entry gate stands, ahead of where the ship began
//   outAt(e)                 where the ship is, e seconds into the way out,
//                            from its parked spot along its heading (≤ 0)
//   gateOpenAt(age, shutAge) a gate `age` seconds after it began opening:
//                            { open (0…1, a little past while settling), flash, done }
//
// createGateFx({ parent }) → { open({ at, dir, radius, seed }) → gate,
//   bolt({ from, to, dur }), clip(object, gate, keep) → { release() },
//   update(dt), dispose() }
//   parent: what the gates go under (positions and directions in its space;
//     it may turn: the universe map's does). at: the gate's middle; dir: the
//     way through it (unit). gate: { shut(), age, done }.
//   clip keep: 'near' (the side the ship comes from: on the way in) or 'far'
//     (the side it comes out to: on the way out).

import * as THREE from 'three';
import { SWIRL_GLSL } from './swirl';

const V = THREE.Vector3;
const clamp01 = (k) => Math.min(1, Math.max(0, k));
const easeOut = (k) => 1 - (1 - k) ** 3;

export const GATE = {
  bolt: 0.16, // the portal gun's shot, out to where the gate opens
  opening: 0.32, // seconds a gate takes to open
  start: 0.18, // the ship sets off for the gate
  reach: 0.62, // and its nose is at it
  speed: 6, // ship lengths a second, going through
  radius: 1.05, // ship lengths: the gate's
  shutAfter: 0.12, // seconds after the ship's through that it pinches shut
  shutFor: 0.2,
  back: 2.2, // ship lengths behind its parked spot: the exit gate
  outFrom: 0.05, // seconds into the way out: the ship comes out of it
  outFor: 0.85,
  outShut: 1.0, // and the exit gate shuts
};

// (speeding up from the start till its nose is at the gate, then steady through it)
export function intoAt(t) {
  const tau = t - GATE.start;
  if (tau <= 0) return 0;
  const run = GATE.reach - GATE.start;
  const a = GATE.speed / run;
  if (t < GATE.reach) return 0.5 * a * tau * tau;
  return 0.5 * a * run * run + GATE.speed * (t - GATE.reach);
}
export const gateAhead = () => intoAt(GATE.reach) + 0.5;
// when the ship's tail is through the entry gate
export const throughAt = () => GATE.reach + 1 / GATE.speed;

export function outAt(e) {
  const from = -(GATE.back + 0.6); // (all of it behind the gate's plane)
  if (e <= GATE.outFrom) return from;
  const k = clamp01((e - GATE.outFrom) / GATE.outFor);
  return k >= 1 ? 0 : from * (1 - easeOut(k));
}

// (a little past open, then back: the goo settling, as the page's portal does)
const settle = (k) => Math.max(0, 1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2);
export function gateOpenAt(age, shutAge = null) {
  if (age <= 0) return { open: 0, flash: 0, done: false };
  let open = settle(clamp01(age / GATE.opening));
  let flash = 0;
  let done = false;
  if (shutAge != null && age > shutAge) {
    const k = clamp01((age - shutAge) / GATE.shutFor + 1e-9); // (a hair over, so its last moment is shut whatever the sum rounds to)
    open = k >= 1 ? 0 : open * (1 - k) ** 2;
    flash = k >= 1 ? 0 : Math.sin(k * Math.PI) * 0.9;
    done = k >= 1;
  }
  return { open, flash, done };
}

// ── drawn ──

const PAD = 1.22; // the disc is this much wider than the rim, for the haze
const MOTES = 36;

const discMat = () =>
  new THREE.ShaderMaterial({
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: { t: { value: 0 }, seed: { value: 0 }, open: { value: 0 }, flash: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform float t, seed, open, flash;
      varying vec2 vUv;
      ${SWIRL_GLSL}
      void main() {
        vec4 c = portal((vUv * 2.0 - 1.0) * ${PAD.toFixed(2)}, t, open, seed);
        if (c.a < 0.004) discard;
        // the lip's light all over it as it pinches shut
        c.rgb = mix(c.rgb, vec3(0.93, 1.0, 0.7) * c.a, flash);
        // (bright enough to bloom, as the show's portals glow)
        gl_FragColor = vec4(c.rgb * 1.35, c.a);
      }`,
  });

const moteTexture = () => {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.35, 'rgba(190,255,140,0.8)');
  r.addColorStop(1, 'rgba(120,255,60,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

export function createGateFx({ parent }) {
  const disc = new THREE.PlaneGeometry(1, 1);
  const moteTex = moteTexture();
  const gates = new Set();
  const bolts = new Set();
  const clips = new Set();
  const _a = new V();
  const _b = new V();
  const Z = new V(0, 0, 1);

  function open({ at, dir, radius, seed = Math.random() * 10 }) {
    const d = dir.clone().normalize();
    const mat = discMat();
    mat.uniforms.seed.value = seed;
    const mesh = new THREE.Mesh(disc, mat);
    mesh.position.copy(at);
    mesh.quaternion.setFromUnitVectors(Z, d);
    mesh.scale.setScalar(radius * 2 * PAD);
    mesh.renderOrder = 5;
    mesh.frustumCulled = false;
    parent.add(mesh);
    // motes of light round the rim, drifting in toward the eye
    const pos = new Float32Array(MOTES * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const motes = new THREE.Points(geo, new THREE.PointsMaterial({ map: moteTex, size: radius * 0.16, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#c8ff9a', toneMapped: false }));
    motes.frustumCulled = false;
    mesh.add(motes);
    motes.scale.setScalar(1 / (2 * PAD)); // (in the disc's space: the rim at 0.5)
    motes.renderOrder = 6;
    const phase = Array.from({ length: MOTES }, (_, i) => ({ a: (i / MOTES) * Math.PI * 2 + Math.random() * 0.3, k: Math.random(), s: 0.25 + Math.random() * 0.35 }));
    const gate = {
      at: at.clone(),
      dir: d,
      radius,
      age: 0,
      shutAge: null,
      done: false,
      mesh,
      motes,
      phase,
      shut() {
        if (gate.shutAge == null) gate.shutAge = Math.max(gate.age, GATE.opening * 0.5);
      },
    };
    gates.add(gate);
    return gate;
  }

  // the portal gun's shot: a green ball of light and its trail, out to where the gate opens
  function bolt({ from, to, dur = GATE.bolt }) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color('#9dff5a').multiplyScalar(3), toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    const size = from.distanceTo(to) * 0.03;
    m.scale.setScalar(Math.max(1e-4, size));
    m.position.copy(from);
    parent.add(m);
    bolts.add({ m, from: from.clone(), to: to.clone(), age: 0, dur, size });
  }

  // an object's materials clipped at a gate's plane (copies; the object's own back on release)
  function clip(object, gate, keep = 'near') {
    const plane = new THREE.Plane();
    const swapped = new Map();
    const meshes = [];
    object.traverse((o) => {
      if (!(o.isMesh || o.isPoints || o.isLine) || !o.material) return;
      const own = (m) => {
        if (!swapped.has(m)) {
          const c = m.clone();
          c.clippingPlanes = [plane];
          c.clipShadows = true;
          swapped.set(m, c);
        }
        return swapped.get(m);
      };
      meshes.push([o, o.material]);
      o.material = Array.isArray(o.material) ? o.material.map(own) : own(o.material);
    });
    const c = {
      gate,
      plane,
      keep,
      release() {
        if (!clips.has(c)) return;
        clips.delete(c);
        for (const [o, m] of meshes) o.material = m;
        for (const m of swapped.values()) m.dispose();
      },
    };
    clips.add(c);
    place(c);
    return c;
  }
  // (a clip's plane in the world, where its gate stands now: the parent may have turned)
  function place(c) {
    parent.updateWorldMatrix(true, false);
    const p = parent.localToWorld(_a.copy(c.gate.at));
    const n = _b.copy(c.gate.dir).transformDirection(parent.matrixWorld);
    if (c.keep === 'near') n.negate();
    c.plane.setFromNormalAndCoplanarPoint(n, p);
  }

  function update(dt) {
    for (const g of gates) {
      g.age += dt;
      const s = gateOpenAt(g.age, g.shutAge);
      const u = g.mesh.material.uniforms;
      u.t.value += dt;
      u.open.value = s.open;
      u.flash.value = s.flash;
      // the motes: round and in, faster near the eye, fading in with the gate
      const pos = g.motes.geometry.attributes.position;
      for (let i = 0; i < MOTES; i++) {
        const ph = g.phase[i];
        ph.k = (ph.k + dt * ph.s) % 1;
        ph.a += dt * (1.2 + 2.5 * ph.k);
        const r = 0.52 * (1 - ph.k) * Math.min(1, s.open);
        pos.setXYZ(i, Math.cos(ph.a) * r, Math.sin(ph.a) * r, 0.01);
      }
      pos.needsUpdate = true;
      g.motes.material.opacity = Math.min(1, s.open);
      if (s.done) {
        g.done = true;
        gates.delete(g);
        g.mesh.removeFromParent();
        g.mesh.material.dispose();
        g.motes.geometry.dispose();
        g.motes.material.dispose();
      }
    }
    for (const b of bolts) {
      b.age += dt;
      const k = clamp01(b.age / b.dur);
      b.m.position.lerpVectors(b.from, b.to, k);
      b.m.scale.setScalar(b.size * (1 + k));
      if (k >= 1) {
        bolts.delete(b);
        b.m.removeFromParent();
        b.m.geometry.dispose();
        b.m.material.dispose();
      }
    }
    for (const c of clips) place(c);
  }

  return {
    open,
    bolt,
    clip,
    update,
    get busy() {
      return gates.size > 0 || bolts.size > 0;
    },
    dispose() {
      for (const c of [...clips]) c.release();
      for (const g of gates) {
        g.mesh.removeFromParent();
        g.mesh.material.dispose();
        g.motes.geometry.dispose();
        g.motes.material.dispose();
      }
      gates.clear();
      for (const b of bolts) {
        b.m.removeFromParent();
        b.m.geometry.dispose();
        b.m.material.dispose();
      }
      bolts.clear();
      disc.dispose();
      moteTex?.dispose();
    },
  };
}
