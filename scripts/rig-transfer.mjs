// Rigs a new figure on the crew's skeleton by moving a rigged donor's skin
// weights onto it: old Ben (scripts/meshy-deathstar.mjs) came out of Meshy
// unrigged, and the account had no credits left for Meshy's rig. The donor
// is a crew figure of the same build in the same A-pose (jedi3, the crew's
// old robed man), so each vertex of the new mesh, stood in the donor's place
// at the donor's height, takes the weights of the donor's surface nearest
// it. The donor's own skeleton, bind matrices and all, is kept unchanged,
// so every clip made for the crew plays on the new figure as on the donor.
//
//   node scripts/rig-transfer.mjs <donor.glb> <mesh.glb> <out.glb> [--tex 2048]
//
// The new mesh comes unrigged. One rigged some other way (C-3PO, on
// Mixamo's bones, whose exporter leans on three.js's way of binding a skin)
// is first baked where three.js stands it at rest: in a page, each skinned
// mesh's getVertexPosition put through its localToWorld, the meshes
// exported with GLTFExporter. C-3PO's was baked so from
// public/models/galaxy/surface/c3po.glb, and rigged from the officer.
//
//   transferWeights(donor, target, { k, turn }) → { joints, weights }   pure
//     donor: { positions, normals?, joints, weights } (flat arrays, 3 and 4 a vertex) in one space;
//     target: { positions, normals? } in the same space; k: donor points blended for each vertex;
//     turn: how much more a donor point facing away from the vertex counts as far (the inside of
//     one thigh isn't the other thigh). Each vertex gets at most four joints, summing to one.
//   smoothWeights({ joints, weights }, index, n, { passes, amount, same? }) → { joints, weights }
//     each vertex `amount` of the way to its neighbours' mean along the mesh's edges (and, given
//     `same`, a list of vertex groups at one place, those groups made one), `passes` times
//   fitTo(positions, box) → positions   pure: a copy scaled to box's height, its feet on box's floor,
//     centred over box's middle
//   rigFrom(donorFile, meshFile, outFile, { tex }) → { tris, joints, spread }   the whole job;
//     spread: how far apart the donor's bind matrices put a vertex (0 when they agree, as they must)

import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MOST = 4; // joints a vertex keeps
const EPS = 1e-10;

// the k nearest of the donor's points to (x, y, z), by distance squared,
// a point facing away from `n` counted `turn` times as far again
function nearest(donor, x, y, z, nx, ny, nz, k, turn, best, bestD) {
  const p = donor.positions;
  const dn = donor.normals;
  const count = p.length / 3;
  let filled = 0;
  for (let i = 0; i < count; i++) {
    const dx = p[i * 3] - x;
    const dy = p[i * 3 + 1] - y;
    const dz = p[i * 3 + 2] - z;
    let d = dx * dx + dy * dy + dz * dz;
    if (dn && nx !== null) {
      const dot = dn[i * 3] * nx + dn[i * 3 + 1] * ny + dn[i * 3 + 2] * nz;
      if (dot < 0) d *= 1 - turn * dot;
    }
    if (filled < k) {
      // insertion into the sorted list
      let j = filled++;
      while (j > 0 && bestD[j - 1] > d) {
        bestD[j] = bestD[j - 1];
        best[j] = best[j - 1];
        j--;
      }
      bestD[j] = d;
      best[j] = i;
    } else if (d < bestD[k - 1]) {
      let j = k - 1;
      while (j > 0 && bestD[j - 1] > d) {
        bestD[j] = bestD[j - 1];
        best[j] = best[j - 1];
        j--;
      }
      bestD[j] = d;
      best[j] = i;
    }
  }
  return filled;
}

// a vertex's joint → weight, cut to the heaviest MOST and summed to one, written at vertex v
function keep(acc, v, joints, weights) {
  const top = [...acc.entries()].filter(([, w]) => w > 0).sort((a, b) => b[1] - a[1]).slice(0, MOST);
  const sum = top.reduce((s, [, w]) => s + w, 0) || 1;
  for (let k = 0; k < MOST; k++) {
    joints[v * 4 + k] = top[k]?.[0] ?? 0;
    weights[v * 4 + k] = top[k] ? top[k][1] / sum : 0;
  }
}

