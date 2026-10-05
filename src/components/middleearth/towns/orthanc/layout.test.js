import { describe, expect, it } from 'vitest';
import { makeWalker, pushOut } from '../walker';
import { DUEL_AT, HALL_COLLIDERS, HALL_IN, HALL_WALLS, HORNS, LEAF, LECTERN, MOTH_AT, PALANTIR, PIN, PIN_IN, PITS, RING, SARUMAN_AT, STAIR, STAIR_BASE, STAIR_LEN, TOWER_H, WINDOWS, WINDOW_SIGHTS, clearView, indoors, stairAt, validAt } from './layout';
import { CONVOS, QUESTS, orthancProgress } from './story';

const free = (x, z, r = 0.4) => {
  const [px, pz] = pushOut(x, z, r, HALL_COLLIDERS, HALL_WALLS);
  return Math.hypot(px - x, pz - z) < 0.02;
};
// walk from one spot through a list of points, as the visitor would
const walk = (from, points) => {
  const w = makeWalker({ radius: 60, colliders: HALL_COLLIDERS, walls: HALL_WALLS });
  let h = { x: from.x, z: from.z, face: 0, vx: 0, vz: 0, speed: 0 };
  for (const [x, z] of points) {
    for (let i = 0; i < 600 && Math.hypot(x - h.x, z - h.z) > 0.3; i++) {
      const d = Math.hypot(x - h.x, z - h.z);
      h = w.step(h, { x: (x - h.x) / d, z: (z - h.z) / d }, 1 / 30);
    }
  }
  return h;
};

describe('the great hall', () => {
  it('has room to come in, and to fight in', () => {
    expect(free(HALL_IN.x, HALL_IN.z)).toBe(true);
    expect(free(DUEL_AT.gandalf.x, DUEL_AT.gandalf.z)).toBe(true);
    for (let k = 0; k <= 3; k++) expect(free(DUEL_AT.saruman.x + DUEL_AT.back * k, DUEL_AT.saruman.z, 0.45)).toBe(true);
  });
  it('lets you walk up to Saruman and the stone', () => {
    const h = walk(HALL_IN, [[0, 0], [0.8, -5.2]]);
    expect(Math.hypot(h.x - SARUMAN_AT.x, h.z - SARUMAN_AT.z)).toBeLessThan(SARUMAN_AT.r);
    expect(Math.hypot(h.x - PALANTIR.x, h.z - PALANTIR.z)).toBeLessThan(PALANTIR.r);
  });
  it('keeps you inside its walls', () => {
    const h = walk(HALL_IN, [[0, 0], [-30, 0]]);
    expect(h.x).toBeGreaterThan(-14);
    expect(indoors(h.x, h.z)).toBe(true);
  });
});

describe('the library', () => {
  it('is through the arch, with the lectern at the far end', () => {
    const h = walk(HALL_IN, [[0, 2], [10, 0], [17, 0], [21.6, 0]]);
    expect(Math.hypot(h.x - LECTERN.x, h.z - LECTERN.z)).toBeLessThan(LECTERN.r);
  });
  it('hides something behind the northern case, that can be got to', () => {
    const h = walk(HALL_IN, [[0, 2], [10, 0], [17, 0], [21.4, 0], [21.2, -3.6], [LEAF.x, LEAF.z]]);
    expect(Math.hypot(h.x - LEAF.x, h.z - LEAF.z)).toBeLessThan(LEAF.r);
    // but not from the arch
    expect(Math.hypot(14 - LEAF.x, 0 - LEAF.z)).toBeGreaterThan(LEAF.r * 4);
  });
  it('can’t be seen into through its walls', () => {
    expect(clearView(16, 0, 10, 0)).toBe(true);
    expect(clearView(18, -4, 10, -4)).toBe(false);
    // nor through the cases standing out from its walls
    expect(clearView(LEAF.x, LEAF.z, 17, -3.5)).toBe(false);
  });
});

describe('the tower', () => {
  it('has a stair that climbs steadily to the pinnacle', () => {
    let last = -1;
    for (let s = 0; s <= STAIR_LEN; s += 1) {
      const [x, y, z] = stairAt(s);
      expect(y).toBeGreaterThan(last);
      expect(Math.hypot(x, z)).toBeCloseTo(STAIR.r);
      last = y;
    }
    expect(stairAt(0)[1]).toBeCloseTo(STAIR_BASE);
    expect(stairAt(STAIR_LEN)[1]).toBeLessThan(TOWER_H);
    // from the north round to the south
    expect(stairAt(0)[2]).toBeLessThan(0);
    expect(stairAt(STAIR_LEN)[2]).toBeGreaterThan(0);
  });
  it('has its windows on the stair, one for each sight', () => {
    expect(WINDOWS.length).toBe(WINDOW_SIGHTS.length);
    for (const s of WINDOWS) expect(s).toBeLessThan(STAIR_LEN - 4);
    for (const id of WINDOW_SIGHTS) expect(CONVOS[id]).toBeTruthy();
  });
  it('has room on the pinnacle for you and the moth, and the horns beyond', () => {
    expect(Math.hypot(PIN_IN.x, PIN_IN.z)).toBeLessThan(PIN.r);
    expect(Math.hypot(MOTH_AT.x, MOTH_AT.z)).toBeLessThan(PIN.r);
    for (const [x, z] of HORNS) expect(Math.hypot(x, z)).toBeGreaterThan(PIN.r + 1);
  });
  it('keeps the pits inside the ring and clear of the tower', () => {
    expect(PITS.length).toBeGreaterThan(12);
    for (const p of PITS) {
      expect(Math.hypot(p.x, p.z)).toBeGreaterThan(30);
      expect(Math.hypot(p.x, p.z) + p.size).toBeLessThan(RING.r - 10);
    }
  });
});

describe('the story', () => {
  it('goes from the hall up the stair to the pinnacle, and takes your staff', () => {
    expect(orthancProgress([]).zone).toBe('hall');
    expect(orthancProgress([]).staff).toBe(true);
    expect(orthancProgress(['hall', 'library', 'palantir', 'duel']).zone).toBe('stair');
    expect(orthancProgress(['hall', 'library', 'palantir', 'duel']).staff).toBe(false);
    expect(orthancProgress(['hall', 'library', 'palantir', 'duel', 'stair']).zone).toBe('top');
    expect(orthancProgress(QUESTS.map((q) => q.id)).finished).toBe(true);
    expect(orthancProgress(QUESTS.map((q) => q.id)).zone).toBe('hall');
    expect(orthancProgress(QUESTS.map((q) => q.id)).staff).toBe(true);
    // a save can't skip ahead
    expect(orthancProgress(['duel']).next).toBe('hall');
  });
  it('keeps a fair saved spot', () => {
    expect(validAt({ zone: 'hall', x: 0, z: 4, face: 1 }, 'hall')).toEqual({ zone: 'hall', x: 0, z: 4, face: 1 });
    expect(validAt({ zone: 'hall', x: 40, z: 0 }, 'hall')).toEqual({ zone: 'hall', ...HALL_IN });
    expect(validAt({ zone: 'hall', x: PALANTIR.x + 0.1, z: PALANTIR.z }, 'hall')).toEqual({ zone: 'hall', ...HALL_IN });
    expect(validAt({ zone: 'top', x: 9, z: 0 }, 'top')).toEqual({ zone: 'top', ...PIN_IN });
    expect(validAt(null, 'top')).toEqual({ zone: 'top', ...PIN_IN });
  });
});
