import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { mkdir, mkdtemp, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { atRest, makePack, resampleChannel } from './bf2017-clips.mjs';

const reader = async () => {
  await MeshoptDecoder.ready;
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
};

// Reference → AITrajectory, and under Reference: Hips → Spine → RightArm →
// RightHand → Wep_Root, Hips → LeftToeBase and RightToeBase
function skeleton(doc) {
  const n = (name, t) => doc.createNode(name).setTranslation(t);
  const ref = n('Reference', [0, 0, 0]);
  const traj = n('AITrajectory', [0, 0, 0]);
  const hips = n('Hips', [0, 0.95, 0]);
  const spine = n('Spine', [0, 0.2, 0]);
  const arm = n('RightArm', [-0.2, 0.3, 0]);
  const hand = n('RightHand', [-0.25, 0, 0]);
  const wep = n('Wep_Root', [0, 0, 0]);
  const ik = n('IK_Joint_RightHand', [0, 0, 0]);
  const lt = n('LeftToeBase', [0.1, -0.93, 0.1]);
  const rt = n('RightToeBase', [-0.1, -0.93, 0.1]);
  ref.addChild(traj).addChild(hips);
  hips.addChild(spine).addChild(lt).addChild(rt);
  spine.addChild(arm);
  arm.addChild(hand);
  hand.addChild(wep).addChild(ik);
  doc.createScene('Walrus_HumanMale').addChild(ref);
  return { ref, traj, hips, spine, arm, hand };
}

// a clip of 10 frames at 30 a second: the arm swung round, the trajectory walked ahead
async function clipFile(file, name) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const { traj, arm, spine } = skeleton(doc);
  const acc = (type, a) => doc.createAccessor().setType(type).setArray(new Float32Array(a)).setBuffer(buffer);
  const times = Array.from({ length: 10 }, (_, i) => i / 30);
  const anim = doc.createAnimation(name).setExtras({ fps: 30, loop: false });
  const add = (node, path, type, values) => {
    const s = doc.createAnimationSampler().setInput(acc('SCALAR', times)).setOutput(acc(type, values)).setInterpolation('LINEAR');
    anim.addSampler(s).addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath(path).setSampler(s));
  };
  add(arm, 'rotation', 'VEC4', times.flatMap((_, i) => [Math.sin(i * 0.15), 0, 0, Math.cos(i * 0.15)]));
  add(traj, 'translation', 'VEC3', times.flatMap((_, i) => [0, 0, i * 0.05]));
  // (the spine holds its rest all through: nothing to send)
  add(spine, 'rotation', 'VEC4', times.flatMap(() => [0, 0, 0, 1]));
  await mkdir(join(file, '..'), { recursive: true });
  await writeFile(file, await new NodeIO().writeBinary(doc));
}

describe('a pack of the game’s clips', () => {
  it('resamples a channel to another rate, the end kept, a constant one as two keys', () => {
    const r = resampleChannel([0, 0.5, 1], [0, 0, 0, 1, 0, 0, 2, 0, 0], 3, 4, 1);
    expect(r.times).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(r.values.filter((_, i) => i % 3 === 0)).toEqual([0, 0.5, 1, 1.5, 2]);
    expect(resampleChannel([0, 1], [1, 2, 3, 1, 2, 3], 3, 24, 1).times).toEqual([0, 1]);
    // (an end between two frames is still the last key: 0.43 s at 24 a second)
    const odd = resampleChannel([0, 0.43], [0, 0, 0, 1, 0, 0], 3, 24, 0.43);
    expect(odd.times.at(-1)).toBeCloseTo(0.43, 9);
    expect(odd.values.slice(-3)).toEqual([1, 0, 0]);
  });

  it('knows a channel that only holds its rest (a turn or its negation)', () => {
    const node = new Document().createNode('x').setRotation([0, 0, 0, 1]);
    expect(atRest(node, 'rotation', [0, 0, 0, 1, 0, 0, 0, -1])).toBe(true);
    expect(atRest(node, 'rotation', [0, 0, 0, 1, 0.1, 0, 0, 0.99])).toBe(false);
  });

  it('packs the named clips under the site’s names, at 24 fps, with contact and root, meshopt-compressed', async () => {
    const root = await mkdtemp(join(tmpdir(), 'bf2017-clips-'));
    const out = join(root, 'out');
    const rows = [
      ['A_Luke_AttackLoop_Strike1', 'anims/walrus_humanmale/a_luke_attackloop_strike1.glb'],
      ['L_Luke_Stand_Idle_01', 'anims/walrus_humanmale/l_luke_stand_idle_01.glb'],
    ];
    for (const [name, file] of rows) await clipFile(join(root, 'web', file), name);
    await writeFile(join(root, 'web', 'anims.jsonl'), rows.map(([name, file]) => JSON.stringify({ name, file, fps: 30, frames: 10, additive: false, skeleton: 'Characters/Rigs/Humanoids/Walrus_HumanMale' })).join('\n'));
    const sk = new Document();
    sk.createBuffer();
    skeleton(sk);
    const skFile = join(root, 'walrus.glb');
    await writeFile(skFile, await new NodeIO().writeBinary(sk));

    const r = await makePack('luke', { only: ['sword.light.a', 'idle'], out, root, skeleton: skFile, log: () => {} });
    expect(r.none).toEqual([]);
    const file = join(out, 'clips-luke.glb');
    expect((await stat(file)).size).toBeLessThan(20 * 1024);
    const doc = await (await reader()).read(file);
    expect(doc.getRoot().listExtensionsUsed().map((e) => e.extensionName)).toContain('EXT_meshopt_compression');
    const anims = doc.getRoot().listAnimations();
    expect(anims.map((a) => a.getName()).sort()).toEqual(['idle', 'sword.light.a']);
    const strike = anims.find((a) => a.getName() === 'sword.light.a');
    const channels = strike.listChannels();
    // (the arm's, at 24 a second over 0.3 s; the trajectory's and the resting spine's gone)
    expect(channels.map((c) => c.getTargetNode().getName())).toEqual(['RightArm']);
    const t = channels[0].getSampler().getInput().getArray();
    expect(t.length).toBe(Math.ceil(0.3 * 24) + 1);
    expect(t[t.length - 1]).toBeCloseTo(0.3, 6);
    const { contact, root: travel, rootHips, source } = strike.getExtras();
    expect(source).toBe('A_Luke_AttackLoop_Strike1');
    expect(contact[0]).toBeGreaterThanOrEqual(0);
    expect(contact[1]).toBeGreaterThan(contact[0]);
    expect(contact[1]).toBeLessThanOrEqual(0.3);
    expect(rootHips).toBeGreaterThan(0);
    expect(travel.at(-1)[2]).toBeCloseTo(0.45, 2);
  });
});

describe('an own rig’s pack', () => {
  it('takes clips from that rig’s skeleton alone, and its skeleton from the body', async () => {
    const { skeletonFileFor, skeletonsFor } = await import('./bf2017-clips.mjs');
    expect(skeletonsFor('b1').test('Characters/Rigs/Droids/D_Assault_Preq_01_Ske')).toBe(true);
    expect(skeletonsFor('b1').test('Characters/Rigs/Humanoids/Walrus_HumanMale')).toBe(false);
    expect(skeletonsFor('humanoid').test('Characters/Rigs/Humanoids/Walrus_HumanMale')).toBe(true);
    expect(skeletonFileFor('b1', '/r')).toBe('/r/public/models/galaxy/bf2017/crew/battledroid.lod1.glb');
    expect(skeletonFileFor('luke', '/r')).toBe('/r/public/models/galaxy/bf2017/walrus.glb');
  });
});
