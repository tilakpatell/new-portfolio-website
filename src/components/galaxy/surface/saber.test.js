// A figure with a saber, headless: the Meshy skeleton with Luke's rest
// (meshyRig.fixture.js), the hilt in its hand by gunplay, its strokes the
// baked clips read off disk, run frame by frame as scene.js runs them
// (the figure placed, gunplay's pose, the saber's over it). What a stroke
// hits is what its blade swept through.
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { createBolts } from '../../../lib/combat/bolt';
import { meshyRig } from '../../../lib/three/meshyRig.fixture';
import { createGunplay } from '../../universe/gunplay';
import { STANCES } from './combatRules';
import { createSaber } from './saber';

const UP = new THREE.Vector3(0, 1, 0);
const clips = {};
beforeAll(async () => {
  for (const name of new Set([...STANCES.single.strokes.map((k) => k.clip), 'sword.heavy.a', 'sword.block'])) {
    const buf = readFileSync(`public/games/meshy/ual-${name}.glb`);
    const g = await new Promise((r, j) => new GLTFLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', r, j));
    clips[name] = g.animations[0];
  }
});

// a target standing at x, z: as activity.js's are, a holder and a figure 1.8 m tall
const target = (x, z) => {
  const holder = new THREE.Group();
  holder.position.set(x, 0, z);
  return { holder, fig: { tall: 1.8 } };
};

function duellist() {
  const rig = meshyRig();
  const scene = new THREE.Group();
  const holder = new THREE.Group();
  scene.add(holder);
  holder.add(rig.model);
  scene.updateMatrixWorld(true);
  const gp = createGunplay({ model: rig.model, bones: rig.bones }, 'saber', { unit: 1 });
  const saber = createSaber(gp, { stance: 'single', parent: scene, fig: { bones: rig.bones, hipsY: rig.hipsY }, clips });
  const me = { x: 0, z: 0, yaw: 0 };
  const hits = [];
  let now = 0;
  const frame = (targets, dt = 1 / 60) => {
    now += dt;
    holder.position.set(me.x, 0, me.z);
    holder.rotation.y = me.yaw;
    scene.updateMatrixWorld(true);
    const forward = new THREE.Vector3(Math.sin(me.yaw), 0, Math.cos(me.yaw));
    gp.set(dt, { aim: 0.75, look: 0, dir: null, forward, up: UP });
    saber.update(dt, now, { forward, up: UP, me, targets, hit: (t, damage, at, o) => hits.push({ t, damage, at: at.clone(), where: o?.where ?? null, clip: (now - saber.swinging.t0) * saber.swinging.speed, contact: saber.swinging.contact }) });
  };
  return { saber, me, hits, frame, get now() {
    return now;
  } };
}

// lit at guard for a moment, then one stroke through to its end
const strokeAt = (d, targets, opts = {}, guard = 20) => {
  for (let i = 0; i < guard; i++) d.frame(targets);
  const sw = d.saber.swing(d.now, opts);
  expect(sw).toBeTruthy();
  for (let i = 0; i < 120 && d.saber.swinging; i++) d.frame(targets);
  expect(d.saber.swinging).toBeNull();
  return sw;
};

describe('a stroke from a clip, a hit from the blade', () => {
  it('hits a body 1.8 m ahead, once, on the blade, inside the clip’s contact window', () => {
    const d = duellist();
    d.saber.light(true);
    const ahead = target(0, 1.8);
    strokeAt(d, [ahead]);
    expect(d.hits.map((h) => h.t)).toEqual([ahead]);
    const [h] = d.hits;
    expect(h.clip).toBeGreaterThanOrEqual(h.contact[0] - 1e-6);
    expect(h.clip).toBeLessThanOrEqual(h.contact[1] + 1 / 60);
    expect(h.at.y).toBeGreaterThan(0.3);
    expect(h.at.y).toBeLessThan(2.2);
  });
  it('misses the same body 2 m off to the side, and one behind', () => {
    const d = duellist();
    d.saber.light(true);
    strokeAt(d, [target(-2.6, 1.8), target(0, -2)]);
    expect(d.hits).toEqual([]);
  });
  it('steps by the clip’s root toward the one it’s locked on, and turns to them', () => {
    const d = duellist();
    d.saber.light(true);
    const far = target(1.5, 3.2);
    strokeAt(d, [far], { lock: far });
    const dist = Math.hypot(far.holder.position.x - d.me.x, far.holder.position.z - d.me.z);
    expect(dist).toBeLessThan(Math.hypot(1.5, 3.2) - 0.8);
    expect(d.me.yaw).toBeCloseTo(Math.atan2(1.5 - d.me.x, 3.2 - d.me.z), 0);
    expect(d.hits.map((h) => h.t)).toEqual([far]);
  });
  it('lands every stroke of the combo, and the heavy one, on a body it’s locked on 2.5 m off', () => {
    const d = duellist();
    d.saber.light(true);
    const got = [];
    for (const opts of [...STANCES.single.strokes.map(() => ({})), { heavy: true }]) {
      const foe = target(d.me.x + 0.8, d.me.z + 2.4);
      d.hits.length = 0;
      const sw = strokeAt(d, [foe], { ...opts, lock: foe }, got.length ? 0 : 20);
      got.push([sw.clip.name, d.hits.length]);
      // (straight on to the next, inside the combo's 0.45 s)
      for (let i = 0; i < 6; i++) d.frame([]);
    }
    expect(got.map(([n]) => n)).toEqual([...STANCES.single.strokes.map((k) => k.clip), 'sword.heavy.a']);
    expect(got.map(([, n]) => n)).toEqual(got.map(() => 1));
  });
  it('turns a bolt at the chest with the block up (the bolts’ own step), lets it land with the block down, and a tap of the block still shows for the parry window', () => {
    const d = duellist();
    d.saber.light(true);
    for (let i = 0; i < 20; i++) d.frame([]);
    // a trooper 15 m ahead fires at your chest, through the middle of your blade
    const shoot = () => {
      const bolts = createBolts({ pool: 4 });
      const guard = d.saber.guard();
      const { base, tip } = d.saber.blades[0].history().at(-1);
      const mid = base.map((v, i) => (v + tip[i]) / 2);
      const from = [mid[0], mid[1], mid[2] + 15];
      bolts.fire({ from, dir: [0, 0, -1], side: 'them', owner: 'trooper', damage: 8, deflect: true });
      const you = { id: 'you', a: [0, 0.4, 0], b: [0, 1.45, 0], r: 0.4, side: 'you' };
      for (let i = 0; i < 30; i++) {
        const [e] = bolts.step(1 / 30, { solids: () => null, bodies: [you], blades: guard ? [guard] : [] });
        if (e && e.type !== 'gone') return e.type;
      }
      return null;
    };
    expect(d.saber.guard()).toBeNull();
    expect(shoot()).toBe('hit');
    d.saber.block(true);
    for (let i = 0; i < 20; i++) d.frame([]);
    expect(d.saber.guard()).toMatchObject({ id: 'you', side: 'you' });
    expect(shoot()).toBe('deflect');
    d.saber.block(false);
    for (let i = 0; i < 30; i++) d.frame([]);
    expect(d.saber.guard()).toBeNull();
    // (down and up again in a frame: still up for the parry window, then down)
    d.saber.block(true);
    d.frame([]);
    d.saber.block(false);
    for (let i = 0; i < 6; i++) d.frame([]);
    expect(d.saber.guard()).not.toBeNull();
    for (let i = 0; i < 20; i++) d.frame([]);
    expect(d.saber.guard()).toBeNull();
  });
  it('hits nothing with the blade out', () => {
    const d = duellist();
    strokeAt(d, [target(0, 1.8)]);
    // (a stroke lights it: put out again before the next, it can't hit)
    d.saber.light(false);
    for (let i = 0; i < 30; i++) d.frame([]);
    d.hits.length = 0;
    d.saber.swing(d.now);
    d.saber.light(false);
    for (let i = 0; i < 120 && d.saber.swinging; i++) d.frame([target(0, 1.8)]);
    expect(d.hits).toEqual([]);
  });

  // Rapier's bodies: a figure with hurtboxes by region is hit by the region, once a stroke, and the hit says which
  it('a stroke on a figure with regions lands once and says where', () => {
    const plain = duellist();
    plain.saber.light(true);
    strokeAt(plain, [target(0, 1.8)]);
    expect(plain.hits[0].where).toBe('whole');
    const d = duellist();
    d.saber.light(true);
    // (a figure facing you 1.5 m off, its regions where a body's are: the stroke
    // meets a shoulder, the chest or the head, not a capsule half a metre wide)
    const t = target(0, 1.5);
    const col = (y0, y1, r, x = 0) => ({ a: [x, y0, 1.5], b: [x, y1, 1.5], r });
    const arm = (x) => ({ a: [x * 0.2, 1.45, 1.5], b: [x * 0.45, 1.25, 1.5], r: 0.07 });
    t.hb = { rig: { single: false, segments: new Map([['head', col(1.6, 1.8, 0.12)], ['chest', col(0.9, 1.45, 0.2)], ['upperArmL', arm(1)], ['upperArmR', arm(-1)], ['thighL', col(0.45, 0.9, 0.09, 0.1)], ['thighR', col(0.45, 0.9, 0.09, -0.1)]]) } };
    strokeAt(d, [t]);
    expect(d.hits).toHaveLength(1);
    expect(d.hits[0].t).toBe(t);
    expect(['head', 'chest', 'upperArmL', 'upperArmR', 'thighL', 'thighR']).toContain(d.hits[0].where);
  });
});
