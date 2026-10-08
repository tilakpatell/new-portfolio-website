import { describe, expect, it } from 'vitest';
import { CHALLENGE, FRESH, LINES, disguised, doubtStep } from './disguise';

const STEP = 1 / 30;

// a trooper in full armour, walking calmly, seen by one man and doing nothing odd
const calm = (o = {}) => ({ armour: true, helmet: true, running: false, shooting: false, restricted: false, escorting: false, ordered: false, officerAt: null, watchers: 1, ...o });

// steps the doubt as the game does, 30 times a second, for `seconds`, and keeps every step’s result
function run(doubt, ctx, seconds) {
  const steps = [];
  for (let i = 0; i < Math.round(seconds / STEP); i++) {
    const r = doubtStep(doubt, ctx, STEP);
    steps.push(r);
    doubt = r.doubt;
  }
  return { doubt, steps, said: steps.filter((s) => s.says).map((s) => s.says) };
}

describe('the garrison’s doubt rises at each rate', () => {
  it('rises 0.12 a second while someone sees you running', () => {
    expect(run(0, calm({ running: true }), 1).doubt).toBeCloseTo(0.12, 6);
  });

  it('rises 0.08 a second in a restricted room', () => {
    expect(run(0, calm({ restricted: true }), 1).doubt).toBeCloseTo(0.08, 6);
  });

  it('rises 0.05 a second with an officer within 3 m, and not with one further off', () => {
    expect(run(0, calm({ officerAt: 2.5 }), 1).doubt).toBeCloseTo(0.05, 6);
    expect(run(0, calm({ officerAt: 3 }), 1).doubt).toBeCloseTo(0.05, 6);
    expect(run(0, calm({ officerAt: 3.5 }), 1).doubt).toBe(0);
    expect(run(0, calm({ officerAt: null }), 1).doubt).toBe(0);
  });

  it('rises 0.06 a second escorting a prisoner without orders, and not with them', () => {
    expect(run(0, calm({ escorting: true }), 1).doubt).toBeCloseTo(0.06, 6);
    expect(run(0, calm({ escorting: true, ordered: true }), 1).doubt).toBe(0);
  });

  it('adds the rates up when several things are odd at once', () => {
    expect(run(0, calm({ running: true, restricted: true, officerAt: 1, escorting: true }), 1).doubt).toBeCloseTo(0.31, 6);
  });

  it('holds steady while someone watches a trooper doing nothing odd', () => {
    expect(run(0.3, calm(), 5).doubt).toBeCloseTo(0.3, 6);
  });

  it('falls 0.04 a second with nobody watching, whatever you are doing, and stops at nothing', () => {
    expect(run(0.5, calm({ watchers: 0, running: true, restricted: true, escorting: true }), 1).doubt).toBeCloseTo(0.46, 6);
    expect(run(0.02, calm({ watchers: 0 }), 2).doubt).toBe(0);
  });

  it('scales with the step’s length', () => {
    expect(doubtStep(0, calm({ running: true }), 0.5).doubt).toBeCloseTo(0.06, 6);
  });
});

describe('what blows the disguise at once', () => {
  it('a shot fired in sight blows it, from no doubt at all', () => {
    const r = doubtStep(0, calm({ shooting: true }), STEP);
    expect(r).toMatchObject({ doubt: 1, blown: true });
    expect(r.says.key).toBe('blown-shot');
  });

  it('the helmet off in sight blows it', () => {
    const r = doubtStep(0.1, calm({ helmet: false }), STEP);
    expect(r).toMatchObject({ doubt: 1, blown: true });
    expect(r.says.key).toBe('blown-face');
  });

  it('no armour at all in sight blows it, as the helmet off does', () => {
    expect(doubtStep(0, calm({ armour: false, helmet: false }), STEP)).toMatchObject({ doubt: 1, blown: true });
  });

  it('neither does anything with nobody watching', () => {
    expect(doubtStep(0.2, calm({ watchers: 0, shooting: true }), STEP).blown).toBe(false);
    expect(doubtStep(0.2, calm({ watchers: 0, helmet: false }), STEP).blown).toBe(false);
  });
});

