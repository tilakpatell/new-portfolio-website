import { describe, expect, it } from 'vitest';
import { pushOut } from '../../middleearth/towns/walker';
import { BODY, COLLIDERS, INSTRUMENTS, INSTRUMENT_IDS, POOL, START, TERRACE, WALLS, forwardOf, moveFor, nearInstrument, standFor, stickMove, walker } from './layout';

const free = (x, z) => {
  const [px, pz] = pushOut(x, z, BODY.radius, COLLIDERS, WALLS);
  return Math.hypot(px - x, pz - z) < 1e-6 && Math.abs(x) < TERRACE.half && Math.abs(z) < TERRACE.half;
};

// every spot on a fine grid you can walk to from the start, without passing through anything
function reachable(step = 0.2) {
  const key = (i, j) => `${i},${j}`;
  const toCell = (v) => Math.round(v / step);
  const seen = new Set([key(toCell(START.x), toCell(START.z))]);
  const queue = [[toCell(START.x), toCell(START.z)]];
  while (queue.length) {
    const [i, j] = queue.pop();
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = [i + di, j + dj];
      const k = key(...n);
      if (seen.has(k) || !free(n[0] * step, n[1] * step)) continue;
      seen.add(k);
      queue.push(n);
    }
  }
  return (x, z) => seen.has(key(toCell(x), toCell(z)));
}

describe('the courtyard', () => {
  it('starts you on open paving, looking towards the instruments', () => {
    expect(free(START.x, START.z)).toBe(true);
    const ahead = forwardOf(START.yaw);
    expect(ahead.z).toBeLessThan(-0.99); // north
    expect(nearInstrument(START.x, START.z, START.yaw)).toBeNull();
  });

  it('lets you walk up to every instrument, and play it from where you stand', () => {
    const canReach = reachable();
    for (const id of INSTRUMENT_IDS) {
      const s = standFor(id);
      expect(free(s.x, s.z), id).toBe(true);
      expect(canReach(s.x, s.z), id).toBe(true);
      expect(nearInstrument(s.x, s.z, s.yaw), id).toBe(id);
    }
  });

  it('keeps you out of the pool, off the instruments and inside the parapet', () => {
    expect(free(POOL.x, POOL.z)).toBe(false);
    // (a hair off each one's middle: a point exactly there has no way out to be pushed)
    for (const id of ['tanpura', 'harmonium', 'tabla']) expect(free(INSTRUMENTS[id].x + 0.05, INSTRUMENTS[id].z), id).toBe(false);
    // walking north from the start for a long while ends at the pool's edge, not in it
    let h = { x: START.x, z: START.z, face: 0, vx: 0, vz: 0 };
    for (let k = 0; k < 600; k++) h = walker.step(h, moveFor(new Set(['up']), 0), 1 / 60);
    expect(h.z).toBeGreaterThan(POOL.z + POOL.half);
    // and walking out towards the dunes stops at the wall
    h = { x: 0, z: 0, face: 0, vx: 0, vz: 0 };
    for (let k = 0; k < 900; k++) h = walker.step(h, stickMove(1, 0, 0), 1 / 60);
    expect(h.x).toBeLessThan(TERRACE.half - 0.3);
  });

  it('picks the instrument you look at, not one behind you', () => {
    const s = standFor('tabla');
    expect(nearInstrument(s.x, s.z, Math.PI)).toBeNull(); // turned round, a step away
    // where you play the sitar, with the harmonium at your left: whichever you look at
    const { x, z } = standFor('sitar');
    const at = (id) => Math.atan2(-(INSTRUMENTS[id].x - x), -(INSTRUMENTS[id].z - z));
    expect(nearInstrument(x, z, at('harmonium'))).toBe('harmonium');
    expect(nearInstrument(x, z, at('sitar'))).toBe('sitar');
  });
});

describe('walking', () => {
  it('goes where you look: forward, back and to either side', () => {
    const up = moveFor(new Set(['up']), 0);
    expect(up.x).toBeCloseTo(0, 9);
    expect(up.z).toBeCloseTo(-1, 9);
    const right = moveFor(new Set(['right']), 0);
    expect(right.x).toBeCloseTo(1, 9);
    const diag = moveFor(new Set(['up', 'right']), Math.PI / 2);
    expect(Math.hypot(diag.x, diag.z)).toBeCloseTo(1, 9);
    expect(moveFor(new Set(['up', 'run']), 0).run).toBe(true);
    const still = moveFor(new Set(), 1);
    expect(Math.hypot(still.x, still.z)).toBe(0);
  });
});
