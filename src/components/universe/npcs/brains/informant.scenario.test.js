// An informant's promise (its header): it flies up alongside you, says
// hello and tells you what's coming (a `tip` with world.next), flies along
// a moment (NPC.tell), and goes. It never fires.
import { describe, expect, it } from 'vitest';
import { NPC } from './common';
import { foe, meet, you } from './harness';

describe('an informant, flown', () => {
  it('catches you up, tips you off with what is next, stays a moment, and goes', () => {
    let tipAt = null;
    let leftAt = null;
    const seen = meet({
      brain: 'informant',
      npc: foe('informant', { faction: 'smugglers', stats: { speed: 18, accel: 16, turn: 2.6, hp: 6 } }),
      at: { x: 0, y: 0, z: 30 },
      ship: you({ speed: 10 }),
      world: () => ({ next: 'hunters' }),
      seconds: 40,
      each: (m, s, out, t) => {
        for (const e of out.events) {
          if (e.type === 'tip' && tipAt === null) tipAt = t;
          if (e.type === 'say' && e.key === 'leaving' && leftAt === null) leftAt = t;
        }
      },
    });
    const tips = seen.events.filter((e) => e.type === 'tip');
    expect(tips).toHaveLength(1);
    expect(tips[0].next).toBe('hunters');
    // the hello comes first, in the same frame
    expect(seen.says.indexOf('hello')).toBeGreaterThanOrEqual(0);
    expect(leftAt - tipAt).toBeGreaterThan(NPC.tell - 0.1);
    expect(leftAt - tipAt).toBeLessThan(NPC.tell + 1);
    expect(seen.shots).toEqual([]);
  });
});