export function transferWeights(donor, target, { k = 8, turn = 9 } = {}) {
  const tp = target.positions;
  const tn = target.normals ?? null;
  const n = tp.length / 3;
  const joints = new Uint16Array(n * 4);
  const weights = new Float32Array(n * 4);
  const best = new Int32Array(k);
  const bestD = new Float64Array(k);
  const acc = new Map();
  for (let v = 0; v < n; v++) {
    const got = nearest(donor, tp[v * 3], tp[v * 3 + 1], tp[v * 3 + 2], tn ? tn[v * 3] : null, tn ? tn[v * 3 + 1] : 0, tn ? tn[v * 3 + 2] : 0, k, turn, best, bestD);
    acc.clear();
    for (let j = 0; j < got; j++) {
      const i = best[j];
      // inverse-square: the nearest point leads, the rest blend a seam
      const w = 1 / (bestD[j] + EPS);
      for (let s = 0; s < 4; s++) {
        const wj = donor.weights[i * 4 + s];
        if (wj > 0) acc.set(donor.joints[i * 4 + s], (acc.get(donor.joints[i * 4 + s]) ?? 0) + w * wj);
      }
    }
    keep(acc, v, joints, weights);
  }
  return { joints, weights };
}

export function smoothWeights({ joints, weights }, index, n, { passes = 2, amount = 0.5, same = null } = {}) {
  const near = Array.from({ length: n }, () => new Set());
  for (let t = 0; t + 2 < index.length; t += 3) {
    const [a, b, c] = [index[t], index[t + 1], index[t + 2]];
    near[a].add(b).add(c);
    near[b].add(a).add(c);
    near[c].add(a).add(b);
  }
  // (vertices at one place, a seam's twins, are one vertex to the weights)
  if (same) {
    for (const group of same) {
      const all = new Set();
      for (const v of group) for (const u of near[v]) all.add(u);
      for (const v of group) for (const u of all) if (u !== v) near[v].add(u);
    }
  }
  let J = joints;
  let W = weights;
  const mapOf = (v) => {
    const m = new Map();
    for (let s = 0; s < 4; s++) if (W[v * 4 + s] > 0) m.set(J[v * 4 + s], (m.get(J[v * 4 + s]) ?? 0) + W[v * 4 + s]);
    return m;
  };
  for (let pass = 0; pass < passes; pass++) {
    const nj = new Uint16Array(n * 4);
    const nw = new Float32Array(n * 4);
    for (let v = 0; v < n; v++) {
      const acc = new Map();
      for (const [j, w] of mapOf(v)) acc.set(j, (1 - amount) * w);
      const ns = near[v];
      if (ns.size) {
        const share = amount / ns.size;
        for (const u of ns) for (const [j, w] of mapOf(u)) acc.set(j, (acc.get(j) ?? 0) + share * w);
      } else for (const [j, w] of mapOf(v)) acc.set(j, w);
      keep(acc, v, nj, nw);
    }
    J = nj;
    W = nw;
  }
  // a seam's twins end exactly alike, so the seam can't open as the figure moves
  if (same) {
    for (const group of same) {
      if (group.length < 2) continue;
      const acc = new Map();
      for (const v of group) for (const [j, w] of mapOf(v)) acc.set(j, (acc.get(j) ?? 0) + w);
      for (const v of group) keep(acc, v, J, W);
    }
  }
  return { joints: J, weights: W };
}

function boxOf(p) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) {
    for (let a = 0; a < 3; a++) {
      if (p[i + a] < min[a]) min[a] = p[i + a];
      if (p[i + a] > max[a]) max[a] = p[i + a];
    }
  }
  return { min, max };
}

export function fitTo(positions, box) {
  const b = boxOf(positions);
  const k = (box.max[1] - box.min[1]) / Math.max(EPS, b.max[1] - b.min[1]);
  const mid = (bb, a) => (bb.min[a] + bb.max[a]) / 2;
  const out = new Float32Array(positions.length);
  for (let i = 0; i < positions.length; i += 3) {
    out[i] = (positions[i] - mid(b, 0)) * k + mid(box, 0);
    out[i + 1] = (positions[i + 1] - b.min[1]) * k + box.min[1];
    out[i + 2] = (positions[i + 2] - mid(b, 2)) * k + mid(box, 2);
  }
  return out;
}

// ── matrices (glTF's column-major 4 × 4) ──

