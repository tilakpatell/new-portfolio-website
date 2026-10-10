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
export function detach(node) {
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

// A composite's parts (a hero's cape, hands, head) come as GLBs of their
// own, each with its own copy of the skeleton. A part whose bones are all
// in the first skin by name is moved onto it, so one skeleton drives them
// all and the copies go; a part on another rig keeps its own. Returns how
// many skins were joined.
export function shareSkins(doc) {
  const root = doc.getRoot();
  const [body, ...rest] = root.listSkins();
  if (!body) return 0;
  const index = new Map(body.listJoints().map((j, i) => [j.getName(), i]));
  const bodyJoints = new Set(body.listJoints());
  let joined = 0;
  for (const skin of rest) {
    const joints = skin.listJoints();
    if (!joints.every((j) => index.has(j.getName()))) continue;
    const map = new Map(joints.map((j, i) => [i, index.get(j.getName())]));
    for (const node of root.listNodes().filter((n) => n.getSkin() === skin)) {
      for (const prim of node.getMesh()?.listPrimitives() ?? []) remap(prim, map);
      node.setSkin(body);
    }
    // (deepest first, so each copy's children have gone up before it goes)
    const depth = (n) => (n.getParentNode() ? 1 + depth(n.getParentNode()) : 0);
    for (const j of [...joints].sort((a, b) => depth(b) - depth(a))) if (!bodyJoints.has(j)) detach(j);
    skin.dispose();
    joined++;
  }
  return joined;
}
