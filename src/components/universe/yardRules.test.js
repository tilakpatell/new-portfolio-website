import { describe, expect, it } from 'vitest';
import { createEconomy, refundOf } from './economy';
import { itemFor } from './catalog';
import { STOCK, STOCK_LOADOUT, partById } from './outfit';
import { STOCK_BUILD, buildCode } from './shipyard/build';
import { modulesFor } from './shipyard/parts';
import { check, diff, fitDraft, itemOfModule, itemOfPart, openDraft, pasteDraft, rollDraft, setHull, setModule, setPart, sellable } from './yardRules';

const wallet = ({ credits = 0, owned = [], unlocked = [] } = {}) => {
  const e = createEconomy({ achievements: () => unlocked });
  if (credits) e.earn('found', Math.ceil(credits / 30)); // (30 a find; xp too, a level or so)
  e.grant(owned);
  return e;
};
const live = { build: null, loadout: { ...STOCK_LOADOUT } };
const srb = itemOfPart('booster', 'srb');
const rcs = itemOfPart('thrusters', 'rcs');

describe('the draft', () => {
  it('a draft from live is equal and not the same object', () => {
    const l = { build: { ...STOCK_BUILD }, loadout: { ...STOCK_LOADOUT, booster: 'srb' } };
    const d = openDraft(l);
    expect(d).toEqual(l);
    expect(d).not.toBe(l);
    expect(d.loadout).not.toBe(l.loadout);
    expect(d.build).not.toBe(l.build);
    expect(openDraft(live).build).toBeNull();
  });

  it('setPart and setModule return new drafts and leave the old', () => {
    const d = openDraft(live);
    const a = setPart(d, 'booster', 'srb');
    expect(a.loadout.booster).toBe('srb');
    expect(d.loadout.booster).toBe(STOCK);
    expect(setPart(d, 'booster', 'nonsense')).toBe(d); // (an unknown part changes nothing)
    const wing = modulesFor('wings')[1].id;
    const b = setModule(d, 'wings', wing);
    expect(b.build).toEqual({ ...STOCK_BUILD, wings: wing }); // (a build opened from stock)
    expect(d.build).toBeNull();
    expect(setModule(d, 'wings', 'nonsense')).toBe(d);
  });

  it('setHull on opens the last build or stock, and off flies the stock ship', () => {
    const d = openDraft(live);
    const last = { ...STOCK_BUILD, wings: modulesFor('wings')[1].id, seed: 9 };
    expect(setHull(d, true, last).build).toEqual(last);
    expect(setHull(d, true, last).build).not.toBe(last);
    expect(setHull(d, true, null).build).toEqual({ ...STOCK_BUILD });
    expect(setHull(setHull(d, true, last), false).build).toBeNull();
  });

  it('a roll is the same build for the same seed, and only from what’s owned', () => {
    const d = openDraft(live);
    expect(rollDraft(d, 7, [], []).build).toEqual(rollDraft(d, 7, [], []).build);
    expect(rollDraft(d, 7, [], []).loadout).toEqual(d.loadout);
  });

  it('pasteDraft refuses a bad code and a code with an unowned module', () => {
    const d = openDraft(live);
    expect(pasteDraft(d, 'hello', {})).toEqual({ error: 'Not a build code. They look like GB-021301.k3.' });
    expect(pasteDraft(d, buildCode(STOCK_BUILD), { economy: wallet() }).draft.build).toEqual({ ...STOCK_BUILD });
    const bought = modulesFor('wings').find((m) => !m.achievement && m.id !== STOCK_BUILD.wings && m.id !== 'none');
    const code = buildCode({ ...STOCK_BUILD, wings: bought.id });
    expect(pasteDraft(d, code, { economy: wallet() }).error).toMatch(/haven’t bought/);
    expect(pasteDraft(d, code, { economy: wallet({ owned: [itemOfModule('wings', bought.id).key] }) }).draft.build.wings).toBe(bought.id);
    const shut = modulesFor('wings').find((m) => m.achievement);
    if (shut) expect(pasteDraft(d, buildCode({ ...STOCK_BUILD, wings: shut.id }), { economy: wallet() }).error).toMatch(/isn’t yours yet/);
  });
});

