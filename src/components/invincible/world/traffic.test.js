import { describe, expect, it } from 'vitest';
import { BRIDGES, CITY, GRID, RIVER } from './map';
import { LANE, WALK, carAt, createTraffic, segmentOk, stepTraffic, walkerAt } from './traffic';

// distance from a coordinate to the nearest street centre line
const offLine = (v) => Math.abs(((((v - GRID.cell / 2) % GRID.cell) + GRID.cell * 1.5) % GRID.cell) - GRID.cell / 2);
const run = (st, t, cam = { cx: 0, cz: 0 }, dt = 1 / 30) => {
  for (let s = 0; s < t; s += dt) st = stepTraffic(st, dt, cam);
  return st;
};

describe('the streets', () => {
  it('knows which stretches of street are there', () => {
    expect(segmentOk('x', 40, 0)).toBe(true); // an E–W street downtown
    expect(segmentOk('z', (RIVER.x0 + RIVER.x1) / 2 - 10, 0)).toBe(false); // nothing runs up the river
    expect(segmentOk('x', BRIDGES[1], (RIVER.x0 + RIVER.x1) / 2)).toBe(true); // a bridge
    expect(segmentOk('x', BRIDGES[1] + GRID.cell, (RIVER.x0 + RIVER.x1) / 2)).toBe(false); // no bridge here
  });
});

describe('the cars', () => {
  const st = run(createTraffic({ cars: 200, walkers: 0 }), 60);
  it('keep to the right-hand lane of a street', () => {
    for (const c of st.cars) {
      const [x, z] = carAt(c);
      const across = c.axis === 'x' ? z : x;
      expect(Math.abs(offLine(across) - LANE), `car at ${x},${z}`).toBeLessThan(0.6);
      // on the right: east-bound cars south of the line, north-bound east of it
      const side = c.axis === 'x' ? Math.sign(z - c.line) : -Math.sign(x - c.line);
      expect(side).toBe(c.dir);
    }
  });
  it('stay in town, and cross the river only on a bridge', () => {
    for (const c of st.cars) {
      const [x, z] = carAt(c);
      expect(x).toBeGreaterThan(CITY.x0 - 60);
      expect(x).toBeLessThan(CITY.x1 + 60);
      expect(z).toBeGreaterThan(CITY.z0 - 60);
      expect(z).toBeLessThan(CITY.z1 + 60);
      if (x > RIVER.x0 - 5 && x < RIVER.x1 + 5) {
        expect(c.axis).toBe('x');
        expect(BRIDGES).toContain(c.line);
      }
    }
  });
  it('keep their distance in a lane (bar the odd one just turned in)', () => {
    const lanes = new Map();
    for (const c of st.cars) {
      const k = `${c.axis}:${c.line}:${c.dir}`;
      if (!lanes.has(k)) lanes.set(k, []);
      lanes.get(k).push(c.s);
    }
    let pairs = 0;
    let close = 0;
    for (const list of lanes.values()) {
      list.sort((a, b) => a - b);
      for (let i = 1; i < list.length; i++) {
        pairs++;
        if (list[i] - list[i - 1] < 4.5) close++;
      }
    }
    expect(close / Math.max(1, pairs)).toBeLessThan(0.03);
  });
  it('move', () => {
    const a = createTraffic({ cars: 50, walkers: 0 });
    const b = run(a, 5);
    const moved = b.cars.filter((c, i) => Math.hypot(carAt(c)[0] - carAt(a.cars[i])[0], carAt(c)[1] - carAt(a.cars[i])[1]) > 20);
    expect(moved.length).toBeGreaterThan(30);
  });
  it('follow the camera round town', () => {
    const away = run(st, 2, { cx: -900, cz: 400 });
    for (const c of away.cars) {
      const [x, z] = carAt(c);
      expect(Math.hypot(x + 900, z - 400)).toBeLessThan(1000);
    }
  });
  it('stop for trouble', () => {
    const one = createTraffic({ cars: 40, walkers: 0 });
    const [x, z] = carAt(one.cars[0]);
    const after = run(one, 1, { cx: 0, cz: 0, scare: [{ x, z, r: 40 }] });
    expect(after.cars[0].speed).toBeLessThan(2);
  });
});

describe('the people walking', () => {
  const st = run(createTraffic({ cars: 0, walkers: 150 }), 40);
  it('keep to the pavements', () => {
    for (const w of st.walkers) {
      const [x, z] = walkerAt(w);
      const across = w.axis === 'x' ? z : x;
      expect(Math.abs(offLine(across) - WALK)).toBeLessThan(0.8);
    }
  });
  it('step aside for him on foot, and stay on the pavement doing it', () => {
    const one = createTraffic({ cars: 0, walkers: 30 });
    const w = one.walkers[0];
    const [x, z] = walkerAt(w);
    const acrossOf = (q) => (q.axis === 'x' ? walkerAt(q)[1] : walkerAt(q)[0]);
    const before = acrossOf(w);
    // him a little to one side of the walker's line, right in their way
    const hero = w.axis === 'x' ? { x: x + w.dir * 0.6, z: z + 0.3 } : { x: x + 0.3, z: z + w.dir * 0.6 };
    let st = one;
    for (let i = 0; i < 15; i++) st = stepTraffic(st, 1 / 30, { cx: 0, cz: 0, hero });
    const after = acrossOf(st.walkers[0]);
    expect(Math.sign(after - before)).toBe(-1); // (away from him)
    expect(Math.abs(offLine(after) - WALK)).toBeLessThan(0.8);
  });
  it('give each other room', () => {
    const near = (s) => {
      let n = 0;
      const at = s.walkers.map(walkerAt);
      for (let i = 0; i < at.length; i++) for (let j = i + 1; j < at.length; j++) if (Math.hypot(at[i][0] - at[j][0], at[i][1] - at[j][1]) < 0.3) n++;
      return n;
    };
    expect(near(st)).toBe(0);
  });
  it('run from trouble', () => {
    const one = createTraffic({ cars: 0, walkers: 30 });
    const [x, z] = walkerAt(one.walkers[0]);
    const after = run(one, 1.5, { cx: 0, cz: 0, scare: [{ x: x + 3, z, r: 30 }] });
    const [x2] = walkerAt(after.walkers[0]);
    expect(x2).toBeLessThan(x - 3);
  });
});
