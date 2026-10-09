import { describe, expect, it } from 'vitest';
import { CREWS } from '../universe/crews';
import { CAPITAL_SUBS, GARRISON_SUBS, garrisonSay } from './garrisonLines';
import { SIDES } from './sides';
import { castFor } from './warCast';

// who of each crew is on this radio (universe/crews.js's speakers)
const SPEAKERS = { cruiser: ['rick', 'morty'], xwing: ['luke', 'r2'], falcon: ['han', 'chewie'], rv: ['walt', 'jesse'] };
const MOMENTS = ['challenge', 'warn', 'clear', 'scramble', 'open', 'standdown', 'cover', 'escort', 'reinforce'];
const CAPITAL = ['fired', 'shielded', 'dome', 'open', 'bridge', 'dead', 'fled', 'gone', 'wave'];
const e = (o) => ({ type: 'event', id: 'garrison', sub: 'challenge', side: 'empire', sys: 'hoth', ...o });
const capital = (sub) => ({ type: 'event', id: 'capital', sub });

// every exchange a crew has here, named for the test's messages: a
// garrison's moment for each side's fleet, and the capital ship's
const exchanges = (crew) => [
  ...MOMENTS.flatMap((sub) => Object.keys(SIDES).map((side) => [`${crew} garrison ${sub} ${side}`, garrisonSay(e({ sub, side }), crew)])),
  ...CAPITAL.map((sub) => [`${crew} capital ${sub}`, garrisonSay(capital(sub), crew)]),
];

describe('garrisonSay', () => {
  it('every crew has every garrison and capital moment', () => {
    expect(GARRISON_SUBS).toEqual(MOMENTS);
    expect(CAPITAL_SUBS).toEqual(CAPITAL);
    expect(Object.keys(SPEAKERS).sort()).toEqual(CREWS.map((c) => c.id).sort());
    for (const crew of Object.keys(SPEAKERS)) {
      for (const sub of MOMENTS) {
        const said = garrisonSay(e({ sub }), crew).slice(1);
        expect(said.length, `${crew} garrison ${sub}`).toBeGreaterThanOrEqual(1);
        expect(said.length, `${crew} garrison ${sub}`).toBeLessThanOrEqual(2);
      }
      for (const sub of CAPITAL) {
        const said = garrisonSay(capital(sub), crew);
        expect(said.length, `${crew} capital ${sub}`).toBeGreaterThanOrEqual(1);
        expect(said.length, `${crew} capital ${sub}`).toBeLessThanOrEqual(2);
      }
    }
  });

  it('the lines keep the site’s copy rules', () => {
    for (const crew of Object.keys(SPEAKERS)) {
      for (const [what, exchange] of exchanges(crew)) {
        expect(exchange.length, what).toBeGreaterThan(0);
        for (const line of exchange) {
          const [who, text, clip] = line;
          expect(who === 'comms' || SPEAKERS[crew].includes(who), `${what}: ${who}`).toBe(true);
          // text on the comms, never a recording (spec: not new voices)
          expect(clip, what).toBeUndefined();
          expect(typeof text, what).toBe('string');
          expect(text.length, `${what}: ${text}`).toBeGreaterThanOrEqual(3);
          expect(text.length, `${what}: ${text}`).toBeLessThanOrEqual(120);
          expect(text, what).not.toMatch(/['"]/);
          expect(text, what).not.toMatch(/!!/);
          // Artoo and Chewie say what they mean, in brackets
          if (who === 'r2' || who === 'chewie') expect(text, what).toMatch(/^\[.+\]$/);
        }
      }
    }
  });

  it('the commander speaks first, named and coloured', () => {
    const posts = { empire: 'hoth', rebel: 'yavin', republic: 'kamino', separatists: 'geonosis', hutt: 'tatooine' };
    for (const [side, sys] of Object.entries(posts)) {
      const c = castFor(sys, side);
      expect(c, side).toBeTruthy();
      for (const crew of Object.keys(SPEAKERS)) {
        for (const sub of MOMENTS) {
          const [first, ...rest] = garrisonSay(e({ sub, side, sys }), crew);
          const what = `${crew} ${side} ${sub}`;
          expect(first, what).toStrictEqual(['comms', expect.any(String), undefined, { name: c.name, color: c.color }]);
          // Jabba speaks only Huttese
          if (side === 'hutt') expect(first[1], what).toMatch(/^\[in Huttese, .+\]$/);
          else expect(first[1], what).not.toMatch(/^\[/);
          expect(rest.every(([who]) => who !== 'comms'), what).toBe(true);
        }
      }
    }
    // with no side to speak for, the crew alone
    expect(garrisonSay(e({ side: null }), 'xwing')).toEqual(garrisonSay(e({}), 'xwing').slice(1));
    // the capital ship's fight is the crew's alone
    for (const crew of Object.keys(SPEAKERS)) for (const sub of CAPITAL) expect(garrisonSay(capital(sub), crew).some(([who]) => who === 'comms'), `${crew} capital ${sub}`).toBe(false);
  });

  it('an unknown moment says nothing', () => {
    expect(garrisonSay(e({ sub: 'nothing' }), 'xwing')).toEqual([]);
    expect(garrisonSay(capital('nothing'), 'falcon')).toEqual([]);
    expect(garrisonSay(e({}), 'nobody')).toEqual([]);
    expect(garrisonSay(e({}), undefined)).toEqual([]);
    expect(garrisonSay({ type: 'event', id: 'battle', sub: 'front', side: 'rebel', sys: 'hoth' }, 'rv')).toEqual([]);
  });
});
