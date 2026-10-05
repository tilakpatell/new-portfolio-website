import { describe, expect, it } from 'vitest';
import { DAMAGE, GUARD, NAME_MAX, STALE_MS, allyStep, cleanName, hitCounts, randomCallsign, readCursor, readHello, readHit, readPose, readShot, sample, writeCursor, writePose, writeShot } from './protocol';

describe('cleanName', () => {
  it('keeps an ordinary name', () => {
    expect(cleanName('Rogue Five')).toBe('Rogue Five');
  });
  it('trims, collapses spaces and caps the length', () => {
    expect(cleanName('  Red    Leader  ')).toBe('Red Leader');
    expect([...cleanName('x'.repeat(40))].length).toBe(NAME_MAX);
  });
  it('drops control and direction-override characters', () => {
    expect(cleanName('Han\u202eSolo')).toBe('HanSolo');
    expect(cleanName('a\u0000b\nc')).toBe('abc');
  });
  it('counts an emoji as one character, not its halves', () => {
    const name = cleanName('🚀'.repeat(20));
    expect([...name].length).toBe(NAME_MAX);
  });
  it('turns nothing into null', () => {
    expect(cleanName('   ')).toBeNull();
    expect(cleanName(42)).toBeNull();
    expect(cleanName(undefined)).toBeNull();
  });
});

describe('randomCallsign', () => {
  it('is a clean name', () => {
    for (let i = 0; i < 50; i++) {
      const n = randomCallsign();
      expect(cleanName(n)).toBe(n);
    }
  });
});

describe('readHello', () => {
  it('reads a hello and cleans it', () => {
    expect(readHello({ n: ' Ace ', k: 'xwing', c: 3, w: '/middle-earth' })).toEqual({ name: 'Ace', kind: 'xwing', kills: 3, where: '/middle-earth' });
  });
  it('drops an unknown ship and bad kills', () => {
    expect(readHello({ n: 'A', k: '<img>', c: -5, w: 'javascript:alert(1)' })).toEqual({ name: 'A', kind: null, kills: 0, where: null });
    expect(readHello({ n: '', k: null, c: 'lots' })).toEqual({ name: 'Pilot', kind: null, kills: 0, where: null });
  });
  it('is null for anything that is not an object', () => {
    expect(readHello(null)).toBeNull();
    expect(readHello([1, 2])).toBeNull();
    expect(readHello('hi')).toBeNull();
  });
});

describe('poses', () => {
  const ship = { x: 12.3456, y: -1.2, z: 40.01, heading: 1.2, pitch: 0.1, bank: -0.3, speed: 5.5, vy: 0.4 };
  it('round-trips', () => {
    const p = readPose(writePose(ship, 2));
    expect(p.x).toBeCloseTo(12.35, 2);
    expect(p.heading).toBeCloseTo(1.2, 3);
    expect(p.vy).toBeCloseTo(0.4, 2);
    expect(p.boost).toBe(true);
    expect(p.hidden).toBe(false);
  });
  it('refuses junk and clamps the rest', () => {
    expect(readPose([1, 2])).toBeNull();
    expect(readPose(['a', 0, 0, 0, 0, 0, 0, 0, 0])).toBeNull();
    expect(readPose([NaN, 0, 0, 0, 0, 0, 0, 0, 0])).toBeNull();
    const p = readPose([1e9, 0, 0, 0, 9, 0, 1e6, 0, 1]);
    expect(p.x).toBe(7500);
    expect(p.pitch).toBe(1.6);
    expect(p.speed).toBe(600);
    expect(p.hidden).toBe(true);
  });
});

describe('cursors', () => {
  it('round-trips', () => {
    expect(readCursor(writeCursor(-120.4, 900.6, false))).toEqual({ x: -120, y: 901, touch: false });
    expect(readCursor(writeCursor(0, 10, true)).touch).toBe(true);
  });
  it('refuses junk and clamps the rest', () => {
    expect(readCursor([1])).toBeNull();
    expect(readCursor(['a', 0, 0])).toBeNull();
    expect(readCursor([1e9, -5, 0])).toEqual({ x: 5000, y: 0, touch: false });
  });
});

describe('shots', () => {
  it('round-trips', () => {
    const s = readShot(writeShot({ x: 1, y: 2, z: 3 }, [0, 0, -20]));
    expect(s).toEqual({ p: [1, 2, 3], v: [0, 0, -20] });
  });
  it('refuses one from far off where the pilot was, or impossibly fast', () => {
    expect(readShot([50, 0, 0, 0, 0, -20], { x: 0, y: 0, z: 0 })).toBeNull();
    expect(readShot([0, 0, 0, 0, 0, -5000])).toBeNull();
    expect(readShot([0, 0, 0, 0, 0])).toBeNull();
  });
});

