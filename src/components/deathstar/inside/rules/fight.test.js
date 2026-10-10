import { describe, expect, it, vi } from 'vitest';
import { seeded } from '../../../../lib/seeded';
import { buildLayout } from './layout';
import { createNav, route } from './nav';
import { lineClear } from './walker';
import { chooseTactic, coverFrom, createFights, fallbackFrom, fightStep, flankRoute, searchOf, sectionSpots, standOff, TACTICS } from './fight';

const room = (id, x, z, w, d, o = {}) => ({ id, kind: 'corridor', name: id, section: 's', x, z, w, d, y: 0, h: 3, ...o });
const door = (id, a, b, x, z, axis, w = 2) => ({ id, a, b, x, z, axis, w, h: 2.4, kind: 'slide' });
const station = (rooms, doors = [], spots = {}, sections = { s: 'Test' }) => {
  const at = { room: rooms[0].id, x: rooms[0].x, z: rooms[0].z, yaw: 0 };
  return { id: 't', name: 'Test', era: 'anh', sections, rooms, doors, lifts: [], starts: { rebel: at, imperial: at }, spots };
};

// A hall (x −10…10, z −5…5) with an annex east of it through one door.
const pair = () => buildLayout(station([room('hall', 0, 0, 20, 10), room('annex', 15, 0, 10, 10)], [door('ha', 'hall', 'annex', 10, 0, 'z')]));

// The hall again, with a west room joined to it two ways: straight through
// door A, or round by the north corridor (doors B and C).
const loop = () =>
  buildLayout(
    station(
      [room('hall', 0, 0, 20, 10), room('west', -15, 0, 10, 10), room('north', -10, -7, 20, 4)],
      [door('A', 'west', 'hall', -10, 0, 'z'), door('B', 'west', 'north', -15, -5, 'x'), door('C', 'north', 'hall', -3, -5, 'x')],
    ),
  );

// nav.route as it is, counted, so a test can tell a way remembered from one worked out anew
vi.mock('./nav', async (real) => {
  const nav = await real();
  return { ...nav, route: vi.fn((...args) => nav.route(...args)) };
});

const open = () => true;
const sees = (layout) => (a, b) => lineClear(layout, open, a, b);
const chest = (p) => ({ x: p.x, y: (p.y ?? 0) + 1.2, z: p.z });
const doorsOf = (path) => path.filter((p) => p.door).map((p) => p.door);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// A situation in a fight, everything fine unless a test says otherwise.
const ctx = (o = {}) => ({ sees: true, lostFor: 0, dist: 8, range: 60, hp: 1, token: true, cover: false, inCover: false, flank: false, allies: 0, ...o });

describe('choosing what to do in a fight', () => {
  it('names the six tactics the brief asks for', () => {
    expect([...TACTICS].sort()).toEqual(['advance', 'cover', 'fallback', 'flank', 'hold', 'search']);
  });

  it('holds and fires with a shot token, the target in sight and in reach', () => {
    expect(chooseTactic(ctx())).toBe('hold');
  });

  it('takes cover when there is cover to take and no token to shoot with', () => {
    expect(chooseTactic(ctx({ token: false, cover: true }))).toBe('cover');
  });

  it('flanks when another way round is known and friends keep the target busy', () => {
    expect(chooseTactic(ctx({ token: false, flank: true, allies: 2 }))).toBe('flank');
  });

  it('closes in on a target too far off to hit', () => {
    expect(chooseTactic(ctx({ dist: 30 }))).toBe('advance');
  });

  it('closes in to see again a target just gone out of sight', () => {
    expect(chooseTactic(ctx({ sees: false, lostFor: 1, cover: true }))).toBe('advance');
  });

  it('falls back when badly hurt, whatever else is on offer', () => {
    expect(chooseTactic(ctx({ hp: 0.15, cover: true, flank: true, allies: 2 }))).toBe('fallback');
  });

  it('stays in cover while friends keep the target in sight and every shot is taken', () => {
    expect(chooseTactic(ctx({ sees: false, told: true, free: false, token: false, cover: true, inCover: true }), { current: 'cover' })).toBe('cover');
  });

  it('comes out of cover to see the target again once a shot is free', () => {
    expect(chooseTactic(ctx({ sees: false, told: true, free: true, token: false, cover: true, inCover: true }), { current: 'cover' })).toBe('advance');
  });

  it('searches once the target has been out of sight a while', () => {
    expect(chooseTactic(ctx({ sees: false, lostFor: 4, cover: true }))).toBe('search');
  });

  it('keeps to a tactic over one barely better, so it doesn’t flip back and forth', () => {
    // cover scores 0.54 here, a hold without a token 0.35: well apart; a held
    // cover in cover scores 0.135 against a hold of 0.35, so it moves on
    expect(chooseTactic(ctx({ token: false, cover: true, inCover: true }), { current: 'cover' })).toBe('hold');
    // at 22 m a hold (0.667) and an advance (0.68) are near enough that momentum keeps whichever is running
    expect(chooseTactic(ctx({ dist: 22 }))).toBe('advance');
    expect(chooseTactic(ctx({ dist: 22 }), { current: 'hold' })).toBe('hold');
  });
});