describe('check', () => {
  it('is ok on a draft of owned, open, fitting parts', () => {
    const d = setPart(openDraft(live), 'booster', 'srb');
    const r = check(d, { kind: 'falcon', unlocked: [], economy: wallet({ owned: [srb.key] }) });
    expect(r.ok).toBe(true);
    expect(r.issues).toEqual([]);
    expect(r.toBuy).toEqual([]);
    expect(r.total).toBe(0);
    expect(r.short).toBe(0);
    expect(r.power).toBe(partById('booster', 'srb').power);
    expect(r.capacity).toBe(9);
    expect(r.mass).toBeGreaterThan(0);
  });

  it('lists what’s to buy, its total, and what’s short', () => {
    const d = setPart(setPart(openDraft(live), 'booster', 'srb'), 'thrusters', 'rcs');
    const e = wallet({ credits: 100 });
    const r = check(d, { kind: 'falcon', unlocked: [], economy: e });
    expect(r.toBuy.map((i) => i.key)).toEqual([srb.key, rcs.key]);
    expect(r.total).toBe(srb.price + rcs.price);
    expect(r.short).toBe(srb.price + rcs.price - e.credits);
    expect(r.ok).toBe(false);
    expect(r.issues).toEqual([{ slot: null, id: null, why: 'short', text: `Short ${r.short} ¢.` }]);
  });

  it('lists a locked part and a part the plant can’t run', () => {
    let d = setPart(openDraft(live), 'booster', 'afterburner'); // (the trench run's)
    const e = wallet({ credits: 100000, owned: ['part:booster:afterburner'] });
    let r = check(d, { kind: 'falcon', unlocked: [], economy: e });
    expect(r.issues.map((i) => i.why)).toEqual(['locked']);
    expect(r.issues[0].text).toBe('Locked. Hit the exhaust port in the trench run.');
    // the RV's 5 MW against portal (3), vector (2) and fastcharge (2)
    d = setPart(setPart(setPart(openDraft(live), 'booster', 'portal'), 'thrusters', 'vector'), 'shields', 'fastcharge');
    r = check(d, { kind: 'rv', unlocked: ['showmewhatyougot', 'grounded', 'captain'], economy: wallet({ owned: ['part:booster:portal', 'part:thrusters:vector', 'part:shields:fastcharge'] }) });
    expect(r.issues).toEqual([{ slot: null, id: null, why: 'power', text: 'Not enough power: 2 MW short.' }]);
  });

  it('a lock past an achievement (a level) is an issue whatever the wallet says', () => {
    const d = setPart(openDraft(live), 'thrusters', 'vamonos'); // (level 3)
    const r = check(d, { kind: 'falcon', unlocked: [], economy: wallet() });
    expect(r.issues[0]).toMatchObject({ slot: 'thrusters', id: 'vamonos', why: 'locked' });
    expect(r.issues[0].text).toMatch(/^Locked\. Reach level 3\.$/);
  });

  it('says the shop’s still opening with no wallet', () => {
    const r = check(setPart(openDraft(live), 'booster', 'srb'), { kind: 'falcon', unlocked: [], economy: null });
    expect(r.ok).toBe(false);
    expect(r.issues).toEqual([{ slot: null, id: null, why: 'unowned', text: 'The shop’s still opening.' }]);
  });
});

