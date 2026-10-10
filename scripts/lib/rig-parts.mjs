// A 2017 composite's parts on one skeleton. A hero comes as several GLBs (a
// body, a cape, hands, a head), each with its own copy of the rig; the
// import joins them so one skeleton drives them all. The rig itself is kept
// whole, as DICE made it (the owner's choice: the game's clips and physics
// drive it as they were made to), so nothing here removes a bone the body
// uses: only a part's duplicate copies go.
import { invert4, mul4 } from './surface-model.mjs';

// A part's JOINTS_n re-indexed from its own joint list to the body's, by
// name. A joint the body hasn't got (a bone only the part's rig has) is
// bound to the body's Hips, so the vertex still moves with the figure, and
// counted, so the import can say how much of a part went stiff.
export function rebindJoints(partJoints, bodyJoints, joints, weights = null) {
  const index = new Map(bodyJoints.map((n, i) => [n, i]));
  const hips = index.get('Hips') ?? 0;
  const map = partJoints.map((n) => index.get(n) ?? -1);
  const unmatched = new Set();
  const out = new joints.constructor(joints.length);
  for (let i = 0; i < joints.length; i++) {
    const to = map[joints[i]];
    // (a slot of no weight may name anything: 0)
    if (weights && !(weights[i] > 0)) out[i] = 0;
    else if (to >= 0) out[i] = to;
    else {
      out[i] = hips;
      unmatched.add(joints[i]);
    }
  }
  return { joints: out, unmatched: unmatched.size };
}

// A part's vertices moved into the body's bind space. Each copy of the rig
// carries its own inverse bind matrices, and gltfpack folds a mesh's
// quantisation into them, so the body's and a part's differ by one matrix
// `m` (the part's bind against the body's, the same for every joint they
// share): a vertex bound to the body's joint lands where it did only once
// it is put through m. Floats only (dequantize first).
export function toBodyBind(prim, m) {
  const pos = prim.getAttribute('POSITION');
  if (pos) {
    const a = pos.getArray().slice();
    for (let i = 0; i < a.length; i += 3) {
      const [x, y, z] = [a[i], a[i + 1], a[i + 2]];
      for (let r = 0; r < 3; r++) a[i + r] = m[r] * x + m[4 + r] * y + m[8 + r] * z + m[12 + r];
    }
    pos.setArray(a);
  }
  // (a direction goes through the inverse transpose of m's turn and scale)
  const inv = invert4(m);
  for (const [name, size] of [
    ['NORMAL', 3],
    ['TANGENT', 4],
  ]) {
    const acc = prim.getAttribute(name);
    if (!acc) continue;
    const a = acc.getArray().slice();
    for (let i = 0; i < a.length; i += size) {
      const [x, y, z] = [a[i], a[i + 1], a[i + 2]];
      const d = [0, 1, 2].map((r) => inv[r * 4] * x + inv[r * 4 + 1] * y + inv[r * 4 + 2] * z);
      const l = Math.hypot(...d) || 1;
      for (let r = 0; r < 3; r++) a[i + r] = d[r] / l;
    }
    acc.setArray(a);
  }
}

// m for a part's skin against the body's: the body's bind undone, then the
// part's, read at the first joint they share
export function bindDelta(partIbm, bodyIbm) {
  return mul4(invert4(bodyIbm), partIbm);
}

function remap(prim, partJoints, bodyJoints) {
  let unmatched = 0;
  for (let set = 0; ; set++) {
    const joints = prim.getAttribute(`JOINTS_${set}`);
    if (!joints) return unmatched;
    const r = rebindJoints(partJoints, bodyJoints, joints.getArray(), prim.getAttribute(`WEIGHTS_${set}`).getArray());
    joints.setArray(r.joints);
    unmatched += r.unmatched;
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

// A composite's parts (a hero's cape, hands, head) come as GLBs of their
// own, each with its own copy of the skeleton. A part on the body's rig
// (most of its bones in the first skin by name) is moved onto it, so one
// skeleton drives them all and the copies go; a bone of the part's the body
// lacks binds to Hips (rebindJoints). A part on another rig keeps its own.
// Returns how many skins were joined; `say` hears each part's binding.
export function shareSkins(doc, say = () => {}) {
  const root = doc.getRoot();
  const [body, ...rest] = root.listSkins();
  if (!body) return 0;
  const bodyNames = body.listJoints().map((j) => j.getName());
  const index = new Set(bodyNames);
  const bodyJoints = new Set(body.listJoints());
  let joined = 0;
  for (const skin of rest) {
    const joints = skin.listJoints();
    const names = joints.map((j) => j.getName());
    const bound = names.filter((n) => index.has(n)).length;
    if (bound * 2 < names.length) continue;
    // (the first joint both have, its two inverse binds)
    const at = names.findIndex((n) => index.has(n));
    const ibmOf = (sk, i) => sk.getInverseBindMatrices()?.getElement(i, []) ?? [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const m = bindDelta(ibmOf(skin, at), ibmOf(body, bodyNames.indexOf(names[at])));
    // (one move for the whole part: every joint it shares must agree, or the
    // part was bound in a pose of its own and moving it by one joint's
    // delta would tear it; 1 mm and a thousandth of a turn)
    names.forEach((n, i) => {
      if (!index.has(n)) return;
      const d = bindDelta(ibmOf(skin, i), ibmOf(body, bodyNames.indexOf(n)));
      if (d.some((v, k) => Math.abs(v - m[k]) > 1e-3)) throw new Error(`part ${names[0]}…: its bind pose at ${n} differs from at ${names[at]}; it can't be moved onto the body's as one`);
    });
    for (const node of root.listNodes().filter((n) => n.getSkin() === skin)) {
      for (const prim of node.getMesh()?.listPrimitives() ?? []) toBodyBind(prim, m);
      let unmatched = 0;
      for (const prim of node.getMesh()?.listPrimitives() ?? []) unmatched += remap(prim, names, bodyNames);
      say(`part ${node.getName() || node.getMesh()?.getName() || '?'}: ${bound} joints bound, ${unmatched} unmatched`);
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
