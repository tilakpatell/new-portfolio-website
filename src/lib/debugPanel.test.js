import { describe, expect, it } from 'vitest';
import { debugOn, toCode } from './debugPanel';

describe('whether the tuning panel is asked for', () => {
  it('reads ?debug from the address or after the hash route', () => {
    expect(debugOn({ search: '?debug', hash: '' })).toBe(true);
    expect(debugOn({ search: '', hash: '#/middle-earth/shire?debug' })).toBe(true);
    expect(debugOn({ search: '?quality=high&debug=1', hash: '' })).toBe(true);
    expect(debugOn({ search: '', hash: '#/middle-earth/shire?quality=low&debug' })).toBe(true);
  });

  it('is off otherwise, and when it says so', () => {
    expect(debugOn({ search: '', hash: '#/middle-earth/shire' })).toBe(false);
    expect(debugOn({ search: '?debugger', hash: '' })).toBe(false);
    expect(debugOn({ search: '?debug=0', hash: '' })).toBe(false);
    expect(debugOn(null)).toBe(false);
  });
});

describe('the values, as code to paste back', () => {
  it('prints numbers as they are and colours as hex, grouped', () => {
    const code = toCode([
      { name: 'look', items: [{ key: 'edge0', type: 'range', value: 0.16 }, { key: 'shadow', type: 'colour', value: '#9d93c4' }] },
      { name: 'wind', items: [{ key: 'strength', type: 'range', value: 0.45 }] },
    ]);
    expect(code).toBe('{\n  look: { edge0: 0.16, shadow: 0x9d93c4 },\n  wind: { strength: 0.45 },\n}');
  });

  it('rounds away float noise', () => {
    expect(toCode([{ name: 'g', items: [{ key: 'k', type: 'range', value: 0.30000000000000004 }] }])).toBe('{\n  g: { k: 0.3 },\n}');
  });
});