describe('a disguise doubted all the way', () => {
  it('blows when the doubt reaches 1, saying so once', () => {
    const { doubt, steps, said } = run(0.9, calm({ running: true }), 1.5);
    expect(doubt).toBe(1);
    expect(steps.at(-1).blown).toBe(true);
    expect(said.map((s) => s.key)).toEqual(['blown']);
  });

  it('stays blown when nobody is watching any more, since nobody unsees a Rebel', () => {
    const r = run(1, calm({ watchers: 0 }), 10);
    expect(r.doubt).toBe(1);
    expect(r.steps.every((s) => s.blown && !s.says)).toBe(true);
  });

  it('keeps a doubt it is given between nothing and 1', () => {
    expect(doubtStep(-0.5, calm(), STEP).doubt).toBe(0);
    expect(doubtStep(undefined, calm(), STEP).doubt).toBe(0);
    expect(doubtStep(3, calm(), STEP)).toMatchObject({ doubt: 1, blown: true });
  });
});

describe('the challenge', () => {
  it('is said once, on the step the doubt crosses half', () => {
    const { steps, said } = run(0.4, calm({ running: true }), 2);
    expect(said).toHaveLength(1);
    const at = steps.findIndex((s) => s.says);
    expect(steps[at - 1].doubt).toBeLessThan(CHALLENGE);
    expect(steps[at].doubt).toBeGreaterThanOrEqual(CHALLENGE);
    expect(steps[at].blown).toBe(false);
  });

  it('is said again if the doubt falls back under half and climbs over it once more', () => {
    let doubt = run(0.45, calm({ running: true }), 1).doubt;
    doubt = run(doubt, calm({ watchers: 0 }), 3).doubt;
    expect(doubt).toBeLessThan(CHALLENGE);
    expect(run(doubt, calm({ running: true }), 1).said).toHaveLength(1);
  });

  it('is the famous line only to whoever wears TK-421’s armour', () => {
    const [line] = run(0.45, calm({ running: true, tk: 421 }), 1).said;
    expect(line).toEqual({ key: 'challenge-tk421', text: 'TK-421, why aren’t you at your post?' });
    expect(run(0.45, calm({ running: true, tk: 7 }), 1).said[0].key).not.toBe('challenge-tk421');
    expect(run(0.45, calm({ running: true }), 1).said[0].key).not.toBe('challenge-tk421');
  });

  it('asks after what made the garrison wonder', () => {
    const key = (o) => run(0.48, calm(o), 1).said[0].key;
    expect(key({ escorting: true })).toBe('challenge-prisoner');
    expect(key({ restricted: true })).toBe('challenge-restricted');
    expect(key({ officerAt: 1 })).toBe('challenge-officer');
    expect(key({ running: true })).toBe('challenge');
  });

  it('is not said when a shot blows the disguise straight past half', () => {
    expect(doubtStep(0.3, calm({ shooting: true }), STEP).says.key).toBe('blown-shot');
  });
});

describe('the lines', () => {
  it('are each said with its own key, in British spelling and curly quotes, with no exclamation runs', () => {
    for (const [key, text] of Object.entries(LINES)) {
      expect(typeof text, key).toBe('string');
      expect(text, key).not.toMatch(/['"]|!!/);
    }
  });

  it('quote the film only in the one famous line', () => {
    const famous = Object.values(LINES).filter((t) => t.includes('TK-421'));
    expect(famous).toEqual([LINES['challenge-tk421']]);
  });
});

describe('when there is a disguise to doubt', () => {
  it('is only a Rebel in armour', () => {
    expect(disguised({ side: 'rebel', armour: true, helmet: true })).toBe(true);
    expect(disguised({ side: 'rebel', armour: true, helmet: false })).toBe(true);
    expect(disguised({ side: 'rebel', armour: false, helmet: false })).toBe(false);
    expect(disguised({ side: 'imperial', armour: true, helmet: true })).toBe(false);
    expect(disguised(null)).toBe(false);
  });

  it('starts armour just put on at a fresh doubt of 0', () => {
    expect(FRESH).toBe(0);
  });

  it('leaves a Rebel seen out of armour, then given armour, starting again from nothing', () => {
    // stepped out of armour, the doubt would blow and stay blown, which is why the game must not step it then
    expect(doubtStep(0, calm({ armour: false, helmet: false }), STEP)).toMatchObject({ doubt: 1, blown: true });
    expect(doubtStep(1, calm(), STEP)).toMatchObject({ doubt: 1, blown: true });
    // armour put on starts at FRESH, and a calm walk past a watcher keeps it there
    const after = run(FRESH, calm(), 2);
    expect(after.doubt).toBe(0);
    expect(after.steps.every((s) => !s.blown)).toBe(true);
    expect(after.said).toEqual([]);
  });
});
