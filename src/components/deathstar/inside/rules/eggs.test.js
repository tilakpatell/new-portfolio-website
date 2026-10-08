import { describe, expect, it } from 'vitest';
import { EGGS, eggsOn } from './eggs';

// Each egg, the event that finds it, and events that come close but must
// find nothing at all (not this egg, not any other).
const CASES = {
  bonk: { hit: { type: 'saw', what: 'bonk', seconds: 0.4 }, near: [{ type: 'saw', what: 'bonk', seconds: 0.1 }, { type: 'heard', line: 'bonk' }] },
  tk421: { hit: { type: 'took', item: 'tk421-armour' }, near: [{ type: 'took', item: 'tk422-armour' }, { type: 'took', item: 'e11' }] },
  g7: { hit: { type: 'kept-up', with: 'g7', lap: true }, near: [{ type: 'kept-up', with: 'g7', lap: false }, { type: 'kept-up', with: 'mouse', lap: true }] },
  roar: { hit: { type: 'fled', kind: 'mouse', from: 'roar' }, near: [{ type: 'fled', kind: 'mouse', from: 'blaster' }, { type: 'fled', kind: 'trooper', from: 'roar' }] },
  1138: { hit: { type: 'chose', talk: 'aa23-officer', node: 'transfer-1138' }, near: [{ type: 'chose', talk: 'aa23-officer', node: 'transfer-2187' }, { type: 'chose', talk: 'han-intercom', node: 'transfer-1138' }] },
  3263827: { hit: { type: 'dialled', code: '3263827' }, near: [{ type: 'dialled', code: '3263828' }, { type: 'dialled', code: '326382' }] },
  boring: { hit: { type: 'chose', talk: 'han-intercom', node: 'boring' }, near: [{ type: 'chose', talk: 'han-intercom', node: 'negative' }, { type: 'chose', talk: 'conference', node: 'boring' }] },
  short: { hit: { type: 'opened', door: 'cell2187', helmet: true }, near: [{ type: 'opened', door: 'cell2187', helmet: false }, { type: 'opened', door: 'cell2186', helmet: true }] },
  krennic: { hit: { type: 'sat', tag: 'krennic-chair' }, near: [{ type: 'sat', tag: 'tarkin-chair' }, { type: 'saw', what: 'krennic-chair', seconds: 5 }] },
  faith: { hit: { type: 'chose', talk: 'conference', node: 'faith' }, near: [{ type: 'chose', talk: 'conference', node: 'ultimate-power' }, { type: 'chose', talk: 'aa23-officer', node: 'faith' }] },
  eyestalk: { hit: { type: 'saw', what: 'eyestalk', seconds: 2 }, near: [{ type: 'saw', what: 'eyestalk', seconds: 1.9 }, { type: 'read', tag: 'eyestalk' }] },
  librarian: { hit: { type: 'saw', what: 'librarian', seconds: 1 }, near: [{ type: 'saw', what: 'librarian', seconds: 0.5 }, { type: 'saw', what: 'archive', seconds: 5 }] },
  robe: { hit: { type: 'saw', what: 'robe', seconds: 1 }, near: [{ type: 'saw', what: 'robe', seconds: 0.5 }, { type: 'took', item: 'robe' }] },
  armrest: { hit: { type: 'pulled', tag: 'armrest-saber' }, near: [{ type: 'pulled', tag: 'throne-lever' }, { type: 'saw', what: 'armrest-saber', seconds: 5 }] },
  trap: { hit: { type: 'heard', line: 'trap' }, near: [{ type: 'heard', line: 'shield' }, { type: 'read', tag: 'trap' }] },
  moff: { hit: { type: 'saw', what: 'nameplate', seconds: 1 }, near: [{ type: 'saw', what: 'nameplate', seconds: 0.5 }, { type: 'read', tag: 'nameplate' }] },
  charge: { hit: { type: 'charge' }, near: [{ type: 'chased' }, { type: 'fled', kind: 'trooper', from: 'player' }] },
  port: { hit: { type: 'read', tag: 'exhaust-note' }, near: [{ type: 'read', tag: 'exhaust-port' }, { type: 'saw', what: 'exhaust-note', seconds: 5 }] },
  plans: { hit: { type: 'read', tag: 'plans' }, near: [{ type: 'read', tag: 'plan' }, { type: 'saw', what: 'plans', seconds: 5 }] },
  droids: { hit: { type: 'trick', count: 2 }, near: [{ type: 'trick', count: 1 }, { type: 'trick' }] },
};

const g = {};

describe('the Easter eggs', () => {
  it('are the twenty the brief lists, each with a ds- achievement, a title and a line', () => {
    expect(EGGS.map((e) => e.id).sort()).toEqual(Object.keys(CASES).sort());
    for (const egg of EGGS) {
      expect(egg.achievement).toBe(`ds-${egg.id}`);
      expect(egg.title).toMatch(/\S/);
      expect(egg.line).toMatch(/\S/);
      expect(typeof egg.when).toBe('function');
    }
  });

  it('use curly quotes and no exclamation runs in their copy', () => {
    for (const egg of EGGS) {
      for (const text of [egg.title, egg.line]) {
        expect(text).not.toMatch(/["']/);
        expect(text).not.toMatch(/!!/);
      }
    }
  });

  for (const [id, { hit }] of Object.entries(CASES)) {
    it(`finds “${id}” from its own event, and nothing else with it`, () => {
      expect(eggsOn(new Set(), hit, g)).toEqual([id]);
    });
  }

  it('finds each egg only once, however often its event comes', () => {
    const found = new Set();
    for (const { hit } of Object.values(CASES)) eggsOn(found, hit, g);
    expect(found.size).toBe(EGGS.length);
    for (const { hit } of Object.values(CASES)) expect(eggsOn(found, hit, g)).toEqual([]);
  });

  it('keeps eggs found in an earlier visit found, as the save hands them back', () => {
    expect(eggsOn(new Set(['tk421']), CASES.tk421.hit, g)).toEqual([]);
  });

  for (const [id, { near }] of Object.entries(CASES)) {
    it(`finds nothing on events that come close to “${id}”`, () => {
      for (const event of near) expect(eggsOn(new Set(), event, g)).toEqual([]);
    });
  }

  it('links the plans to the readout on the Death Star page', () => {
    expect(EGGS.find((e) => e.id === 'plans').link).toBe('/deathstar#readout');
  });
});
