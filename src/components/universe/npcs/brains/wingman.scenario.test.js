// A wingman's promise (its header): the brain hands it to the wing (a
// `delegate` event, via 'wing', with its ship) and the wing flies it
// (wingRules.js): it forms up off your wing and stays there. Flown here as
// the design's table has it: you fly a lazy circle with nobody to fight.
import { describe, expect, it } from 'vitest';
import { WING, createWing } from '../../wingRules';
import { DT, apart, fly, foe, meet, seeded, you } from './harness';

// off your wing: the slot is about 3 units out; inside 1 is a collision,
// past 12 it has lost its place
const BAND = [1, 12];

describe('a wingman, met', () => {
  it('is handed to the wing in the first frame, with its ship, and never flown by the brains', () => {
    const seen = meet({ brain: 'wingman', npc: foe('wingman', { ship: 'xwing', role: 'ally' }), ship: you({ speed: 10 }), seconds: 5 });
    expect(seen.events.filter((e) => e.type === 'delegate')).toEqual([expect.objectContaining({ via: 'wing', kind: 'xwing', t: 0 })]);
    expect(seen.shots).toEqual([]);
  });

  it('holds formation off your wing round a lazy circle, and never runs into you or the other', () => {
    const wing = createWing({ rand: seeded(4) });
    let s = you({ speed: 12 });
    wing.join('xwing', s, 2);
    // a fight about, but not one coming at you: the wing stays and covers you
    // (with nobody about at all it forms up WING.stay seconds, then goes home)
    const wide = [{ id: 9, at: { x: 500, y: 0, z: 500 }, vel: { x: 0, y: 0, z: 0 }, size: 0.4, threat: 0 }];
    let held = 0;
    let frames = 0;
    let closest = Infinity;
    for (let t = 0; t < 40; t += DT) {
      s = fly({ ...s, heading: s.heading + 0.15 * DT });
      wing.update(DT, s, wide);
      const [a, b] = wing.live;
      if (!a || !b) break;
      closest = Math.min(closest, apart(a.pos, s), apart(b.pos, s), apart(a.pos, b.pos));
      // once it has come up from behind and settled
      if (t < WING.settle + 6) continue;
      frames += 1;
      if ([a, b].every((w) => apart(w.pos, s) > BAND[0] && apart(w.pos, s) < BAND[1])) held += 1;
    }
    expect(frames).toBeGreaterThan(0);
    expect(held / frames).toBeGreaterThan(0.8);
    expect(closest).toBeGreaterThan(BAND[0]);
  });
});
