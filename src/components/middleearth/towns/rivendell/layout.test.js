import { describe, expect, it } from 'vitest';
import { pushOut } from '../walker';
import { newTalk, talkOn } from '../talk';
import { BRIDGE, CAST, COLLIDERS, COMPANIONS, COURT, GATE, HOUSE_DOOR, SEATS, SPOTS, START, WALLS, WORLD, blocked, bridgeY, castFor, height, riverX, spot, validAt } from './layout';
import { CONVOS, QUESTS, SEAL, SPEAKERS, rivendellProgress } from './story';

const clear = (x, z, rad = 0.4) => {
  const [px, pz] = pushOut(x, z, rad, COLLIDERS, WALLS);
  return Math.hypot(px - x, pz - z) < 1e-6 && !blocked(px, pz);
};
function reachable(a, b) {
  const S = 0.5;
  const key = (i, j) => `${i},${j}`;
  const cell = (x, z) => [Math.round(x / S), Math.round(z / S)];
  const [bi, bj] = cell(b.x, b.z);
  const queue = [cell(a.x, a.z)];
  const seen = new Set([key(...queue[0])]);
  while (queue.length) {
    const [i, j] = queue.shift();
    if (Math.hypot(i - bi, j - bj) * S < (b.r ?? 1)) return true;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di;
      const nj = j + dj;
      const k = key(ni, nj);
      if (seen.has(k)) continue;
      seen.add(k);
      if (Math.hypot(ni * S, nj * S) > WORLD.radius || !clear(ni * S, nj * S)) continue;
      queue.push([ni, nj]);
    }
  }
  return false;
}

describe('Rivendell’s valley', () => {
  it('has every spot, everyone and every start standing clear', () => {
    for (const s of SPOTS) expect(clear(s.x, s.z), s.id).toBe(true);
    for (const c of [...CAST, ...COMPANIONS]) expect(clear(c.x, c.z, 0.3), c.id).toBe(true);
    for (const [name, at] of Object.entries({ START, HOUSE_DOOR })) expect(clear(at.x, at.z), name).toBe(true);
  });

  it('can get everywhere the story goes, from the house', () => {
    for (const s of SPOTS) expect(reachable(HOUSE_DOOR, s), s.id).toBe(true);
    for (const c of COMPANIONS) expect(reachable(HOUSE_DOOR, { ...c, r: 1.5 }), c.id).toBe(true);
  });

  it('crosses the gorge only by the bridge', () => {
    const east = { x: BRIDGE.x + BRIDGE.len / 2 + 3, z: BRIDGE.z, r: 1 };
    expect(reachable(HOUSE_DOOR, east)).toBe(true);
    // and the gorge is deep, and can’t be stood in
    expect(height(riverX(-20), -20)).toBeLessThan(-5);
    expect(clear(riverX(-20), -20)).toBe(false);
    expect(clear(riverX(30), 30)).toBe(false);
  });

  it('arches the bridge’s deck, level with its ends', () => {
    expect(bridgeY(BRIDGE.x)).toBeCloseTo(BRIDGE.y0 + BRIDGE.rise, 5);
    expect(height(BRIDGE.x, BRIDGE.z)).toBeCloseTo(BRIDGE.y0 + BRIDGE.rise, 5);
    const end = BRIDGE.x - BRIDGE.len / 2;
    expect(Math.abs(height(end - 0.5, BRIDGE.z) - BRIDGE.y0)).toBeLessThan(0.4);
    expect(Math.abs(height(end + 0.2, BRIDGE.z) - BRIDGE.y0)).toBeLessThan(0.4);
  });

  it('rings the court with its seats, facing the middle, inside the balustrade', () => {
    expect(SEATS).toHaveLength(10);
    for (const s of SEATS) {
      expect(Math.hypot(s.x - COURT.x, s.z - COURT.z)).toBeLessThan(COURT.r - 1);
      const fx = Math.cos(s.face);
      const fz = -Math.sin(s.face);
      expect(fx * (COURT.x - s.x) + fz * (COURT.z - s.z)).toBeGreaterThan(5);
    }
    // and its way in is open
    expect(reachable(HOUSE_DOOR, { x: COURT.x, z: COURT.z + 2, r: 1 })).toBe(true);
  });

  it('only lets a saved spot stand if it’s fair', () => {
    expect(validAt(null)).toEqual(START);
    expect(validAt(null, ['awake'])).toEqual(HOUSE_DOOR);
    expect(validAt({ x: -6, z: 30, face: 1 }, ['awake'])).toEqual({ x: -6, z: 30, face: 1 });
    expect(validAt({ x: riverX(0), z: 0 }, ['awake'])).toEqual(HOUSE_DOOR);
    expect(validAt({ x: 300, z: 0 }, ['awake'])).toEqual(HOUSE_DOOR);
    expect(spot('gate').z).toBeLessThan(GATE.z);
  });
});

describe('Rivendell’s story', () => {
  it('goes day, dusk, morning', () => {
    expect(rivendellProgress([]).sky).toBe('day');
    expect(rivendellProgress(['awake', 'narsil', 'council']).sky).toBe('dusk');
    expect(rivendellProgress(QUESTS.map((q) => q.id)).sky).toBe('dawn');
    expect(rivendellProgress(['council']).done).toEqual([]);
  });

  it('has a seal for every quest, and someone to say every line', () => {
    for (const q of QUESTS) expect(SEAL[q.id], q.id).toBeTruthy();
    for (const [id, c] of Object.entries(CONVOS)) {
      expect(c.nodes[c.start], id).toBeTruthy();
      for (const n of Object.values(c.nodes)) {
        expect(n.who in SPEAKERS, `${id}: ${n.who}`).toBe(true);
        for (const ch of n.choices ?? []) expect(c.nodes[ch.to], `${id} → ${ch.to}`).toBeTruthy();
        if (n.next) expect(c.nodes[n.next], `${id} → ${n.next}`).toBeTruthy();
      }
    }
  });

  it('ends every conversation, by any choices', () => {
    for (const [id, c] of Object.entries(CONVOS)) {
      const walk = (talk, depth) => {
        if (talk.end) return [talk.end];
        expect(depth, id).toBeLessThan(16);
        const node = c.nodes[talk.at];
        if (node.choices) return node.choices.flatMap((_, i) => walk(talkOn(c, talk, i), depth + 1));
        return walk(talkOn(c, talk), depth + 1);
      };
      expect(walk(newTalk(c), 0).every((e) => e === 'won'), id).toBe(true);
    }
  });

  it('has eight to gather, and the right people about at the right time', () => {
    expect(COMPANIONS).toHaveLength(8);
    expect(new Set(COMPANIONS.map((c) => c.id)).size).toBe(8);
    const ids = (next) => castFor(next).map((c) => c.id);
    expect(ids('narsil')).toContain('boromir-shards');
    expect(ids('council')).not.toContain('boromir-shards');
    expect(ids('fellowship')).not.toContain('sam-walk');
    expect(ids('fellowship')).toContain('arwen');
  });
});
