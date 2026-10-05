import { describe, expect, it } from 'vitest';
import { pushOut } from '../walker';
import { newTalk, talkNode, talkOn } from '../talk';
import { BILL, CAST, COLLIDERS, GATE_WALLS, HARRY_AT_HATCH, HOUSES, INN_DOOR, PONY, ROADS, ROUNDS, SPOTS, START, STRIDER_NIGHT, TOWN, WALLS, WORLD, boxDist, height, spot, validAt } from './layout';
import { CONVOS, QUESTS, breeProgress } from './story';

const clear = (x, z, rad = 0.4, walls = WALLS) => {
  const [px, pz] = pushOut(x, z, rad, COLLIDERS, walls);
  return Math.hypot(px - x, pz - z) < 1e-6;
};

// can a hobbit walk from a to b? A search over half-metre squares.
function reachable(a, b, walls) {
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
      if (Math.hypot(x, z) > WORLD.radius || !clear(x, z, 0.4, walls)) continue;
      queue.push([ni, nj]);
    }
  }
  return false;
}

describe('Bree’s layout', () => {
  it('has every spot, everyone and every start standing clear', () => {
    for (const s of SPOTS) expect(clear(s.x, s.z), s.id).toBe(true);
    for (const c of CAST) expect(clear(c.x, c.z, 0.35), c.id).toBe(true);
    for (const [name, at] of Object.entries({ START, INN_DOOR, HARRY_AT_HATCH, STRIDER_NIGHT, BILL })) expect(clear(at.x, at.z, 0.35), name).toBe(true);
  });

  it('keeps every house inside the stockade, apart from the others', () => {
    const all = [...HOUSES, PONY];
    for (const h of all) {
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const t = h.turn || 0;
        const lx = (sx * h.w) / 2;
        const lz = (sz * h.d) / 2;
        const x = h.x + lx * Math.cos(t) + lz * Math.sin(t);
        const z = h.z - lx * Math.sin(t) + lz * Math.cos(t);
        expect(Math.hypot(x, z), h.id ?? 'pony').toBeLessThan(TOWN.r - 0.5);
        for (const o of all) if (o !== h) expect(boxDist(o, x, z), `${h.id} into ${o.id}`).toBeGreaterThan(0.6);
      }
    }
  });

  it('keeps the streets and lanes clear to walk down', () => {
    for (const r of ROADS) {
      if (r.id === 'yard') continue; // the yard has its cart and hay
      for (let k = 0; k <= 1; k += 0.05) {
        const x = r.a[0] + (r.b[0] - r.a[0]) * k;
        const z = r.a[1] + (r.b[1] - r.a[1]) * k;
        if (Math.hypot(x, z) > WORLD.radius) continue;
        expect(clear(x, z), `${r.id} at ${x.toFixed(1)},${z.toFixed(1)}`).toBe(true);
      }
    }
  });

  it('can be walked: from the road in to the Pony once the gate’s open, and from the Pony to the East Gate', () => {
    expect(reachable(START, spot('pony'), [...WALLS, ...GATE_WALLS.east])).toBe(true);
    expect(reachable(START, spot('pony'), [...WALLS, ...GATE_WALLS.west])).toBe(false);
    expect(reachable(INN_DOOR, spot('east'), [...WALLS, ...GATE_WALLS.east])).toBe(true);
    expect(reachable(INN_DOOR, spot('leave'), [...WALLS, ...GATE_WALLS.east])).toBe(false);
    expect(reachable(INN_DOOR, spot('leave'), WALLS)).toBe(true);
  });

  it('sends the Nazgûl round on open ground', () => {
    for (const r of ROUNDS) for (const [x, z] of r) expect(clear(x, z, 0.45), `${x},${z}`).toBe(true);
  });

  it('stands the buildings level, and the land rises up Bree-hill to the north', () => {
    expect(Number.isFinite(height(0, 0))).toBe(true);
    expect(height(-8, -27)).toBeGreaterThan(height(-8, 3));
  });

  it('puts a saved spot back where it is fair', () => {
    expect(validAt({ x: 4, z: -1, face: 0 }, [])).toBe(START);
    expect(validAt({ x: PONY.x, z: PONY.z }, ['gate'])).toBe(INN_DOOR);
    expect(validAt({ x: 60, z: 0 }, ['gate'])).toBe(INN_DOOR);
    expect(validAt({ x: 40, z: -5.6 }, ['gate', 'pony', 'pints', 'strider'])).toBe(INN_DOOR);
    expect(validAt({ x: -20, z: 4, face: 1 }, ['gate'])).toEqual({ x: -20, z: 4, face: 1 });
    expect(validAt(null, ['gate'])).toBe(INN_DOOR);
    expect(validAt({ x: 'a' }, [])).toBe(START);
  });
});

describe('Bree’s story', () => {
  it('goes gate, Pony, pints, Strider, then through the town unseen', () => {
    const order = [];
    let done = [];
    for (let i = 0; i < QUESTS.length; i++) {
      const p = breeProgress(done);
      order.push(p.next);
      done = [...done, p.next];
    }
    expect(order).toEqual(['gate', 'pony', 'pints', 'strider', 'slip']);
  });

  it('is a wet evening until Strider, night until you are through, then dawn', () => {
    expect(breeProgress([]).sky).toBe('evening');
    expect(breeProgress(['gate', 'pony', 'pints']).sky).toBe('evening');
    expect(breeProgress(['gate', 'pony', 'pints', 'strider'])).toMatchObject({ sky: 'night', smashed: true, eastOpen: false });
    expect(breeProgress(['gate', 'pony', 'pints', 'strider', 'slip'])).toMatchObject({ sky: 'dawn', eastOpen: true, finished: true });
  });

  it('has conversations that hang together and can be won', () => {
    for (const [name, c] of Object.entries(CONVOS)) {
      for (const [id, n] of Object.entries(c.nodes)) {
        for (const to of [n.next, ...(n.choices ?? []).map((x) => x.to)].filter(Boolean)) expect(c.nodes[to], `${name}.${id} → ${to}`).toBeTruthy();
      }
      // always taking the first reply wins
      let t = newTalk(c);
      for (let i = 0; i < 20 && !t.end; i++) t = talkOn(c, t, talkNode(c, t).choices ? 0 : null);
      expect(t.end, name).toBe('won');
    }
  });
});
