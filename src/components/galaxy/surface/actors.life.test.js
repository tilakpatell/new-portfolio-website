import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { approach, createActors, feetOf, modelFigureOf, think } from './actors';
import { hear, placesOf } from './needs';

// a figure that keeps a note of what it's asked to do
const noting = () => {
  const calls = [];
  return {
    model: new THREE.Group(),
    tall: 1.8,
    anim: {},
    calls,
    update: (dt, move, motion) => calls.push(['update', dt, move, motion]),
    play: (name, opts) => (calls.push(['play', name, opts]), Promise.resolve(true)),
    stop: (fade, layer) => calls.push(['stop', fade, layer]),
    base: (name) => (calls.push(['base', name]), Promise.resolve('done')),
    look: (target) => calls.push(['look', target]),
    react: (event, ctx) => (calls.push(['react', event, ctx]), { clip: event }),
    dispose() {},
  };
};
const flat = { heightAt: () => 0, solids: null, normalAt: () => [0, 1, 0], reach: 600 };
const settle = () => new Promise((r) => setTimeout(r, 0));
async function world(life, { wants = [], seed = 5 } = {}) {
  const figs = [];
  const actors = createActors({
    parent: new THREE.Group(),
    world: flat,
    life,
    wants,
    seed,
    figure: () => {
      const f = noting();
      figs.push(f);
      return Promise.resolve(f);
    },
  });
  await settle();
  await settle();
  return { actors, figs };
}
const DT = 1 / 30;
const named = (calls, kind, name) => calls.filter((c) => c[0] === kind && (name == null || c[1] === name));
const ORIGIN = { x: 0, y: 0, z: 0 };

describe('a wanderer’s body follows its brain', () => {
  it('is given the motion its brain moved it by: its ground, along its facing, not sideways', async () => {
    const { actors, figs } = await world([{ kind: 'villager', at: [0, 0], roam: 12, speed: 1.2 }]);
    const a = actors.actors[0];
    let walked = 0;
    let told = 0;
    let side = 0;
    for (let i = 0; i < 600; i++) {
      const was = [a.b.x, a.b.z];
      actors.update(DT, null, ORIGIN);
      walked += Math.hypot(a.b.x - was[0], a.b.z - was[1]);
      const [, dt, move, m] = figs[0].calls.at(-1);
      told += m.speed * dt;
      side = Math.max(side, Math.abs(m.side));
      expect(move).toBeCloseTo(Math.min(1, Math.hypot(m.speed, m.side) / 2.4), 6);
    }
    expect(walked).toBeGreaterThan(3);
    expect(told).toBeCloseTo(walked, 1);
    expect(side).toBeLessThan(0.3);
  });

  it('stands still for you (no legs going under it), its head turned to you, a wave the first time', async () => {
    const { actors, figs } = await world([{ kind: 'villager', at: [0, 0], roam: 6, speed: 1.2, says: ['Watch yourself.'] }]);
    const you = { x: 2.5, y: 0, z: 0, yaw: -Math.PI / 2, speed: 0 };
    for (let i = 0; i < 90; i++) actors.update(DT, you, you);
    const ups = named(figs[0].calls, 'update').slice(-30);
    for (const [, , , m] of ups) expect(Math.abs(m.speed)).toBeLessThan(1e-6);
    const looks = named(figs[0].calls, 'look').slice(-5);
    for (const [, p] of looks) expect(p).toMatchObject({ x: 2.5, y: 1.6, z: 0 });
    expect(named(figs[0].calls, 'react', 'greet')).toHaveLength(1);
    // (and not again till you've been well away)
    for (let i = 0; i < 90; i++) actors.update(DT, you, you);
    expect(named(figs[0].calls, 'react', 'greet')).toHaveLength(1);
  });
});

