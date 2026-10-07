// A rival's promise (its header): it circles you and shoots for a while;
// hurt to half, or once the duel has gone on NPC.duel seconds, it calls it
// a draw and goes. Lose it behind a moon and it says `search`, then `found`.
import { describe, expect, it } from 'vitest';
import { NPC } from './common';
import { DT, apart, foe, meet, you } from './harness';

describe('a rival, flown', () => {
  const npc = foe('rival', { faction: 'evil-morty' });

  it('circles near you and fires, then calls it a draw when the duel runs long', () => {
    let near = 0;
    let frames = 0;
    let drawAt = null;
    const seen = meet({
      brain: 'rival',
      npc,
      ship: you({ speed: 6 }),
      steer: (s) => ({ ...s, heading: s.heading + 0.2 * DT }),
      seconds: NPC.duel + 5,
      each: (m, s, out, t) => {
        if (out.events.some((e) => e.type === 'draw') && drawAt === null) drawAt = t;
        if (!m || t < 6 || drawAt !== null) return;
        frames += 1;
        if (apart(m.pos, s) < NPC.orbit * 2.5) near += 1;
      },
    });
    expect(seen.shots.length).toBeGreaterThan(5);
    // a dogfight: near you most of the time once it's come in
    expect(near / frames).toBeGreaterThan(0.6);
    expect(drawAt).toBeGreaterThan(NPC.duel - 0.1);
    expect(drawAt).toBeLessThan(NPC.duel + 0.5);
  });

  it('calls it a draw at half its hull, and fires no more', () => {
    let drawAt = null;
    const seen = meet({
      brain: 'rival',
      npc,
      ship: you({ speed: 6 }),
      seconds: 20,
      each: (m, s, out, t) => {
        if (m && Math.abs(t - 8) < DT / 2) m.hp = m.hpMax / 2;
        if (drawAt === null && out.events.some((e) => e.type === 'draw')) drawAt = t;
      },
    });
    expect(drawAt).toBeGreaterThan(8);
    expect(drawAt).toBeLessThan(8.1);
    expect(seen.shots.filter((s) => s.t > drawAt)).toEqual([]);
  });
});
