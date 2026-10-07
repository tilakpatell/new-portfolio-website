// The NPC toolkit over random worlds (the shape of cybertron/game/fuzz.test.js):
// each tool's promise held for every one of RUNS seeded draws, so an edge
// a hand-written case misses is found here first.
import { describe, expect, it } from 'vitest';
import { seeded } from '../seeded';
import { avoid, clear, createContext, flee, resolve, seek, separate } from './steer';
import { flood } from './search';
import { pickPlace, scorePlace } from './spatial';
import { advance, createSquads, withdraw } from './squad';
import { belief, createSenses, sense } from './perception';
import { pick } from './utility';

const RUNS = 300;
const point = (r, span = 50) => ({ x: (r() - 0.5) * span, y: 0, z: (r() - 0.5) * span });

describe('context steering, over random fields', () => {
  it('always answers with a heading no longer than one, and finite', () => {
    for (let seed = 1; seed <= RUNS; seed++) {
      const r = seeded(seed);
      const ctx = createContext(8 + Math.floor(r() * 24));
      for (let frame = 0; frame < 4; frame++) {
        clear(ctx);
        const me = point(r);
        seek(ctx, me, point(r), r() * 3);
        if (r() < 0.6) flee(ctx, me, point(r), r() * 2, 5 + r() * 40);
        for (let k = Math.floor(r() * 4); k > 0; k--) avoid(ctx, me, { x: r() - 0.5, y: 0, z: r() - 0.5 }, { at: point(r, 20), r: r() * 6 }, r(), 1 + r() * 10);
        if (r() < 0.5) separate(ctx, me, Array.from({ length: 3 }, () => point(r, 10)), 1 + r() * 4);
        const { dir, strength } = resolve(ctx, { blend: r() * 0.8 });
        const l = Math.hypot(dir.x, dir.y, dir.z);
        expect(Number.isFinite(l) && Number.isFinite(strength), `seed ${seed}`).toBe(true);
        expect(l, `seed ${seed}`).toBeLessThanOrEqual(1 + 1e-9);
        expect(dir.y).toBe(0);
      }
    }
  });
});

// every walkable cell reachable from `from`, by a plain flood fill
function reachable(grid, from) {
  const seen = new Set([`${from.x},${from.z}`]);
  const todo = [[from.x, from.z]];
  while (todo.length) {
    const [x, z] = todo.pop();
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = `${x + dx},${z + dz}`;
      if (!seen.has(k) && grid.walkable(x + dx, z + dz)) {
        seen.add(k);
        todo.push([x + dx, z + dz]);
      }
    }
  }
  return seen;
}

describe('the chase’s flood, over random grids', () => {
  it('gives a walkable cell the chase can get to from where it lost you, or nothing', () => {
    for (let seed = 1; seed <= RUNS; seed++) {
      const r = seeded(seed);
      const size = 6 + Math.floor(r() * 14);
      const open = r() * 0.5 + 0.4;
      const cells = Array.from({ length: size }, () => Array.from({ length: size }, () => r() < open));
      const grid = { cell: 1, walkable: (x, z) => x >= 0 && z >= 0 && x < size && z < size && cells[x][z] };
      const from = { x: Math.floor(r() * size), z: Math.floor(r() * size) };
      const dir = r() < 0.5 ? null : { x: Math.round(r() * 2 - 1), z: Math.round(r() * 2 - 1) };
      const to = flood(grid, from, dir, { steps: 5 + Math.floor(r() * 30) });
      if (!grid.walkable(from.x, from.z)) {
        expect(to, `seed ${seed}`).toBeNull();
        continue;
      }
      if (to === null) continue;
      expect(grid.walkable(to.x, to.z), `seed ${seed}: ${JSON.stringify(to)}`).toBe(true);
      expect(reachable(grid, from).has(`${to.x},${to.z}`), `seed ${seed}: ${JSON.stringify(to)} cut off`).toBe(true);
    }
  });
});

