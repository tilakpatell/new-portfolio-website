import { describe, expect, it } from 'vitest';
import { createKit } from '../../courses/shapes';
import { makeWorld } from '../collide';
import { newMario } from '../mario';
import { interact, newScene, stepActors, useB } from './index';

const floor = () => {
  const k = createKit();
  k.box({ x: 0, y: -100, z: 0, w: 20000, h: 100, d: 20000, mat: 'g' });
  const o = k.done();
  return makeWorld(o.tris, o.kinds);
};
const scene = (o = {}) => newScene({ world: floor(), mario: newMario({ x: 0, y: 0, z: 0 }), save: { stars: {} }, area: { redStar: { index: 1, x: 0, y: 300, z: 2000 } }, ...o });
const tick = (g) => {
  stepActors(g);
  interact(g);
};
const types = (g) => g.out.map((e) => e.type);

describe('coins', () => {
  it('adds a coin and heals a wedge when touched', () => {
    const g = scene();
    g.mario.health = 5;
    g.spawn({ type: 'coin', x: 0, y: 0, z: 0 });
    tick(g);
    expect(g.mario.coins).toBe(1);
    expect(g.mario.health).toBe(6);
    expect(g.out).toContainEqual(expect.objectContaining({ type: 'coin', value: 1 }));
    expect(g.actors.filter((a) => a.type === 'coin')).toHaveLength(0);
  });

  it('brings out the red coin star with the eighth red coin', () => {
    const g = scene();
    for (let i = 0; i < 8; i++) {
      g.spawn({ type: 'coin', kind: 'red', x: 0, y: 0, z: 0 });
      tick(g);
    }
    expect(g.visit.reds).toBe(8);
    const star = g.actors.find((a) => a.type === 'star');
    expect(star).toBeDefined();
    expect(star.index).toBe(1);
    expect(star.pos.z).toBe(2000);
  });

  it('gives a life at the 50th coin', () => {
    const g = scene();
    g.mario.coins = 49;
    const lives = g.mario.lives;
    g.spawn({ type: 'coin', x: 0, y: 0, z: 0 });
    tick(g);
    expect(g.mario.lives).toBe(lives + 1);
    expect(types(g)).toContain('oneup');
  });
});

describe('stars, signs, doors and paintings', () => {
  it('emits star with its index when a star is touched', () => {
    const g = scene();
    g.spawn({ type: 'star', index: 2, x: 0, y: 0, z: 0 });
    tick(g);
    expect(g.out).toContainEqual({ type: 'star', index: 2 });
  });

  it('reads a sign on B, instead of punching', () => {
    const g = scene();
    g.spawn({ type: 'sign', text: 'Hello', x: 0, y: 0, z: 100 });
    expect(useB(g)).toBe(true);
    expect(g.out).toContainEqual(expect.objectContaining({ type: 'dialog', text: 'Hello' }));
    const far = scene();
    far.spawn({ type: 'sign', text: 'Hello', x: 0, y: 0, z: 900 });
    expect(useB(far)).toBe(false);
  });

  it('keeps a star door shut, saying how many stars it needs, with too few', () => {
    const g = scene();
    g.spawn({ type: 'stardoor', need: 3, x: 0, y: 0, z: 60, yaw: Math.PI });
    tick(g);
    expect(g.out).toContainEqual({ type: 'locked', need: 3 });
  });

  it('lets Mario through an open star door, into where it leads', () => {
    const g = scene({ save: { stars: { a: [true, true, true] } } });
    g.spawn({ type: 'stardoor', need: 3, to: { area: 'bowser', entry: 'main' }, x: 0, y: 0, z: 60, yaw: Math.PI });
    tick(g);
    expect(g.out).toContainEqual({ type: 'warp', area: 'bowser', entry: 'main' });
  });

  it('opens the course card when he jumps into a painting', () => {
    const g = scene();
    // a painting on a wall at z = 50, facing back toward -z, 600 wide and tall from y 0
    g.spawn({ type: 'painting', course: 'bobomb', x: 0, y: 0, z: 50, yaw: Math.PI, w: 600, h: 600 });
    g.mario.pos.y = 100;
    g.mario.vel.z = 20;
    g.mario.airborne = true;
    tick(g);
    expect(g.out).toContainEqual({ type: 'card', course: 'bobomb' });
  });

  it('does nothing when he walks past a painting, not into it', () => {
    const g = scene();
    g.spawn({ type: 'painting', course: 'bobomb', x: 0, y: 0, z: 50, yaw: Math.PI, w: 600, h: 600 });
    g.mario.pos.y = 100;
    g.mario.vel.x = 20;
    tick(g);
    expect(types(g)).not.toContain('card');
  });
});
