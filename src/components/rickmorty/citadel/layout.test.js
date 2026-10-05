import { describe, expect, it } from 'vitest';
import { pushOut, sightClear } from '../../middleearth/towns/walker';
import { CAST, COLLIDERS, CROWD_LOOPS, ESCAPE_START, HANGAR_WALLS, PEN, ROUNDS, SPOTS, START, WALLS, WORLD, castFor, crowdColliders, crowdFor, inPen, spot, validAt } from './layout';

const clear = (x, z, rad = 0.45, walls = WALLS) => {
  const [px, pz] = pushOut(x, z, rad, COLLIDERS, walls);
  return Math.hypot(px - x, pz - z) < 1e-6;
};

// is every point along a to b clear for a body of `rad`?
const legClear = (a, b, rad = 0.45) => {
  const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.25);
  for (let i = 0; i <= n; i++) if (!clear(a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n, rad)) return false;
  return true;
};
const legs = (loop) => loop.map((p, i) => [p, loop[(i + 1) % loop.length]]);

// can Rick walk from a to b? A search over half-metre squares.
function reachable(a, b, walls = WALLS) {
  const S = 0.5;
  const key = (i, j) => `${i},${j}`;
  const cell = (x, z) => [Math.round(x / S), Math.round(z / S)];
  const [bi, bj] = cell(b.x, b.z);
  const seen = new Set();
  const queue = [cell(a.x, a.z)];
  seen.add(key(...queue[0]));
  while (queue.length) {
    const [i, j] = queue.shift();
    if (Math.hypot(i - bi, j - bj) * S < (b.r ?? 1)) return true;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di;
      const nj = j + dj;
      const k = key(ni, nj);
      if (seen.has(k)) continue;
      seen.add(k);
      const x = ni * S;
      const z = nj * S;
      if (Math.hypot(x, z) > WORLD.radius - 0.45 || !clear(x, z, 0.42, walls)) continue;
      queue.push([ni, nj]);
    }
  }
  return false;
}

describe('the Citadel’s concourse', () => {
  it('has the starts, every spot and everyone standing clear', () => {
    for (const p of [START, ESCAPE_START, ...SPOTS, ...CAST]) expect(clear(p.x, p.z), p.id ?? `${p.x},${p.z}`).toBe(true);
    for (const p of [START, ESCAPE_START, ...SPOTS, ...CAST]) expect(Math.hypot(p.x, p.z)).toBeLessThan(WORLD.radius - 0.5);
  });
  it('lets the crowd walk its loops without walking through anything', () => {
    for (const loop of CROWD_LOOPS) for (const [a, b] of legs(loop)) expect(legClear(a, b, 0.4), `${a} → ${b}`).toBe(true);
  });
  it('can reach every spot from the portal', () => {
    for (const s of SPOTS) expect(reachable(START, s), s.id).toBe(true);
  });
  it('has the Day Care pen with its gate, and its spot outside', () => {
    expect(inPen(PEN.x, PEN.z)).toBe(true);
    expect(inPen(-15.5, 0)).toBe(false);
    expect(inPen(spot('daycare').x, spot('daycare').z)).toBe(false);
    // in through the gate
    expect(reachable(spot('daycare'), { x: PEN.x, z: PEN.z, r: 1 })).toBe(true);
    // and not over the fence
    expect(clear(PEN.x - PEN.w / 2 + 0.2, 0, 0.42)).toBe(false);
    expect(clear(PEN.x, PEN.z - PEN.d / 2 - 0.2, 0.42)).toBe(false);
  });
  it('keeps the hangar reachable with its doors shut, from the booth too', () => {
    expect(reachable(START, spot('hangar'), [...WALLS, ...HANGAR_WALLS])).toBe(true);
    expect(reachable(ESCAPE_START, spot('hangar'), [...WALLS, ...HANGAR_WALLS])).toBe(true);
  });
  it('walks the Cop Ricks on open floor, never through anything', () => {
    for (const round of ROUNDS) {
      for (const [x, z] of round) expect(clear(x, z)).toBe(true);
      for (const [a, b] of legs(round)) {
        expect(legClear(a, b), `${a} → ${b}`).toBe(true);
        expect(sightClear(a[0], a[1], b[0], b[1], COLLIDERS, WALLS), `${a} → ${b}`).toBe(true);
      }
    }
  });
  it('hides you behind the core, but not behind a bench', () => {
    expect(sightClear(-10, 0, 10, 0, COLLIDERS, WALLS)).toBe(false);
    const bench = COLLIDERS.find((c) => c.id === 'bench0');
    expect(bench.low).toBe(true);
    expect(sightClear(bench.x, bench.z - 3, bench.x, bench.z + 3, COLLIDERS, WALLS)).toBe(true);
  });
  it('has cover on both ways round the core, booth to hangar', () => {
    const tall = COLLIDERS.filter((c) => !c.low && c.id !== 'core');
    // west and south, or north and east: each side has two tall things near it
    const near = (pts) => tall.filter((c) => pts.some(([x, z]) => Math.hypot(c.x - x, c.z - z) < 7)).length;
    expect(near([[-17, 0], [-12, 12], [0, 17], [12, 22]])).toBeGreaterThanOrEqual(2);
    expect(near([[0, -17], [12, -12], [17, 0], [22, 12]])).toBeGreaterThanOrEqual(2);
  });
  it('puts the named cast away in a red alert, all but Candidate Morty', () => {
    expect(castFor('day').some((c) => c.id === 'evilmorty')).toBe(false);
    expect(castFor('election').some((c) => c.id === 'evilmorty')).toBe(true);
    expect(castFor('red').map((c) => c.id)).toEqual(['evilmorty']);
    expect(castFor('election').filter((c) => c.vote).length).toBe(3);
  });
  it('keeps a saved spot only if it’s a fair one', () => {
    expect(validAt(null, [])).toEqual(START);
    expect(validAt({ x: 0, z: 0, face: 0 }, [])).toEqual(START);
    expect(validAt({ x: 99, z: 0 }, [])).toEqual(START);
    expect(validAt({ x: 10, z: 10, face: 1 }, [])).toEqual({ x: 10, z: 10, face: 1 });
    expect(validAt(null, ['daycare', 'wafers', 'council', 'votemorty'])).toEqual(ESCAPE_START);
    expect(validAt({ x: 10, z: 10, face: 1 }, ['daycare', 'wafers', 'council', 'votemorty'])).toEqual(ESCAPE_START);
  });
});

