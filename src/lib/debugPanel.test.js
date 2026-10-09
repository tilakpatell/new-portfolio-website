import { describe, expect, it } from 'vitest';
import { copyText, debugOn, debugPanel, keep, restore, toCode } from './debugPanel';

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

  it('copies with a world’s own printer when it has one, the groups’ live values in', () => {
    const groups = [{ name: 'g', items: [{ key: 'k', type: 'range', get: () => 0.5 }] }];
    expect(copyText(groups)).toBe('{\n  g: { k: 0.5 },\n}');
    expect(copyText(groups, (v) => `${v[0].name}:${v[0].items[0].value}`)).toBe('g:0.5');
  });
});

describe('a switch and a choice', () => {
  it('prints a switch as true or false and a choice as a quoted string', () => {
    const code = toCode([{ name: 'sun', items: [{ key: 'cockpit', type: 'bool', value: true }, { key: 'mode', type: 'select', value: 'real' }, { key: 'off', type: 'bool', value: 0 }] }]);
    expect(code).toBe("{\n  sun: { cockpit: true, mode: 'real', off: false },\n}");
  });
});

describe('the values kept for the tab', () => {
  const store = (kept = {}) => ({ kept, getItem: (k) => kept[k] ?? null, setItem: (k, v) => (kept[k] = String(v)) });
  const groups = () => {
    const v = { k: 0.5, on: false, mode: 'day', shadow: '#000000' };
    return {
      v,
      groups: [
        {
          name: 'g',
          items: [
            { key: 'k', type: 'range', get: () => v.k, set: (x) => (v.k = x) },
            { key: 'on', type: 'bool', get: () => v.on, set: (x) => (v.on = x) },
            { key: 'mode', type: 'select', options: ['day', 'real'], get: () => v.mode, set: (x) => (v.mode = x) },
            { key: 'shadow', type: 'colour', get: () => v.shadow, set: (x) => (v.shadow = x) },
          ],
        },
      ],
    };
  };

  it('sets only the keys the groups have, and says how many', () => {
    const { v, groups: gs } = groups();
    const s = store({ 'tp-tune-earth': JSON.stringify({ g: { k: 0.9, on: true, mode: 'real', gone: 3 }, other: { k: 1 } }) });
    expect(restore('earth', gs, s)).toBe(3);
    expect(v).toEqual({ k: 0.9, on: true, mode: 'real', shadow: '#000000' });
  });

  it('skips a choice it no longer offers and a value of the wrong kind', () => {
    const { v, groups: gs } = groups();
    const s = store({ 'tp-tune-earth': JSON.stringify({ g: { k: 'x', on: 1, mode: 'night', shadow: '#ff0000' } }) });
    expect(restore('earth', gs, s)).toBe(1);
    expect(v).toEqual({ k: 0.5, on: false, mode: 'day', shadow: '#ff0000' });
  });

  it('does nothing without an id, a store, or with what isn’t JSON', () => {
    const { groups: gs } = groups();
    expect(restore(null, gs, store())).toBe(0);
    expect(restore('earth', gs, null)).toBe(0);
    expect(restore('earth', gs, store({ 'tp-tune-earth': '{nope' }))).toBe(0);
    expect(restore('earth', gs, { getItem: () => { throw new Error('denied'); } })).toBe(0);
  });

  it('keeps the live values under the id, to restore', () => {
    const { v, groups: gs } = groups();
    const s = store();
    v.k = 0.7;
    keep('earth', gs, s);
    expect(JSON.parse(s.kept['tp-tune-earth'])).toEqual({ g: { k: 0.7, on: false, mode: 'day', shadow: '#000000' } });
    expect(() => keep('earth', gs, { setItem: () => { throw new Error('full'); } })).not.toThrow();
  });
});

describe('one panel, worlds in turn', () => {
  it('builds nothing and throws nothing without a document', () => {
    const p = debugPanel({ title: 't', groups: [] });
    expect(() => p.open([], { title: 'x', id: 'x' })).not.toThrow();
    expect(() => p.close()).not.toThrow();
    expect(() => p.dispose()).not.toThrow();
  });
});
