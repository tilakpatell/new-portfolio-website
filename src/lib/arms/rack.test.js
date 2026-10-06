import { describe, expect, it } from 'vitest';
import { MAX_GUNS, nextGun, rackOf, readRacks, withFirst, withRack } from './rack';

describe('a rack', () => {
  it('is what was saved, cleaned: known guns only, no repeats, three at most, two mods', () => {
    const r = readRacks({ han: { guns: ['blaster', 'nope', 'blaster', 'rifle', 'a280', 'ee3'], mods: ['scope', 'x', 'choke', 'trigger'] }, bad: 'junk', empty: { guns: [] } });
    expect(r.han).toEqual({ guns: ['blaster', 'rifle', 'a280'], mods: ['scope', 'choke'] });
    expect(r.bad).toBeUndefined();
    expect(r.empty).toBeUndefined();
    expect(readRacks(null)).toEqual({});
    expect(readRacks('junk')).toEqual({});
    expect(r.han.guns.length).toBeLessThanOrEqual(MAX_GUNS);
  });
  it('falls back to Rick’s three gadgets, or the person’s own gun, or nothing', () => {
    expect(rackOf({}, 'rick', 'portal').guns).toEqual(['portal', 'freeze', 'shrink']);
    expect(rackOf({}, 'han', 'blaster')).toEqual({ guns: ['blaster'], mods: [] });
    expect(rackOf({}, 'artoo', null)).toEqual({ guns: [], mods: [] });
    expect(rackOf(readRacks({ han: { guns: ['rifle'] } }), 'han', 'blaster').guns).toEqual(['rifle']);
  });
  it('goes round with B, and a pick goes to the front', () => {
    const r = { guns: ['portal', 'freeze', 'shrink'], mods: [] };
    expect(nextGun(r).guns).toEqual(['freeze', 'shrink', 'portal']);
    expect(nextGun(nextGun(nextGun(r))).guns).toEqual(r.guns);
    const one = { guns: ['blaster'], mods: [] };
    expect(nextGun(one)).toBe(one);
    expect(withFirst(r, 'shrink').guns).toEqual(['shrink', 'portal', 'freeze']);
    expect(withFirst({ guns: ['rifle', 'a280', 'ee3'], mods: [] }, 'blaster').guns).toEqual(['blaster', 'rifle', 'a280']);
    expect(withRack({}, 'han', { guns: ['nope'], mods: [] })).toEqual({});
    expect(withRack({}, 'han', { guns: ['dlt19'], mods: ['stock'] })).toEqual({ han: { guns: ['dlt19'], mods: ['stock'] } });
  });
});
