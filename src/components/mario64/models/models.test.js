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

  it('poses Mario without throwing, his flip turning his body', () => {
    const m = makeMario();
    m.apply(poseFor('triple', 11));
    let spun = 0;
    m.root.traverse((o) => (spun = Math.max(spun, Math.abs(o.rotation.x))));
    expect(spun).toBeGreaterThan(1);
  });
});
