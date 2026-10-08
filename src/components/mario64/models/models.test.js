import { describe, expect, it } from 'vitest';
import { poseFor } from '../pose';
import { TYPES } from '../rules/actors/index';
import { makeActor, makeMario, makeProp } from './index';
import { AREAS } from '../courses/index';

describe('the models', () => {
  it.each(Object.keys(TYPES))('makes a %s that can be updated', (type) => {
    const a = { type, def: { kind: 'red', course: 'bobomb', w: 600, h: 600, need: 3, post: 'post' }, pos: { x: 0, y: 0, z: 0 }, yaw: 0, state: 'idle', t: 0 };
    const m = makeActor(a);
    expect(m.root.isObject3D).toBe(true);
    expect(() => m.update(a, 10, { actors: [] })).not.toThrow();
  });

  it('makes every prop the areas place', () => {
    for (const area of Object.values(AREAS)) for (const p of area.props ?? []) expect(makeProp(p).root.children.length, p.kind).toBeGreaterThan(0);
  });

  it('says how long his legs are, for his stride', () => {
    expect(makeMario().leg).toBeGreaterThan(0.4);
    expect(makeMario().leg).toBeLessThan(0.7);
  });

  it('shrinks King Bob-omb away by the time since he was beaten, not by the clock', () => {
    const king = { id: 1, type: 'king', def: {}, pos: { x: 0, y: 0, z: 0 }, yaw: 0, state: 'defeated', t: 31, since: 1 };
    const m = makeActor(king);
    m.update(king, 120, { actors: [] }, { dt: 1, since: 30 }); // (t a whole minute of frames: the old shrink was none)
    expect(m.root.scale.y).toBeGreaterThan(0.4);
    expect(m.root.scale.y).toBeLessThan(0.6);
    king.t = 59;
    m.update(king, 148, { actors: [] }, { dt: 1, since: 58 });
    expect(m.root.scale.y).toBeLessThan(0.1);
  });

  it('keeps a walking Goomba’s feet on the ground', () => {
    const a = { id: 3, type: 'goomba', def: {}, pos: { x: 0, y: 0, z: 0 }, yaw: 0, state: 'wander', t: 0 };
    const m = makeActor(a);
    const feet = m.root.children.filter((o) => o.isMesh);
    expect(feet).toHaveLength(2);
    const speed = 1.2; // metres a second (its wander)
    const dt = 0.5; // frames
    let ground = 0;
    let prev = null;
    let worst = 0;
    for (let i = 0; i < 240; i++) {
      m.update(a, i * dt, { actors: [] }, { dt, since: i * dt, speed });
      ground += speed * (dt / 30);
      const f = feet[0];
      const at = ground + f.position.z;
      const down = f.position.y < 0.0701;
      if (prev?.down && down && i > 30) worst = Math.max(worst, Math.abs(at - prev.at) / (dt / 30));
      prev = { at, down };
    }
    expect(worst).toBeLessThan(0.15);
  });

  it('spins a knocked Goomba by the time passed, not by how often it’s drawn', () => {
    const a = { id: 4, type: 'goomba', def: {}, pos: { x: 0, y: 0, z: 0 }, yaw: 0, state: 'knocked', t: 0 };
    const once = makeActor(a);
    once.update(a, 1, { actors: [] }, { dt: 1 });
    const twice = makeActor(a);
    twice.update(a, 0.5, { actors: [] }, { dt: 0.5 });
    twice.update(a, 1, { actors: [] }, { dt: 0.5 });
    expect(twice.root.rotation.x).toBeCloseTo(once.root.rotation.x);
  });

  it('rears the Chain Chomp back as it winds up to bite', () => {
    const a = { id: 5, type: 'chomp', def: { post: 'post' }, pos: { x: 0, y: 0, z: 0 }, yaw: 0, state: 'idle', t: 0, tell: 0 };
    const m = makeActor(a);
    m.update(a, 10, { actors: [] });
    const head = m.root.children[0];
    const calm = head.rotation.x;
    a.tell = 1;
    m.update(a, 11, { actors: [] });
    expect(head.rotation.x).toBeLessThan(calm - 0.3);
  });

  it('has Toad hop as Mario comes up, and bob as he talks', () => {
    const a = { id: 6, type: 'toad', def: {}, pos: { x: 0, y: 0, z: 0 }, yaw: 0, state: 'idle', t: 0 };
    const m = makeActor(a);
    const far = { actors: [], mario: { pos: { x: 0, y: 0, z: 5000 } }, mode: 'play', dialogs: [] };
    m.update(a, 100, far);
    const near = { ...far, mario: { pos: { x: 0, y: 0, z: 300 } } };
    m.update(a, 101, near);
    let top = 0;
    for (let t = 102; t < 112; t++) {
      m.update(a, t, near);
      top = Math.max(top, m.root.children[0].position.y);
    }
    expect(top).toBeGreaterThan(0.08);
    const talking = { ...near, mode: 'dialog', dialogs: [{ title: 'Toad', text: 'hi' }] };
    const ys = [];
    for (let t = 200; t < 230; t++) {
      m.update(a, t, talking);
      ys.push(m.root.children[0].position.y);
    }
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(0.025);
  });

  it('poses Mario without throwing, his flip turning his body', () => {
    const m = makeMario();
    m.apply(poseFor('triple', 11));
    let spun = 0;
    m.root.traverse((o) => (spun = Math.max(spun, Math.abs(o.rotation.x))));
    expect(spun).toBeGreaterThan(1);
  });
});
