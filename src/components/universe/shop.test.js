import { describe, expect, it } from 'vitest';
import { createSaves } from '../../runtime/saves';
import { CATALOG, itemFor } from './catalog';
import { EARN, createEconomy } from './economy';
import { MODULES } from './shipyard/parts';
import { ownedModules, ownsItem, pillOf } from './shop';

const memory = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
const wallet = (opts = {}) => createEconomy({ saves: createSaves({ local: memory(), session: memory() }), later: () => 0, cancel: () => {}, ...opts });

describe('the hangar’s price pill', () => {
  it('says nothing on stock, and Owned on what’s yours', () => {
    const econ = wallet();
    expect(pillOf(econ, itemFor('part', 'booster', 'stock'))).toBeNull();
    expect(pillOf(econ, itemFor('module', 'tail', 'none'))).toBeNull();
    econ.grant([itemFor('part', 'booster', 'srb').key]);
    expect(pillOf(econ, itemFor('part', 'booster', 'srb'))).toEqual({ kind: 'owned', text: 'Owned' });
  });

  it('offers what you can afford, and says how short you are of the rest', () => {
    const econ = wallet();
    const rcs = itemFor('part', 'thrusters', 'rcs');
    expect(pillOf(econ, rcs)).toEqual({ kind: 'short', text: `short ${rcs.price} ¢`, price: `${rcs.price} ¢` });
    econ.earn('killCapital');
    expect(pillOf(econ, rcs)).toEqual({ kind: 'buy', text: `Buy · ${rcs.price} ¢` });
    const left = EARN.killCapital.credits;
    const dear = Object.values(CATALOG).find((it) => it.price > left && !Object.keys(it.needs).length);
    expect(pillOf(econ, dear)).toEqual({ kind: 'short', text: `short ${dear.price - left} ¢`, price: `${dear.price} ¢` });
  });

  it('shows a lock as its sentence', () => {
    const econ = wallet();
    expect(pillOf(econ, itemFor('part', 'fins', 'council'))).toEqual({ kind: 'locked', text: 'Reach level 5' });
    expect(pillOf(econ, itemFor('paint', 'paint', 'citadel'))).toEqual({ kind: 'locked', text: 'Be trusted by the Federation' });
  });

  it('is nothing for nothing', () => {
    expect(pillOf(wallet(), null)).toBeNull();
    expect(pillOf(null, itemFor('part', 'booster', 'srb'))).toBeNull();
  });
});

describe('what’s yours to fly', () => {
  it('stock always, the rest when the wallet has it', () => {
    const econ = wallet();
    expect(ownsItem(econ, itemFor('part', 'booster', 'stock'))).toBe(true);
    expect(ownsItem(null, itemFor('part', 'booster', 'stock'))).toBe(true);
    expect(ownsItem(econ, itemFor('part', 'booster', 'srb'))).toBe(false);
    expect(ownsItem(null, itemFor('part', 'booster', 'srb'))).toBe(false);
    econ.grant([itemFor('part', 'booster', 'srb').key]);
    expect(ownsItem(econ, itemFor('part', 'booster', 'srb'))).toBe(true);
    // (the paint called portal isn't the booster called portal)
    econ.grant([itemFor('paint', 'paint', 'portal').key]);
    expect(ownsItem(econ, itemFor('part', 'booster', 'portal'))).toBe(false);
  });

  it('lists the module ids owned, for the roll', () => {
    const econ = wallet();
    const stock = MODULES.filter((m) => itemFor('module', m.slot, m.id).stock).map((m) => m.id);
    expect(new Set(ownedModules(econ))).toEqual(new Set(stock));
    econ.grant([itemFor('module', 'hull', 'hauler').key]);
    expect(ownedModules(econ)).toContain('hauler');
    expect(ownedModules(null)).toEqual(expect.arrayContaining(stock));
  });
});
