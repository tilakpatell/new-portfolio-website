import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { meshyRig } from '../src/lib/three/meshyRig.fixture.js';
import { findBones } from '../src/lib/three/rig.js';
import { UAL_MAP, keepRest, ualRig } from './preview/ualRetarget.js';
import { SETS, bakeFiles, bakeInto, contactWindow, rootTravel } from './ual-bake.mjs';

const UAL1 = 'lab/assets/ual1/Unreal-Godot/UAL1.glb';
const CORE = SETS.find((s) => s.name === 'core');
const reader = async () => {
  await MeshoptDecoder.ready;
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
};

describe('the shipped bakes', () => {
  // (the pack is fetched by node scripts/assets-fetch.mjs ual1; without it there's nothing to bake from)
  it.skipIf(!existsSync(UAL1))(
    're-bake byte for byte as they were (the retarget on Meshy names unchanged)',
    async () => {
      const dir = await mkdtemp(join(tmpdir(), 'ual-'));
      const made = await bakeFiles('pro', ['jog', 'hit.stomach', 'sit.ground'], dir);
      expect(made.length).toBe(3);
      for (const m of made) expect(Buffer.compare(await readFile(join(dir, m.file)), await readFile(join('public/games/meshy', m.file)))).toBe(0);
    },
    120000,
  );
});

// a mannequin under UAL's names with the core set's clips (the fixture's walk under each)
function mannequin() {
  const rig = meshyRig();
  const toDef = Object.fromEntries(Object.entries(UAL_MAP).map(([d, m]) => [m, d]));
  const clips = Object.keys(CORE.clips).map((name) => {
    const c = rig.clips.walk.clone();
    c.name = name;
    for (const t of c.tracks) {
      const [bone, prop] = t.name.split('.');
      t.name = `${toDef[bone] ?? bone}.${prop}`;
    }
    return c;
  });
  for (const b of Object.values(rig.bones)) b.name = toDef[b.name] ?? b.name;
  return keepRest(ualRig({ scene: rig.model, animations: clips }));
}

// a skinned figure on a downloaded Mixamo skeleton (mixamorig:Hips_52…), one triangle on its hips
async function mixamoFigure(file) {
  const rig = meshyRig();
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene();
  const nodes = new Map();
  let i = 0;
  const add = (o, parent) => {
    const name = o.isBone ? `mixamorig:${{ Spine02: 'Spine', Spine01: 'Spine1', Spine: 'Spine2', neck: 'Neck' }[o.name] ?? o.name}_${i++}` : o.name;
    const n = doc.createNode(name).setTranslation(o.position.toArray()).setRotation(o.quaternion.toArray()).setScale(o.scale.toArray());
    nodes.set(o, n);
    (parent ?? scene).addChild(n);
    for (const c of o.children) add(c, n);
  };
  add(rig.armature, null);
  const joints = Object.values(rig.bones).map((b) => nodes.get(b));
  const acc = (a, type) => doc.createAccessor().setArray(a).setType(type).setBuffer(buffer);
  const prim = doc
    .createPrimitive()
    .setAttribute('POSITION', acc(new Float32Array([0, 0.9, 0, 0.1, 0.9, 0, 0, 1, 0]), 'VEC3'))
    .setAttribute('JOINTS_0', acc(new Uint16Array(12), 'VEC4'))
    .setAttribute('WEIGHTS_0', acc(new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]), 'VEC4'));
  const ibm = new Float32Array(16 * joints.length);
  for (let j = 0; j < joints.length; j++) ibm.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], j * 16);
  const skin = doc.createSkin().setInverseBindMatrices(acc(ibm, 'MAT4'));
  for (const j of joints) skin.addJoint(j);
  scene.addChild(doc.createNode('body').setMesh(doc.createMesh().addPrimitive(prim)).setSkin(skin));
  await writeFile(file, await new NodeIO().writeBinary(doc));
}