describe('places to fight from', () => {
  it('finds cover out of the target’s sight, through the door into the next room', () => {
    const layout = pair();
    const me = { x: 6, y: 0, z: 0, room: 'hall' };
    const threat = { x: -6, y: 1.2, z: 0 };
    const at = coverFrom(layout, me, threat, { seesThrough: sees(layout) });
    expect(at.room).toBe('annex');
    expect(lineClear(layout, open, threat, chest(at))).toBe(false);
    expect(flat(at, me)).toBeLessThan(10);
  });

  it('finds no cover in a bare room with no way out', () => {
    const layout = buildLayout(station([room('hall', 0, 0, 20, 10)]));
    expect(coverFrom(layout, { x: 6, y: 0, z: 0, room: 'hall' }, { x: -6, y: 1.2, z: 0 }, { seesThrough: sees(layout) })).toBeNull();
  });

  it('keeps its cover from friends already there', () => {
    const layout = pair();
    const me = { x: 6, y: 0, z: 0, room: 'hall' };
    const threat = { x: -6, y: 1.2, z: 0 };
    const first = coverFrom(layout, me, threat, { seesThrough: sees(layout) });
    const second = coverFrom(layout, me, threat, { seesThrough: sees(layout), allies: [first] });
    expect(flat(first, second)).toBeGreaterThanOrEqual(1.5);
  });

  it('flanks through another door into the target’s room', () => {
    const layout = loop();
    const nav = createNav(layout);
    const path = flankRoute(nav, { x: -15, z: 0, room: 'west' }, { x: 3, z: 0, room: 'hall' });
    expect(doorsOf(path)).toEqual(['B', 'C']);
    expect(path.at(-1)).toMatchObject({ x: 3, z: 0, room: 'hall' });
  });

  it('has no flank when the target’s room has one way in, or when it is the same room', () => {
    const layout = pair();
    const nav = createNav(layout);
    expect(flankRoute(nav, { x: 15, z: 0, room: 'annex' }, { x: 0, z: 0, room: 'hall' })).toBeNull();
    expect(flankRoute(createNav(loop()), { x: -5, z: 0, room: 'hall' }, { x: 3, z: 0, room: 'hall' })).toBeNull();
  });

  it('flanks by the ways it remembers when it looks again from where it stood at a target that hasn’t moved off', () => {
    const nav = createNav(loop());
    route.mockClear();
    const first = flankRoute(nav, { x: -15, z: 0, room: 'west' }, { x: 3, z: 0, room: 'hall' });
    const asked = route.mock.calls.length;
    const again = flankRoute(nav, { x: -14.6, z: 0.4, room: 'west' }, { x: 3.2, z: 0.3, room: 'hall' });
    expect(route.mock.calls.length).toBe(asked);
    expect(doorsOf(again)).toEqual(doorsOf(first));
    expect(again[0]).toMatchObject({ x: -14.6, z: 0.4 });
  });

  it('flanks only through doors it may pass', () => {
    const nav = createNav(loop());
    expect(flankRoute(nav, { x: -15, z: 0, room: 'west' }, { x: 3, z: 0, room: 'hall' }, { canPass: (id) => id !== 'C' })).toBeNull();
  });

  it('stands off a target along the line between them, kept inside the room', () => {
    const layout = pair();
    expect(standOff(layout, { x: 0, z: 0, room: 'hall' }, { x: 8, y: 1.2, z: 0 }, 6)).toMatchObject({ x: 2, y: 0, z: 0, room: 'hall' });
    const far = standOff(layout, { x: 0, z: 0, room: 'hall' }, { x: 8, y: 1.2, z: 0 }, 25);
    expect(far.x).toBeCloseTo(-9.2, 6);
    expect(far.z).toBeCloseTo(0, 6);
  });

  it('has no stand-off from a target in another room', () => {
    expect(standOff(pair(), { x: 0, z: 0, room: 'hall' }, { x: 15, y: 1.2, z: 0 }, 6)).toBeNull();
  });

  it('falls back further from the target than it stood, out of its sight', () => {
    const layout = pair();
    const me = { x: 6, y: 0, z: 0, room: 'hall' };
    const threat = { x: -6, y: 1.2, z: 0 };
    const at = fallbackFrom(layout, me, threat, { seesThrough: sees(layout) });
    expect(flat(at, threat)).toBeGreaterThan(flat(me, threat));
    expect(lineClear(layout, open, threat, chest(at))).toBe(false);
  });
});

