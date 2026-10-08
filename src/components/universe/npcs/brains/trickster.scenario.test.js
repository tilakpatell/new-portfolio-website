// A trickster's promise (its header): it comes alongside and names its
// toll; hold still NPC.scan seconds and it pays you back with word of
// what's coming and goes; keep it waiting past NPC.toll and it calls its
// friends in (a `busted` event) and fights.
import { describe, expect, it } from 'vitest';
import { NPC } from './common';
import { foe, meet, you } from './harness';

const npc = foe('trickster', { faction: 'pirates', stats: { speed: 24, accel: 20, turn: 2.8, hp: 14, fire: [0.7, 1.1], damage: 6 } });

describe('a trickster, flown', () => {
  it('names its toll, and paid in patience tips you off and goes without a shot', () => {
    let helloAt = null;
    const seen = meet({
      brain: 'trickster',
      npc,
      at: { x: 0, y: 0, z: 30 },
      ship: you({ speed: 8 }),
      steer: (s) => (helloAt === null ? s : { ...s, speed: 0 }),
      world: () => ({ next: 'a storm' }),
      seconds: 40,
      each: (m, s, out, t) => {
        if (helloAt === null && out.events.some((e) => e.type === 'say' && e.key === 'hello')) helloAt = t;
      },
    });
    expect(seen.says).toEqual(expect.arrayContaining(['hello', 'paid', 'leaving']));
    expect(seen.events.filter((e) => e.type === 'tip').map((e) => e.next)).toEqual(['a storm']);
    expect(seen.events.some((e) => e.type === 'busted')).toBe(false);
    expect(seen.shots).toEqual([]);
  });

  it('kept waiting past its patience, calls its friends in and fights you', () => {
    let helloAt = null;
    let bustedAt = null;
    const seen = meet({
      brain: 'trickster',
      npc,
      at: { x: 0, y: 0, z: 30 },
      // you never stop: you drift along, faster than holding still and slower than running
      ship: you({ speed: NPC.hold * 2 }),
      seconds: 40,
      each: (m, s, out, t) => {
        if (helloAt === null && out.events.some((e) => e.type === 'say' && e.key === 'hello')) helloAt = t;
        if (bustedAt === null && out.events.some((e) => e.type === 'busted')) bustedAt = t;
      },
    });
    expect(bustedAt - helloAt).toBeGreaterThan(NPC.toll - 0.1);
    expect(bustedAt - helloAt).toBeLessThan(NPC.toll + 0.5);
    expect(seen.says).toContain('angry');
    expect(seen.shots.length).toBeGreaterThan(0);
  });
});
