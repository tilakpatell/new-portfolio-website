// A bounty hunter's promise (its header): the brain hands it over to the
// hunt (a `delegate` event, via 'hunt', with its faction), at once, and
// never flies or fires it itself.
import { describe, expect, it } from 'vitest';
import { foe, meet, you } from './harness';

describe('a bounty hunter, met', () => {
  it('is handed to the hunt in the first frame, once, and the brains never move it again', () => {
    const at = { x: 3, y: 1, z: -25 };
    const seen = meet({ brain: 'bounty', npc: foe('bounty', { faction: 'bounty-hunters', role: 'enemy' }), at, ship: you({ speed: 10 }), seconds: 10 });
    const delegates = seen.events.filter((e) => e.type === 'delegate');
    expect(delegates).toEqual([expect.objectContaining({ via: 'hunt', faction: 'bounty-hunters', t: 0 })]);
    expect(seen.shots).toEqual([]);
    expect(seen.me.pos).toEqual(at);
    expect(seen.brains.targets).toEqual([]);
  });
});