describe('searching a section', () => {
  const sections = { s: 'Test', t: 'Other' };
  const twoSections = () =>
    buildLayout(
      station(
        [room('a', 0, 0, 10, 4), room('b', 10, 0, 10, 4), room('car', 16.5, 0, 3, 3, { kind: 'lift' }), room('c', -10, 0, 10, 4, { section: 't' })],
        [door('ab', 'a', 'b', 5, 0, 'z'), door('bl', 'b', 'car', 15, 0, 'z'), door('ca', 'c', 'a', -5, 0, 'z')],
        { desk: { room: 'a', x: 2, z: 1, yaw: 0 }, crate: { room: 'c', x: -12, z: 0, yaw: 0 } },
        sections,
      ),
    );

  it('looks in the section’s spots and the middle of each of its rooms, but not its lift cars', () => {
    const spots = sectionSpots(twoSections(), 's');
    expect(spots).toEqual([
      { x: 2, y: 0, z: 1, room: 'a' },
      { x: 0, y: 0, z: 0, room: 'a' },
      { x: 10, y: 0, z: 0, room: 'b' },
    ]);
  });

  it('runs one search a section, starting where the target was last placed', () => {
    const layout = twoSections();
    const fights = createFights({ rand: seeded(3), layout, nav: createNav(layout) });
    const s = searchOf(fights, 's');
    expect(searchOf(fights, 's')).toBe(s);
    expect(searchOf(fights, 't')).not.toBe(s);
    s.start({ at: { x: 9, y: 0, z: 1 } }, { aggressive: true });
    expect(s.claim('trooper-1', { x: 0, y: 0, z: 0 }).at).toEqual({ x: 9, y: 0, z: 1 });
    s.arrive('trooper-1');
    const next = s.claim('trooper-1', { x: 9, y: 0, z: 1 });
    expect([
      { x: 2, y: 0, z: 1 },
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 0, z: 0 },
    ]).toContainEqual(next.at);
  });

  it('shares out at most three shots at one target at a time', () => {
    const layout = pair();
    const fights = createFights({ rand: seeded(3), layout, nav: createNav(layout) });
    const got = ['t1', 't2', 't3', 't4'].map((id) => fights.tokens.claim('shot', id, { target: 'you' }));
    expect(got).toEqual([true, true, true, false]);
    expect(fights.tokens.claim('shot', 't4', { target: 'han' })).toBe(true);
  });
});

describe('a soldier’s step', () => {
  it('keeps the place an advance takes him to while the target drifts, and moves it once the target has moved off', () => {
    const layout = buildLayout(station([room('long', 0, 0, 50, 6)]));
    const fights = createFights({ rand: seeded(1), layout, nav: createNav(layout) });
    const me = { id: 'tk', x: -22, y: 0, z: 0, yaw: Math.PI / 2, room: 'long', hp: 60, max: 60, gun: 'e11' };
    const places = new Set();
    const bb = {
      clock: 0,
      go: (where) => (places.add(`${where.x.toFixed(2)},${where.z.toFixed(2)}`), 'running'),
      face() {},
      lock() {},
      pose() {},
      aimAt() {},
      fire() {},
      gunBusy: () => false,
      seesThrough: sees(layout),
      canPass: () => true,
      solidsOf: () => [],
      allies: () => [],
    };
    const threat = { id: 'you', at: { x: 8, y: 1.2, z: -2 }, visible: true, confidence: 1 };
    const f = { tactic: null, think: 0, place: null, burst: 0, next: 0, knownUntil: -Infinity };
    const run = (seconds) => {
      for (let k = 0; k < seconds * 30; k++) {
        bb.clock += 1 / 30;
        threat.at = { ...threat.at, z: threat.at.z + 1.5 / 30 };
        fightStep(fights, me, threat, bb, f, { unseen: 0, lostFor: 0 });
      }
    };
    run(1);
    expect(f.tactic).toBe('advance');
    expect(places.size).toBe(1);
    run(1.2);
    expect(places.size).toBe(2);
  });
});
