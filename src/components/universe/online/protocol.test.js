import { describe, expect, it } from 'vitest';
import { DAMAGE, FLOOD, GUARD, NAME_MAX, RATES, STALE_MS, aimedAt, allyStep, cleanName, createLimiter, hitCounts, randomCallsign, readCursor, readFoot, readHello, readHit, readPose, readShot, sample, writeCursor, writeFoot, writePose, writeShot } from './protocol';
import { STOCK_LOADOUT, writeOutfit } from '../outfit';

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
  it('shows no slurs or obscenities, leetspeak and all, but leaves innocent words be', () => {
    for (const bad of ['sh1t lord', 'F.U.C.K', 'fuuuuck', 'Big Dick', 'KKK']) expect(cleanName(bad), bad).toBeNull();
    for (const ok of ['Cockpit Ace', 'Torpedo 7', 'Grape Ape', 'Class Act', 'Spicy Rick', 'Therapist', 'Hello Kitty', 'Kirk', 'Pass Go']) expect(cleanName(ok), ok).toBe(ok);
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
    expect(readHello({ n: ' Ace ', k: 'xwing', c: 3, w: '/middle-earth' })).toEqual({ name: 'Ace', kind: 'xwing', loadout: STOCK_LOADOUT, kills: 3, where: '/middle-earth' });
  });
  it('drops an unknown ship and bad kills', () => {
    expect(readHello({ n: 'A', k: '<img>', c: -5, w: 'javascript:alert(1)' })).toEqual({ name: 'A', kind: null, loadout: STOCK_LOADOUT, kills: 0, where: null });
    expect(readHello({ n: '', k: null, c: 'lots' })).toEqual({ name: 'Pilot', kind: null, loadout: STOCK_LOADOUT, kills: 0, where: null });
  });
  it('reads the paint job and parts fitted, and only ones it knows', () => {
    const l = { ...STOCK_LOADOUT, paint: 'sith', booster: 'portal', guns: 'fusion', fins: 'fins' };
    expect(readHello({ n: 'A', k: 'falcon', p: 'sith', o: writeOutfit(l) }).loadout).toEqual(l);
    // a colour, a shape, a part in the wrong slot or too many: none of it's believed
    expect(readHello({ n: 'A', k: 'falcon', p: '#ff0000', o: ['fusion', { r: 1 }, '<b>', 'portal', 'fins', 'srb', 'srb'] }).loadout).toEqual({ ...STOCK_LOADOUT, fins: 'fins' });
    expect(readHello({ n: 'A', k: 'falcon', p: 'aws', o: 'srb' }).loadout).toEqual({ ...STOCK_LOADOUT, paint: 'aws' });
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
  it('carries a ship upside down, and the lean into a turn on its bank', () => {
    expect(readPose(writePose({ ...ship, bank: Math.PI - 0.01 })).bank).toBeCloseTo(Math.PI - 0.01, 3);
    expect(readPose(writePose({ ...ship, bank: 0.2, lean: 0.3 })).bank).toBeCloseTo(0.5, 3);
    expect(readPose(writePose({ ...ship, bank: 3, lean: 0.3 })).bank).toBeCloseTo(3.3 - 2 * Math.PI, 3); // (round past upside down)
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

describe('crews on foot', () => {
  const n = [0, 1, 0];
  const walker = (who, extra = {}) => ({ who, n: [0.6, 0.8, 0], f: [0, 0, 1], h: 0.01, speed: 0.05, side: 0, aim: 1, ...extra });
  const crew = { planet: 'breakingbad', kind: 'rv', ship: { n, f: [1, 0, 0] }, lead: walker('walt'), mate: walker('jesse') };

  it('round-trips, through the wire as JSON', () => {
    const f = readFoot(JSON.parse(JSON.stringify(writeFoot(crew))));
    expect(f.planet).toBe('breakingbad');
    expect(f.kind).toBe('rv');
    expect(f.ship.n).toEqual([0, 1, 0]);
    expect(f.lead.who).toBe('walt');
    expect(f.lead.n[0]).toBeCloseTo(0.6, 4);
    expect(f.lead.speed).toBeCloseTo(0.05, 4);
    expect(f.lead.aim).toBe(1);
    expect(f.mate.who).toBe('jesse');
  });
  it('says when the crew are back in, and takes a ship just landing with nobody out', () => {
    expect(readFoot(writeFoot(null))).toEqual({ off: true });
    const landing = readFoot(writeFoot({ ...crew, lead: null, mate: null }));
    expect(landing.lead).toBeNull();
    expect(landing.ship.n).toEqual([0, 1, 0]);
  });
  it('makes the directions unit ones, along the ground', () => {
    const f = readFoot(writeFoot({ ...crew, lead: walker('walt', { n: [0, 2, 0], f: [0, 0.5, 1] }) }));
    expect(Math.hypot(...f.lead.n)).toBeCloseTo(1, 6);
    expect(Math.hypot(...f.lead.f)).toBeCloseTo(1, 6);
    expect(f.lead.f[0] * f.lead.n[0] + f.lead.f[1] * f.lead.n[1] + f.lead.f[2] * f.lead.n[2]).toBeCloseTo(0, 6);
  });
  it('refuses a station, a stranger, junk numbers, and clamps the rest', () => {
    expect(readFoot(writeFoot({ ...crew, planet: 'home' }))).toBeNull(); // (no landing on a station)
    expect(readFoot(writeFoot({ ...crew, planet: 'starwars' }))).toBeNull(); // (nor on the gate into the galaxy)
    expect(readFoot(writeFoot({ ...crew, planet: 'nowhere' }))).toBeNull();
    expect(readFoot(writeFoot({ ...crew, lead: walker('vader') }))).toBeNull();
    expect(readFoot({ ...writeFoot(crew), s: [0, 0, 0, 1, 0, 0] })).toBeNull(); // (no way up)
    expect(readFoot({ ...writeFoot(crew), a: ['walt', NaN, 1, 0, 0, 0, 1, 0, 0, 0, 0] })).toBeNull();
    expect(readFoot([1, 2, 3])).toBeNull();
    expect(readFoot(null)).toBeNull();
    const fast = readFoot(writeFoot({ ...crew, lead: walker('walt', { speed: 99, h: 99 }), mate: walker('nobody') }));
    expect(fast.lead.speed).toBeLessThan(1);
    expect(fast.lead.h).toBeLessThan(0.1);
    expect(fast.mate).toBeNull();
  });
  it('is rate-limited like a pose', () => {
    expect(RATES.foot).toEqual(RATES.pose);
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
  const me = { x: 0, y: 0, z: 0, speed: 0 };
  const atMe = { p: [5, 0, 0], v: [-18, 0, 0], at: 1000 }; // from 5 off, straight at you
  const peer = (o = {}) => ({ ally: 'none', blocked: false, shots: [atMe], hitAt: -Infinity, pose: { x: 5, y: 0, z: 0 }, ...o });
  it('counts a fair hit', () => {
    expect(hitCounts(peer(), me, 1200)).toBe(true);
  });
  it('ignores allies, the blocked, and anyone with no shot lately', () => {
    expect(hitCounts(peer({ ally: 'ally' }), me, 1200)).toBe(false);
    expect(hitCounts(peer({ blocked: true }), me, 1200)).toBe(false);
    expect(hitCounts(peer(), me, 1000 + GUARD.shotWindow + 1)).toBe(false);
  });
  it('ignores a hit from a shot that went nowhere near you', () => {
    const wide = { p: [5, 0, 0], v: [0, 0, -18], at: 1000 }; // fired off to the side
    expect(hitCounts(peer({ shots: [wide] }), me, 1200)).toBe(false);
    expect(hitCounts(peer({ shots: [] }), me, 1200)).toBe(false);
  });
  it('gives the aim more room the faster you were going', () => {
    const near = { p: [5, 0, 4], v: [-18, 0, 0], at: 1000 }; // passes 4 off
    expect(aimedAt([near], me, 1200)).toBe(false);
    expect(aimedAt([near], { ...me, speed: 5.5 }, 1200)).toBe(true);
  });
  it('ignores hits faster than the guns fire, or from too far', () => {
    expect(hitCounts(peer({ hitAt: 1150 }), me, 1200)).toBe(false);
    expect(hitCounts(peer({ pose: { x: GUARD.range + 1, y: 0, z: 0 } }), me, 1200)).toBe(false);
  });
  it('ignores hits while you are not flying', () => {
    expect(hitCounts(peer(), null, 1200)).toBe(false);
  });
});

describe('createLimiter', () => {
  it('lets a pilot send their share, then turns the rest away', () => {
    const lim = createLimiter();
    const [, burst] = RATES.shot;
    let ok = 0;
    for (let i = 0; i < 20; i++) ok += lim.allow('shot', 1000) ? 1 : 0;
    expect(ok).toBe(burst);
    expect(lim.allow('shot', 1000 + 1000 / RATES.shot[0] + 1)).toBe(true); // one more, a moment on
  });
  it('turns away a kind it does not know', () => {
    expect(createLimiter().allow('bogus', 0)).toBe(false);
  });
  it('calls a flood a flood, and forgets it in time', () => {
    const lim = createLimiter();
    for (let i = 0; i < 200; i++) lim.allow('pose', 1000);
    expect(lim.flooding(1000)).toBe(true);
    expect(lim.flooding(1000 + FLOOD.window + 1)).toBe(false);
  });
  it('a steady pose stream is fine', () => {
    const lim = createLimiter();
    let ok = 0;
    for (let t = 0; t < 10000; t += 100) ok += lim.allow('pose', t) ? 1 : 0;
    expect(ok).toBe(100);
    expect(lim.flooding(10000)).toBe(false);
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
  it('goes over the top of a loop the short way, not spinning round', () => {
    // nose just short of straight up, then just past it (on its back, going the other way)
    const a = { ...snap(0, 0), pitch: 1.5 };
    const b = { ...snap(100, 0), heading: Math.PI, pitch: 1.5, bank: Math.PI };
    const s = sample([a, b], 190, 140);
    expect(Math.sin(s.pitch)).toBeGreaterThan(0.999); // straight up between them
  });
  it('guesses a little way ahead of the newest, then gives up', () => {
    const moving = { ...snap(0, 0), speed: 10 };
    const s = sample([moving], 1000, 140);
    expect(s.z).toBeCloseTo(-2.5); // heading 0 is −z; 250 ms at most
    expect(sample([moving], STALE_MS + 1)).toBeNull();
    expect(sample([], 0)).toBeNull();
  });
});

describe('down on a world in the galaxy', () => {
  it('sends where the crew are, and reads it back', async () => {
    const { readWalk, writeWalk } = await import('./protocol');
    const sent = writeWalk({ world: 'tatooine', kind: 'xwing', lead: { who: 'luke', x: 12.345, y: 3.2, z: -40.1, yaw: 1.2, speed: 3.3 }, mate: { who: 'artoo', x: 11, y: 3.1, z: -41, yaw: 1.1, speed: 3 }, ride: 'landspeeder' });
    const got = readWalk(JSON.parse(JSON.stringify(sent)));
    expect(got.world).toBe('tatooine');
    expect(got.kind).toBe('xwing');
    expect(got.lead).toMatchObject({ who: 'luke', x: 12.35, y: 3.2, z: -40.1, yaw: 1.2 });
    expect(got.mate.who).toBe('artoo');
    expect(got.ride).toBe('landspeeder');
    expect(readWalk(writeWalk(null))).toEqual({ off: true });
  });

  it('turns away what isn’t a crew on a world', async () => {
    const { readWalk } = await import('./protocol');
    expect(readWalk(null)).toBeNull();
    expect(readWalk({ w: 'tatooine', a: ['vader', 0, 0, 0, 0, 0] })).toBeNull();
    expect(readWalk({ w: '../etc', a: ['luke', 0, 0, 0, 0, 0] })).toBeNull();
    expect(readWalk({ w: 'tatooine', a: ['luke', 'x', 0, 0, 0, 0] })).toBeNull();
    expect(readWalk({ w: 'tatooine', a: ['luke', 1, 2, 3, 0, 0], r: 'deathstar' }).ride).toBeNull();
  });
});
