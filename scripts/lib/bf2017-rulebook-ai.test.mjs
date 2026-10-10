import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { patternBits, aiRulebook } from './bf2017-rulebook-ai.mjs';
import { checkSources } from './bf2017-rulebook.mjs';

const ROOT = join(import.meta.dirname, '..', 'fixtures', 'bf2017', 'data');

describe('the AI rulebook', () => {
  const ai = aiRulebook(ROOT);

  it('reads a tactics table', () => {
    const t = ai.tactics.AIRebelSoldierTactics;
    expect(t.engage).toMatchObject({ distance: 40, suppression: 0.15 });
    expect(t.suppression).toMatchObject({ value: 0.75, time: 10, area: 5 });
    expect(t.vehicleSuppression).toMatchObject({ distance: 15, reevaluate: 15 });
    expect(Object.keys(t.attack).length).toBeGreaterThan(1);
  });

  it('reads a soldier template', () => {
    expect(ai.templates.rifleman).toMatchObject({ targetLostTime: 10, alertPropagationSpeed: 2, fireHeightOffset: 0, tactics: 'Rifleman_Tactics' });
  });

  it('reads the cover constants', () => {
    expect(ai.cover.constants).toMatchObject({ SlotSpacing: 2.2, CrouchHeight: 0.94, StandHeight: 1.7, 'VaultOverPathLinkConfig.VaultStartDistance': 1.4 });
  });

  it('reads the firing patterns as 64-bit masks', () => {
    // (290482175965396993 is odd: a JSON number rounds it to …397000, so the
    // patterns are read from the record's text)
    expect(ai.patterns).toHaveLength(202);
    expect(ai.patterns.every((p) => /^-?\d+$/.test(p.mask))).toBe(true);
    expect(ai.patterns[0]).toMatchObject({ id: 1, delay: 24, weapon: 'AssaultRifle', intensity: 'Low', single: true });
    expect(ai.patterns[0].bits[0]).toBe(true);
    expect(patternBits('5')).toEqual([true, false, true]);
    expect(patternBits('0')).toEqual([]);
    expect(patternBits('-1')).toHaveLength(64);
  });

  it('names every number’s source', () => {
    expect(checkSources(ai)).toEqual([]);
  });
});