function mul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
const point = (m, x, y, z) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
const dir = (m, x, y, z) => [m[0] * x + m[4] * y + m[8] * z, m[1] * x + m[5] * y + m[9] * z, m[2] * x + m[6] * y + m[10] * z];
function invert(m) {
  // (affine: the 3 × 3 inverted, the translation carried through it)
  const [a, b, c, d, e, f, g, h, i] = [m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]];
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  const r = [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, -(a * f - c * d) / det, C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
  const t = [m[12], m[13], m[14]];
  const tx = -(r[0] * t[0] + r[3] * t[1] + r[6] * t[2]);
  const ty = -(r[1] * t[0] + r[4] * t[1] + r[7] * t[2]);
  const tz = -(r[2] * t[0] + r[5] * t[1] + r[8] * t[2]);
  return [r[0], r[1], r[2], 0, r[3], r[4], r[5], 0, r[6], r[7], r[8], 0, tx, ty, tz, 1];
}
// ── quaternions ([x, y, z, w]) ──

const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qinv = (q) => [-q[0], -q[1], -q[2], q[3]];
const qaxis = (ax, ang) => [ax[0] * Math.sin(ang / 2), ax[1] * Math.sin(ang / 2), ax[2] * Math.sin(ang / 2), Math.cos(ang / 2)];
// a matrix's turn, its columns' scale taken out
function qof(m) {
  const sx = Math.hypot(m[0], m[1], m[2]);
  const sy = Math.hypot(m[4], m[5], m[6]);
  const sz = Math.hypot(m[8], m[9], m[10]);
  const [a, b, c, d, e, f, g, h, i] = [m[0] / sx, m[1] / sx, m[2] / sx, m[4] / sy, m[5] / sy, m[6] / sy, m[8] / sz, m[9] / sz, m[10] / sz];
  // (column-major: a b c is the first column)
  const tr = a + e + i;
  let q;
  if (tr > 0) {
    const k = 0.5 / Math.sqrt(tr + 1);
    q = [(f - h) * k, (g - c) * k, (b - d) * k, 0.25 / k];
  } else if (a > e && a > i) {
    const k = 2 * Math.sqrt(1 + a - e - i);
    q = [0.25 * k, (d + b) / k, (g + c) / k, (f - h) / k];
  } else if (e > i) {
    const k = 2 * Math.sqrt(1 + e - a - i);
    q = [(d + b) / k, 0.25 * k, (h + f) / k, (g - c) / k];
  } else {
    const k = 2 * Math.sqrt(1 + i - a - e);
    q = [(g + c) / k, (h + f) / k, 0.25 * k, (b - d) / k];
  }
  const l = Math.hypot(...q);
  return q.map((v) => v / l);
}

const unit = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

// ── the job ──

let kit = null;
async function tools() {
  if (!kit) {
    const [{ NodeIO }, { ALL_EXTENSIONS }, f, { MeshoptDecoder, MeshoptEncoder }] = await Promise.all([import('@gltf-transform/core'), import('@gltf-transform/extensions'), import('@gltf-transform/functions'), import('meshoptimizer')]);
    const require = createRequire(import.meta.url);
    // (glTF-Transform’s own sharp: two libvips in one process break textures on Windows)
    const sharp = createRequire(require.resolve('ndarray-pixels'))('sharp');
    await MeshoptEncoder.ready;
    await MeshoptDecoder.ready;
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
    kit = { io, f, MeshoptEncoder, sharp };
  }
  return kit;
}

// a primitive's attribute as plain floats (quantized or not)
function floats(acc) {
  const n = acc.getCount();
  const size = acc.getElementSize();
  const out = new Float32Array(n * size);
  const el = [];
  for (let i = 0; i < n; i++) out.set(acc.getElement(i, el), i * size);
  return out;
}

