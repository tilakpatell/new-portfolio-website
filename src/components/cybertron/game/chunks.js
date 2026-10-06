// The transformation. The robot and the vehicle are different models, so one
// can't be bent into the other; instead each is cut into chunks of nearby
// triangles (the same few dozen pieces every time), and when Optimus changes
// form the outgoing shape's chunks fold away, turning over in quarter turns
// and climbing a little as they go, onto the places the incoming shape's
// chunks come from, while those unfold into place: top down into the truck,
// bottom up into the robot, in under a second. It reads as armour swinging
// round and locking, the way the games' transformations do.
//
// All of it happens in the vertex shader: each vertex knows its chunk's
// centre, its partner's centre and its chunk's number (for when it moves and
// which way it turns), and the time is one uniform, so it's one draw per
// material, as the models are, whatever the chunk count.
//
//   bake(root, frame) → parts (the model's triangles where they are now,
//                       skinned ones as posed, in `frame`'s space)
//   cluster(parts, n, seed) → { ids, centres }  (which chunk each triangle is in)
//   centresOf(parts, ids, n) → centres (again, after the parts have moved)
//   pairChunks(a, b) → for each of a's chunks, one of b's
//   makeTransformer(from, to) → { group, set(t), sparks(t, out), dispose }

import * as THREE from 'three';

// ── cutting up ──

// Every visible mesh's triangles, flattened (no index), where they are drawn
// right now (a skinned mesh as its bones hold it), in `frame`'s space.
export function bake(root, frame) {
  root.updateMatrixWorld(true);
  frame.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(frame.matrixWorld).invert();
  const m = new THREE.Matrix4();
  const v = new THREE.Vector3();
  const parts = [];
  root.traverse((o) => {
    if (!o.isMesh || !o.visible || !o.geometry?.attributes?.position) return;
    if (o.isSkinnedMesh) o.skeleton.update();
    const g = o.geometry;
    const index = g.index;
    const count = index ? index.count : g.attributes.position.count;
    const uv = g.attributes.uv;
    const positions = new Float32Array(count * 3);
    const uvs = uv ? new Float32Array(count * 2) : null;
    m.multiplyMatrices(inv, o.matrixWorld);
    for (let k = 0; k < count; k++) {
      const i = index ? index.getX(k) : k;
      o.getVertexPosition(i, v).applyMatrix4(m);
      positions[k * 3] = v.x;
      positions[k * 3 + 1] = v.y;
      positions[k * 3 + 2] = v.z;
      if (uvs) {
        uvs[k * 2] = uv.getX(i);
        uvs[k * 2 + 1] = uv.getY(i);
      }
    }
    const material = Array.isArray(o.material) ? o.material[0] : o.material;
    parts.push({ positions, uvs, material, triangles: count / 3 });
  });
  return parts;
}

const triCentre = (p, t, out) => {
  const i = t * 9;
  out[0] = (p[i] + p[i + 3] + p[i + 6]) / 3;
  out[1] = (p[i + 1] + p[i + 4] + p[i + 7]) / 3;
  out[2] = (p[i + 2] + p[i + 5] + p[i + 8]) / 3;
  return out;
};

const seeded = (seed) => {
  let s = seed >>> 0 || 1;
  return () => ((s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0) / 4294967296);
};

// k-means on the triangles' centres: which chunk each triangle is in (per
// part), and where each chunk's middle is. Seeded, so the same model is cut
// the same way every time.
export function cluster(parts, n, seed = 1) {
  const all = [];
  const c = [0, 0, 0];
  for (const [pi, part] of parts.entries()) for (let t = 0; t < part.triangles; t++) all.push([pi, t, ...triCentre(part.positions, t, c)]);
  const k = Math.max(1, Math.min(n, all.length));
  const rand = seeded(seed);
  // spread the first guesses: each next one the farthest of a few picked at random
  const centres = new Float32Array(k * 3);
  const first = all[Math.floor(rand() * all.length)];
  centres.set(first.slice(2), 0);
  for (let j = 1; j < k; j++) {
    let best = null;
    let bestD = -1;
    for (let tries = 0; tries < 24; tries++) {
      const cand = all[Math.floor(rand() * all.length)];
      let near = Infinity;
      for (let q = 0; q < j; q++) near = Math.min(near, (cand[2] - centres[q * 3]) ** 2 + (cand[3] - centres[q * 3 + 1]) ** 2 + (cand[4] - centres[q * 3 + 2]) ** 2);
      if (near > bestD) {
        bestD = near;
        best = cand;
      }
    }
    centres.set(best.slice(2), j * 3);
  }
  const assign = new Uint16Array(all.length);
  for (let iter = 0; iter < 5; iter++) {
    for (let a = 0; a < all.length; a++) {
      const [, , x, y, z] = all[a];
      let best = 0;
      let bestD = Infinity;
      for (let q = 0; q < k; q++) {
        const d = (x - centres[q * 3]) ** 2 + (y - centres[q * 3 + 1]) ** 2 + (z - centres[q * 3 + 2]) ** 2;
        if (d < bestD) {
          bestD = d;
          best = q;
        }
      }
      assign[a] = best;
    }
    const sum = new Float64Array(k * 3);
    const num = new Uint32Array(k);
    for (let a = 0; a < all.length; a++) {
      const q = assign[a];
      sum[q * 3] += all[a][2];
      sum[q * 3 + 1] += all[a][3];
      sum[q * 3 + 2] += all[a][4];
      num[q] += 1;
    }
    for (let q = 0; q < k; q++) if (num[q]) for (let r = 0; r < 3; r++) centres[q * 3 + r] = sum[q * 3 + r] / num[q];
  }
  const ids = parts.map((p) => new Uint16Array(p.triangles));
  for (let a = 0; a < all.length; a++) ids[all[a][0]][all[a][1]] = assign[a];
  return { ids, centres, n: k };
}