describe('picking a place, over random candidates', () => {
  it('picks one of the candidates, the best scored, or keeps the current one only when the best is not much better', () => {
    for (let seed = 1; seed <= RUNS; seed++) {
      const r = seeded(seed);
      const points = Array.from({ length: 1 + Math.floor(r() * 12) }, () => point(r));
      const q = point(r);
      const tests = [{ weight: r(), value: (p) => -Math.hypot(p.x - q.x, p.z - q.z) }, { weight: r(), value: (p) => p.x }];
      const current = r() < 0.4 ? point(r) : null;
      const got = pickPlace(points, tests, { current, hysteresis: 0.15 });
      const sets = tests.map((t) => [...points, ...(current ? [current] : [])].map((p) => t.value(p)));
      const best = Math.max(...points.map((p) => scorePlace(p, tests, sets)));
      if (got.kept) expect(got.at).toBe(current);
      else {
        expect(points, `seed ${seed}`).toContain(got.at);
        expect(got.score, `seed ${seed}`).toBeCloseTo(best, 9);
      }
    }
  });
});

describe('squads, over random crowds', () => {
  it('put every live member in exactly one squad of its own side, and split it into movers and cover with nobody in both', () => {
    for (let seed = 1; seed <= RUNS / 3; seed++) {
      const r = seeded(seed);
      const members = Array.from({ length: 1 + Math.floor(r() * 16) }, (_, i) => ({ id: i + 1, at: point(r, 120), side: r() < 0.5 ? 'a' : 'b', alive: r() > 0.1 }));
      const squads = createSquads({ reach: 10 + r() * 30 }).update(members);
      const live = members.filter((m) => m.alive);
      const placed = squads.flatMap((s) => s.members);
      expect([...placed].sort((a, b) => a - b), `seed ${seed}`).toEqual(live.map((m) => m.id).sort((a, b) => a - b));
      for (const s of squads) for (const id of s.members) expect(members.find((m) => m.id === id).side).toBe(s.side);
      for (const s of squads) {
        const front = { centre: s.centre, dir: { x: 1, y: 0, z: 0 } };
        for (const halves of [advance(s, members, front), withdraw(s, members, front)]) {
          expect([...halves.move, ...halves.cover].sort((a, b) => a - b)).toEqual([...s.members].sort((a, b) => a - b));
          expect(halves.move.filter((id) => halves.cover.includes(id))).toEqual([]);
        }
      }
    }
  });
});

describe('a belief with nothing more seen or heard', () => {
  it('only ever fades, and is gone in the end', () => {
    for (let seed = 1; seed <= RUNS / 3; seed++) {
      const r = seeded(seed);
      const senses = createSenses({ sight: { range: 50, cone: -1, far: 0.2 }, memory: 1 + r() * 8, intuition: r() * 3 });
      const me = { pos: { x: 0, y: 0, z: 0 }, dir: { x: 0, y: 0, z: -1 }, beliefs: {} };
      const there = { id: 'you', at: point(r, 30), vel: { x: r() - 0.5, y: 0, z: r() - 0.5 }, hostile: true };
      for (let t = 0; t < 2; t += 1 / 30) sense(senses, me, { targets: [there] }, 1 / 30);
      let last = belief(me, 'you')?.confidence ?? 0;
      expect(last, `seed ${seed}`).toBeGreaterThan(0);
      for (let t = 0; t < 20; t += 1 / 30) {
        sense(senses, me, { targets: [] }, 1 / 30);
        const now = belief(me, 'you')?.confidence ?? 0;
        expect(now, `seed ${seed}`).toBeLessThanOrEqual(last + 1e-12);
        last = now;
      }
      expect(belief(me, 'you'), `seed ${seed}`).toBeNull();
    }
  });
});

describe('utility’s pick, over random options', () => {
  it('chooses an option with the highest score, or, given a rand and a spread, one near the top', () => {
    for (let seed = 1; seed <= RUNS; seed++) {
      const r = seeded(seed);
      const options = Array.from({ length: 1 + Math.floor(r() * 8) }, (_, i) => {
        const v = Math.floor(r() * 4) / 3; // a few ties, on purpose
        return { id: `o${i}`, weight: 1, considerations: [() => v] };
      });
      const got = pick(options, {});
      const top = Math.max(...options.map((o) => o.considerations[0]()));
      if (top <= 0) {
        expect(got, `seed ${seed}`).toBeNull();
        continue;
      }
      expect(got.score, `seed ${seed}`).toBe(top);
      // ties broken by the rand given: within the spread, and the same rand gives the same pick
      const spread = 0.25;
      const a = pick(options, {}, { rand: seeded(seed * 3), spread });
      const b = pick(options, {}, { rand: seeded(seed * 3), spread });
      expect(a.id).toBe(b.id);
      expect(a.score, `seed ${seed}`).toBeGreaterThanOrEqual(top * (1 - spread));
    }
  });
});
