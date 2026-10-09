// A duel, headless: two figures on the Meshy skeleton (meshyRig.fixture.js),
// each with a saber in its hand (gunplay, saber.js) playing the baked sword
// clips off disk, run frame by frame as the scene runs them. What lands is
// what a blade sweeps; what meets it is the other's block, as the scene
// decides it (duellists.js's met and turnOf).
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { createDuellist, duelStep } from '../../../lib/combat/duel';
import { meshyRig } from '../../../lib/three/meshyRig.fixture';
import { createGunplay } from '../../universe/gunplay';
import { GUARD, PARRY, STANCES } from './combatRules';
import { asTarget, landed, met, swingingOf, turnOf } from './duellists';
import { createSaber } from './saber';

const UP = new THREE.Vector3(0, 1, 0);
const DT = 1 / 60;
const clips = {};
beforeAll(async () => {
  for (const name of new Set([...STANCES.single.strokes.map((k) => k.clip), 'sword.block'])) {
    const buf = readFileSync(`public/games/meshy/ual-${name}.glb`);
    const g = await new Promise((r, j) => new GLTFLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', r, j));
    clips[name] = g.animations[0];
  }
});

// a figure with a lit saber at x, z, facing yaw
function fighter(x, z, yaw) {
  const rig = meshyRig();
  const scene = new THREE.Group();
  const holder = new THREE.Group();
  scene.add(holder);
  holder.add(rig.model);
  scene.updateMatrixWorld(true);
  const gp = createGunplay({ model: rig.model, bones: rig.bones }, 'saber', { unit: 1 });
  const saber = createSaber(gp, { stance: 'single', parent: scene, fig: { bones: rig.bones, hipsY: rig.hipsY }, clips });
  saber.light(true);
  const me = { x, z, yaw };
  return {
    saber,
    me,
    holder,
    fig: { tall: 1.8 },
    spec: {},
    // a frame: placed, gunplay's pose, the saber's over it
    frame(now, targets = [], hit = null) {
      holder.position.set(me.x, 0, me.z);
      holder.rotation.y = me.yaw;
      scene.updateMatrixWorld(true);
      const forward = new THREE.Vector3(Math.sin(me.yaw), 0, Math.cos(me.yaw));
      gp.set(DT, { aim: 0.75, look: 0, dir: null, forward, up: UP });
      saber.update(DT, now, { forward, up: UP, me, targets, hit });
    },
  };
}

// they at the origin facing +z, you 1.8 m ahead facing them; both lit at guard a moment
function duel() {
  const them = fighter(0, 0, 0);
  const you = fighter(0, 1.8, Math.PI);
  const youT = asTarget().at({ x: 0, y: 0, z: 1.8 });
  let now = 0;
  const step = (fn) => {
    now += DT;
    fn?.(now);
  };
  for (let i = 0; i < 20; i++) step((t) => (them.frame(t), you.frame(t)));
  // a duellist as activity.js has one, for landed and turnOf
  const t = { blade: { saber: them.saber }, hostile: { damage: 16, guard: 3 }, b: them.me, holder: them.holder, fig: them.fig, guard: 3, stagger: 0, duel: null };
  return { them, you, youT, t, step, get now() {
    return now;
  } };
}

// their stroke at you, frame by frame to its end; `block(now, sw)` raises yours when it says to.
// Each contact goes through the scene's rule (met) as it lands.
function theirStroke(d, block = () => false) {
  const sw = d.them.saber.swing(d.now, { clip: STANCES.single.strokes[0].clip, lock: d.youT });
  expect(sw).toBeTruthy();
  const out = [];
  let blockAt = null;
  let guard = { value: GUARD.max, hitAt: null, brokenAt: null };
  for (let i = 0; i < 120 && d.them.saber.swinging; i++)
    d.step((now) => {
      if (blockAt == null && block(now, sw)) {
        blockAt = now;
        d.you.saber.block(true);
      }
      d.you.frame(now);
      d.them.frame(now, [d.youT], (x, damage, at, o) => {
        const c = landed(d.t, x, damage, at, o);
        const m = met(c, { saber: d.you.saber, blockAt, now, window: PARRY.window, guard });
        guard = m.guard;
        out.push({ ...m, c });
      });
    });
  return { out, guard, sw };
}

describe('a duellist’s stroke at you', () => {
  it('lands its damage through its blade’s sweep, inside its contact window, with no block', () => {
    const d = duel();
    const { out, sw } = theirStroke(d);
    expect(out).toHaveLength(1);
    expect(out[0].how).toBe('hit');
    expect(out[0].damage).toBe(16);
    // (its contact began where the clip says, in the world's time)
    expect(out[0].c.contactAt).toBeCloseTo(sw.t0 + sw.contact[0] / sw.speed, 6);
    expect(out[0].c.point[1]).toBeGreaterThan(0.3);
  });

  it('into your held block spends your guard and deals nothing', () => {
    const d = duel();
    d.you.saber.block(true);
    for (let i = 0; i < 20; i++) d.step((now) => d.you.frame(now));
    const { out, guard } = theirStroke(d);
    expect(out).toHaveLength(1);
    expect(out[0].how).toBe('block');
    expect(out[0].damage).toBe(0);
    expect(guard.value).toBeLessThan(GUARD.max);
  });

  it('into a block begun within the parry window before its contact is a parry', () => {
    const d = duel();
    const { out, guard } = theirStroke(d, (now, sw) => now >= sw.t0 + sw.contact[0] / sw.speed - PARRY.window * 0.6);
    expect(out).toHaveLength(1);
    expect(out[0].how).toBe('parry');
    expect(out[0].damage).toBe(0);
    expect(guard.value).toBe(GUARD.max);
  });
});

describe('your stroke at a duellist', () => {
  // you strike; its mind reads your stroke each frame and raises its blade (or doesn't)
  function yourStroke(d, rates) {
    d.t.duel = createDuellist({ reach: 2.2, ...rates });
    d.t.duel.at = [0, 0];
    d.t.duel.state = 'circle';
    d.t.duel.timer = 5;
    const sw = d.you.saber.swing(d.now, { clip: STANCES.single.strokes[0].clip, lock: { holder: d.them.holder, fig: d.them.fig } });
    expect(sw).toBeTruthy();
    const out = [];
    for (let i = 0; i < 120 && d.you.saber.swinging; i++)
      d.step((now) => {
        const o = duelStep(d.t.duel, { pos: [d.you.me.x, d.you.me.z], swinging: swingingOf(d.you.saber, now) }, DT, () => 0);
        d.them.saber.block(o.block);
        d.them.frame(now);
        d.you.frame(now, [d.them], () => out.push(turnOf(d.t, {})));
      });
    return out;
  }

  it('into its held block is turned, and its guard counts down', () => {
    const d = duel();
    const out = yourStroke(d, { guard: 1, parry: 0 });
    expect(out).toEqual([{ parried: true, broke: false, perfect: false }]);
    expect(d.t.guard).toBe(2);
  });

  it('into its parry is turned, and you’re the one who reels', () => {
    const d = duel();
    const out = yourStroke(d, { guard: 1, parry: 1 });
    expect(out).toEqual([{ parried: true, broke: false, perfect: true }]);
  });

  it('lands when its blade isn’t up', () => {
    const d = duel();
    const out = yourStroke(d, { guard: 0, parry: 0 });
    expect(out).toEqual([{ parried: false, broke: false, perfect: false }]);
  });
});
