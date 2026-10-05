import { describe, expect, it } from 'vitest';
import { pushOut } from '../walker';
import { newTalk, talkOn } from '../talk';
import { ARWEN_AT, BED, CAST, COLLIDERS, CRAGS, DELL, FIRE_AT, GAPS, HILL, PATCHES, PLANTS, RUIN, SAM_START, SPOTS, STAIR, STAND, START, WALLS, WORLD, WOUNDED, castFor, height, spot, stairNear, validAt } from './layout';
import { CONVOS, QUESTS, SEAL, SPEAKERS, weathertopProgress } from './story';

const clear = (x, z, rad = 0.4) => {
  const [px, pz] = pushOut(x, z, rad, COLLIDERS, WALLS);
  return Math.hypot(px - x, pz - z) < 1e-6;
};
// can a hobbit walk from a to b? A search over half-metre squares.
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

describe('Weathertop’s land', () => {
  it('has a flat top for the ruin, crags round it, and the heath far below', () => {
    for (const [x, z] of [[0, 0], [5, -4], [-7, 3], [RUIN.r - 0.5, 0]]) expect(height(x, z)).toBeCloseTo(HILL.top, 5);
    expect(height(0, -HILL.crag[1])).toBeLessThan(HILL.top - 5);
    expect(Math.abs(height(0, -HILL.foot - 2))).toBeLessThan(2);
  });

  it('cuts a stair that climbs all the way, never too steep for a hobbit', () => {
    const top = STAIR.at(-1);
    expect(top[2]).toBe(HILL.top);
    expect(STAIR[0][2]).toBeLessThan(3);
    for (let i = 1; i < STAIR.length; i++) {
      const [ax, az, ay] = STAIR[i - 1];
      const [bx, bz, by] = STAIR[i];
      expect(by, `step ${i}`).toBeGreaterThanOrEqual(ay - 0.8);
      expect((by - ay) / Math.hypot(bx - ax, bz - az), `slope ${i}`).toBeLessThan(0.95);
    }
    // the land follows the stair along it
    for (let k = 0; k <= 1; k += 0.05) {
      const i = Math.min(STAIR.length - 2, Math.floor(k * (STAIR.length - 1)));
      const f = k * (STAIR.length - 1) - i;
      const x = STAIR[i][0] + (STAIR[i + 1][0] - STAIR[i][0]) * f;
      const z = STAIR[i][1] + (STAIR[i + 1][1] - STAIR[i][1]) * f;
      expect(Math.abs(height(x, z) - stairNear(x, z).y)).toBeLessThan(0.05);
    }
  });

  it('lets you up only by the stair: the crags close everything else', () => {
    const summit = spot('summit');
    expect(reachable(START, summit)).toBe(true);
    // straight up the north face: walled
    const [x, z] = pushOut(0, -(HILL.crag[0] + HILL.crag[1]) / 2, 0.4, COLLIDERS, WALLS);
    expect(Math.hypot(x, z + (HILL.crag[0] + HILL.crag[1]) / 2)).toBeGreaterThan(0.5);
    // and the crags' rocks stand clear of the stair
    for (const [cx, cz] of CRAGS) expect(stairNear(cx, cz).d).toBeGreaterThan(2);
  });

  it('can get everywhere the story goes, from the road', () => {
    for (const s of SPOTS) expect(reachable(START, s), s.id).toBe(true);
    for (const p of PLANTS) expect(reachable(SAM_START, { ...p, r: 1.2 }), p.id).toBe(true);
    for (const p of PATCHES) expect(reachable(BED, { ...p, r: 0.8 }), p.id).toBe(true);
  });

  it('has every spot, everyone and every start standing clear', () => {
    for (const s of SPOTS) expect(clear(s.x, s.z), s.id).toBe(true);
    for (const c of CAST) expect(clear(c.x, c.z, 0.35), c.id).toBe(true);
    for (const p of PLANTS) expect(clear(p.x, p.z, 0.3), p.id).toBe(true);
    for (const [name, at] of Object.entries({ START, SAM_START, ARWEN_AT, WOUNDED, BED, STAND })) expect(clear(at.x, at.z, 0.35), name).toBe(true);
  });

  it('puts the camp in the dell, on the level', () => {
    expect(Math.hypot(FIRE_AT.x - DELL.x, FIRE_AT.z - DELL.z)).toBeLessThan(DELL.r * 0.5);
    const ys = PATCHES.map((p) => height(p.x, p.z));
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(0.6);
  });

  it('opens a gap in the ruin for each of the five', () => {
    expect(GAPS.length).toBeGreaterThanOrEqual(5);
    for (const a of GAPS) {
      const x = Math.cos(a) * RUIN.r;
      const z = Math.sin(a) * RUIN.r;
      expect(clear(x, z, 0.35), `gap ${a}`).toBe(true);
    }
    // and there's room to stand in the middle, with the brand
    expect(clear(STAND.x, STAND.z, 0.4)).toBe(true);
  });

  it('only lets a saved spot stand if it’s fair', () => {
    expect(validAt(null)).toEqual(START);
    expect(validAt({ x: 0, z: 2 }, [])).toEqual(START);
    expect(validAt({ x: 0, z: 30, face: 1 }, ['climb'])).toEqual({ x: 0, z: 30, face: 1 });
    expect(validAt({ x: RUIN.plinth.x + 0.2, z: RUIN.plinth.z }, ['climb'])).toEqual(START);
    expect(validAt({ x: 200, z: 0 }, ['climb'])).toEqual(START);
  });
});

describe('Weathertop’s story', () => {
  it('goes dusk, night, dawn, with Sam searching in between', () => {
    expect(weathertopProgress([]).sky).toBe('dusk');
    expect(weathertopProgress(['climb']).sky).toBe('night');
    expect(weathertopProgress(['climb', 'supper']).riders).toBe(true);
    expect(weathertopProgress(['climb', 'supper', 'brand']).as).toBe('sam');
    expect(weathertopProgress(['climb', 'supper', 'brand', 'athelas']).as).toBe('sam');
    expect(weathertopProgress(['climb', 'supper']).as).toBe('frodo');
    const all = weathertopProgress(QUESTS.map((q) => q.id));
    expect(all.finished).toBe(true);
    expect(all.sky).toBe('dawn');
  });

  it('can’t skip ahead from a strange save', () => {
    expect(weathertopProgress(['ford', 'brand']).done).toEqual([]);
    expect(weathertopProgress(['climb', 'brand']).next).toBe('supper');
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
      // walk each choice in turn; every path ends within a few lines
      const walk = (talk, depth) => {
        if (talk.end) return [talk.end];
        expect(depth, id).toBeLessThan(12);
        const node = c.nodes[talk.at];
        if (node.choices) return node.choices.flatMap((_, i) => walk(talkOn(c, talk, i), depth + 1));
        return walk(talkOn(c, talk), depth + 1);
      };
      expect(walk(newTalk(c), 0).every((e) => e === 'won'), id).toBe(true);
    }
  });

  it('has the right people about at the right time', () => {
    const ids = (sky, next) => castFor(sky, next).map((c) => c.id);
    expect(ids('dusk', 'climb')).toContain('strider');
    expect(ids('night', 'supper')).toEqual(expect.arrayContaining(['sam', 'merry', 'pippin']));
    expect(ids('night', 'brand')).not.toContain('sam');
    expect(ids('night', 'athelas')).toContain('strider-foot');
    expect(ids('dawn', null)).toContain('strider-dawn');
  });
});
