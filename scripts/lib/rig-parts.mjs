// A 2017 composite's parts on one skeleton. A hero comes as several GLBs (a
// body, a cape, hands, a head), each with its own copy of the rig; the
// import joins them so one skeleton drives them all. The rig itself is kept
// whole, as DICE made it (the owner's choice: the game's clips and physics
// drive it as they were made to), so nothing here removes a bone the body
// uses: only a part's duplicate copies go.
import { mul4 } from './surface-model.mjs';

// A part's JOINTS_n re-indexed from its own joint list to the body's, by
// name. A joint the body lacks (a bone only the part's copy has) binds to
// its nearest ancestor the body has, when `parentOf` names its parents,
// else to the body's Hips, and is counted: the clips drive the body's
// bones, so a vertex on a bone nobody drives would only stand still.
// `weights`, when given, lets a slot of no weight go to 0.
export function rebindJoints(partJoints, bodyJoints, joints, { weights = null, parentOf = null } = {}) {
  const index = new Map(bodyJoints.map((n, i) => [n, i]));
  const hips = index.get('Hips') ?? 0;
  let unmatched = 0;
  const map = partJoints.map((name) => {
    if (index.has(name)) return index.get(name);
    unmatched++;
    for (let up = parentOf?.(name); up; up = parentOf(up)) if (index.has(up)) return index.get(up);
    return hips;
  });
  const out = new joints.constructor(joints.length);
  for (let i = 0; i < joints.length; i++) out[i] = weights && !(weights[i] > 0) ? 0 : map[joints[i]];
  return { joints: out, unmatched };
}

function remap(prim, partNames, bodyNames, parentOf) {
  let unmatched = 0;
  for (let set = 0; ; set++) {
    const joints = prim.getAttribute(`JOINTS_${set}`);
    if (!joints) return unmatched;
    const weights = prim.getAttribute(`WEIGHTS_${set}`).getArray();
    const r = rebindJoints(partNames, bodyNames, joints.getArray(), { weights, parentOf });
    joints.setArray(r.joints);
    unmatched = Math.max(unmatched, r.unmatched);
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
// own, each with its own copy of the skeleton. A part on the body's
// skeleton (any bone in common by name) is moved onto the body's skin, so
// one skeleton drives them all and the copies go; a bone only the part has
// binds to its nearest ancestor the body has (rebindJoints). A part on
// another rig keeps its own. `log` hears one line a part joined. Returns
// how many skins were joined.
export function shareSkins(doc, { log = null } = {}) {
  const root = doc.getRoot();
  const [body, ...rest] = root.listSkins();
  if (!body) return 0;
  const bodyNames = body.listJoints().map((j) => j.getName());
  const index = new Set(bodyNames);
  const bodyJoints = new Set(body.listJoints());
  let joined = 0;
  for (const skin of rest) {
    const joints = skin.listJoints();
    if (!joints.some((j) => index.has(j.getName()))) continue;
    const partNames = joints.map((j) => j.getName());
    const byName = new Map(joints.map((j) => [j.getName(), j]));
    const parentOf = (name) => byName.get(name)?.getParentNode()?.getName() ?? null;
    let unmatched = 0;
    for (const node of root.listNodes().filter((n) => n.getSkin() === skin)) {
      for (const prim of node.getMesh()?.listPrimitives() ?? []) unmatched = Math.max(unmatched, remap(prim, partNames, bodyNames, parentOf));
      node.setSkin(body);
    }
    log?.(`part ${skin.getName() || joints[0].getName()}: ${joints.length - unmatched} joints bound, ${unmatched} unmatched`);
    // (deepest first, so each copy's children have gone up before it goes)
    const depth = (n) => (n.getParentNode() ? 1 + depth(n.getParentNode()) : 0);
    for (const j of [...joints].sort((a, b) => depth(b) - depth(a))) if (!bodyJoints.has(j)) detach(j);
    skin.dispose();
    joined++;
  }
  return joined;
}