describe('what the people hear', () => {
  it('a townsman startles at a shot, then runs from it; a trooper raises his blaster to it; one out of earshot goes on', async () => {
    const { actors, figs } = await world([
      { kind: 'villager', at: [5, 0], roam: 1, speed: 1 },
      { kind: 'stormtrooper', at: [0, 6], roam: 1, speed: 1 },
      { kind: 'villager', at: [300, 0], roam: 1, speed: 1 },
    ]);
    for (let i = 0; i < 10; i++) actors.update(DT, null, ORIGIN);
    const [town, trooper, far] = actors.actors;
    const from = Math.hypot(town.b.x, town.b.z);
    actors.hear({ at: [0, 0], loudness: 1, t: 1 });
    actors.update(DT, null, ORIGIN);
    expect(named(figs[0].calls, 'react', 'gunfire')).toHaveLength(1);
    expect(named(figs[0].calls, 'react', 'gunfire')[0][2]).toMatchObject({ target: { x: 0, z: 0 }, moving: false });
    expect(named(figs[1].calls, 'play', 'aim.pistol')[0][2]).toMatchObject({ layer: 'upper' });
    expect(named(figs[2].calls, 'react')).toHaveLength(0);
    expect(named(figs[2].calls, 'play')).toHaveLength(0);
    // (its head to it)
    expect(named(figs[1].calls, 'look').at(-1)[1]).toEqual({ x: 0, z: 0 });
    // stood a moment, startled, then off at a run (its step back let go as it goes)
    const stood = [town.b.x, town.b.z];
    for (let i = 0; i < 12; i++) actors.update(DT, null, ORIGIN);
    expect(Math.hypot(town.b.x - stood[0], town.b.z - stood[1])).toBeLessThan(0.05);
    for (let i = 0; i < 120; i++) actors.update(DT, null, ORIGIN);
    expect(Math.hypot(town.b.x, town.b.z)).toBeGreaterThan(from + 3);
    expect(named(figs[0].calls, 'stop').some((c) => c[2] === 'full')).toBe(true);
    expect(trooper.b.flee).toBeFalsy();
    expect(far.b.flee).toBeFalsy();
  });
});

describe('the places people use', () => {
  it('one goes to its spot at the bar, faces it and drinks for its while, then goes; two never share one slot', async () => {
    const wants = [{ id: 'bar', kind: 'food', at: [0, 0], clip: 'drink', slots: 1, spots: [[3, 0]], pause: 4 }];
    const { actors, figs } = await world([{ kind: 'twilek', n: 2, at: [9, 0], spread: 1, roam: 2, speed: 1.2, needs: ['food'] }], { wants });
    let used = null;
    let left = false;
    for (let i = 0; i < 30 * 60; i++) {
      actors.update(DT, null, ORIGIN);
      const users = actors.actors.filter((a) => a.b.use);
      expect(users.length).toBeLessThanOrEqual(1);
      if (users[0] && !used) used = users[0];
      if (used && users[0] === used) {
        expect(Math.hypot(used.b.x - 3, used.b.z)).toBeLessThan(0.3);
      }
      if (used && !used.b.use) {
        left = true;
        break;
      }
    }
    expect(used).toBeTruthy();
    expect(left).toBe(true);
    const fig = figs[actors.actors.indexOf(used)];
    const drink = named(fig.calls, 'play', 'drink');
    expect(drink).toHaveLength(1);
    expect(drink[0][2]).toMatchObject({ loop: true });
    expect(Math.abs(Math.atan2(Math.sin(used.b.yaw + Math.PI / 2), Math.cos(used.b.yaw + Math.PI / 2)))).toBeLessThan(0.2); // (facing the bar, −x)
    actors.update(DT, null, ORIGIN);
    expect(named(fig.calls, 'stop').length).toBeGreaterThan(0);
  });

  it('a seat is sat in, and got up off before it goes', () => {
    const [bench] = placesOf([{ id: 'bench', kind: 'rest', at: [2, 0], base: 'sit', slots: 1, face: 0, pause: 2 }]);
    const b = { x: 0, z: 0, yaw: 0, home: [0, 0], speed: 0, to: null, wait: 0, leg: 0, visited: {}, last: null };
    const spec = { needs: ['rest'], speed: 1.2, roam: 4 };
    let t = 0;
    for (; t < 20 && !b.use; t += DT) think(b, spec, DT, () => 0.5, { wants: [bench], t });
    expect(b.use?.want).toBe(bench);
    for (; t < 40 && b.use; t += DT) think(b, spec, DT, () => 0.5, { wants: [bench], t });
    // (up, and stood a moment before it walks)
    const at = [b.x, b.z];
    const up = t;
    for (; t < up + 1; t += DT) think(b, spec, DT, () => 0.5, { wants: [bench], t });
    expect(Math.hypot(b.x - at[0], b.z - at[1])).toBeLessThan(1e-9);
  });

  it('one sat who hears a shot gets up before it runs', () => {
    const [bench] = placesOf([{ id: 'bench', kind: 'rest', at: [2, 0], base: 'sit', slots: 1, face: 0, pause: 30 }]);
    const b = { x: 0, z: 0, yaw: 0, home: [0, 0], speed: 0, to: null, wait: 0, leg: 0, visited: {}, last: null };
    const spec = { kind: 'villager', needs: ['rest'], speed: 1.2 };
    let t = 0;
    for (; t < 20 && !b.use; t += DT) think(b, spec, DT, () => 0.5, { wants: [bench], t });
    expect(b.use).toBeTruthy();
    hear(b, spec, { at: [10, 0] }, t, () => 0.5);
    const at = [b.x, b.z];
    for (const end = t + 0.8 + 1.2 - 0.05; t < end; t += DT) think(b, spec, DT, () => 0.5, { wants: [bench], t });
    expect(b.use).toBe(null);
    expect(Math.hypot(b.x - at[0], b.z - at[1])).toBeLessThan(1e-9);
    for (const end = t + 2; t < end; t += DT) think(b, spec, DT, () => 0.5, { wants: [bench], t });
    expect(b.x).toBeLessThan(at[0] - 1); // (away from the shot, at +x)
  });

  it('the only place of its kind draws it back after a wander', () => {
    const [fire] = placesOf([{ id: 'fire', kind: 'rest', at: [4, 0], slots: 3, base: 'crouch', pause: 2 }]);
    const b = { x: 0, z: 0, yaw: 0, home: [0, 0], speed: 0, to: null, wait: 0, leg: 0, visited: {}, last: null };
    let visits = 0;
    let was = null;
    for (let t = 0; t < 120; t += DT) {
      think(b, { needs: ['rest'], speed: 1.2, roam: 6 }, DT, () => 0.5, { wants: [fire], t });
      if (b.use && !was) visits++;
      was = b.use;
    }
    expect(visits).toBeGreaterThan(1);
  });
});

