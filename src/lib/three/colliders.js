// A loaded model's physical nodes as bodies (lib/physics/fromModel.js says
// the names): the model's tree read into plain nodes, each place relative
// to `root` (where the model stands is the caller's: it places the bodies
// as it places the model), a mesh's box from its geometry, a hull's or a
// trimesh's points from its own. Every physical object is hidden, its
// colliders with it: they're the shape the physics has, never something
// drawn (a modeller puts the look beside it, not in it).
//
//   collidersOf(root, { mass } (fromModel's)) → { bodies: [{ name, desc,
//     object }], hidden (how many objects were hidden) }

import * as THREE from 'three';
import { bodiesFromNodes } from '../physics/fromModel';

const PHYSICAL = /physical/i;
const BOX = new THREE.Box3();
const ONE = new THREE.Box3();
const REL = new THREE.Matrix4();

// the points of a mesh's geometry, its own frame (getX and the rest undo a
// quantised attribute: the web cut's meshopt leaves positions as integers)
function pointsOf(object) {
  const p = object.geometry?.attributes?.position;
  if (!p) return null;
  const out = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    out[i * 3] = p.getX(i);
    out[i * 3 + 1] = p.getY(i);
    out[i * 3 + 2] = p.getZ(i);
  }
  return out;
}

function indicesOf(object) {
  const index = object.geometry?.index;
  return index ? Uint32Array.from(index.array) : undefined;
}

// the box round what's drawn of `object`, in its own frame
function boxOf(object) {
  BOX.makeEmpty();
  object.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(object.matrixWorld).invert();
  object.traverse((o) => {
    if (!o.geometry?.attributes?.position) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    ONE.copy(o.geometry.boundingBox).applyMatrix4(REL.multiplyMatrices(inv, o.matrixWorld));
    BOX.union(ONE);
  });
  return BOX.isEmpty() ? undefined : { min: BOX.min.toArray(), max: BOX.max.toArray() };
}

function nodeOf(object, inBody) {
  const node = {
    name: object.name ?? '',
    position: object.position.toArray(),
    quaternion: object.quaternion.toArray(),
    scale: object.scale.toArray(),
    children: object.children.map((c) => nodeOf(c, inBody || PHYSICAL.test(object.name ?? ''))),
    userData: object.userData,
    object,
  };
  if (PHYSICAL.test(node.name)) node.box = boxOf(object);
  // (only a body's own children are its colliders: points for nothing else)
  if (inBody && /^(hull|trimesh)/i.test(node.name)) {
    node.points = pointsOf(object);
    node.indices = indicesOf(object);
  }
  return node;
}

export function collidersOf(root, opts = {}) {
  const made = bodiesFromNodes(
    root.children.map((c) => nodeOf(c, false)),
    opts,
  );
  let hidden = 0;
  root.traverse((o) => {
    if (!PHYSICAL.test(o.name ?? '') || !o.visible) return;
    o.visible = false;
    hidden++;
  });
  return { bodies: made.map(({ name, desc, node }) => ({ name, desc, object: node.object })), hidden };
}