describe('the Citadel’s crowds', () => {
  const MOODS = ['day', 'election'];
  it('stand clear of everything, of each other and of the places to stop', () => {
    for (const mood of MOODS) {
      const crowd = crowdFor(mood);
      expect(crowd.length, mood).toBeGreaterThan(30);
      crowd.forEach((c, i) => {
        expect(clear(c.x, c.z, 0.38), `${mood} ${i} ${c.x},${c.z}`).toBe(true);
        expect(Math.hypot(c.x, c.z)).toBeLessThan(WORLD.radius - 0.6);
        expect(inPen(c.x, c.z)).toBe(false);
        for (const s of SPOTS) expect(Math.hypot(c.x - s.x, c.z - s.z), `${mood} ${i} by ${s.id}`).toBeGreaterThan(s.r + 0.6);
        for (const p of CAST) expect(Math.hypot(c.x - p.x, c.z - p.z), `${mood} ${i} by ${p.id}`).toBeGreaterThan(0.95);
        for (let j = 0; j < i; j++) expect(Math.hypot(c.x - crowd[j].x, c.z - crowd[j].z), `${mood} ${i}/${j}`).toBeGreaterThan(0.8);
        expect(Number.isFinite(c.face)).toBe(true);
      });
    }
  });
  it('leave the walkers’ loops clear', () => {
    for (const mood of MOODS) {
      const crowd = crowdFor(mood);
      for (const loop of CROWD_LOOPS)
        for (const [a, b] of legs(loop)) {
          const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.25);
          for (let k = 0; k <= n; k++) {
            const x = a[0] + ((b[0] - a[0]) * k) / n;
            const z = a[1] + ((b[1] - a[1]) * k) / n;
            for (const c of crowd) expect(Math.hypot(x - c.x, z - c.z), `${mood} loop by ${c.x},${c.z}`).toBeGreaterThan(0.85);
          }
        }
    }
  });
  it('still let you reach every place, round them', () => {
    for (const mood of MOODS) {
      const extra = crowdColliders(mood);
      const withCrowd = (x, z, rad = 0.42) => {
        const [px, pz] = pushOut(x, z, rad, [...COLLIDERS, ...extra], WALLS);
        return Math.hypot(px - x, pz - z) < 1e-6;
      };
      for (const s of SPOTS) expect(reachableWith(START, s, withCrowd), `${mood} ${s.id}`).toBe(true);
    }
  });
  it('clear off the concourse on red alert', () => {
    expect(crowdFor('red')).toEqual([]);
    expect(crowdColliders('red')).toEqual([]);
  });
  it('rally in front of Candidate Morty’s booth on election day, facing it', () => {
    const rally = crowdFor('election').filter((c) => c.group === 'rally');
    expect(rally.length).toBeGreaterThanOrEqual(30);
    for (const c of rally) {
      const want = Math.atan2(-(-21.5 - c.z), -21.5 - c.x);
      expect(Math.abs(Math.atan2(Math.sin(c.face - want), Math.cos(c.face - want)))).toBeLessThan(0.35);
    }
    expect(crowdFor('day').some((c) => c.group === 'rally')).toBe(false);
  });
});

// reachability with a clear() of its own
function reachableWith(a, b, ok) {
  const S = 0.5;
  const key = (i, j) => `${i},${j}`;
  const cell = (x, z) => [Math.round(x / S), Math.round(z / S)];
  const [bi, bj] = cell(b.x, b.z);
  const seen = new Set();
  const queue = [cell(a.x, a.z)];
  seen.add(key(...queue[0]));
  while (queue.length) {
    const [i, j] = queue.shift();
    if (Math.hypot(i - bi, j - bj) * S < (b.r ?? 1)) return true;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di;
      const nj = j + dj;
      const k = key(ni, nj);
      if (seen.has(k)) continue;
      seen.add(k);
      const x = ni * S;
      const z = nj * S;
      if (Math.hypot(x, z) > WORLD.radius - 0.45 || !ok(x, z)) continue;
      queue.push([ni, nj]);
    }
  }
  return false;
}