describe('hits', () => {
  it('caps the damage', () => {
    expect(readHit({ d: 999 })).toBe(DAMAGE);
    expect(readHit({ d: -1 })).toBeNull();
    expect(readHit({})).toBeNull();
  });
  const me = { x: 0, y: 0, z: 0 };
  const peer = (o = {}) => ({ ally: 'none', blocked: false, shotAt: 1000, hitAt: -Infinity, pose: { x: 5, y: 0, z: 0 }, ...o });
  it('counts a fair hit', () => {
    expect(hitCounts(peer(), me, 1200)).toBe(true);
  });
  it('ignores allies, the blocked, and anyone with no shot lately', () => {
    expect(hitCounts(peer({ ally: 'ally' }), me, 1200)).toBe(false);
    expect(hitCounts(peer({ blocked: true }), me, 1200)).toBe(false);
    expect(hitCounts(peer({ shotAt: 1000 }), me, 1000 + GUARD.shotWindow + 1)).toBe(false);
  });
  it('ignores hits faster than the guns fire, or from too far', () => {
    expect(hitCounts(peer({ hitAt: 1150 }), me, 1200)).toBe(false);
    expect(hitCounts(peer({ pose: { x: GUARD.range + 1, y: 0, z: 0 } }), me, 1200)).toBe(false);
  });
  it('ignores hits while you are not flying', () => {
    expect(hitCounts(peer(), null, 1200)).toBe(false);
  });
});

describe('allyStep', () => {
  it('asks, and the other side accepts', () => {
    const a = allyStep('none', 'ask');
    expect(a).toEqual({ state: 'sent', send: 'ask' });
    const b = allyStep('none', { in: 'ask' });
    expect(b).toEqual({ state: 'got', send: null });
    const b2 = allyStep(b.state, 'accept');
    expect(b2).toEqual({ state: 'ally', send: 'yes' });
    expect(allyStep(a.state, { in: 'yes' })).toEqual({ state: 'ally', send: null });
  });
  it('a yes nobody asked for does nothing', () => {
    expect(allyStep('none', { in: 'yes' }).state).toBe('none');
    expect(allyStep('got', { in: 'yes' }).state).toBe('got');
  });
  it('both asking at once is an alliance', () => {
    expect(allyStep('sent', { in: 'ask' })).toEqual({ state: 'ally', send: 'yes' });
    expect(allyStep('got', 'ask')).toEqual({ state: 'ally', send: 'yes' });
  });
  it('declines and ends', () => {
    expect(allyStep('got', 'decline')).toEqual({ state: 'none', send: 'no' });
    expect(allyStep('sent', { in: 'no' }).state).toBe('none');
    expect(allyStep('ally', 'end')).toEqual({ state: 'none', send: 'end' });
    expect(allyStep('ally', { in: 'end' }).state).toBe('none');
  });
  it('ignores what makes no sense', () => {
    expect(allyStep('none', 'accept')).toEqual({ state: 'none', send: null });
    expect(allyStep('none', { in: 'bogus' })).toEqual({ state: 'none', send: null });
    expect(allyStep(undefined, 'end')).toEqual({ state: 'none', send: null });
  });
});

describe('sample', () => {
  const snap = (at, x, heading = 0) => ({ at, x, y: 0, z: 0, heading, pitch: 0, bank: 0, speed: 0, vy: 0, hidden: false, boost: false });
  it('draws between the poses either side, a little in the past', () => {
    const s = sample([snap(0, 0), snap(100, 10)], 190, 140);
    expect(s.x).toBeCloseTo(5);
  });
  it('turns the short way round', () => {
    const s = sample([snap(0, 0, 3.1), snap(100, 0, -3.1)], 190, 140);
    expect(Math.abs(s.heading)).toBeGreaterThan(3.1);
  });
  it('guesses a little way ahead of the newest, then gives up', () => {
    const moving = { ...snap(0, 0), speed: 10 };
    const s = sample([moving], 1000, 140);
    expect(s.z).toBeCloseTo(-2.5); // heading 0 is −z; 250 ms at most
    expect(sample([moving], STALE_MS + 1)).toBeNull();
    expect(sample([], 0)).toBeNull();
  });
});
