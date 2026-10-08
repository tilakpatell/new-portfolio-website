import { describe, expect, it } from 'vitest';
import { GAP, LANES, LIFT, NODES, R, RAMP_OUT, RAMP_S, RING, TIERS, carriageway, laneAt, rampOf, routeTo } from './hyperlanes';
import { REGIONS } from './regions';
import { bezier, clearance } from './lanes';
import { SHIP, SOLIDS, parkAt } from './ship';
import { HOME_RADIUS, ORDER, POSITIONS } from './layout';
import { DEEP, PLACES, WONDERS } from './deep';
import { MAW } from './maw';
import { byId } from './universes';

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const node = (id) => NODES.find((n) => n.id === id);
const fandoms = ORDER.filter((id) => byId(id).kind !== 'core');
const furthest = fandoms.reduce((a, b) => (Math.hypot(POSITIONS[a][0], POSITIONS[a][2]) > Math.hypot(POSITIONS[b][0], POSITIONS[b][2]) ? a : b));
const homeEdge = { x: 0, y: SHIP.height, z: HOME_RADIUS + 1.5, speed: 0 };

describe('the hyperlanes (hyperlanes.js)', () => {
  it('keeps the spec’s numbers', () => {
    expect(TIERS.local).toEqual({ speed: 1200, density: 400 });
    expect(TIERS.trunk).toEqual({ speed: 1500, density: 900 });
    expect(TIERS.express).toEqual({ speed: 4000, density: 2500 });
    expect([RAMP_OUT, GAP, R, RING, RAMP_S]).toEqual([1.6, 24, 6, 12, 3]);
    expect(LIFT).toEqual([60, 110]);
  });

  // (by each solid's reach, its moons and rings and glare, not just its body; and each carriageway's tube, R round its middle)
  it('clears everything solid along every lane, both carriageways, by more than 2', () => {
    const solids = SOLIDS.map((o) => ({ at: o.at, r: o.reach }));
    for (const lane of LANES) {
      expect(clearance(lane.pts, solids), lane.id).toBeGreaterThan(2);
      for (const way of ['out', 'in']) expect(clearance(carriageway(lane, way), solids) - R, `${lane.id} ${way}`).toBeGreaterThan(2);
    }
  });

  it('keeps every lane out of the portals, which would take its riders to the other sector', () => {
    for (const w of WONDERS.filter((x) => x.kind === 'portal' && !x.sector)) for (const l of LANES) for (const way of ['out', 'in']) expect(clearance(carriageway(l, way), [{ at: w.at, r: w.r }]) - R, `${l.id} ${way}`).toBeGreaterThan(2);
  });

  it('puts every ramp out past its place’s reach and the Maw’s pull, and clear of everything', () => {
    for (const n of NODES) {
      expect(dist(n.at, MAW.at), n.id).toBeGreaterThan(MAW.reach + 20);
      for (const o of SOLIDS) expect(dist(n.at, o.at), `${n.id} and ${o.id}`).toBeGreaterThan(o.reach + RING);
      if (n.kind === 'ramp') expect(dist(n.at, PLACES.find((p) => p.id === n.place).at), n.id).toBeGreaterThanOrEqual(PLACES.find((p) => p.id === n.place).reach * RAMP_OUT - 1e-6);
    }
  });

  it('joins every node up: every one reaches the home system’s beacon', () => {
    const next = new Map(NODES.map((n) => [n.id, []]));
    for (const l of LANES) {
      next.get(l.from).push(l.to);
      next.get(l.to).push(l.from);
    }
    const seen = new Set(['beacon:home']);
    const todo = ['beacon:home'];
    while (todo.length) for (const m of next.get(todo.pop())) if (!seen.has(m)) seen.add(m) && todo.push(m);
    for (const n of NODES) expect(seen.has(n.id), n.id).toBe(true);
  });

  it('runs a local lane from every member of a region to its beacon, and a trunk from every beacon home and round the ring', () => {
    for (const r of REGIONS.slice(1)) {
      for (const id of r.members) expect(LANES.some((l) => l.tier === 'local' && l.from === rampOf(id).id && l.to === `beacon:${r.id}`), `${id} to ${r.id}`).toBe(true);
      // (home has four beacons round its edge: a trunk comes in to the one facing it)
      expect(LANES.some((l) => l.tier === 'trunk' && l.from === `beacon:${r.id}` && l.to.startsWith('beacon:home')), r.id).toBe(true);
      expect(LANES.filter((l) => l.tier === 'trunk' && (l.from === `beacon:${r.id}` || l.to === `beacon:${r.id}`) && !l.to.startsWith('beacon:home')).length, r.id).toBe(2);
    }
  });

  it('rings the home system with four beacons, none of its lanes through it', () => {
    const home = NODES.filter((n) => n.region === 'home');
    expect(home.length).toBe(4);
    for (const n of home) expect(Math.hypot(n.at[0], n.at[2])).toBeGreaterThan(HOME_RADIUS + 200);
    for (const l of LANES) for (let i = 0; i <= 40; i++) expect(Math.hypot(bezier(l.pts, i / 40)[0], bezier(l.pts, i / 40)[2]), l.id).toBeGreaterThan(HOME_RADIUS + 100);
  });

  it('runs three express lanes from home: to the Star Wars gate, the portal and the Maw', () => {
    const express = LANES.filter((l) => l.tier === 'express');
    expect(express.map((l) => l.to).sort()).toEqual(['ramp:maw', 'ramp:rmportal', 'ramp:starwars']);
    for (const l of express) expect(l.from.startsWith('beacon:home')).toBe(true);
  });

  it('names every lane, and measures it', () => {
    for (const l of LANES) {
      expect(l.name.length, l.id).toBeGreaterThan(3);
      expect(l.length, l.id).toBeGreaterThan(dist(node(l.from).at, node(l.to).at) - 1e-6);
      expect(bezier(l.pts, 0)).toEqual(node(l.from).at);
      expect(bezier(l.pts, 1)).toEqual(node(l.to).at);
    }
  });

  it('keeps traffic to the right: each carriageway GAP / 2 to the right of its way of travel', () => {
    const lane = LANES[0];
    const out = carriageway(lane, 'out');
    const back = carriageway(lane, 'in');
    expect(dist(bezier(out, 0.5), bezier(back, 0.5))).toBeCloseTo(GAP, 0);
    // (the in carriageway runs the other way: it starts at the far end)
    expect(dist(back[0], node(lane.to).at)).toBeCloseTo(GAP / 2, 3);
    // to the right of travel (looking along the way, +y up)
    const d = out[2].map((v, i) => v - out[0][i]);
    const right = [-d[2], 0, d[0]];
    const off = out[0].map((v, i) => v - lane.pts[0][i]);
    expect(off[0] * right[0] + off[2] * right[2]).toBeGreaterThan(0);
  });

  it('says which carriageway a point is in, and how far along', () => {
    for (const lane of LANES.slice(0, 12)) {
      for (const way of ['out', 'in']) {
        const p = bezier(carriageway(lane, way), 0.5);
        const at = laneAt(...p);
        expect(at?.lane.id, `${lane.id} ${way}`).toBe(lane.id);
        expect(at.way).toBe(way);
        expect(at.s).toBeCloseTo(0.5, 2);
        expect(at.off).toBeLessThan(0.5);
      }
    }
    // R × 2 off, straight up from the middle of the out carriageway: in neither
    const lane = LANES.find((l) => l.tier === 'trunk');
    const p = bezier(carriageway(lane, 'out'), 0.5);
    expect(laneAt(p[0], p[1] + R * 2, p[2])).toBeNull();
  });

  it('routes from home’s edge to the furthest world: fly to a ramp, ride, fly in, all in under 40 s', () => {
    const r = routeTo(homeEdge, furthest);
    expect(r).not.toBeNull();
    expect(r.legs[0].kind).toBe('fly');
    expect(r.legs.at(-1).kind).toBe('fly');
    expect(r.legs.slice(1, -1).every((l) => l.kind === 'ride')).toBe(true);
    expect(r.legs.length).toBeGreaterThanOrEqual(3);
    expect(r.time).toBeLessThan(40);
    // each leg starts where the last ended
    for (let i = 1; i < r.legs.length; i++) expect(dist(r.legs[i].from, r.legs[i - 1].to)).toBeLessThan(1e-6);
    expect(dist(r.legs.at(-1).to, POSITIONS[furthest])).toBeLessThan(1e-6);
  });

  it('times a route as its lanes’ lengths over their speeds, RAMP_S a node, and the free legs as they’re flown', () => {
    // (out of the home system at a quarter of the pulse drive, out in the open at it, in to the place at the boost)
    const inHome = (p) => Math.hypot(p[0], p[2]) < DEEP.open;
    for (const [from, id] of [[homeEdge, 'middleearth'], [{ ...parkAt('marvel'), speed: 0 }, furthest]]) {
      const r = routeTo(from, id);
      let t = 0;
      r.legs.forEach((leg, i) => {
        if (leg.kind === 'ride') t += leg.lane.length / TIERS[leg.lane.tier].speed + RAMP_S;
        else if (i === r.legs.length - 1) t += dist(leg.from, leg.to) / SHIP.boost;
        else t += dist(leg.from, leg.to) / (inHome(leg.from) || inHome(leg.to) ? SHIP.pulse / 4 : SHIP.pulse);
      });
      expect(r.time, id).toBeCloseTo(t, 6);
    }
  });

  // (Review Focus 4: the autopilot of today flies these)
  it('gives no route where free flight is quicker: between two home stations', () => {
    const at = parkAt('home');
    expect(routeTo({ ...at, speed: 0 }, 'projects')).toBeNull();
    expect(routeTo({ ...at, speed: 0 }, 'nowhere')).toBeNull();
  });

  it('rides out of the home system to a station’s beacon only when it pays', () => {
    // from the furthest world home: ride in, then fly from the home beacon to the station
    const at = { ...parkAt(furthest), speed: 0 };
    const r = routeTo(at, 'home');
    expect(r).not.toBeNull();
    expect(r.legs.at(-1).kind).toBe('fly');
    expect(dist(r.legs.at(-1).to, POSITIONS.home)).toBeLessThan(1e-6);
  });

  it('finds a place’s ramp by its id', () => {
    expect(rampOf('middleearth').kind).toBe('ramp');
    expect(rampOf('middleearth').place).toBe('middleearth');
    expect(rampOf('home')).toBeNull();
  });

  // (a guard on the web as built: every lane and node, to 1e-6, against the
  // committed fixture; a change to how the lanes are built shows up here)
  it('builds the same web as the fixture', async () => {
    const r6 = (x) => Math.round(x * 1e6) / 1e6;
    const lanes = LANES.map((l) => ({ id: l.id, tier: l.tier, from: l.from, to: l.to, pts: l.pts.map((p) => p.map(r6)), length: r6(l.length), name: l.name }));
    const nodes = NODES.map((n) => ({ ...n, at: n.at.map(r6) }));
    await expect(JSON.stringify({ lanes, nodes }, null, 1) + '\n').toMatchFileSnapshot('./__fixtures__/lanes.json');
  });
});
