import { describe, expect, it } from 'vitest';
import { JUMP, SNAP, jumpTime, laneGraph, routeBetween, routeMid, viaLanes } from './routes';
import { LANES, SYSTEMS, systemById } from './systems';

const len = (pts) => pts.slice(1).reduce((d, p, i) => d + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
const run = LANES.find((l) => l.id === 'corellian-run');

describe('laneGraph', () => {
  it('has every lane’s points as nodes, joined in order', () => {
    const { nodes, edges } = laneGraph();
    expect(nodes.length).toBeGreaterThan(20);
    // the Run’s six points make five edges of it, and one more where the Hydian Way crosses it
    expect(edges.filter((e) => e.lane === 'corellian-run').length).toBe(run.pts.length);
  });
  it('joins lanes that share a point', () => {
    const { nodes } = laneGraph();
    // the Perlemian, the Run and the Western Reaches all start at Coruscant: one node
    const at = nodes.filter((n) => Math.hypot(n.at[0] - 11.5, n.at[1] - 8.5) < 0.3);
    expect(at.length).toBe(1);
  });
  it('joins lanes where they cross: the Hydian Way meets the Perlemian and the Run', () => {
    const r = routeBetween('yavin', 'coruscant');
    expect(r.onLane).toBe(true);
    expect(r.lanes).toEqual(['hydian', 'perlemian']);
    expect(routeBetween('naboo', 'tatooine').onLane).toBe(true);
  });
  it('joins the Rimma to the Run where it branches off it', () => {
    const { nodes } = laneGraph();
    const fork = nodes.find((n) => n.lanes.includes('rimma') && n.lanes.includes('corellian-run'));
    expect(fork.at).toEqual([12.6, 10.6]);
  });
  it('joins every lane into one web', () => {
    const { nodes, edges } = laneGraph();
    const seen = new Set([0]);
    for (let grew = true; grew; ) {
      grew = false;
      for (const e of edges) if (seen.has(e.a) !== seen.has(e.b)) grew = seen.add(e.a).add(e.b);
    }
    expect(seen.size).toBe(nodes.length);
  });
  it('snaps a system within SNAP of a lane point onto it, and no further', () => {
    const { snap } = laneGraph();
    expect(snap.coruscant).toBeDefined();
    expect(snap.hoth).toBeDefined(); // half a square off the Spine
    expect(snap.dagobah).toBeUndefined(); // the swamp’s nearly two squares from any lane
    expect(SNAP).toBe(1.2);
  });
});

describe('routeBetween', () => {
  it('takes Coruscant to Tatooine down the Corellian Run', () => {
    const r = routeBetween('coruscant', 'tatooine');
    expect(r.onLane).toBe(true);
    expect(r.lanes).toContain('corellian-run');
    const along = len(run.pts.slice(0, run.pts.findIndex((p) => p[0] === 17.6 && p[1] === 15.4) + 1));
    expect(Math.abs(r.squares - along) / along).toBeLessThan(0.1);
    // it bends: longer than the straight line
    expect(r.squares).toBeGreaterThan(Math.hypot(17.6 - 11.5, 15.4 - 8.5));
  });
  it('goes straight where an end is off the lanes (Dagobah to Hoth)', () => {
    const r = routeBetween('dagobah', 'hoth');
    expect(r.onLane).toBe(false);
    expect(r.pts.length).toBe(2);
    expect(r.squares).toBeCloseTo(Math.hypot(12.5 - 10.4, 18.5 - 17.4), 6);
    expect(r.lanes).toEqual([]);
  });
  it('starts and ends at the systems', () => {
    for (const [a, b] of [['coruscant', 'tatooine'], ['dagobah', 'hoth'], ['yavin', 'kamino'], ['sorgan', 'naboo']]) {
      const r = routeBetween(a, b);
      expect(r.pts[0]).toEqual(systemById(a).pos);
      expect(r.pts[r.pts.length - 1]).toEqual(systemById(b).pos);
      expect(r.squares).toBeCloseTo(len(r.pts), 6);
    }
  });
  it('is the same length both ways', () => {
    expect(routeBetween('tatooine', 'coruscant').squares).toBeCloseTo(routeBetween('coruscant', 'tatooine').squares, 6);
  });
  it('is null for a system it doesn’t know', () => {
    expect(routeBetween('jakku', 'hoth')).toBeNull();
  });
});

describe('jumpTime', () => {
  it('is 2.5 s and 1.2 s a square along the route', () => {
    expect(jumpTime({ squares: 3, onLane: true })).toBeCloseTo(JUMP.base + 3 * JUMP.perSquare, 6);
    expect(jumpTime({ squares: 0, onLane: true })).toBe(2.5);
  });
  it('is 1.6 times that off the lanes (Dagobah to Hoth)', () => {
    const r = routeBetween('dagobah', 'hoth');
    expect(jumpTime(r)).toBeCloseTo((JUMP.base + JUMP.perSquare * r.squares) * 1.6, 6);
  });
  it('is never over 12 s', () => {
    expect(jumpTime({ squares: 40, onLane: true })).toBe(12);
    expect(jumpTime({ squares: 7, onLane: false })).toBe(12);
    for (const a of ['coruscant', 'sorgan', 'scarif', 'nevarro']) for (const b of ['tatooine', 'lothal', 'hoth', 'endor']) expect(jumpTime(routeBetween(a, b))).toBeLessThanOrEqual(12);
  });
  it('takes the Run’s nine squares at the most a jump takes', () => {
    expect(jumpTime(routeBetween('coruscant', 'tatooine'))).toBe(JUMP.max);
  });
});

describe('viaLanes', () => {
  it('names the one lane a route takes', () => {
    expect(viaLanes({ onLane: true, lanes: ['corellian-run'] })).toBe('via the Corellian Run');
    expect(viaLanes(routeBetween('coruscant', 'tatooine'))).toBe('via the Corellian Run');
  });
  it('joins two with “and”, three or more with commas and then “and”', () => {
    expect(viaLanes({ onLane: true, lanes: ['hydian', 'perlemian'] })).toBe('via the Hydian Way and the Perlemian Trade Route');
    expect(viaLanes(routeBetween('yavin', 'coruscant'))).toBe('via the Hydian Way and the Perlemian Trade Route');
    expect(viaLanes({ onLane: true, lanes: ['reaches', 'corellian-run', 'spine'] })).toBe('via the Western Reaches route, the Corellian Run and the Corellian Trade Spine');
  });
  it('says so when the jump’s off the lanes, and nothing for no route', () => {
    expect(viaLanes(routeBetween('dagobah', 'hoth'))).toBe('off the lanes: a straight jump, slower, and the Empire watches those');
    expect(viaLanes(null)).toBe('');
  });
  it('calls two systems on the one lane point a short hop on the lanes (Tatooine to Geonosis)', () => {
    expect(viaLanes(routeBetween('tatooine', 'geonosis'))).toBe('a short hop, on the lanes');
  });
  it('names every lane a route can take, never its id', () => {
    for (const a of SYSTEMS) for (const b of SYSTEMS) if (a !== b) expect(viaLanes(routeBetween(a.id, b.id))).not.toMatch(/-/);
  });
});

describe('routeMid', () => {
  it('is the point half the way along the course, not the middle point of its list', () => {
    expect(routeMid({ pts: [[0, 0], [4, 0]] })).toEqual([2, 0]);
    // an L of 3 then 1: half of 4 is 2, which is 2 along its long leg
    const [x, z] = routeMid({ pts: [[0, 0], [3, 0], [3, 1]] });
    expect(x).toBeCloseTo(2, 9);
    expect(z).toBeCloseTo(0, 9);
  });
  it('lies on the real courses, and never past their ends', () => {
    for (const [a, b] of [['coruscant', 'tatooine'], ['yavin', 'coruscant'], ['dagobah', 'hoth']]) {
      const r = routeBetween(a, b);
      const m = routeMid(r);
      expect(m.every(Number.isFinite)).toBe(true);
      // (the halves are as long as each other: the point splits the course at its middle)
      const i = r.pts.findIndex((p, j) => j > 0 && len(r.pts.slice(0, j + 1)) >= r.squares / 2 - 1e-9);
      const first = [...r.pts.slice(0, i), m];
      expect(len(first)).toBeCloseTo(r.squares / 2, 6);
    }
  });
  it('is the one point of a course that goes nowhere', () => {
    expect(routeMid({ pts: [[5, 5]] })).toEqual([5, 5]);
  });
});