describe('bakeInto', () => {
  it('bakes the core set into a figure on a Mixamo skeleton, as its own clips, small', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ual-into-'));
    const fig = join(dir, 'fig.glb');
    const out = join(dir, 'out.glb');
    await mixamoFigure(fig);
    const r = await bakeInto(fig, out, { set: 'core', src: mannequin(), findBones });
    expect(r.clips).toEqual(['idle', 'walk', 'run', 'talk', 'hit.chest', 'die', 'sit.idle']);
    expect(r.added).toBeLessThan(60 * 1024);
    const back = await (await reader()).read(out);
    const anims = back.getRoot().listAnimations();
    expect(anims.map((a) => a.getName())).toEqual(r.clips);
    const targets = new Set(anims[1].listChannels().map((c) => c.getTargetNode().getName()));
    expect(targets).toContain('mixamorig:Hips_0');
    expect([...targets].some((n) => n.startsWith('mixamorig:LeftUpLeg'))).toBe(true);
    // (again into its own output: the set's clips replaced, not doubled)
    const again = await bakeInto(out, out, { set: 'core', src: mannequin(), findBones });
    expect(again.clips.length).toBe(7);
    expect((await (await reader()).read(out)).getRoot().listAnimations().length).toBe(7);
  }, 60000);

  it('throws on a set clip the mannequin lacks', async () => {
    const src = mannequin();
    delete src.clips.Death01;
    await expect(bakeInto('x.glb', 'y.glb', { set: 'core', src, findBones })).rejects.toThrow(/no Death01/);
  });
});

// rows as the bake samples them: a time and the sword hand where it is
const handRows = (fast, d = 1, fps = 30) =>
  Array.from({ length: Math.round(d * fps) + 1 }, (_, f) => {
    const t = f / fps;
    // (still, then quick between fast[0] and fast[1], then still)
    const k = Math.min(1, Math.max(0, (t - fast[0]) / (fast[1] - fast[0])));
    return { t, hand: [k * 1.5, 1.2, 0] };
  });

describe('contactWindow', () => {
  it('finds the hand’s fastest span, widened either side', () => {
    const [t0, t1] = contactWindow(handRows([0.4, 0.6]));
    expect(t0).toBeGreaterThan(0.3);
    expect(t0).toBeLessThan(0.4);
    expect(t1).toBeGreaterThan(0.6);
    expect(t1).toBeLessThan(0.7);
  });
  it('counts only the frames the blade is ahead of the body (`ahead`): a wind-up behind the back isn’t a hit', () => {
    // (fast behind between 0.1 and 0.3, fast again, ahead, between 0.6 and 0.8)
    const rows = handRows([0.1, 0.3]).map((r) => {
      const t = r.t;
      const k = Math.min(1, Math.max(0, (t - 0.6) / 0.2));
      return { t, hand: [r.hand[0] + k * 1.5, 1.2, 0], ahead: t >= 0.55 };
    });
    const [t0, t1] = contactWindow(rows);
    expect(t0).toBeGreaterThan(0.5);
    expect(t1).toBeGreaterThan(0.8);
  });
  it('keeps a window inside [0.05, duration − 0.05] when the hand never moves, or moves at the very ends', () => {
    for (const rows of [handRows([2, 3]), handRows([0, 0.05]), handRows([0.95, 1])]) {
      const [t0, t1] = contactWindow(rows);
      expect(t0).toBeGreaterThanOrEqual(0.05);
      expect(t1).toBeLessThanOrEqual(0.95 + 1e-9);
      expect(t1).toBeGreaterThan(t0);
    }
  });
});

describe('rootTravel', () => {
  it('starts at nothing and ends at the root’s whole displacement, faced and scaled', () => {
    const rows = Array.from({ length: 31 }, (_, f) => ({ t: f / 30, at: [0.5 + f * 0.01, 0.9, 2 + f * 0.1] }));
    const r = rootTravel(rows, { k: 2 });
    expect(r[0]).toEqual([0, 0, 0]);
    expect(r.at(-1)[0]).toBeCloseTo(1);
    expect(r.at(-1)[1]).toBeCloseTo(0.6);
    expect(r.at(-1)[2]).toBeCloseTo(6);
    // (a quarter turn about up: ahead becomes to the side)
    const turned = rootTravel(rows, { face: ([x, , z]) => [z, 0, -x] });
    expect(turned.at(-1)[1]).toBeCloseTo(3);
    expect(turned.at(-1)[2]).toBeCloseTo(-0.3);
  });
});
