import { describe, expect, it } from 'vitest';
import { createEconomy } from '../economy';
import { CREWS } from '../crews';
import { LOADOUT_KEY, STOCK_LOADOUT, loadoutOf } from '../outfit';
import { diff, itemOfModule, itemOfPart, openDraft, setModule, setPart } from '../yardRules';
import { GARAGE_KEY, HULL_KEY, STOCK_BUILD } from './build';
import { modulesFor } from './parts';
import { applyYardDraft, keepBuild, keepLoadouts, readSaves, withBuild } from './yardPage';

// (the browser's storage: what `local` is, in a Map)
const store = (start = {}) => {
  const m = new Map(Object.entries(start).map(([k, v]) => [k, JSON.stringify(v)]));
  return { get: (k, fallback = null) => (m.has(k) ? JSON.parse(m.get(k)) : fallback), set: (k, v) => m.set(k, JSON.stringify(v)), keys: () => [...m.keys()] };
};
const wallet = (owned = []) => {
  const e = createEconomy({ achievements: () => [] });
  e.earn('found', 40);
  e.grant(owned);
  return e;
};
const SHIP = CREWS[0].id;
const live = { build: null, loadout: { ...STOCK_LOADOUT } };
const wing = modulesFor('wings')[1].id;

describe('the Shipyard page’s state', () => {
  it('reads nothing as nothing: no crew has a hull, a garage build or a part', () => {
    const s = readSaves(store());
    expect(s.hulls).toEqual({});
    expect(s.garage).toEqual({});
    expect(s.loadouts[SHIP]).toBeUndefined();
  });
  it('a build flown is the hull, and the last build to go back to; stock keeps the last', () => {
    const b = { ...STOCK_BUILD, wings: wing };
    const a = withBuild({ hulls: {}, garage: {} }, SHIP, b);
    expect(a.hulls[SHIP]).toEqual(b);
    expect(a.garage[SHIP]).toEqual(b);
    const stock = withBuild(a, SHIP, null);
    expect(stock.hulls[SHIP]).toBeNull();
    expect(stock.garage[SHIP]).toEqual(b);
  });
  it('a build and a loadout kept are what the other map reads when it opens', () => {
    const disk = store();
    const b = { ...STOCK_BUILD, wings: wing };
    keepBuild(disk, readSaves(disk), SHIP, b);
    keepLoadouts(disk, { [SHIP]: { ...STOCK_LOADOUT, booster: 'srb' } });
    expect(disk.keys().sort()).toEqual([GARAGE_KEY, HULL_KEY, LOADOUT_KEY].sort());
    const other = readSaves(disk); // (what the universe map's first render reads; the galaxy's are the same)
    expect(other.hulls[SHIP]).toEqual(b);
    expect(other.garage[SHIP]).toEqual(b);
    expect(loadoutOf(other.loadouts, SHIP, [], other.hulls[SHIP]).booster).toBe('srb');
    // (and back to stock: the hull goes, the garage keeps the build)
    keepBuild(disk, other, SHIP, null);
    expect(readSaves(disk).hulls[SHIP]).toBeNull();
    expect(readSaves(disk).garage[SHIP]).toEqual(b);
  });
});

describe('applying a draft', () => {
  const request = (draft) => ({ diff: diff(draft, live), toBuy: [], draft });
  it('says the shop is still opening with no wallet, and a refusal changes nothing', () => {
    const r = applyYardDraft({ ship: SHIP, economy: null, loadouts: {}, unlocked: [] }, request(openDraft(live)));
    expect(r.result).toMatchObject({ ok: false, why: 'shop' });
    expect(r.loadouts).toBeUndefined();
    expect(applyYardDraft({ ship: null, economy: wallet(), loadouts: {}, unlocked: [] }, request(openDraft(live))).result.ok).toBe(false);
  });
  it('fits a part owned: the loadout to keep, the hull untouched, a note that says so', () => {
    const e = wallet([itemOfPart('booster', 'srb')]);
    const draft = setPart(openDraft(live), 'booster', 'srb');
    const r = applyYardDraft({ ship: SHIP, economy: e, loadouts: {}, unlocked: [] }, request(draft));
    expect(r.result).toMatchObject({ ok: true, text: 'Fitted.' });
    expect(r.result.live.loadout.booster).toBe('srb');
    expect(r.loadouts[SHIP].booster).toBe('srb');
    expect('build' in r).toBe(false);
  });
  it('a module changes the hull: the build to fly comes with it', () => {
    const e = wallet([itemOfModule('wings', wing)]);
    const draft = setModule(openDraft(live), 'wings', wing);
    const r = applyYardDraft({ ship: SHIP, economy: e, loadouts: {}, unlocked: [] }, request(draft));
    expect(r.result.ok).toBe(true);
    expect(r.build).toEqual(draft.build);
    expect(r.build.wings).toBe(wing);
  });
  it('a part that isn’t paid for is refused, and nothing is kept', () => {
    const e = wallet();
    const srb = itemOfPart('booster', 'srb');
    const draft = setPart(openDraft(live), 'booster', 'srb');
    const credits = e.credits;
    const r = applyYardDraft({ ship: SHIP, economy: e, loadouts: {}, unlocked: [] }, { diff: diff(draft, live), toBuy: [{ ...srb, price: credits + 500 }], draft });
    expect(r.result.ok).toBe(false);
    expect(r.loadouts).toBeUndefined();
    expect(e.credits).toBe(credits);
  });
});
