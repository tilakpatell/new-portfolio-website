import { describe, expect, it } from 'vitest';
import { BRIDGES, CITY, GRID, RIVER } from './map';
import { LANE, WALK, carAt, createTraffic, segmentOk, stepTraffic, takeCar, walkerAt } from './traffic';

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

  it('back away from a fight for 3 s, then stop backing', () => {
    let st = createTraffic({ cars: 1, walkers: 0 });
    const c0 = st.cars[0];
    const [x, z] = carAt(c0);
    // one frame of the fight's scare, then nothing
    st = stepTraffic(st, 1 / 30, { cx: x, cz: z, scare: [{ x, z, r: 60, reverse: true }] });
    const s0 = st.cars[0].s;
    st = run(st, 2.5, { cx: x, cz: z });
    // (backed the other way from its direction of travel)
    expect((st.cars[0].s - s0) * c0.dir).toBeLessThan(-6);
    st = run(st, 0.6, { cx: x, cz: z }); // (past its 3 s)
    const s1 = st.cars[0].s;
    st = run(st, 1, { cx: x, cz: z });
    expect((st.cars[0].s - s1) * c0.dir).toBeGreaterThanOrEqual(-1);
  });
  it('lose one a Mauler takes, and get it back out of sight', () => {
    let st = createTraffic({ cars: 3, walkers: 0 });
    const [x, z] = carAt(st.cars[1]);
    st = takeCar(st, 1);
    expect(st.cars[1].gone).toBe(true);
    st = stepTraffic(st, 1 / 30, { cx: x, cz: z });
    const [x1, z1] = carAt(st.cars[1]);
    expect(st.cars[1].gone).toBe(false);
    expect(Math.hypot(x1 - x, z1 - z)).toBeGreaterThan(200);
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
  it('run from trouble', () => {
    const one = createTraffic({ cars: 0, walkers: 30 });
    const [x, z] = walkerAt(one.walkers[0]);
    const after = run(one, 1.5, { cx: 0, cz: 0, scare: [{ x: x + 3, z, r: 30 }] });
    const [x2] = walkerAt(after.walkers[0]);
    expect(x2).toBeLessThan(x - 3);
  });
});
