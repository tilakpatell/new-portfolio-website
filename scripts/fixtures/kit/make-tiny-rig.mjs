// Writes scripts/fixtures/kit/tiny-rig.glb: the smallest figure a
// vertex-animation bake can be tested on (scripts/vat-bake.test.mjs runs
// scripts/vat-bake.mjs on it). A quad two cells tall, skinned to a chain of
// two bones (the bottom row to the first, the middle shared, the top to the
// second), under an armature moved off the origin, its mesh node moved too
// (a place three's skinning cancels: the bones alone place a skin, and so
// must the bake), and one clip of a
// second, `pose`: the first bone rising and the second turning a quarter
// about z and back.
//
//   node scripts/fixtures/kit/make-tiny-rig.mjs

import { Document, NodeIO } from '@gltf-transform/core';
import { join } from 'node:path';

const OUT = join(import.meta.dirname, 'tiny-rig.glb');
const doc = new Document();
const buffer = doc.createBuffer();
const acc = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);

// the armature at (1, 0, 0); the bones' world places are (1, 0, 0) and (1, 1, 0)
const armature = doc.createNode('Armature').setTranslation([1, 0, 0]);
const root = doc.createNode('Root');
const tip = doc.createNode('Tip').setTranslation([0, 1, 0]);
armature.addChild(root);
root.addChild(tip);
// (inverse binds: each joint's world place undone; neither turns at rest)
const inverseBinds = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -1, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -1, -1, 0, 1]);
const skin = doc.createSkin('Rig').addJoint(root).addJoint(tip).setSkeleton(root).setInverseBindMatrices(acc('MAT4', inverseBinds));

const quad = doc
  .createPrimitive()
  .setAttribute('POSITION', acc('VEC3', new Float32Array([0.5, 0, 0, 1.5, 0, 0, 0.5, 1, 0, 1.5, 1, 0, 0.5, 2, 0, 1.5, 2, 0])))
  .setAttribute('JOINTS_0', acc('VEC4', new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0])))
  .setAttribute('WEIGHTS_0', acc('VEC4', new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 0.5, 0.5, 0, 0, 0.5, 0.5, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0])))
  .setIndices(acc('SCALAR', new Uint16Array([0, 1, 3, 0, 3, 2, 2, 3, 5, 2, 5, 4])));
const body = doc.createNode('Body').setMesh(doc.createMesh('Body').addPrimitive(quad)).setSkin(skin).setTranslation([0, 0, 0.25]);

const s = Math.SQRT1_2;
const times = acc('SCALAR', new Float32Array([0, 0.5, 1]));
const anim = doc.createAnimation('pose');
const track = (node, path, type, values) => {
  const sampler = doc.createAnimationSampler().setInput(times).setOutput(acc(type, new Float32Array(values))).setInterpolation('LINEAR');
  anim.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath(path).setSampler(sampler));
};
track(root, 'translation', 'VEC3', [0, 0, 0, 0, 0.5, 0, 0, 0, 0]);
track(tip, 'rotation', 'VEC4', [0, 0, 0, 1, 0, 0, s, s, 0, 0, 0, 1]);

doc.createScene().addChild(armature).addChild(body);
await new NodeIO().write(OUT, doc);
console.log(`wrote ${OUT}`);