describe('the people with each other', () => {
  it('two who want company meet a step apart, face each other and take turns talking with their hands', async () => {
    const { actors, figs } = await world([{ kind: 'villager', n: 2, at: [0, 0], spread: 4, roam: 3, speed: 1, says: ['Hutt business. Don’t ask.'] }]);
    let talked = false;
    for (let i = 0; i < 30 * 120 && !talked; i++) {
      actors.update(DT, null, ORIGIN);
      const [a, b] = actors.actors;
      if (a.mode === 'talk' || b.mode === 'talk') {
        const d = Math.hypot(a.b.x - b.b.x, a.b.z - b.b.z);
        if (Math.abs(d - 1.3) < 0.3) talked = true;
      }
    }
    expect(talked).toBe(true);
    expect(figs.some((f) => named(f.calls, 'play', 'talk').some((c) => c[2].layer === 'upper' && c[2].loop))).toBe(true);
  });

  it('a band walks together, the rest near its leader', async () => {
    const { actors } = await world([{ kind: 'tusken', n: 3, at: [0, 0], spread: 2, roam: 20, speed: 1, group: true }]);
    let worst = 0;
    for (let i = 0; i < 30 * 40; i++) {
      actors.update(DT, null, ORIGIN);
      if (i < 30 * 5) continue;
      const [lead, ...rest] = actors.actors;
      for (const o of rest) worst = Math.max(worst, Math.hypot(o.b.x - lead.b.x, o.b.z - lead.b.z));
    }
    const [lead] = actors.actors;
    expect(Math.hypot(lead.b.x, lead.b.z)).toBeGreaterThan(1);
    expect(worst).toBeLessThan(6);
  });
});

describe('what they say, and how', () => {
  it('a line is said with the hands for its length, looking at you; a line in brackets is done, not said; a Tusken holds his stick high', async () => {
    const { actors, figs } = await world([
      { kind: 'villager', at: [0, 0], still: true, says: ['If you’re looking for a pilot, try the cantina.', '(It stares. It doesn’t move.)'] },
      { kind: 'tusken', at: [5, 0], still: true, says: ['(A long, rising howl, and the gaffi stick held high.)'] },
    ]);
    const you = { x: 1, y: 0, z: 0, yaw: 0, speed: 0 };
    actors.update(DT, you, you);
    const [local, tusken] = actors.actors;
    expect(actors.say(local).text).toMatch(/pilot/);
    const said = named(figs[0].calls, 'react', 'say');
    expect(said).toHaveLength(1);
    expect(said[0][2].hold).toBeGreaterThan(2);
    expect(said[0][2].target).toMatchObject({ x: 1, z: 0 });
    actors.say(local);
    expect(named(figs[0].calls, 'react', 'say')).toHaveLength(1);
    // (he greeted you with it as you came up, and holds it high again as he howls)
    const held = named(figs[1].calls, 'play', 'cheer').length;
    actors.say(tusken);
    expect(named(figs[1].calls, 'play', 'cheer')).toHaveLength(held + 1);
    expect(named(figs[1].calls, 'react', 'say')).toHaveLength(0);
  });

  it('one sat in a booth sits', async () => {
    const { figs } = await world([{ kind: 'greedo', at: [0, 0], still: true, sit: true, says: ['…'] }]);
    expect(named(figs[0].calls, 'base', 'sit')).toHaveLength(1);
  });
});

