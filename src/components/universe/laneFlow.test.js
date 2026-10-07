import { describe, expect, it } from 'vitest';
import { CAPITAL, COLUMN, NEAR, RESOLVE, SLOT_OFF, countFor, flowAt, flowNear, kill, nearest, positionOf, shipsOf, slotOf, wrapsOf } from './laneFlow';
import { LANES, R, TIERS, carriageway } from './hyperlanes';
import { bezier } from './lanes';
import { SIDES } from './sides';

const trunk = LANES.find((l) => l.tier === 'trunk');
const local = LANES.find((l) => l.tier === 'local');
const express = LANES.find((l) => l.tier === 'express');
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const byKey = (list) => new Map(list.map((f) => [`${f.i}.${f.m}`, f]));

describe('the flow of traffic in the lanes (laneFlow.js)', () => {
  it('keeps the spec’s numbers', () => {
    expect(TIERS.local.density).toBe(400);
    expect(TIERS.trunk.density).toBe(900);
    expect(TIERS.express.density).toBe(2500);
    expect(RESOLVE).toBe(12);
    expect(NEAR).toBe(400);
    expect(SLOT_OFF).toBeCloseTo(R * 0.7);
  });

  it('carries a ship a density’s length of each carriageway', () => {
    for (const l of LANES) expect(countFor(l)).toBe(Math.ceil(l.length / TIERS[l.tier].density));
  });

  it('gives each slot its place across the tube, its pace and its phase, the same every time', () => {
    for (const lane of [trunk, local, express])
      for (const way of ['out', 'in'])
        for (let i = 0; i < countFor(lane); i++) {
          const a = slotOf(lane, way, i);
          expect(a).toEqual(slotOf(lane, way, i));
          expect(Math.hypot(...a.off)).toBeLessThanOrEqual(R * 0.7 + 1e-9);
          expect(a.v).toBeGreaterThanOrEqual(0.9);
          expect(a.v).toBeLessThanOrEqual(1.1);
          expect(a.phase).toBeGreaterThanOrEqual(0);
          expect(a.phase).toBeLessThan(1);
        }
    // (and not all the same: a hash, not a constant)
    const phases = new Set(Array.from({ length: countFor(trunk) }, (_, i) => slotOf(trunk, 'out', i).phase));
    expect(phases.size).toBe(countFor(trunk));
  });

  it('is in a steady state: as many ships at any time as at the start', () => {
    for (const lane of [trunk, local, express]) expect(flowAt(lane, 'out', 1000).length).toBe(flowAt(lane, 'out', 0).length);
    expect(flowAt(trunk, 'in', 1e9 + 0.37).length).toBe(shipsOf(trunk, 'in'));
  });

  it('moves each ship along by its speed over the lane’s length', () => {
    const t = 123.4;
    const dt = 0.05;
    const a = byKey(flowAt(trunk, 'out', t));
    const b = byKey(flowAt(trunk, 'out', t + dt));
    for (const [k, f] of a) {
      const g = b.get(k);
      const ds = (((g.s - f.s) % 1) + 1) % 1;
      expect(ds).toBeCloseTo((f.speed * dt) / trunk.length, 9);
      expect(f.speed).toBeCloseTo(slotOf(trunk, 'out', f.i).v * TIERS.trunk.speed, 9);
    }
  });

  it('gives two pilots the same traffic in the same places (no message between them)', () => {
    const t = 1759838400.123; // (wall-clock seconds, as the scene passes them)
    expect(flowAt(express, 'in', t)).toEqual(flowAt(express, 'in', t));
    expect(flowAt(local, 'out', t)).toEqual(flowAt(local, 'out', t));
  });

  it('keeps every ship inside its tube', () => {
    for (const f of flowAt(trunk, 'out', 42)) expect(Math.hypot(...f.off)).toBeLessThanOrEqual(R * 0.7 + 1e-9);
    const pts = carriageway(trunk, 'out');
    for (const f of flowAt(trunk, 'out', 42)) expect(dist(positionOf(trunk, 'out', f.s, f.off), bezier(pts, f.s))).toBeLessThanOrEqual(R * 0.7 + 1e-6);
  });

  it('runs convoys on the trunks, in a column of four to seven, and the side’s capital ships on the express', () => {
    const slots = Array.from({ length: countFor(trunk) }, (_, i) => slotOf(trunk, 'out', i));
    const columns = slots.filter((s) => s.column > 1);
    expect(columns.length).toBeGreaterThan(0);
    for (const c of columns) {
      expect(c.column).toBeGreaterThanOrEqual(COLUMN[0]);
      expect(c.column).toBeLessThanOrEqual(COLUMN[1]);
    }
    for (let i = 0; i < countFor(local); i++) expect(slotOf(local, 'out', i).column).toBe(1);
    const capitals = Object.values(CAPITAL);
    for (let i = 0; i < countFor(express); i++) expect(capitals).toContain(slotOf(express, 'out', i).kind);
    // (and every side's capital is a ship of that side's)
    for (const [id, kind] of Object.entries(CAPITAL)) expect([...SIDES[id].traffic, ...SIDES[id].civil]).toContain(kind);
  });

  it('draws a column’s ships one behind the other, along the lane', () => {
    const i = Array.from({ length: countFor(trunk) }, (_, k) => k).find((k) => slotOf(trunk, 'out', k).column > 1);
    const members = flowAt(trunk, 'out', 7).filter((f) => f.i === i);
    expect(members.length).toBe(slotOf(trunk, 'out', i).column);
    for (let m = 1; m < members.length; m++) {
      const ds = (((members[m - 1].s - members[m].s) % 1) + 1) % 1;
      expect(ds * trunk.length).toBeGreaterThan(0.5);
      expect(ds * trunk.length).toBeLessThan(6);
    }
  });

  it('keeps a ship shot down dead until it next comes round, and no longer', () => {
    const dead = new Map();
    const t = 500;
    const f = flowAt(trunk, 'out', t).find((g) => g.s < 0.4);
    kill(dead, trunk, 'out', f.i, f.m, t);
    expect(flowAt(trunk, 'out', t + 0.1, dead).some((g) => g.i === f.i && g.m === f.m)).toBe(false);
    // the time it wraps round to s = 0 again
    const period = trunk.length / f.speed;
    const left = ((1 - f.s) * trunk.length) / f.speed;
    expect(flowAt(trunk, 'out', t + left - 0.01, dead).some((g) => g.i === f.i && g.m === f.m)).toBe(false);
    expect(flowAt(trunk, 'out', t + left + 0.01, dead).some((g) => g.i === f.i && g.m === f.m)).toBe(true);
    expect(left).toBeLessThan(period);
  });

  it('keeps a ship shot the frame before it wraps dead through the wrap (Review Focus 5)', () => {
    const t0 = 900;
    const f0 = flowAt(express, 'in', t0)[0];
    // the moment just before this one comes round to s = 0
    const tw = t0 + ((1 - f0.s) * express.length) / f0.speed;
    const t = tw - 1 / 60;
    const dead = new Map();
    kill(dead, express, 'in', f0.i, f0.m, t);
    expect(wrapsOf(express, 'in', f0.i, f0.m, t + 2 / 60)).toBe(wrapsOf(express, 'in', f0.i, f0.m, t) + 1);
    // (it's come round once since it was shot: still dead, until the next time round)
    expect(flowAt(express, 'in', t + 2 / 60, dead).some((g) => g.i === f0.i && g.m === f0.m)).toBe(false);
    const period = express.length / f0.speed;
    expect(flowAt(express, 'in', t + period * 0.5, dead).some((g) => g.i === f0.i && g.m === f0.m)).toBe(false);
    expect(flowAt(express, 'in', t + 2 / 60 + period, dead).some((g) => g.i === f0.i && g.m === f0.m)).toBe(true);
  });

  it('forgets a ship once it’s come round again', () => {
    const dead = new Map();
    const f = flowAt(local, 'out', 10)[0];
    kill(dead, local, 'out', f.i, f.m, 10);
    flowAt(local, 'out', 10 + (2 * local.length) / f.speed, dead);
    expect(dead.size).toBe(0);
  });

  it('finds the flow near a ship, and the nearest of it, sorted and capped', () => {
    const t = 77;
    const lane = trunk;
    const f = flowAt(lane, 'out', t)[3];
    const at = positionOf(lane, 'out', f.s, [0, 0]);
    const ship = { x: at[0] + 1, y: at[1], z: at[2] };
    const near = flowNear(ship, t, new Map(), NEAR);
    expect(near.some((g) => g.lane === lane && g.i === f.i)).toBe(true);
    for (const g of near) expect(dist(g.at, [ship.x, ship.y, ship.z])).toBeLessThanOrEqual(NEAR + 1e-6);
    const picked = nearest(near, ship, 2, NEAR);
    expect(picked.length).toBeLessThanOrEqual(2);
    expect(picked[0].dist).toBeLessThanOrEqual(picked[picked.length - 1].dist);
    // and none past `near`, and all of them when there are fewer than n
    expect(nearest(near, ship, 100, 10).every((g) => g.dist <= 10)).toBe(true);
    const all = nearest(near, ship, 1000, NEAR);
    expect(all.length).toBe(near.length);
    for (let k = 1; k < all.length; k++) expect(all[k].dist).toBeGreaterThanOrEqual(all[k - 1].dist);
  });

  it('finds nothing near a ship far from every lane', () => {
    expect(flowNear({ x: 0, y: 5000, z: 0 }, 3, new Map(), NEAR)).toEqual([]);
  });
});
