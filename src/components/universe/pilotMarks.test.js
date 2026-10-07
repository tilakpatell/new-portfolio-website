import { describe, expect, it } from 'vitest';
import { swear } from '../galaxy/allegiance';
import { RANKS } from '../galaxy/ranks';
import { oathAndRank, standingLevels, warRank } from './pilotMarks';

// a store the way lib/hooks' `local` is: get(key, fallback), set(key, value)
const store = (init = {}) => {
  const m = new Map(Object.entries(init));
  return { get: (k, fallback = null) => (m.has(k) ? m.get(k) : fallback), set: (k, v) => m.set(k, v) };
};
const NOW = Date.now();

describe('standing, for the wallet', () => {
  it('reads each axis’s level for a side, from what standing.js keeps', () => {
    const s = store({ 'tp:universe-standing': { rickmorty: { law: 4, civil: -3.5, outlaw: 0, at: NOW } } });
    expect(standingLevels(s, 'rickmorty')).toEqual({ law: 'trusted', civil: 'feared', outlaw: null });
    expect(standingLevels(s, 'starwars')).toEqual({ law: null, civil: null, outlaw: null });
  });

  it('is nobody’s with nothing kept, or junk', () => {
    expect(standingLevels(store(), 'breakingbad')).toEqual({ law: null, civil: null, outlaw: null });
    expect(standingLevels(store({ 'tp:universe-standing': 'junk' }), 'breakingbad')).toEqual({ law: null, civil: null, outlaw: null });
    expect(standingLevels(null, 'breakingbad')).toBeNull();
    expect(standingLevels(store(), null)).toBeNull();
  });
});

describe('the war rank, for the wallet', () => {
  const sworn = (side) => swear({ since: -1, war: 'gcw', oaths: {} }, side, NOW);

  it('is the rank your points make, on the side you swore to', () => {
    const points = (n) => (war) => (war === 'gcw' ? n : 0);
    expect(warRank(sworn('rebel'), 'rebel', points(0), NOW)).toBe('flight-cadet');
    expect(warRank(sworn('rebel'), 'rebel', points(RANKS.rebel[2].at), NOW)).toBe('flight-leader');
    expect(warRank(sworn('empire'), 'empire', points(200), NOW)).toBe('admiral');
  });

  it('is nothing on a side you never swore to', () => {
    const points = () => 999;
    expect(warRank(sworn('rebel'), 'empire', points, NOW)).toBeNull();
    expect(warRank(null, 'rebel', points, NOW)).toBeNull();
    expect(warRank('{junk', 'rebel', points, NOW)).toBeNull();
    expect(warRank(sworn('rebel'), 'hutt', points, NOW)).toBeNull();
    expect(warRank(sworn('rebel'), 'nobody', points, NOW)).toBeNull();
  });

  it('reads a kept oath as a string too', () => {
    expect(warRank(JSON.stringify(sworn('rebel')), 'rebel', () => 0, NOW)).toBe('flight-cadet');
  });

  it('says the oath and rank in the theatre you fight in, for the record', () => {
    expect(oathAndRank(sworn('rebel'), () => 16, NOW)).toEqual({ war: 'gcw', side: 'rebel', rank: 'flight-leader' });
    expect(oathAndRank(null, () => 0, NOW)).toEqual({ war: 'gcw', side: null, rank: null });
  });
});
