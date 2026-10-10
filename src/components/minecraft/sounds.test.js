import { describe, expect, it } from 'vitest';
import { createSounds } from './sounds.js';

const ear = () => {
  const heard = [];
  const s = createSounds({ play: (name, voice) => heard.push([name, voice]), random: () => 0.5 });
  return { s, heard, names: () => heard.map(([n]) => n) };
};
const dry = { inWater: false, vy: 0 };

describe('the tribute’s sounds', () => {
  it('answers a step, a break, a place and a hurt, each its own', () => {
    const { s, names } = ear();
    s.hear([{ type: 'step' }, { type: 'break', id: 1 }, { type: 'place', id: 1 }, { type: 'hurt', amount: 2 }], dry);
    expect(names()).toEqual(['thunk', 'crunch', 'thunk', 'oof']);
  });

  it('keeps a step quieter than a place', () => {
    const { s, heard } = ear();
    s.hear([{ type: 'step' }, { type: 'place' }], dry);
    expect(heard[0][1].gain).toBeLessThan(heard[1][1].gain);
  });

  it('splashes once going into the water, louder the faster, and not while in it or coming out', () => {
    const { s, heard, names } = ear();
    s.hear([], dry);
    s.hear([], { inWater: true, vy: -0.1 });
    s.hear([], { inWater: true, vy: -0.1 });
    s.hear([], dry);
    expect(names()).toEqual(['splash']);
    const slow = heard[0][1].gain;
    s.hear([], { inWater: true, vy: -0.6 });
    expect(heard[1][1].gain).toBeGreaterThan(slow);
  });

  it('says nothing for what it doesn’t know', () => {
    const { s, names } = ear();
    s.hear([{ type: 'munch' }, { type: 'open', what: 'table' }], dry);
    expect(names()).toEqual([]);
  });
});
