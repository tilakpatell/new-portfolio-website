import { describe, expect, it } from 'vitest';
import { pushOut } from '../walker';
import { newTalk, talkOn } from '../talk';
import { CAST, CHAMBER, CHAMBER_DOOR_WALL, DASH_START, DOOR_WALL, EAST_DOOR, FORK, GATE, GATE_COLLIDERS, GATE_START, GATE_WALLS, HALL, HALL_COLLIDERS, HALL_START, HALL_WALLS, PILLARS, SPOTS, TOMB, TROLL_FRODO, TROLL_ROUNDS, castFor, inLake, validAt, wayAt } from './layout';
import { CONVOS, QUESTS, SEAL, SPEAKERS, moriaProgress } from './story';

const AREA = {
  gate: { colliders: GATE_COLLIDERS, walls: GATE_WALLS, blocked: inLake },
  halls: { colliders: HALL_COLLIDERS, walls: HALL_WALLS, blocked: () => false },
};
const clear = (zone, x, z, rad = 0.4, extra = []) => {
  const a = AREA[zone];
  const [px, pz] = pushOut(x, z, rad, a.colliders, [...a.walls, ...extra]);
  return Math.hypot(px - x, pz - z) < 1e-6 && !a.blocked(x, z);
};
function reachable(zone, a, b, extra = []) {
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
      if (Math.abs(ni * S) > 120 || Math.abs(nj * S) > 120 || !clear(zone, ni * S, nj * S, 0.4, extra)) continue;
      queue.push([ni, nj]);
    }
  }
  return false;
}

describe('Moria’s West-gate', () => {
  it('walks the shore to the Doors, but not through them while shut', () => {
    expect(reachable('gate', GATE_START, SPOTS.find((s) => s.id === 'doors'), DOOR_WALL)).toBe(true);
    expect(reachable('gate', GATE_START, { x: 0, z: GATE.cliff - 3, r: 1 }, DOOR_WALL)).toBe(false);
  });
  it('keeps you out of the lake, and has the dash start on dry land', () => {
    expect(clear('gate', 0, GATE.shore + 3)).toBe(false);
    expect(clear('gate', DASH_START.x, DASH_START.z)).toBe(true);
    expect(clear('gate', GATE_START.x, GATE_START.z)).toBe(true);
  });
});

describe('Moria’s halls', () => {
  it('only lets the right way through the fork', () => {
    for (let i = 0; i < FORK.ways.length; i++) {
      // beyond each way's rock-fall, nearly at the hall: only the right one gets there
      const ok = reachable('halls', { x: FORK.x - 3, z: FORK.ways[i] }, { x: FORK.x + 3.4, z: FORK.ways[i], r: 0.4 });
      expect(ok, `way ${i}`).toBe(i === FORK.right);
      expect(wayAt(FORK.x + 1, FORK.ways[i])).toBe(i);
    }
    expect(wayAt(FORK.x - 5, 0)).toBe(-1);
  });

  it('gets from the passage to the chamber and the east door', () => {
    expect(reachable('halls', HALL_START, { x: CHAMBER.x, z: CHAMBER.z + 3, r: 1 })).toBe(true);
    expect(reachable('halls', HALL_START, { x: EAST_DOOR.x - 1, z: EAST_DOOR.z, r: 1 })).toBe(true);
  });

  it('shuts the chamber in when its doors are barred', () => {
    expect(reachable('halls', TROLL_FRODO, { x: CHAMBER.x, z: -HALL.d / 2 + 3, r: 1 }, CHAMBER_DOOR_WALL)).toBe(false);
  });

  it('has everyone, every spot, and the troll’s rounds standing clear', () => {
    for (const s of SPOTS) expect(clear(s.zone, s.x, s.z), s.id).toBe(true);
    for (const c of CAST) expect(clear(c.zone, c.x, c.z, 0.35), c.id).toBe(true);
    for (const [x, z] of TROLL_ROUNDS[0]) expect(clear('halls', x, z, 0.6), `${x},${z}`).toBe(true);
    expect(clear('halls', TROLL_FRODO.x, TROLL_FRODO.z)).toBe(true);
    expect(clear('halls', HALL_START.x, HALL_START.z)).toBe(true);
  });

  it('lays the pillars out clear of the doors, and the tomb in the chamber', () => {
    for (const p of PILLARS) {
      expect(Math.abs(p.z - EAST_DOOR.z) > 2 || Math.abs(p.x - EAST_DOOR.x) > 4).toBe(true);
      expect(Math.abs(p.x - CHAMBER.x) > 2 || p.z > -HALL.d / 2 + 4).toBe(true);
    }
    expect(Math.abs(TOMB.x - CHAMBER.x)).toBeLessThan(1);
  });

  it('only lets a saved spot stand where it’s fair', () => {
    expect(validAt(null, [])).toEqual({ zone: 'gate', ...GATE_START });
    expect(validAt({ zone: 'halls', x: 0, z: 0 }, [])).toEqual({ zone: 'gate', ...GATE_START });
    expect(validAt({ zone: 'halls', x: 0, z: 0, face: 1 }, ['doors'])).toEqual({ zone: 'halls', x: 0, z: 0, face: 1 });
    expect(validAt({ zone: 'halls', x: PILLARS[0].x, z: PILLARS[0].z }, ['doors'])).toEqual({ zone: 'halls', ...HALL_START });
  });
});

describe('Moria’s story', () => {
  it('goes in by the Doors, then lights the halls', () => {
    expect(moriaProgress([]).zone).toBe('gate');
    expect(moriaProgress(['doors']).zone).toBe('halls');
    expect(moriaProgress(['doors']).lit).toBe(false);
    expect(moriaProgress(['doors', 'dark']).lit).toBe(true);
    expect(moriaProgress(QUESTS.map((q) => q.id)).finished).toBe(true);
  });

  it('has a seal for each, keeps the Doors’ own, and someone for every line', () => {
    expect(SEAL.doors).toBe('mellon');
    for (const q of QUESTS) expect(SEAL[q.id]).toBeTruthy();
    for (const [id, c] of Object.entries(CONVOS))
      for (const n of Object.values(c.nodes)) {
        expect(n.who in SPEAKERS, `${id}: ${n.who}`).toBe(true);
        for (const ch of n.choices ?? []) expect(c.nodes[ch.to], `${id} → ${ch.to}`).toBeTruthy();
        if (n.next) expect(c.nodes[n.next], `${id} → ${n.next}`).toBeTruthy();
      }
  });

  it('ends every conversation, whatever you pick, and says mellon to open the Doors', () => {
    for (const [id, c] of Object.entries(CONVOS)) {
      const walk = (talk, depth, path) => {
        if (talk.end) return [[talk.end, path]];
        if (depth > 14) return [['loop', path]];
        const node = c.nodes[talk.at];
        if (node.choices) return node.choices.flatMap((_, i) => walk(talkOn(c, talk, i), depth + 1, [...path, talk.at]));
        return walk(talkOn(c, talk), depth + 1, [...path, talk.at]);
      };
      const ends = walk(newTalk(c), 0, []);
      // a wrong guess goes round again; at least one way through always wins
      expect(ends.some(([e]) => e === 'won'), id).toBe(true);
      for (const [e, path] of ends) if (e === 'won' && id === 'doors') expect(path).toContain('mellon');
    }
  });

  it('has the right people about', () => {
    expect(castFor('gate', 'doors').map((c) => c.id)).toContain('gandalf-gate');
    expect(castFor('halls', 'dark').map((c) => c.id)).toContain('gandalf-fork');
    expect(castFor('halls', 'bridge')).toEqual([]);
  });
});
