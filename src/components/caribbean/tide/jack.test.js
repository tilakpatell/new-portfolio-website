import { describe, expect, it } from 'vitest';
import { CLIPS } from '../../../lib/three/clipLibrary';
import { createReactions } from '../../../lib/ai/react';
import { seeded } from '../../../lib/seeded';
import { HELM, JACK_FIDGETS, JACK_REACTIONS, helmTo, jackHears, rank } from './jack';

const pearl = { id: 1, x: 0, y: 0, a: 0 };

describe('Captain Jack Sparrow at the helm', () => {
  it('plays only clips the library has, and fidgets only with ones that end', () => {
    const rx = createReactions(JACK_REACTIONS, { rand: seeded(3) });
    const seen = new Set();
    for (let i = 0; i < 40; i++)
      for (const ev of Object.keys(JACK_REACTIONS)) {
        const r = rx.on(ev, { t: i * 100 });
        if (r) seen.add(r.clip);
      }
    for (const c of [...seen, ...JACK_FIDGETS]) expect(CLIPS[c], c).toBeTruthy();
    for (const c of JACK_FIDGETS) expect(CLIPS[c].loop, c).toBeFalsy();
    expect(seen.size).toBeGreaterThan(6);
  });

  it('hears what happens to his ship, and what she does', () => {
    expect(jackHears({ type: 'broadside', owner: 'p', side: 1 }, pearl)?.event).toBe('fire');
    expect(jackHears({ type: 'broadside', owner: 'e', side: 1, x: 50, y: 0 }, pearl)?.event).toBe('gunfire');
    expect(jackHears({ type: 'hurt', x: 0, y: 0, dmg: 5 }, pearl)?.event).toBe('hit');
    for (const type of ['arm', 'kraken']) expect(jackHears({ type, x: 30, y: 30 }, pearl)?.event, type).toBe('scare');
    expect(jackHears({ type: 'surface', x: 30, y: 30, big: true }, pearl)?.event).toBe('scare');
    expect(jackHears({ type: 'sunk', kind: 'navy', x: 90, y: 0 }, pearl)?.event).toBe('win');
    expect(jackHears({ type: 'sunk', kind: 'fort', x: 90, y: 0 }, pearl)?.event).toBe('win');
    expect(jackHears({ type: 'sunk', kind: 'kraken', x: 90, y: 0 }, pearl)?.event).toBe('triumph');
    expect(jackHears({ type: 'sunk', kind: 'pearl', id: 1, x: 0, y: 0 }, pearl)?.event).toBe('down');
    expect(jackHears({ type: 'won' }, pearl)?.event).toBe('triumph');
    expect(jackHears({ type: 'pickup', kind: 'chest', x: 4, y: 4 }, pearl)?.event).toBe('loot');
    expect(jackHears({ type: 'pickup', kind: 'rum', x: 4, y: 4 }, pearl)?.event).toBe('rum');
    expect(jackHears({ type: 'gun', owner: 'p' }, pearl)).toBeNull();
    expect(jackHears({ type: 'splash', x: 9, y: 9 }, pearl)).toBeNull();
    // the side he fired, and where a thing happened, as a place to look at on the sea
    expect(jackHears({ type: 'sunk', kind: 'navy', x: 90, y: 7 }, pearl).at).toEqual({ x: 90, y: 7 });
    const fired = jackHears({ type: 'broadside', owner: 'p', side: 1 }, pearl).at;
    expect(fired.y).toBeGreaterThan(10); // heading east, starboard is south (+y)
  });

  it('puts the bigger moment over the smaller, and nothing over going down', () => {
    expect(rank('down')).toBeGreaterThan(rank('triumph'));
    expect(rank('triumph')).toBeGreaterThan(rank('hit'));
    expect(rank('hit')).toBeGreaterThan(rank('rum'));
    expect(rank('scare')).toBeGreaterThan(rank('fire'));
  });

  it('turns the wheel with the helm, by time and not at once', () => {
    let w = 0;
    w = helmTo(w, 1, 1 / 60);
    expect(w).toBeGreaterThan(0);
    expect(w).toBeLessThan(HELM.turns * 0.2);
    for (let i = 0; i < 240; i++) w = helmTo(w, 1, 1 / 60);
    expect(w).toBeCloseTo(HELM.turns, 2);
    for (let i = 0; i < 240; i++) w = helmTo(w, -1, 1 / 60);
    expect(w).toBeCloseTo(-HELM.turns, 2);
    expect(helmTo(0.3, Number.NaN, 1 / 60)).toBeCloseTo(0.3 - (0.3 * (1 - Math.exp(-HELM.rate / 60))), 6);
  });
});
