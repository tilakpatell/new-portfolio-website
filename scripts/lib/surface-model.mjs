// What the galaxy's surface imports share (scripts/sketchfab-surface.mjs,
// scripts/battlefront-import.mjs): a model cut down for the web and set on
// the ground. Each is a glTF-Transform step on a Document, or a measure of
// one:
//   triangles(doc)            how many it draws
//   unskinned()               a model that never moves baked out of its skeleton
//   relit({ gain, drop })     its materials made for daylight, parts left off
//   bareWhereUntextured()     UVs and tangents dropped where no map needs them
//   simplified(tris)          down to a triangle budget, a step rougher each time it stops short
//   grounded({ metres, along, yaw, up })  upright, facing +z, scaled to metres, standing on y = 0
//   dims(doc)                 [wide, tall, long] as it stands
//   bounds(doc, scene), mul4, invert4, qmul, about, UP: the maths under those

import { MeshoptSimplifier } from 'meshoptimizer';
import { compactPrimitive } from '@gltf-transform/functions';

export const triangles = (doc) =>
  doc
    .getRoot()
    .listMeshes()
    .flatMap((m) => m.listPrimitives())
    .reduce((n, p) => n + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0);

// (4×4 matrices, column-major, as glTF keeps them)
export const mul4 = (a, b) => {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
};
export function invert4(m) {
  const [a, b, c, , d, e, f, , g, h, i] = m;
  const det = a * (e * i - f * h) - d * (b * i - c * h) + g * (b * f - c * e);
  const inv3 = [(e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det, (f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det, (d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det];
  const t = [m[12], m[13], m[14]];
  const o = [inv3[0], inv3[1], inv3[2], 0, inv3[3], inv3[4], inv3[5], 0, inv3[6], inv3[7], inv3[8], 0, 0, 0, 0, 1];
  for (let r = 0; r < 3; r++) o[12 + r] = -(o[r] * t[0] + o[4 + r] * t[1] + o[8 + r] * t[2]);
  return o;
}

// A model that never moves, held in a skeleton anyway: each skinned part
// baked as its bones hold it, back into its own node's frame, a plain mesh
// after (as scripts/sketchfab-galaxy.mjs does); its animations go too.
export const unskinned = () => (doc) => {
  const root = doc.getRoot();
  // (the animations' samplers too: their keyframes would stay in the file)
  for (const a of root.listAnimations()) {
    for (const s of a.listSamplers()) s.dispose();
    a.dispose();
  }
  for (const node of root.listNodes()) {
    const skin = node.getSkin();
    if (!skin || !node.getMesh()) continue;
    const ibm = skin.getInverseBindMatrices();
    const back = invert4(node.getWorldMatrix());
    const bones = skin.listJoints().map((joint, i) => mul4(back, mul4(joint.getWorldMatrix(), ibm ? ibm.getElement(i, []) : [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])));
    for (const prim of node.getMesh().listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const nor = prim.getAttribute('NORMAL');
      const joints = prim.getAttribute('JOINTS_0');
      const weights = prim.getAttribute('WEIGHTS_0');
      if (!joints || !weights) continue;
      const p = [];
      const n = [];
      const j = [];
      const w = [];
      const P = new Float32Array(pos.getCount() * 3);
      const N = nor ? new Float32Array(nor.getCount() * 3) : null;
      for (let v = 0; v < pos.getCount(); v++) {
        pos.getElement(v, p);
        if (nor) nor.getElement(v, n);
        joints.getElement(v, j);
        weights.getElement(v, w);
        const out = [0, 0, 0];
        const outN = [0, 0, 0];
        for (let k = 0; k < 4; k++) {
          if (!w[k]) continue;
          const m = bones[j[k]];
          for (let r = 0; r < 3; r++) {
            out[r] += w[k] * (m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2] + m[12 + r]);
            if (nor) outN[r] += w[k] * (m[r] * n[0] + m[4 + r] * n[1] + m[8 + r] * n[2]);
          }
        }
        P.set(out, v * 3);
        if (nor) {
          const l = Math.hypot(...outN) || 1;
          N.set(outN.map((x) => x / l), v * 3);
        }
      }
      prim.setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(P).setBuffer(pos.getBuffer()));
      if (nor) prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(N).setBuffer(nor.getBuffer()));
      for (const name of prim.listSemantics()) if (/^(JOINTS|WEIGHTS)_/.test(name)) prim.setAttribute(name, null);
    }
    node.setSkin(null);
  }
};

// Its materials made for daylight on a world: nothing more than half metal
// (a fully metal hull, with nothing round it to reflect, comes out black),
// its colours brightened by `gain`, and anything in `drop` left off.
export const relit = ({ gain = 1, drop = null }) => (doc) => {
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) if (drop?.test(prim.getMaterial()?.getName() ?? '')) prim.dispose();
  for (const m of doc.getRoot().listMaterials()) {
    m.setMetallicFactor(Math.min(m.getMetallicFactor(), 0.5));
    const [r, g, b, a] = m.getBaseColorFactor();
    m.setBaseColorFactor([...[r, g, b].map((c) => Math.min(1, c * gain)), a]);
  }
};