describe('a step toward a spot', () => {
  it('slows into it and stops on it; a sidestep keeps the way it faces', () => {
    const b = { x: 0, z: 0, yaw: 0, speed: 0 };
    let there = false;
    let worst = 0;
    for (let i = 0; i < 300 && !there; i++) {
      there = approach(b, { x: 3, z: 4 }, DT);
      worst = Math.max(worst, Math.hypot(b.x, b.z));
    }
    expect(there).toBe(true);
    expect(Math.hypot(b.x - 3, b.z - 4)).toBeLessThan(0.15);
    expect(worst).toBeLessThan(5.01);
    const c = { x: 0, z: 0, yaw: 0.4, speed: 0 };
    for (let i = 0; i < 120; i++) approach(c, { x: 1, z: 0 }, DT, { sidestep: true, face: 0.4 });
    expect(c.yaw).toBeCloseTo(0.4, 6);
    expect(Math.hypot(c.x - 1, c.z)).toBeLessThan(0.15);
  });
});

// a rig not Meshy's with two legs, its feet the lowest bones each side
function legged() {
  const g = new THREE.Group();
  const root = new THREE.Bone();
  root.name = 'root';
  root.position.y = 1;
  g.add(root);
  for (const x of [0.3, -0.3]) {
    const thigh = new THREE.Bone();
    thigh.name = `thigh${x}`;
    thigh.position.set(x, -0.1, 0);
    const foot = new THREE.Bone();
    foot.name = `foot${x}`;
    foot.position.set(0, -0.85, 0);
    thigh.add(foot);
    root.add(thigh);
  }
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.8, 0.4).translate(0, 0.9, 0), new THREE.MeshBasicMaterial()));
  return g;
}

describe('a creature’s legs', () => {
  it('finds a rig’s feet: the lowest bone on each side', () => {
    const scene = legged();
    new THREE.Group().add(scene);
    const feet = feetOf(scene);
    expect(feet.left.name).toBe('foot0.3');
    expect(feet.right.name).toBe('foot-0.3');
  });

  it('a walk with no idle, stopping, finishes its step onto a foot rather than freezing mid-stride', () => {
    const swing = new THREE.AnimationClip('Walk', 1, [new THREE.QuaternionKeyframeTrack('root.quaternion', [0, 0.5, 1], [0, 0, 0, 1, 0, 0.3826834, 0, 0.9238795, 0, 0, 0, 1])]);
    const fig = modelFigureOf(legged(), { animations: [swing], anim: { walk: 'Walk' }, seed: 3 });
    for (let i = 0; i < 11; i++) fig.update(DT, 0.5, { speed: 1.2, side: 0, turn: 0 });
    for (let i = 0; i < 90; i++) fig.update(DT, 0, { speed: 0, side: 0, turn: 0 });
    const a = fig.anim.actions.walk;
    const plant = fig.anim.loco.strides.walk?.plant ?? 0;
    const at = ((((a.time / a.getClip().duration - plant) % 1) + 1) % 1) % 0.5;
    expect(Math.min(at, 0.5 - at)).toBeLessThan(0.05);
    // (and stays there, standing)
    const t = a.time;
    for (let i = 0; i < 30; i++) fig.update(DT, 0, { speed: 0, side: 0, turn: 0 });
    expect(a.time).toBeCloseTo(t, 6);
  });
});

// A page's own figure maker (the Rick and Morty planets' cast) is asked
// first; a kind it has nothing for is made as the galaxy's always were.
describe('a figure maker handed in', () => {
  it('is asked first, and a kind it gives nothing for still stands', async () => {
    const asked = [];
    const mine = noting();
    const actors = createActors({
      parent: new THREE.Group(),
      world: flat,
      life: [
        { kind: 'gazorpian', at: [0, 0] },
        { kind: 'jawa', at: [4, 0], model: false },
      ],
      figure: (kind) => {
        asked.push(kind);
        return kind === 'gazorpian' ? Promise.resolve(mine) : Promise.resolve(null);
      },
    });
    await settle();
    await settle();
    expect(asked).toEqual(['gazorpian', 'jawa']);
    expect(actors.actors[0].fig).toBe(mine);
    expect(actors.actors[1].fig).toBeTruthy();
    expect(actors.actors[1].fig).not.toBe(mine);
    actors.dispose();
  });
});
