// An inspector's promise (its header): it comes in ahead of you off your
// wing and says hello; hold still for NPC.scan seconds and a clean ship is
// let go. Flown here as a meeting: you fly straight until it has said
// hello, then cut your engines.
import { describe, expect, it } from 'vitest';
import { NPC } from './common';
import { foe, meet, you } from './harness';

const ALONGSIDE = 20; // seconds, at most, before it's off your wing saying hello
const LET_GO = 15; // and from your stop to its leaving, at most

describe('an inspector, flown', () => {
  it('comes alongside, says hello once, scans you when you stop, and lets a clean ship go', () => {
    let helloAt = null;
    let stopAt = null;
    let leftAt = null;
    const seen = meet({
      brain: 'inspector',
      npc: foe('inspector', { faction: 'imperial-customs', stats: { speed: 20, accel: 18, turn: 2.6, hp: 12, fire: [0.8, 1.2], damage: 5 } }),
      at: { x: 0, y: 0, z: 40 },
      ship: you({ speed: 8 }),
      seconds: 60,
      steer: (s) => (helloAt === null ? s : { ...s, speed: 0 }),
      each: (m, s, out, t) => {
        for (const e of out.events) {
          if (e.type === 'say' && e.key === 'hello' && helloAt === null) helloAt = t;
          if (e.type === 'say' && e.key === 'leaving' && leftAt === null) leftAt = t;
        }
        if (helloAt !== null && stopAt === null && s.speed === 0) stopAt = t;
      },
    });
    expect(helloAt).not.toBeNull();
    expect(helloAt).toBeLessThan(ALONGSIDE);
    expect(seen.says.filter((k) => k === 'hello')).toHaveLength(1);
    expect(seen.says).toContain('clean');
    expect(seen.events.some((e) => e.type === 'busted')).toBe(false);
    expect(leftAt - stopAt).toBeGreaterThanOrEqual(NPC.scan - 0.1);
    expect(leftAt - stopAt).toBeLessThan(LET_GO);
    expect(seen.shots).toEqual([]);
  });

  it('finds a ship that runs wanted: calls its faction in and fights', () => {
    let helloAt = null;
    const seen = meet({
      brain: 'inspector',
      npc: foe('inspector', { faction: 'imperial-customs' }),
      at: { x: 0, y: 0, z: 40 },
      ship: you({ speed: 8 }),
      seconds: 40,
      // hello said, you boost away
      steer: (s) => (helloAt === null ? s : { ...s, speed: NPC.run * 1.5 }),
      each: (m, s, out, t) => {
        if (helloAt === null && out.events.some((e) => e.type === 'say' && e.key === 'hello')) helloAt = t;
      },
    });
    expect(seen.says).toContain('run');
    expect(seen.events.filter((e) => e.type === 'busted')).toHaveLength(1);
  });
});
