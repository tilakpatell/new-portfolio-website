import { Document } from '@gltf-transform/core';
import { describe, expect, it } from 'vitest';
import { packClip, walrusPaths } from './bf2017-clips.mjs';

const skeleton = () => {
  const doc = new Document();
  doc.createBuffer();
  const hips = doc.createNode('Hips');
  hips.addChild(doc.createNode('Spine1'));
  doc.createScene('Walrus_HumanMale').addChild(hips);
  return doc;
};

// a game clip: its own copy of the skeleton, two tracks the skeleton has and one it lacks
const gameClip = () => {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const acc = (type, a) => doc.createAccessor().setType(type).setArray(a).setBuffer(buffer);
  const nodes = ['Hips', 'Spine1', 'Cape_Phys_01'].map((n) => doc.createNode(n));
  const anim = doc.createAnimation('A_HM_Stand_Idle');
  for (const node of nodes) {
    const s = doc.createAnimationSampler().setInput(acc('SCALAR', new Float32Array([0, 1]))).setOutput(acc('VEC4', new Float32Array([0, 0, 0, 1, 0, 0, 0, 1])));
    anim.addSampler(s).addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath('rotation').setSampler(s));
  }
  return doc;
};

describe('the game’s clips packed onto its skeleton', () => {
  it('reads the walrus clips from the bucket’s list, whatever its fields', () => {
    const text = ['{"file":"anims/walrus_humanmale/A_HM_Idle.glb"}', '{"path":"web/anims/walrus_humanmale/A_X-0a1b2c3d.glb","d":1}', '{"file":"anims/yoda_01_ske/A_Yoda.glb"}'].join('\n');
    expect(walrusPaths(text)).toEqual(['anims/walrus_humanmale/A_HM_Idle.glb', 'anims/walrus_humanmale/A_X-0a1b2c3d.glb']);
  });
  it('binds a clip to the skeleton by bone name, under the site’s name, dropping a bone it lacks', () => {
    const skel = skeleton();
    expect(packClip(skel, gameClip(), 'idle')).toEqual({ kept: 2, dropped: 1 });
    const [anim] = skel.getRoot().listAnimations();
    expect(anim.getName()).toBe('idle');
    const skelNodes = new Set(skel.getRoot().listNodes());
    for (const ch of anim.listChannels()) expect(skelNodes.has(ch.getTargetNode())).toBe(true);
  });
});
