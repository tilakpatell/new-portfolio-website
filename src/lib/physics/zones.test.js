import { describe, expect, it, vi } from 'vitest';
import { createPhysics } from './world';
import { createZone } from './zones';

const ground = (p) => p.add({ type: 'fixed', position: [0, -0.5, 0], group: 'floor', colliders: [{ shape: 'cuboid', args: [20, 0.5, 20] }] });
const walker = (p, at) => p.add({ type: 'kinematicPositionBased', position: at, group: 'character', colliders: [{ shape: 'capsule', args: [0.6, 0.4] }] });
const stroll = (p, w, from, to, steps = 20) => {
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    w.body.setNextKinematicTranslation({ x: from[0] + (to[0] - from[0]) * t, y: from[1], z: from[2] });
    p.step(1 / 60);
  }
};

describe('createZone', () => {
  it('a figure walking through a fixed zone is inside() during and not after', async () => {
    const p = await createPhysics();
    ground(p);
    const seen = [];
    const z = createZone(p, { position: [0, 1, 0], args: [1], tag: 'bite', onEnter: (b, tag) => seen.push(['in', b, tag]), onLeave: (b, tag) => seen.push(['out', b, tag]) });
    const w = walker(p, [-4, 1, 0]);
    p.step(1 / 60);
    expect(z.inside()).toEqual([]);
    stroll(p, w, [-4, 1, 0], [0, 1, 0]);
    expect(z.inside()).toEqual([w]);
    stroll(p, w, [0, 1, 0], [4, 1, 0]);
    expect(z.inside()).toEqual([]);
    expect(seen).toEqual([
      ['in', w, 'bite'],
      ['out', w, 'bite'],
    ]);
    p.dispose();
  });

  it('a moved zone catches a standing figure', async () => {
    const p = await createPhysics();
    ground(p);
    const z = createZone(p, { position: [-6, 1, 0], args: [1] });
    const w = walker(p, [0, 1, 0]);
    p.step(1 / 60);
    for (let i = 1; i <= 20; i++) {
      z.move([-6 + (6 * i) / 20, 1, 0]);
      p.step(1 / 60);
    }
    expect(z.inside()).toEqual([w]);
    p.dispose();
  });

  it('remove() empties inside() and fires no more', async () => {
    const p = await createPhysics();
    ground(p);
    const leave = vi.fn();
    const z = createZone(p, { position: [0, 1, 0], args: [1], onLeave: leave });
    const w = walker(p, [0, 1, 0]);
    p.step(1 / 60);
    p.step(1 / 60);
    expect(z.inside()).toEqual([w]);
    z.remove();
    expect(z.inside()).toEqual([]);
    stroll(p, w, [0, 1, 0], [4, 1, 0]);
    expect(leave).not.toHaveBeenCalled();
    p.dispose();
  });
});
