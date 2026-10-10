import { describe, expect, it } from 'vitest';
import { STOCK, STOCK_LOADOUT } from '../outfit';
import { openYard, settle, yardReducer } from './useYard';

const live = { build: null, loadout: { ...STOCK_LOADOUT }, tune: {} };
const later = { build: null, loadout: { ...STOCK_LOADOUT, booster: 'srb' }, tune: {} };

describe('the yard’s draft', () => {
  it('a draft follows live until it’s touched', () => {
    let s = openYard(live);
    s = yardReducer(s, { type: 'live', live: later });
    expect(s.draft).toEqual(later);
    s = yardReducer(s, { type: 'part', slot: 'thrusters', id: 'rcs' });
    expect(s.touched).toBe(true);
    s = yardReducer(s, { type: 'live', live });
    expect(s.draft.loadout.thrusters).toBe('rcs');
    expect(s.draft.loadout.booster).toBe('srb'); // (what was staged on stays)
  });

  it('revert drops the staged changes', () => {
    let s = yardReducer(openYard(live), { type: 'part', slot: 'booster', id: 'srb' });
    s = yardReducer(s, { type: 'module', slot: 'wings', id: 'none' });
    s = yardReducer(s, { type: 'revert', live });
    expect(s.draft).toEqual(live);
    expect(s.touched).toBe(false);
  });

  it('stages a module on the stock hull as a tune, and a module on a garage build as the build', () => {
    let s = yardReducer(openYard(live), { type: 'module', slot: 'engines', id: 'quad' });
    expect(s.draft.build).toBeNull();
    expect(s.draft.tune).toEqual({ engines: 'quad' });
    expect(s.touched).toBe(true);
    s = yardReducer(s, { type: 'hull', garage: true, lastBuild: null });
    s = yardReducer(s, { type: 'module', slot: 'wings', id: 'delta' });
    expect(s.draft.build.wings).toBe('delta');
    expect(s.draft.tune).toEqual({ engines: 'quad' }); // (kept for when the stock hull is back)
    s = yardReducer(s, { type: 'hull', garage: false });
    expect(s.draft.tune).toEqual({ engines: 'quad' });
    s = yardReducer(s, { type: 'module', slot: 'engines', id: 'twincans' });
    expect(s.draft.tune).toEqual({});
    expect(yardReducer(s, { type: 'module', slot: 'engines', id: 'twincans' })).toBe(s); // (the same tune: nothing staged)
  });

  it('stages a hull, a roll and a pasted build', () => {
    let s = yardReducer(openYard(live), { type: 'hull', garage: true, lastBuild: null });
    expect(s.draft.build).toBeTruthy();
    s = yardReducer(s, { type: 'roll', seed: 5, unlocked: [], owned: [] });
    expect(s.draft.build.seed).toBe(5);
    s = yardReducer(s, { type: 'paste', build: { ...s.draft.build, seed: 9 } });
    expect(s.draft.build.seed).toBe(9);
    s = yardReducer(s, { type: 'hull', garage: false });
    expect(s.draft.build).toBeNull();
  });

  it('apply re-opens the draft when a fit is refused', () => {
    const s = yardReducer(openYard(live), { type: 'part', slot: 'booster', id: 'portal' });
    const after = settle(s, live, { ok: false, why: 'power' });
    expect(after.state.draft).toEqual(live);
    expect(after.state.touched).toBe(false);
    expect(after.why).toBe('power');
  });

  it('apply that goes through opens on what’s flown now', () => {
    const s = yardReducer(openYard(live), { type: 'part', slot: 'booster', id: 'srb' });
    const after = settle(s, later, { ok: true });
    expect(after.state.draft).toEqual(later);
    expect(after.why).toBeNull();
  });

  it('an unknown action changes nothing', () => {
    const s = openYard(live);
    expect(yardReducer(s, { type: 'nonsense' })).toBe(s);
    expect(yardReducer(s, { type: 'part', slot: 'booster', id: STOCK })).toEqual(s);
  });
});
