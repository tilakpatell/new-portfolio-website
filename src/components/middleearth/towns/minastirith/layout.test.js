import { describe, expect, it } from 'vitest';
import { pushOut } from '../walker';
import { BEACONS, COURT_COLLIDERS, COURT_IN, COVERS, GATES, HALL_COLLIDERS, HALL_IN, HALL_WALLS, HOUSES, LEDGE, LEVEL_Y, PILE, ROAD, ROAD_LEN, ROAD_W, SLOTS, TREBUCHETS, TUNNELS, WALL_R, WATCH, inCover, inHall, inProw, levelOf, onCourt, roadAt, roadNear, validAt } from './layout';

describe('the city', () => {
  it('has seven walls, each higher and further in than the last', () => {
    expect(WALL_R).toHaveLength(7);
    expect(LEVEL_Y).toHaveLength(7);
    for (let k = 1; k < 7; k++) {
      expect(WALL_R[k]).toBeLessThan(WALL_R[k - 1]);
      expect(LEVEL_Y[k]).toBeGreaterThan(LEVEL_Y[k - 1]);
    }
  });
  it('knows which level a place is on', () => {
    expect(levelOf(0, 0)).toBe(6);
    expect(levelOf(140, 0)).toBe(0);
    expect(levelOf(117, 0)).toBe(1);
    expect(levelOf(300, 0)).toBe(-1);
    // behind, in the mountain
    expect(levelOf(-100, 0)).toBe(-1);
  });
});

describe('the road up', () => {
  it('goes from the Pelennor to the Citadel without a jump', () => {
    const { pts } = ROAD;
    expect(pts[0][1]).toBe(0);
    expect(pts[pts.length - 1][1]).toBe(LEVEL_Y[6]);
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]);
      expect(d).toBeLessThan(1.6);
      expect(pts[i][1]).toBeGreaterThanOrEqual(pts[i - 1][1] - 1e-9);
    }
    expect(ROAD_LEN).toBeGreaterThan(400);
  });
  it('passes through every gate, in order, at the height of the level it climbs to', () => {
    expect(GATES).toHaveLength(7);
    for (let k = 0; k < 7; k++) {
      const g = GATES[k];
      const p = roadAt(g.s);
      expect(Math.hypot(p.x - g.x, p.z - g.z)).toBeLessThan(3);
      if (k) expect(g.s).toBeGreaterThan(GATES[k - 1].s);
      expect(g.sill).toBeGreaterThan(LEVEL_Y[k] - 3);
      expect(g.sill).toBeLessThanOrEqual(LEVEL_Y[k] + 0.01);
    }
  });
  it('goes through the prow only by its tunnels', () => {
    for (let s = 0; s < ROAD_LEN; s += 0.5) {
      const p = roadAt(s);
      if (!inProw(p.x, p.z)) continue;
      const t = TUNNELS.find((u) => Math.abs(p.x - u.x) < u.w / 2);
      expect(t, `at ${s.toFixed(1)}`).toBeTruthy();
      expect(p.y).toBeGreaterThanOrEqual(t.y - 0.01);
      expect(p.y).toBeLessThan(t.y + 2);
    }
  });
  it('gives a heading along it, and finds itself', () => {
    const p = roadAt(150);
    expect(Math.hypot(p.dx, p.dz)).toBeCloseTo(1, 5);
    expect(roadNear(p.x, p.z).d).toBeLessThan(1.2);
  });
  it('has level stretches to put things in the way on, clear of the gates', () => {
    expect(SLOTS.length).toBeGreaterThan(4);
    for (const [a, b] of SLOTS) {
      expect(b).toBeGreaterThan(a);
      for (const g of GATES) expect(g.s < a - 10 || g.s > b + 10).toBe(true);
    }
  });
});

describe('the houses', () => {
  it('stand on their levels, off the road and out of the prow', () => {
    expect(HOUSES.length).toBeGreaterThan(200);
    for (const h of HOUSES) {
      expect(levelOf(h.x, h.z)).toBe(h.k);
      expect(h.y).toBe(LEVEL_Y[h.k]);
      expect(roadNear(h.x, h.z).d).toBeGreaterThan(ROAD_W / 2);
      expect(inProw(h.x, h.z)).toBe(false);
    }
  });
  it('leave room for the trebuchets', () => {
    for (const t of TREBUCHETS) for (const h of HOUSES) expect(Math.hypot(h.x - t.x, h.z - t.z)).toBeGreaterThan(6);
  });
});

describe('the Citadel and the hall', () => {
  it('starts you in the court, clear of everything', () => {
    expect(onCourt(COURT_IN.x, COURT_IN.z)).toBe(true);
    const [x, z] = pushOut(COURT_IN.x, COURT_IN.z, 0.4, COURT_COLLIDERS, []);
    expect(Math.hypot(x - COURT_IN.x, z - COURT_IN.z)).toBeLessThan(0.01);
  });
  it('starts you in the hall by its doors, clear of everything', () => {
    expect(inHall(HALL_IN.x, HALL_IN.z)).toBe(true);
    const [x, z] = pushOut(HALL_IN.x, HALL_IN.z, 0.4, HALL_COLLIDERS, HALL_WALLS);
    expect(Math.hypot(x - HALL_IN.x, z - HALL_IN.z)).toBeLessThan(0.01);
  });
  it('lets you walk out along the prow', () => {
    expect(onCourt(80, 0)).toBe(true);
    expect(onCourt(80, 8)).toBe(false);
  });
  it('keeps a fair saved spot and drops a bad one', () => {
    expect(validAt({ zone: 'court', x: 20, z: -5, face: 1 }, 'court')).toEqual({ zone: 'court', x: 20, z: -5, face: 1 });
    expect(validAt({ zone: 'court', x: 400, z: 0 }, 'court')).toMatchObject({ x: COURT_IN.x, z: COURT_IN.z });
    expect(validAt({ zone: 'hall', x: 0, z: 0 }, 'hall')).toMatchObject({ x: 0, z: 0 });
    expect(validAt({ zone: 'hall', x: 50, z: 0 }, 'hall')).toMatchObject({ x: HALL_IN.x, z: HALL_IN.z });
    expect(validAt(null, 'hall')).toMatchObject({ x: HALL_IN.x });
  });
});

describe('the beacon', () => {
  it('has rocks to hide behind before the pile, and the guard beyond it', () => {
    for (const c of COVERS) expect(c.s).toBeLessThan(PILE.s);
    expect(WATCH.s).toBeGreaterThan(PILE.s);
    expect(WATCH.s).toBeLessThanOrEqual(LEDGE.len);
    expect(inCover(COVERS[0].s)).toBe(true);
    expect(inCover(0)).toBe(false);
  });
  it('lists the seven beacons to Rohan, away from the city', () => {
    expect(BEACONS.map((b) => b.name)).toEqual(['Amon Dîn', 'Eilenach', 'Nardol', 'Erelas', 'Min-Rimmon', 'Calenhad', 'Halifirien']);
    for (let i = 1; i < BEACONS.length; i++) expect(Math.hypot(BEACONS[i].x, BEACONS[i].z)).toBeGreaterThan(Math.hypot(BEACONS[i - 1].x, BEACONS[i - 1].z));
  });
});