describe('diff', () => {
  it('puts the build first and leaves out what hasn’t changed', () => {
    expect(diff(openDraft(live), live)).toEqual([]);
    const wing = modulesFor('wings')[1].id;
    const d = setPart(setModule(openDraft(live), 'wings', wing), 'booster', 'srb');
    const out = diff(d, live);
    expect(out.map((c) => c.slot)).toEqual(['build', 'wings', 'booster']);
    expect(out[0]).toEqual({ slot: 'build', from: 'stock', to: 'garage', module: true });
    expect(out[1]).toEqual({ slot: 'wings', from: STOCK_BUILD.wings, to: wing, module: true });
    expect(out[2]).toEqual({ slot: 'booster', from: STOCK, to: 'srb', module: false });
  });

  it('takes a part off before putting a hungrier one on', () => {
    const from = { build: null, loadout: { ...STOCK_LOADOUT, booster: 'portal' } };
    const d = setPart(setPart(openDraft(from), 'booster', STOCK), 'shields', 'fastcharge');
    expect(diff(d, from).map((c) => c.slot)).toEqual(['booster', 'shields']);
    const d2 = setPart(setPart(openDraft(from), 'shields', 'fastcharge'), 'booster', STOCK);
    expect(diff(d2, from).map((c) => c.slot)).toEqual(['booster', 'shields']);
  });
});

describe('sellable', () => {
  it('leaves out what any crew flies', () => {
    const e = wallet({ owned: [srb.key, rcs.key] });
    const out = sellable({ loadouts: { falcon: { booster: 'srb' } }, hulls: {}, garage: {} }, e);
    expect(out).toEqual([{ item: rcs, refund: refundOf(rcs) }]);
    expect(out[0].refund).toBe(Math.floor(rcs.price * 0.6));
    expect(sellable({ loadouts: {}, hulls: {}, garage: {} }, null)).toEqual([]);
  });

  it('leaves out a module in a hull or the garage, and whatever the draft keeps', () => {
    const wing = modulesFor('wings').find((m) => m.id !== STOCK_BUILD.wings && m.id !== 'none');
    const key = itemOfModule('wings', wing.id).key;
    const e = wallet({ owned: [key, rcs.key] });
    expect(sellable({ loadouts: {}, hulls: {}, garage: { xwing: { ...STOCK_BUILD, wings: wing.id } } }, e).map((s) => s.item.key)).toEqual([rcs.key]);
    expect(sellable({ loadouts: {}, hulls: {}, garage: {}, keep: [rcs.key] }, e).map((s) => s.item.key)).toEqual([key]);
  });

  it('names catalogue items by part and module', () => {
    expect(itemOfPart('booster', 'srb')).toBe(itemFor('part', 'booster', 'srb'));
    expect(itemOfPart('paint', 'portal')).toBe(itemFor('paint', 'paint', 'portal'));
    expect(itemOfModule('wings', STOCK_BUILD.wings).stock).toBe(true);
  });
});

describe('fitDraft', () => {
  it('fits every part change in diff’s order, and keeps the saved loadout’s others', () => {
    const from = { build: null, loadout: { ...STOCK_LOADOUT, booster: 'portal' } };
    const d = setPart(setPart(openDraft(from), 'booster', STOCK), 'shields', 'fastcharge');
    const saved = { ...STOCK_LOADOUT, booster: 'portal', fins: 'fins' };
    const r = fitDraft('rv', d, diff(d, from), { saved, unlocked: ['showmewhatyougot', 'captain'] });
    expect(r.ok).toBe(true);
    expect(r.loadout.booster).toBe(STOCK);
    expect(r.loadout.shields).toBe('fastcharge');
    expect(r.saved).toEqual({ ...saved, booster: STOCK, shields: 'fastcharge' });
  });

  it('refuses the lot when a fit won’t go on (another tab took the plant)', () => {
    const d = setPart(setPart(openDraft(live), 'booster', 'portal'), 'thrusters', 'vector');
    const r = fitDraft('rv', { ...d, loadout: { ...d.loadout, shields: 'fastcharge' } }, diff({ ...d, loadout: { ...d.loadout, shields: 'fastcharge' } }, live), { saved: {}, unlocked: ['showmewhatyougot', 'grounded', 'captain'] });
    expect(r).toMatchObject({ ok: false, why: 'power' });
  });
});
