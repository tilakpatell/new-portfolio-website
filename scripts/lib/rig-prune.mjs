// A rig cut down to the bones that move the mesh. The 2017 people's rig
// (Walrus_HumanMale) has about 250 joints of which some 70 carry weight;
// the rest are twists, physics, camera and weapon helpers that cost bytes in
// every baked clip and a matrix each in every skinned frame. A joint stays
// when a vertex is weighted to it, when it is above such a joint (or the
// skin would lose the chain that places it), or when it is named in `keep`
// (the sockets the site holds things by).
import { mul4 } from './surface-model.mjs';

// the joint indices a primitive weights, from every JOINTS_n/WEIGHTS_n pair
function weighted(prim, into) {
  for (let set = 0; ; set++) {
    const joints = prim.getAttribute(`JOINTS_${set}`);
    const weights = prim.getAttribute(`WEIGHTS_${set}`);
    if (!joints || !weights) return;
    const j = joints.getArray();
    const w = weights.getArray();
    for (let i = 0; i < j.length; i++) if (w[i] > 0) into.add(j[i]);
  }
}

function remap(prim, map) {
  for (let set = 0; ; set++) {
    const joints = prim.getAttribute(`JOINTS_${set}`);
    if (!joints) return;
    const weights = prim.getAttribute(`WEIGHTS_${set}`).getArray();
    const old = joints.getArray();
    const next = new old.constructor(old.length);
    // (a slot of no weight may name a removed joint: any index will do, so 0)
    for (let i = 0; i < old.length; i++) next[i] = weights[i] > 0 ? map.get(old[i]) : 0;
    joints.setArray(next);
  }
}

// A node taken out of the tree, its children moved to its parent with its
// local transform folded into theirs, so nothing under it moves in the world.
function detach(node) {
  const parent = node.getParentNode();
  const m = node.getMatrix();
  for (const child of node.listChildren()) {
    const local = mul4(m, child.getMatrix());
    if (parent) parent.addChild(child);
    else for (const scene of node.listParents().filter((p) => p.propertyType === 'Scene')) scene.addChild(child);
    child.setMatrix(local);
  }
  node.dispose();
}

export function pruneRig(doc, { keep = [] } = {}) {
  const root = doc.getRoot();
  const named = new Set(keep);
  let before = 0;
  let after = 0;
  const removed = [];
  for (const skin of root.listSkins()) {
    const joints = skin.listJoints();
    before += joints.length;
    const prims = root
      .listNodes()
      .filter((n) => n.getSkin() === skin && n.getMesh())
      .flatMap((n) => n.getMesh().listPrimitives());
    const used = new Set();
    for (const p of prims) weighted(p, used);
    const isJoint = new Set(joints);
    const kept = new Set();
    for (const [i, j] of joints.entries()) {
      if (!used.has(i) && !named.has(j.getName())) continue;
      for (let n = j; n; n = n.getParentNode()) if (isJoint.has(n)) kept.add(n);
    }
    const map = new Map();
    const order = joints.filter((j) => kept.has(j));
    joints.forEach((j, i) => kept.has(j) && map.set(i, order.indexOf(j)));
    // the inverse bind matrices of the kept joints, in their new order (a
    // new accessor: the old one may be another skin's too)
    const ibm = skin.getInverseBindMatrices();
    if (ibm) {
      const src = ibm.getArray();
      const out = new Float32Array(16 * order.length);
      joints.forEach((j, i) => kept.has(j) && out.set(src.subarray(16 * i, 16 * i + 16), 16 * map.get(i)));
      skin.setInverseBindMatrices(doc.createAccessor().setType('MAT4').setArray(out).setBuffer(ibm.getBuffer()));
    }
    for (const p of prims) remap(p, map);
    for (const j of joints) {
      if (kept.has(j)) continue;
      skin.removeJoint(j);
      removed.push(j.getName());
      detach(j);
    }
    after += order.length;
  }
  return { before, after, removed };
}
