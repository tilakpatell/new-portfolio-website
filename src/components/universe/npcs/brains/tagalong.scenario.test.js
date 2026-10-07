// A tagalong's promise (its header): it comes up off your left wing, says
// hello, chats every NPC.chatter seconds (three times, then quiet), panics
// and hides from hunters, comes back with a word, never fires, and goes
// home after NPC.tag seconds.
import { describe, expect, it } from 'vitest';
import { NPC, rightOf } from './common';
import { DT, apart, foe, meet, you } from './harness';

const npc = foe('tagalong', { faction: 'smiths', stats: { speed: 16, accel: 14, turn: 2.2, hp: 4 } });

describe('a tagalong, flown', () => {
  it('rides your left wing, chats three times, never fires, and goes home', () => {
    let onLeft = 0;
    let frames = 0;
    const seen = meet({
      brain: 'tagalong',
      npc,
      at: { x: -10, y: 0, z: 20 },
      ship: you({ speed: 6 }),
      steer: (s) => ({ ...s, heading: s.heading + 0.1 * DT }),
      seconds: NPC.tag + 5,
      each: (m, s, out, t) => {
        if (!m || t < 15 || m.leaving) return;
        frames += 1;
        const r = rightOf(s);
        if ((m.pos.x - s.x) * r.x + (m.pos.z - s.z) * r.z < 0 && apart(m.pos, s) < NPC.alongside * 3) onLeft += 1;
      },
    });
    expect(onLeft / frames).toBeGreaterThan(0.8);
    expect(seen.says.filter((k) => /^chat\d$/.test(k))).toEqual(['chat1', 'chat2', 'chat3']);
    expect(seen.shots).toEqual([]);
    expect(seen.says).toContain('leaving');
  });

  it('runs from hunters near you and comes back with a word once they have gone', () => {
    const hunter = { id: 1, at: { x: 0, y: 0, z: -20 }, faction: 'empire', vel: { x: 0, y: 0, z: 0 } };
    const seen = meet({
      brain: 'tagalong',
      npc,
      at: { x: -6, y: 0, z: 2 },
      ship: you(),
      // hunters about from 10 s to 20 s
      world: (t) => ({ hunters: t > 10 && t < 20 ? [hunter] : [] }),
      seconds: 35,
    });
    expect(seen.says).toEqual(expect.arrayContaining(['hello', 'panic', 'back']));
    expect(seen.says.indexOf('panic')).toBeLessThan(seen.says.indexOf('back'));
  });
});