// The donor's surface in its bind pose, in the space its skin works in
// (joint world × inverse bind), with each vertex's joints and weights.
function donorSurface(skinNode, ibms = null) {
  const skin = skinNode.getSkin();
  const joints = skin.listJoints();
  const ibm = skin.getInverseBindMatrices();
  const mats = joints.map((j, i) => mul(j.getWorldMatrix(), ibms?.[i] ?? ibm.getElement(i, [])));
  // they agree for a skin at rest; how far they don't, at a metre out, is the check
  let spread = 0;
  for (const m of mats) for (const [x, y, z] of [[1, 1, 1], [-1, 0.5, 0]]) {
    const a = point(mats[0], x, y, z);
    const b = point(m, x, y, z);
    spread = Math.max(spread, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
  }
  const parts = { positions: [], normals: [], joints: [], weights: [] };
  for (const prim of skinNode.getMesh().listPrimitives()) {
    const p = floats(prim.getAttribute('POSITION'));
    const nrm = prim.getAttribute('NORMAL') ? floats(prim.getAttribute('NORMAL')) : null;
    const J = floats(prim.getAttribute('JOINTS_0'));
    const W = floats(prim.getAttribute('WEIGHTS_0'));
    for (let v = 0; v < p.length / 3; v++) {
      const at = [0, 0, 0];
      const nn = [0, 0, 0];
      let sum = 0;
      for (let s = 0; s < 4; s++) {
        const w = W[v * 4 + s];
        if (!(w > 0)) continue;
        sum += w;
        const m = mats[J[v * 4 + s]];
        const q = point(m, p[v * 3], p[v * 3 + 1], p[v * 3 + 2]);
        for (let a = 0; a < 3; a++) at[a] += q[a] * w;
        if (nrm) {
          const d = dir(m, nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]);
          for (let a = 0; a < 3; a++) nn[a] += d[a] * w;
        }
      }
      parts.positions.push(...at.map((c) => c / (sum || 1)));
      parts.normals.push(...unit(nn));
      for (let s = 0; s < 4; s++) {
        parts.joints.push(J[v * 4 + s]);
        parts.weights.push(W[v * 4 + s] / (sum || 1));
      }
    }
  }
  return {
    mats,
    spread,
    surface: { positions: new Float32Array(parts.positions), normals: new Float32Array(parts.normals), joints: new Uint16Array(parts.joints), weights: new Float32Array(parts.weights) },
  };
}

// The donor's arms turned up (or down) to the new figure's and stretched to
// its reach: from each arm's joint, the angle below level and the distance
// to the hand, the donor's to its hand joint and a hand's length on, the
// new figure's to the vertex furthest out on that side. Each arm is turned
// in the world about the figure's forward axis, so its local turn changes
// and nothing below it does; its forearm and hand are moved out along
// their bones by the reach's ratio.
const HAND = 0.17; // of the shoulder-to-wrist length: how far the fingertips reach past the wrist
function matchArms(skinNode, fitted) {
  const byName = new Map(skinNode.getSkin().listJoints().map((j) => [j.getName(), j]));
  const at = (n) => {
    const m = byName.get(n).getWorldMatrix();
    return [m[12], m[13], m[14]];
  };
  const out = {};
  for (const [side, sign] of [['Left', 1], ['Right', -1]]) {
    const arm = byName.get(`${side}Arm`);
    const fore = byName.get(`${side}ForeArm`);
    const hand = byName.get(`${side}Hand`);
    if (!arm || !fore || !hand) continue;
    const a = at(`${side}Arm`);
    const h = at(`${side}Hand`);
    const wrist = Math.hypot(h[0] - a[0], h[1] - a[1], h[2] - a[2]);
    // the new figure's fingertips: its furthest vertex out on this side
    let tip = null;
    for (let v = 0; v < fitted.length / 3; v++) {
      const x = fitted[v * 3] * sign;
      if (!tip || x > tip[0] * sign) tip = [fitted[v * 3], fitted[v * 3 + 1], fitted[v * 3 + 2]];
    }
    const below = (p) => Math.atan2(a[1] - p[1], Math.abs(p[0] - a[0]));
    const turn = below(h) - below(tip);
    const reach = Math.hypot(tip[0] - a[0], tip[1] - a[1], tip[2] - a[2]) / (wrist * (1 + HAND));
    const stretch = Math.min(1.4, Math.max(0.8, reach));
    // turned in the world about +z: the left arm (on +x) up is anticlockwise, the right clockwise
    const P = qof(arm.getParentNode().getWorldMatrix());
    const r = qaxis([0, 0, 1], sign * turn);
    arm.setRotation(qmul(qmul(qmul(qinv(P), r), P), arm.getRotation()));
    for (const n of [fore, hand]) n.setTranslation(n.getTranslation().map((c) => c * stretch));
    out[side] = { turn: +((turn * 180) / Math.PI).toFixed(1), stretch: +stretch.toFixed(3) };
  }
  return out;
}

