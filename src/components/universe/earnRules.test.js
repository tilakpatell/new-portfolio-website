import { describe, expect, it } from 'vitest';
import { createCarry, createPayLedger, createPayQueue, hunterEarn } from './earnRules';

describe('the pay ledger', () => {
  it('says yes to a key once, and no after', () => {
    const paid = createPayLedger();
    expect(paid.once('starwars:trusted')).toBe(true);
    expect(paid.once('starwars:trusted')).toBe(false);
    // another side or level is its own key
    expect(paid.once('rickmorty:trusted')).toBe(true);
    expect(paid.once('starwars:hero')).toBe(true);
  });

  it('starts with what was paid for before', () => {
    const paid = createPayLedger(['found:bar', 'quest:fuel']);
    expect(paid.once('found:bar')).toBe(false);
    expect(paid.once('quest:fuel')).toBe(false);
    expect(paid.once('found:dunes')).toBe(true);
  });

  it('keeps each ledger to itself', () => {
    const a = createPayLedger();
    const b = createPayLedger();
    expect(a.once('ally:p1')).toBe(true);
    expect(b.once('ally:p1')).toBe(true);
  });
});

describe('the carry', () => {
  it('pays whole points and keeps the fractions', () => {
    const carry = createCarry();
    expect(carry.add(3)).toBe(3);
    expect(carry.add(0.5)).toBe(0);
    expect(carry.add(0.75)).toBe(1);
    expect(carry.add(0.25)).toBe(0);
    expect(carry.add(0.5)).toBe(1);
  });

  it('makes a whole point of ten tenths, despite the floating point', () => {
    const carry = createCarry();
    let paid = 0;
    for (let i = 0; i < 10; i++) paid += carry.add(0.1);
    expect(paid).toBe(1);
  });

  it('ignores nought, negatives and junk', () => {
    const carry = createCarry();
    for (const junk of [0, -2, NaN, Infinity, '3', null, undefined]) expect(carry.add(junk)).toBe(0);
    expect(carry.add(1)).toBe(1);
  });
});

describe('the pay queue', () => {
  const wallet = () => {
    const got = [];
    return { got, earn: (what, n, { side }) => (got.push([what, n, side]), { credits: n, what }) };
  };

  it('keeps what’s earned before the wallet loads, and pays it on arrival', () => {
    const q = createPayQueue();
    expect(q.pay('killHunter', 1, 'starwars')).toEqual([]);
    expect(q.pay('found', 2, 'galaxy')).toEqual([]);
    const w = wallet();
    expect(q.attach(w)).toEqual([
      { credits: 1, what: 'killHunter' },
      { credits: 2, what: 'found' },
    ]);
    expect(w.got).toEqual([
      ['killHunter', 1, 'starwars'],
      ['found', 2, 'galaxy'],
    ]);
    // paid once: attached again, nothing more
    expect(q.attach(w)).toEqual([]);
  });

  it('pays straight in once the wallet’s there', () => {
    const q = createPayQueue();
    const w = wallet();
    q.attach(w);
    expect(q.pay('rescued', 1, null)).toEqual([{ credits: 1, what: 'rescued' }]);
    expect(w.got).toEqual([['rescued', 1, null]]);
  });

  it('goes back to keeping when the wallet’s taken away', () => {
    const q = createPayQueue();
    q.attach(wallet());
    expect(q.attach(null)).toEqual([]);
    expect(q.pay('helped')).toEqual([]);
    const w = wallet();
    q.attach(w);
    expect(w.got).toEqual([['helped', 1, null]]);
  });
});

describe('what a hunter down pays', () => {
  const factions = {
    empire: { role: 'navy', ace: 'vader' },
    weequay: { role: 'pirates' },
    separatists: {},
  };

  it('pays a hunter, a pirate, or more for its faction’s ace', () => {
    expect(hunterEarn(factions, { faction: 'empire', kind: 'tie' })).toBe('killHunter');
    expect(hunterEarn(factions, { faction: 'separatists', kind: 'vulture' })).toBe('killHunter');
    expect(hunterEarn(factions, { faction: 'weequay', kind: 'skiff' })).toBe('killPirate');
    expect(hunterEarn(factions, { faction: 'empire', kind: 'vader' })).toBe('killAce');
  });

  it('counts a hunter after someone else (its prey) as a pirate', () => {
    expect(hunterEarn(factions, { faction: 'empire', kind: 'tie', prey: true })).toBe('killPirate');
  });

  it('pays nothing for one with no faction', () => {
    expect(hunterEarn(factions, { kind: 'tie' })).toBeNull();
    expect(hunterEarn(factions, null)).toBeNull();
  });
});