// Parts with no maps don't need their UVs or tangents (so the simplifier can
// fold across what were seams).
export const bareWhereUntextured = () => (doc) => {
  for (const mesh of doc.getRoot().listMeshes())
    for (const prim of mesh.listPrimitives()) {
      const m = prim.getMaterial();
      const mapped = m && [m.getBaseColorTexture(), m.getNormalTexture(), m.getMetallicRoughnessTexture(), m.getOcclusionTexture(), m.getEmissiveTexture()].some(Boolean);
      for (const name of prim.listSemantics()) if (name === 'TANGENT' || (!mapped && name.startsWith('TEXCOORD_'))) prim.setAttribute(name, null);
    }
};

// The simplifier, each mesh its share of the budget, a step rougher each time
// it stops short (as scripts/sketchfab-galaxy.mjs does it).
export const simplified = (tris) => (doc) => {
  const buffer = doc.getRoot().listBuffers()[0];
  const prims = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives()).filter((p) => p.getIndices());
  const all = prims.reduce((n, p) => n + p.getIndices().getCount() / 3, 0);
  if (all <= tris * 1.1) return;
  for (const prim of prims) {
    const positions = new Float32Array(prim.getAttribute('POSITION').getArray());
    let indices = new Uint32Array(prim.getIndices().getArray());
    const target = Math.max(3, Math.floor((indices.length * tris) / all / 3) * 3);
    const steps = [
      (ix) => MeshoptSimplifier.simplify(ix, positions, 3, target, 0.01, ['Prune'])[0],
      (ix) => MeshoptSimplifier.simplify(ix, positions, 3, target, 0.03, ['Prune', 'Permissive'])[0],
      (ix) => MeshoptSimplifier.simplifySloppy(ix, positions, 3, null, target, 0.02)[0],
    ];
    for (const step of steps) if (indices.length > target * 1.15) indices = step(indices);
    if (!indices.length) {
      prim.dispose();
      continue;
    }
    prim.setIndices(doc.createAccessor().setArray(indices).setBuffer(buffer));
    compactPrimitive(prim);
  }
};

// (quaternions, [x, y, z, w])
export const qmul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
export const about = (axis, angle) => {
  const s = Math.sin(angle / 2);
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(angle / 2)];
};
export const UP = {
  y: [0, 0, 0, 1],
  z: about([1, 0, 0], -Math.PI / 2), // its +z (up as made) to +y
  '-z': about([1, 0, 0], Math.PI / 2),
  x: about([0, 0, 1], Math.PI / 2), // its +x to +y
  '-x': about([0, 0, 1], -Math.PI / 2),
  '-y': about([1, 0, 0], Math.PI), // upside down
};

// Where the model is, as drawn: each part's corners through its node, or
// for a skinned part (whose node glTF ignores) through its bones as they
// hold it at rest.
export function bounds(doc, scene) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const add = (x) => {
    for (let r = 0; r < 3; r++) {
      min[r] = Math.min(min[r], x[r]);
      max[r] = Math.max(max[r], x[r]);
    }
  };
  const apply = (m, p) => [0, 1, 2].map((r) => m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2] + m[12 + r]);
  const id = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  scene.traverse((node) => {
    const mesh = node.getMesh();
    if (!mesh) return;
    const skin = node.getSkin();
    const ibm = skin?.getInverseBindMatrices();
    const bones = skin?.listJoints().map((joint, i) => mul4(joint.getWorldMatrix(), ibm ? ibm.getElement(i, []) : id));
    const world = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const joints = prim.getAttribute('JOINTS_0');
      const weights = prim.getAttribute('WEIGHTS_0');
      const p = [];
      const j = [];
      const w = [];
      // (every vertex of a small part, every few of a big one)
      const step = Math.max(1, Math.floor(pos.getCount() / 20000));
      for (let v = 0; v < pos.getCount(); v += step) {
        pos.getElement(v, p);
        if (!bones || !joints || !weights) {
          add(apply(world, p));
          continue;
        }
        joints.getElement(v, j);
        weights.getElement(v, w);
        const out = [0, 0, 0];
        for (let k = 0; k < 4; k++) if (w[k]) apply(bones[j[k]], p).forEach((c, r) => (out[r] += w[k] * c));
        add(out);
      }
    }
  });
  return { min, max };
}

// On the ground: everything in the scene under one node that turns it
// upright and round to face +z, scales it to `metres` along `along`, and
// stands it on y = 0 with the middle of its footprint at the origin.
export const grounded = ({ metres, along = 'y', yaw = 0, up = 'y' }) => (doc) => {
  const root = doc.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  for (const s of root.listScenes()) if (s !== scene) s.dispose();
  if (!UP[up]) throw new Error(`up: '${up}'? (y, z, -z, x, -x, -y)`);
  const ground = doc.createNode('ground');
  for (const child of scene.listChildren()) {
    scene.removeChild(child);
    ground.addChild(child);
  }
  scene.addChild(ground);
  ground.setRotation(qmul(about([0, 1, 0], yaw), UP[up]));
  const { min, max } = bounds(doc, scene);
  const size = { x: max[0] - min[0], y: max[1] - min[1], z: max[2] - min[2] };
  const measured = along === 'max' ? Math.max(size.x, size.z) : size[along];
  if (!(measured > 0)) throw new Error(`along: '${along}'? (y, x, z or max)`);
  const k = metres / measured;
  ground.setScale([k, k, k]);
  ground.setTranslation([(-k * (min[0] + max[0])) / 2, -k * min[1], (-k * (min[2] + max[2])) / 2]);
};

export const dims = (doc) => {
  const root = doc.getRoot();
  const { min, max } = bounds(doc, root.getDefaultScene() ?? root.listScenes()[0]);
  return [0, 1, 2].map((i) => max[i] - min[i]);
};