// Loose cloth (a cloak's hem, a robe's skirt) hangs from the hips, not the
// legs: a vertex weighted to a leg but further than SKIN from that leg's
// bones hands part of the leg's weight to the hips, up to LOOSE of it by
// SKIN + FALL out, so a stride doesn't tear a long coat apart.
const SKIN = 0.11; // metres from the bone: as far as a trouser leg goes
const FALL = 0.16; // metres more over which the hand-over grows
const LOOSE = 0.75; // the most of a leg's weight handed over
const LEGS = ['UpLeg', 'Leg', 'Foot', 'ToeBase'];
export function loosen(positions, { joints, weights }, bones) {
  const seg = (p, a, b) => {
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1] + (p[2] - a[2]) * ab[2]) / (ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2 || 1)));
    return Math.hypot(p[0] - a[0] - ab[0] * t, p[1] - a[1] - ab[1] * t, p[2] - a[2] - ab[2] * t);
  };
  const hips = bones.index.Hips;
  const leg = new Map();
  for (const side of ['Left', 'Right']) {
    const chain = LEGS.map((n) => bones.at[`${side}${n}`]);
    for (const n of LEGS) leg.set(bones.index[`${side}${n}`], chain);
  }
  for (let v = 0; v < positions.length / 3; v++) {
    const p = [positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]];
    for (let s = 0; s < 4; s++) {
      const chain = leg.get(joints[v * 4 + s]);
      const w = weights[v * 4 + s];
      if (!chain || !(w > 0)) continue;
      let d = Infinity;
      for (let i = 0; i + 1 < chain.length; i++) if (chain[i] && chain[i + 1]) d = Math.min(d, seg(p, chain[i], chain[i + 1]));
      const k = LOOSE * Math.max(0, Math.min(1, (d - SKIN) / FALL));
      if (!(k > 0)) continue;
      weights[v * 4 + s] = w * (1 - k);
      // onto the hips' slot, or the lightest slot if the hips have none
      let h = -1;
      for (let t = 0; t < 4; t++) if (joints[v * 4 + t] === hips && weights[v * 4 + t] > 0) h = t;
      if (h < 0) {
        h = 0;
        for (let t = 1; t < 4; t++) if (weights[v * 4 + t] < weights[v * 4 + h]) h = t;
        if (h === s) continue;
        if (weights[v * 4 + h] > 0) weights[v * 4 + s] += weights[v * 4 + h];
        joints[v * 4 + h] = hips;
        weights[v * 4 + h] = 0;
      }
      weights[v * 4 + h] += w * k;
    }
  }
  return { joints, weights };
}

// groups of vertices at one place (to a tenth of a millimetre)
function twins(p) {
  const by = new Map();
  for (let v = 0; v < p.length / 3; v++) {
    const key = `${Math.round(p[v * 3] * 1e4)},${Math.round(p[v * 3 + 1] * 1e4)},${Math.round(p[v * 3 + 2] * 1e4)}`;
    if (!by.has(key)) by.set(key, []);
    by.get(key).push(v);
  }
  return [...by.values()].filter((g) => g.length > 1);
}