// Each chunk's middle, from where its triangles are now
export function centresOf(parts, ids, n) {
  const sum = new Float64Array(n * 3);
  const num = new Uint32Array(n);
  const c = [0, 0, 0];
  for (const [pi, part] of parts.entries())
    for (let t = 0; t < part.triangles; t++) {
      const q = ids[pi][t];
      triCentre(part.positions, t, c);
      sum[q * 3] += c[0];
      sum[q * 3 + 1] += c[1];
      sum[q * 3 + 2] += c[2];
      num[q] += 1;
    }
  const out = new Float32Array(n * 3);
  for (let q = 0; q < n; q++) if (num[q]) for (let r = 0; r < 3; r++) out[q * 3 + r] = sum[q * 3 + r] / num[q];
  return out;
}

// The order chunks fold in: in bands from the top down, front to back in each
const order = (centres) => {
  const n = centres.length / 3;
  let lo = Infinity;
  let hi = -Infinity;
  for (let q = 0; q < n; q++) {
    lo = Math.min(lo, centres[q * 3 + 1]);
    hi = Math.max(hi, centres[q * 3 + 1]);
  }
  const band = (q) => Math.floor(((hi - centres[q * 3 + 1]) / Math.max(1e-6, hi - lo)) * 6 - 1e-9);
  return Array.from({ length: n }, (_, q) => q).sort((a, b) => band(a) - band(b) || centres[b * 3 + 2] - centres[a * 3 + 2] || centres[b * 3 + 1] - centres[a * 3 + 1] || a - b);
};

// For each chunk of `a`, the chunk of `b` it trades places with: both put in
// the same order (top to bottom, front to back), then matched along it
export function pairChunks(a, b) {
  const oa = order(a);
  const ob = order(b);
  const out = new Uint16Array(oa.length);
  oa.forEach((q, i) => (out[q] = ob[Math.min(ob.length - 1, Math.floor((i * ob.length) / oa.length))]));
  return out;
}

// ── the shader ──

const PARS = /* glsl */ `
attribute vec3 aCentre;
attribute vec3 aPartner;
attribute float aChunk;
attribute float aDelay;
uniform float uT;
uniform float uLeaving;
uniform float uDur;
uniform float uLift;
vec3 cyRotate(vec3 v, vec3 axis, float a) {
  float c = cos(a);
  float s = sin(a);
  return v * c + cross(axis, v) * s + axis * dot(axis, v) * (1.0 - c);
}
float cyHash(float n) { return fract(sin(n * 12.9898 + 78.233) * 43758.5453); }
// how far through its own move this chunk is: 0 where it belongs, 1 at its
// partner's place (folded away)
float cyK() {
  float k = clamp((uT - aDelay) / uDur, 0.0, 1.0);
  k = k * k * (3.0 - 2.0 * k);
  return uLeaving > 0.5 ? k : 1.0 - k;
}
vec3 cyAxis() {
  vec3 a = vec3(cyHash(aChunk), cyHash(aChunk + 3.1), cyHash(aChunk + 7.7)) - 0.5;
  // mostly about the level axes, as armour swings on hinges
  a.y *= 0.4;
  return normalize(a + vec3(1e-4));
}
float cyAngle(float k) {
  float turns = 1.0 + floor(cyHash(aChunk + 1.3) * 3.0); // one to three quarter turns
  return k * turns * 1.5707963 * (cyHash(aChunk + 9.1) < 0.5 ? -1.0 : 1.0);
}
`;

function shaderFor(material, uniforms) {
  const m = material.clone();
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${PARS}`)
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
        objectNormal = cyRotate(objectNormal, cyAxis(), cyAngle(cyK()));`,
      )
      .replace(
        '#include <begin_vertex>',
        `float cyk = cyK();
        vec3 cyLocal = cyRotate(position - aCentre, cyAxis(), cyAngle(cyk));
        // a chunk shrinks a little as it folds, and goes once it's home
        cyLocal *= mix(1.0, 0.45, cyk) * (1.0 - smoothstep(0.86, 1.0, cyk));
        vec3 cyAt = mix(aCentre, aPartner, cyk) + vec3(0.0, uLift * sin(cyk * 3.14159), 0.0);
        vec3 transformed = cyAt + cyLocal;`,
      );
  };
  m.customProgramCacheKey = () => 'cy-chunks';
  m.side = THREE.DoubleSide;
  return m;
}

