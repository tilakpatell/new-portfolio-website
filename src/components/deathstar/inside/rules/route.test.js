// The way shown: where the story points, and the next door, lift or the
// target itself on the way there.
import { describe, expect, it } from 'vitest';
import { newGame, teleport } from './game';
import { routeTo, targetOf } from './route';

const at = (g, room, x, z) => {
  const r = g.layout.rooms.get(room);
  return { x, z, room, y: r.y + 1.2 };
};

describe('targetOf', () => {
  it('points the first Rebel story at its first step’s hiding place, and free roam at nothing', () => {
    const g = newGame({ station: 'ds1', side: 'rebel', mode: 'story', hero: 'luke', seed: 3 });
    const t = targetOf(g);
    expect(t).toMatchObject({ room: 'hold', what: 'spot' });
    expect(targetOf(newGame({ station: 'ds1', side: 'imperial', mode: 'roam', seed: 3 }))).toBeNull();
  });

  it('finds a tagged thing in whatever room it is furnished in', () => {
    const g = newGame({ station: 'ds1', side: 'rebel', mode: 'story', hero: 'luke', seed: 3 });
    g.plot.story.steps.find((s) => s.id === g.plot.progress.step).target = { tag: 'ambush-panel' };
    expect(targetOf(g)).toMatchObject({ room: 'hold' });
  });
});

describe('routeTo', () => {
  const g = newGame({ station: 'ds1', side: 'imperial', mode: 'roam', seed: 3 });
  it('heads straight for a target in the room you are in', () => {
    teleport(g, 'lobby1', 10, -44);
    const r = routeTo(g, at(g, 'lobby1', 12, -42));
    expect(r.next).toMatchObject({ kind: 'goal', x: 12, z: -42 });
    expect(r.metres).toBeCloseTo(Math.hypot(2, 2), 1);
  });

  it('heads for the door out first when the target is through it', () => {
    teleport(g, 'lobby1', 10, -44);
    const r = routeTo(g, at(g, 'corr327', 10, -38));
    expect(r.next.kind).toBe('door');
    expect(r.next.z).toBeCloseTo(-40, 1);
    // the way, for the map: from you to the target
    expect(r.points[0]).toMatchObject({ x: 10, z: -44 });
    expect(r.points.at(-1)).toMatchObject({ x: 10, z: -38 });
  });

  it('heads for the lift when the target is on another level, never through the floor', () => {
    teleport(g, 'lobby1', 10, -44);
    const aa23 = g.layout.rooms.get('aa23');
    const first = routeTo(g, at(g, 'aa23', aa23.x, aa23.z));
    // out of the lobby by the lift's door, at this level
    expect(first.next.kind).toBe('door');
    expect(Math.abs(first.next.y - (g.layout.rooms.get('lobby1').y + 1.2))).toBeLessThan(0.01);
    teleport(g, 'lift1-l2');
    const inCar = routeTo(g, at(g, 'aa23', aa23.x, aa23.z));
    expect(['lift', 'door']).toContain(inCar.next.kind);
    expect(inCar.metres).toBeGreaterThan(20);
  });

  // (the chute's drop is the only way down into the compactor)
  it('heads for the jump that is the only way to a target, the chute to the compactor', () => {
    const g = newGame({ station: 'ds1', side: 'rebel', mode: 'roam', seed: 3 });
    teleport(g, 'cellbay');
    const drop = g.layout.station.spots['compactor-drop'];
    const r = routeTo(g, at(g, 'compactor', drop.x, drop.z));
    expect(r).not.toBeNull();
    teleport(g, 'chute', 42, -108.5);
    const near = routeTo(g, at(g, 'compactor', drop.x, drop.z));
    expect(near.next).toMatchObject({ kind: 'jump', room: 'chute' });
    expect(Math.hypot(near.next.x - 42, near.next.z + 110)).toBeLessThan(0.01);
  });
});
