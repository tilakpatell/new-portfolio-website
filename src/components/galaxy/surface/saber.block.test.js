// The block by the side a cut comes in on, headless: a 2017 hero (the
// committed skeleton, walrus.glb, with Luke's committed clip pack) lays the
// game's block measured holding the blade on that side (luke.json's
// `blocks`, by `held`); a figure on the Meshy skeleton (meshyRig.fixture.js,
// the baked clips off disk) keeps its one block, whatever the side.
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { beforeAll, describe, expect, it } from 'vitest';
import luke from '../../../data/bf2017/strokes/luke.json';
import { socketsOf } from '../../../lib/three/walrus';
import { meshyRig } from '../../../lib/three/meshyRig.fixture';
import { createGunplay } from '../../universe/gunplay';
import { BLOCK_CLIP, STANCES } from './combatRules';
import { createSaber } from './saber';
import { BLOCK_AT } from './saberRules';

const UP = new THREE.Vector3(0, 1, 0);
const FWD = new THREE.Vector3(0, 0, 1);
const parse = async (file) => {
  const buf = readFileSync(file);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  return new Promise((r, j) => loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', r, j));
};

let pack;
const ual = {};
beforeAll(async () => {
  await MeshoptDecoder.ready;
  pack = await parse('public/models/galaxy/bf2017/clips-luke.glb');
  for (const name of new Set([...STANCES.single.strokes.map((k) => k.clip), 'sword.heavy.a', BLOCK_CLIP])) ual[name] = (await parse(`public/games/meshy/ual-${name}.glb`)).animations[0];
});
// (what the pack carries, by the game's names)
const packHas = (n) => pack.animations.some((c) => c.userData.source === n);

// (more: clips laid over the pack's, by its names)
async function hero(more = {}) {
  const g = await parse('public/models/galaxy/bf2017/walrus.glb');
  const bones = {};
  g.scene.traverse((o) => o.name && !(o.name in bones) && (bones[o.name] = o));
  const world = new THREE.Scene();
  world.add(g.scene);
  g.scene.updateMatrixWorld(true);
  const clips = { ...Object.fromEntries(pack.animations.map((c) => [c.name, c])), ...more };
  const fig = { model: g.scene, bones, sockets: socketsOf(g.scene), rig: 'walrus', clips };
  const gp = createGunplay(fig, 'saber', { unit: 1 });
  const saber = createSaber(gp, { fig, parent: world, tier: 'low' });
  let now = 0;
  const frame = () => saber.update(1 / 60, (now += 1 / 60), { forward: FWD, up: UP, me: null, targets: [] });
  return { saber, gp, frame };
}

function meshy() {
  const rig = meshyRig();
  const scene = new THREE.Group();
  scene.add(rig.model);
  scene.updateMatrixWorld(true);
  const gp = createGunplay({ model: rig.model, bones: rig.bones }, 'saber', { unit: 1 });
  const saber = createSaber(gp, { stance: 'single', parent: scene, fig: { bones: rig.bones, hipsY: rig.hipsY }, clips: ual });
  let now = 0;
  const frame = () => {
    now += 1 / 60;
    scene.updateMatrixWorld(true);
    gp.set(1 / 60, { aim: 0.75, look: 0, dir: null, forward: FWD, up: UP });
    saber.update(1 / 60, now, { forward: FWD, up: UP, me: { x: 0, z: 0, yaw: 0 }, targets: [] });
  };
  return { saber, gp, rig, frame };
}

describe('a 2017 hero’s block, by the side a cut comes in on', () => {
  it('meets a cut from its left with the game’s blocks measured there, one a raise in turn', async () => {
    const want = luke.blocks.left.filter(packHas);
    expect(want).toEqual(['A_Luke_Stand_Block_SwingLeft_01', 'A_Luke_Stand_Block_SwingRight_01']);
    const { saber } = await hero();
    const got = [];
    for (let i = 0; i < 4; i++) {
      saber.block(true, 'left');
      got.push(saber.blockClip);
      saber.block(false);
    }
    expect(got).toEqual([0, 1, 2, 3].map((i) => want[i % want.length]));
    for (const n of got) expect(luke.held[n].tip[0]).toBeGreaterThan(0);
  });

  it('from a side with nothing measured on it, or none, the site’s one block', async () => {
    expect(luke.blocks.right).toEqual([]);
    const { saber } = await hero();
    saber.block(true, 'right');
    expect(saber.blockClip).toBe(BLOCK_CLIP);
    saber.block(false);
    saber.block(true, null);
    expect(saber.blockClip).toBe(BLOCK_CLIP);
  });

  // (Obi-Wan's, Anakin's, Maul's and Dooku's packs carry the table's any,
  // the parry's stagger, as their sword.blocked, and laid as the block it
  // held the blade low or behind; Luke's is given one: a clip of his pack's
  // under the any's game name)
  it('keeps the site’s one block with the table’s any in the pack', async () => {
    expect(packHas(luke.blocks.any)).toBe(false);
    const stagger = pack.animations.find((c) => c.name === 'sword.blocked').clone();
    stagger.userData = { ...stagger.userData, source: luke.blocks.any };
    const { saber } = await hero({ 'sword.blocked': stagger });
    for (const side of [null, 'right']) {
      saber.block(true, side);
      expect(saber.blockClip, String(side)).toBe(BLOCK_CLIP);
      saber.block(false);
    }
    saber.block(true, 'left');
    expect(luke.blocks.left).toContain(saber.blockClip);
  });

  it('keeps the block it raised until a cut comes in on the other side', async () => {
    const { saber } = await hero();
    saber.block(true, 'left');
    const a = saber.blockClip;
    saber.block(true, 'left');
    saber.block(true, null);
    expect(saber.blockClip).toBe(a);
    saber.block(true, 'right');
    expect(saber.blockClip).not.toBe(a);
  });

  it('lays the block it chose at the held frame', async () => {
    const { saber, gp, frame } = await hero();
    saber.block(true, 'left');
    const clip = pack.animations.find((c) => c.userData.source === saber.blockClip);
    for (let i = 0; i < 30; i++) frame();
    const track = clip.tracks.find((t) => t.name === 'Wep_Root.quaternion');
    const v = track.createInterpolant().evaluate(clip.duration * BLOCK_AT);
    expect(gp.socket.quaternion.angleTo(new THREE.Quaternion(v[0], v[1], v[2], v[3]))).toBeLessThan(1e-3);
  });

  it('eases over to a block chosen again while it’s up, not in a frame', async () => {
    const { saber, gp, frame } = await hero();
    const heldOf = (n) => {
      const clip = pack.animations.find((c) => c.userData.source === n || c.name === n);
      const v = clip.tracks.find((t) => t.name === 'Wep_Root.quaternion').createInterpolant().evaluate(clip.duration * BLOCK_AT);
      return new THREE.Quaternion(v[0], v[1], v[2], v[3]).normalize();
    };
    saber.block(true, 'left');
    const a = heldOf(saber.blockClip);
    for (let i = 0; i < 30; i++) frame();
    saber.block(true, 'right');
    const b = heldOf(saber.blockClip);
    expect(a.angleTo(b)).toBeGreaterThan(0.1);
    frame();
    const q = gp.socket.quaternion.clone().normalize();
    expect(q.angleTo(a)).toBeGreaterThan(0.01);
    expect(q.angleTo(b)).toBeGreaterThan(0.01);
    for (let i = 0; i < 10; i++) frame();
    expect(gp.socket.quaternion.clone().normalize().angleTo(b)).toBeLessThan(1e-3);
  });
});

describe('a figure on another rig', () => {
  it('keeps its one block, whatever the side', () => {
    const a = meshy();
    const b = meshy();
    a.saber.block(true);
    b.saber.block(true, 'left');
    for (let i = 0; i < 20; i++) {
      a.frame();
      b.frame();
    }
    expect(a.saber.blockClip).toBe(BLOCK_CLIP);
    expect(b.saber.blockClip).toBe(BLOCK_CLIP);
    // (component by component: the hand's turn comes out of the IK a hair off unit length, which angleTo misreads)
    const qa = a.rig.bones.RightHand.quaternion.toArray();
    b.rig.bones.RightHand.quaternion.toArray().forEach((v, i) => expect(Math.abs(v - qa[i])).toBeLessThan(1e-9));
    const at = (s) => s.gp.gun.getWorldPosition(new THREE.Vector3()).toArray();
    expect(at(b)).toEqual(at(a));
  });
});