// The meshes of one form, chunked, wired to fold toward `partner` centres
function meshesOf(form, partners, partnerCentres, uniforms, leaving, frame) {
  const group = new THREE.Group();
  const { parts, ids, centres } = form;
  // which way the order runs: the truck forms top down, the robot bottom up
  let lo = Infinity;
  let hi = -Infinity;
  for (let q = 0; q < centres.length / 3; q++) {
    lo = Math.min(lo, centres[q * 3 + 1]);
    hi = Math.max(hi, centres[q * 3 + 1]);
  }
  const span = Math.max(1e-6, hi - lo);
  for (const [pi, part] of parts.entries()) {
    const n = part.triangles * 3;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(part.positions, 3));
    if (part.uvs) g.setAttribute('uv', new THREE.BufferAttribute(part.uvs, 2));
    const centre = new Float32Array(n * 3);
    const partner = new Float32Array(n * 3);
    const chunk = new Float32Array(n);
    const delay = new Float32Array(n);
    for (let t = 0; t < part.triangles; t++) {
      const q = ids[pi][t];
      const p = partners[q];
      const height = (centres[q * 3 + 1] - lo) / span;
      // the outgoing shape goes first, the incoming one after; each in its order
      const d = leaving ? (frame === 'vehicle' ? height : 1 - height) * 0.42 : 0.3 + (frame === 'vehicle' ? 1 - height : height) * 0.3;
      for (let v = 0; v < 3; v++) {
        const at = t * 3 + v;
        centre.set([centres[q * 3], centres[q * 3 + 1], centres[q * 3 + 2]], at * 3);
        partner.set([partnerCentres[p * 3], partnerCentres[p * 3 + 1], partnerCentres[p * 3 + 2]], at * 3);
        chunk[at] = q + (leaving ? 0 : 500);
        delay[at] = d;
      }
    }
    g.setAttribute('aCentre', new THREE.BufferAttribute(centre, 3));
    g.setAttribute('aPartner', new THREE.BufferAttribute(partner, 3));
    g.setAttribute('aChunk', new THREE.BufferAttribute(chunk, 1));
    g.setAttribute('aDelay', new THREE.BufferAttribute(delay, 1));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    // (its bounds as it moves: everywhere between the two shapes)
    g.boundingSphere.radius *= 2.5;
    const mesh = new THREE.Mesh(g, shaderFor(part.material, uniforms));
    mesh.frustumCulled = false;
    group.add(mesh);
  }
  return group;
}

// One run of the change, from one form to the other. `from` and `to` are
// { parts, ids, centres } (bake, then cluster); `to.kind` is 'vehicle' or
// 'robot' (which way the order runs). set(t) with t from 0 (all `from`) to 1
// (all `to`).
export function makeTransformer(from, to, { lift = 1.6 } = {}) {
  const there = pairChunks(from.centres, to.centres);
  const back = pairChunks(to.centres, from.centres);
  const out = { uT: { value: 0 }, uLeaving: { value: 1 }, uDur: { value: 0.42 }, uLift: { value: lift } };
  const inn = { uT: out.uT, uLeaving: { value: 0 }, uDur: out.uDur, uLift: out.uLift };
  const group = new THREE.Group();
  const leaving = meshesOf(from, there, to.centres, out, true, to.kind);
  const arriving = meshesOf(to, back, from.centres, inn, false, to.kind);
  group.add(leaving, arriving);
  const sparks = [];
  for (let q = 0; q < from.centres.length / 3; q++) sparks.push([from.centres[q * 3], from.centres[q * 3 + 1], from.centres[q * 3 + 2], there[q]]);
  return {
    group,
    set(t) {
      out.uT.value = Math.max(0, Math.min(1, t));
    },
    // where some chunks are mid-flight (for the sparks): fills `out` with
    // [x, y, z] in the transformer's space, returns how many
    sparks(t, into, max = 8) {
      let n = 0;
      for (let i = 0; i < sparks.length && n < max; i += Math.max(1, Math.floor(sparks.length / max))) {
        const [x, y, z, p] = sparks[i];
        const k = Math.max(0, Math.min(1, (t - 0.2) / 0.5));
        if (k <= 0 || k >= 1) continue;
        into[n] = into[n] ?? new THREE.Vector3();
        into[n++].set(x + (to.centres[p * 3] - x) * k, y + (to.centres[p * 3 + 1] - y) * k + lift * Math.sin(k * Math.PI), z + (to.centres[p * 3 + 2] - z) * k);
      }
      return n;
    },
    dispose() {
      group.traverse((o) => {
        if (!o.isMesh) return;
        o.geometry.dispose();
        o.material.dispose();
      });
    },
  };
}
