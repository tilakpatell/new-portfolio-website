// A 2017 composite's parts on one skeleton. A hero comes as several GLBs (a
// body, a cape, hands, a head), each with its own copy of the rig; the
// import joins them so one skeleton drives them all. The rig itself is kept
// whole, as DICE made it (the owner's choice: the game's clips and physics
// drive it as they were made to), so nothing here removes a bone the body
// uses: only a part's duplicate copies go.
import { mul4 } from './surface-model.mjs';

function remap(prim, map) {
  for (let set = 0; ; set++) {
    const joints = prim.getAttribute(`JOINTS_${set}`);
    if (!joints) return;
    const weights = prim.getAttribute(`WEIGHTS_${set}`).getArray();
    const old = joints.getArray();
    const next = new old.constructor(old.length);
    // (a slot of no weight may name a joint the map lacks: any index will do, so 0)
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