export async function rigFrom(donorFile, meshFile, outFile, { tex = 2048 } = {}) {
  const { io, f, MeshoptEncoder, sharp } = await tools();
  const doc = await io.read(donorFile);
  await doc.transform(f.dequantize());
  const root = doc.getRoot();
  const skinNode = root.listNodes().find((n) => n.getSkin() && n.getMesh());
  if (!skinNode) throw new Error(`${donorFile}: no skinned mesh`);
  const skin = skinNode.getSkin();
  const ibmOld = skin.listJoints().map((_, i) => skin.getInverseBindMatrices().getElement(i, []));
  const { spread, surface: atRest } = donorSurface(skinNode);

  const src = await io.read(meshFile);
  await src.transform(f.dequantize());
  // every primitive of the new mesh, in its scene's space (a mesh rigged
  // some other way is baked at rest first: see the header)
  const prims = [];
  for (const node of src.getRoot().listNodes()) {
    if (!node.getMesh()) continue;
    if (node.getSkin()) throw new Error(`${meshFile}: ${node.getName()} is skinned; bake it at rest first`);
    const w = node.getWorldMatrix();
    for (const prim of node.getMesh().listPrimitives()) {
      const p = floats(prim.getAttribute('POSITION'));
      const nrm = prim.getAttribute('NORMAL') ? floats(prim.getAttribute('NORMAL')) : null;
      for (let v = 0; v < p.length / 3; v++) {
        p.set(point(w, p[v * 3], p[v * 3 + 1], p[v * 3 + 2]), v * 3);
        if (nrm) nrm.set(unit(dir(w, nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2])), v * 3);
      }
      prims.push({ prim, p, nrm });
    }
  }
  // one box over all of them, fitted to the donor's
  const all = new Float32Array(prims.reduce((s, q) => s + q.p.length, 0));
  let o = 0;
  for (const q of prims) {
    all.set(q.p, o);
    o += q.p.length;
  }
  // the donor's arms raised and lengthened to the new figure's, and the skin bound there
  const arms = matchArms(skinNode, fitTo(all, boxOf(atRest.positions)));
  const { surface } = donorSurface(skinNode, ibmOld);
  const fitted = fitTo(all, boxOf(surface.positions));
  const ibmAcc = skin.getInverseBindMatrices();
  const ibmNew = new Float32Array(skin.listJoints().length * 16);
  skin.listJoints().forEach((j, i) => ibmNew.set(invert(j.getWorldMatrix()), i * 16));
  ibmAcc.setArray(ibmNew);
  // where each joint stands now, by name, and its place in the skin
  const bones = { at: {}, index: {} };
  skin.listJoints().forEach((j, i) => {
    const m = j.getWorldMatrix();
    bones.at[j.getName()] = [m[12], m[13], m[14]];
    bones.index[j.getName()] = i;
  });

  // (the donor's scene, before the merge brings the new mesh's in beside it)
  const keepScene = root.getDefaultScene() ?? root.listScenes()[0];
  const map = f.mergeDocuments ? f.mergeDocuments(doc, src) : null;
  if (!map) throw new Error('glTF-Transform lacks mergeDocuments');
  const mesh = skinNode.getMesh();
  for (const old of mesh.listPrimitives()) old.dispose();
  const buffer = root.listBuffers()[0];
  let tris = 0;
  o = 0;
  for (const q of prims) {
    const n = q.p.length / 3;
    const here = fitted.subarray(o, o + q.p.length);
    o += q.p.length;
    const index = q.prim.getIndices() ? Uint32Array.from(floats(q.prim.getIndices())) : Uint32Array.from({ length: n }, (_, i) => i);
    tris += index.length / 3;
    const first = transferWeights(surface, { positions: here, normals: q.nrm });
    const same = twins(here);
    const smooth = smoothWeights(first, index, n, { passes: 2, amount: 0.5, same });
    const { joints, weights } = smoothWeights(loosen(here, smooth, bones), index, n, { passes: 1, amount: 0.4, same });
    const prim = map.get(q.prim);
    // (bound where the skeleton now stands, each joint's inverse bind its own world's inverse, so
    // the mesh is in the scene's own space)
    const pos = Float32Array.from(here);
    const nrm = q.nrm ? Float32Array.from(q.nrm) : null;
    const acc = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
    prim.setAttribute('POSITION', acc('VEC3', pos));
    if (nrm) prim.setAttribute('NORMAL', acc('VEC3', nrm));
    prim.setAttribute('JOINTS_0', acc('VEC4', joints));
    prim.setAttribute('WEIGHTS_0', acc('VEC4', weights));
    mesh.addPrimitive(prim);
  }
  // the new mesh's own scene and nodes came along in the merge: let them go
  // (its nodes and meshes by name, not left to prune: a tree of them off
  // every scene survives it, and its meshes, sharing the parts now on the
  // donor's, would be quantized each in a box of its own)
  for (const node of src.getRoot().listNodes()) map.get(node)?.dispose();
  for (const m of src.getRoot().listMeshes()) map.get(m)?.dispose();
  for (const scene of root.listScenes()) if (scene !== keepScene) scene.dispose();
  root.setDefaultScene(keepScene);
  for (const anim of root.listAnimations()) anim.dispose();
  await doc.transform(f.prune(), f.unpartition(), f.dedup(), f.textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [tex, tex] }), f.meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await mkdir(dirname(outFile), { recursive: true });
  await io.write(outFile, doc);
  return { tris, joints: skinNode.getSkin().listJoints().length, spread, arms };
}

async function main() {
  const args = process.argv.slice(2);
  const texAt = args.indexOf('--tex');
  const tex = texAt >= 0 ? Number(args.splice(texAt, 2)[1]) : 2048;
  const [donor, mesh, out] = args;
  if (!donor || !mesh || !out) throw new Error('usage: node scripts/rig-transfer.mjs <donor.glb> <mesh.glb> <out.glb> [--tex 2048]');
  const r = await rigFrom(donor, mesh, out, { tex });
  console.log(`rigged   ${out}: ${r.tris} triangles on ${r.joints} joints (bind spread ${r.spread.toExponential(1)}), arms ${JSON.stringify(r.arms)}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
