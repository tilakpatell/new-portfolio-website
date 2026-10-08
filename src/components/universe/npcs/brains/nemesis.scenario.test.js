// A nemesis's promise (its header and the design's table): it fights you
// on the guns, firing only in range and no faster than its guns allow (a
// fury quicker), and breaks off nearly dead. Flown here as a meeting: you
// fly straight, then turn hard.
import { describe, expect, it } from 'vitest';
import { NPC } from './common';
import { DT, foe, meet, you } from './harness';

const FURY_RATE = 0.6; // nemesis.js: its guns' cooldown in a fury

describe('a nemesis, flown', () => {
  const npc = foe('nemesis');
  const straightThenHard = (s, t) => (t < 10 ? s : { ...s, heading: s.heading + 2.2 * DT });

  it('fires only in range, and never faster than its guns', () => {
    const seen = meet({ npc, ship: you({ speed: 10 }), steer: straightThenHard, seconds: 40 });
    expect(seen.shots.length).toBeGreaterThan(10);
    for (const s of seen.shots) expect(Math.hypot(s.to.x - s.from.x, s.to.y - s.from.y, s.to.z - s.from.z)).toBeLessThan(NPC.range);
    const gaps = seen.shots.slice(1).map((s, i) => s.t - seen.shots[i].t);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(npc.stats.fire[0] * FURY_RATE - DT);
  });

  it('breaks off when it is nearly dead, says so, and remembers', () => {
    let leftAt = null;
    const seen = meet({
      npc,
      ship: you({ speed: 10 }),
      steer: straightThenHard,
      seconds: 30,
      each: (m, s, out, t) => {
        if (m && Math.abs(t - 12) < DT / 2) m.hp = Math.floor(m.hpMax * NPC.retreat * 0.5);
        if (leftAt === null && out.events.some((e) => e.type === 'say' && e.key === 'leaving')) leftAt = t;
      },
    });
    expect(leftAt).toBeGreaterThan(12);
    expect(leftAt).toBeLessThan(13);
    expect(seen.shots.filter((s) => s.t > leftAt)).toEqual([]);
    expect(seen.me.memory.last.how).toBe('retreat');
  });
});
