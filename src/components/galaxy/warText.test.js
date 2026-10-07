import { describe, expect, it } from 'vitest';
import { heldColour, progressOf, standing } from './warText';

const NOW = 1_000_000;
const row = (o) => ({ id: 'hoth', owner: 'empire', control: 0.75, front: false, attack: null, rate: null, ...o });

describe('a system’s place in a war, in words', () => {
  it('a front is the liberator’s progress: how much of the holder’s hold is gone', () => {
    expect(progressOf(row({ front: true }))).toBeCloseTo(0.25, 5);
    expect(standing(row({ front: true, rate: 4 }), NOW, 'gcw')).toBe('25% liberated · +4.0%/h');
  });
  it('under attack it’s the holder’s hold, and the time left to hold out', () => {
    const r = row({ owner: 'rebel', attack: { by: 'empire', until: NOW + 90e3 }, control: 0.6 });
    expect(progressOf(r)).toBeCloseTo(0.6, 5);
    expect(standing(r, NOW, 'gcw')).toBe('The Empire attacks: 60% held, 1:30 to hold out');
  });
  it('a Hutt raid says so', () => {
    expect(standing(row({ owner: 'empire', attack: { by: 'hutt', until: NOW + 60e3 }, control: 0.5 }), NOW, 'gcw')).toBe('The Hutts raid: 50% held, 1:00 to hold out');
  });
  it('a quiet system names its holder, the Hutts’ as Hutt space', () => {
    expect(standing(row({ owner: 'separatists' }), NOW, 'clone')).toBe('Held by the Separatists');
    expect(standing(row({ owner: 'hutt' }), NOW, 'gcw')).toBe('Hutt space');
  });
  it('colours a system its holder’s', () => {
    expect(heldColour('rebel')).toMatch(/^#/);
    expect(heldColour('hutt')).not.toBe(heldColour('rebel'));
    expect(heldColour(undefined)).toBeUndefined();
  });
});
