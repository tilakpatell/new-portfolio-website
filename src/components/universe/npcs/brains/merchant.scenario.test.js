// A merchant's promise (its header): it flies to the nearest station and
// parks just off it; when you come by it says hello and offers you a part,
// once; it leaves when you've gone. It never follows you about.
import { describe, expect, it } from 'vitest';
import { NPC } from './common';
import { apart, foe, meet, you } from './harness';

const STATION = { at: { x: 0, y: 0, z: -80 }, r: 12 };
const TETHER = 200; // map units: it never strays this far from where it parks

describe('a merchant, flown', () => {
  it('parks at the station, offers once when you stop near it, and never follows you off', () => {
    let farthest = 0;
    let parkedAt = null;
    const seen = meet({
      brain: 'merchant',
      npc: foe('merchant', { faction: 'traders' }),
      at: { x: 30, y: 0, z: -40 },
      // you fly to just off the station and stop; after a while you fly away fast
      ship: you({ x: 0, z: 0 }),
      steer: (s, t) => {
        if (t < 20) return { ...s, heading: 0, speed: apart(s, { x: 0, y: 0, z: -60 }) > 1 ? 6 : 0 };
        return { ...s, heading: Math.PI, speed: 30 };
      },
      world: () => ({ stations: [STATION] }),
      seconds: 40,
      each: (m) => {
        if (!m) return;
        if (m.mind.parked && !parkedAt) parkedAt = { ...m.mind.park };
        if (parkedAt) farthest = Math.max(farthest, apart(m.pos, parkedAt));
      },
    });
    expect(parkedAt).not.toBeNull();
    expect(apart(parkedAt, STATION.at)).toBeCloseTo(STATION.r + NPC.park, 0);
    expect(seen.events.filter((e) => e.type === 'offer')).toHaveLength(1);
    expect(seen.says).toContain('hello');
    expect(farthest).toBeLessThan(TETHER);
    // gone, or going, once you have
    expect(seen.says).toContain('leaving');
    expect(seen.shots).toEqual([]);
  });
});
