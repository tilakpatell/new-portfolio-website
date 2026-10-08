import { describe, expect, it } from 'vitest';
import { seeded } from '../../../../lib/seeded';
import { createAlarm, levelOf, lockdowns, raise, stepAlarm } from './alarm';
import { createCombat } from './combat';
import { clearDoorway, createDoors, passable, stepDoors } from './doors';
import { buildLayout, validateStation } from './layout';
import { createNav } from './nav';
import { DS1 } from './stations/ds1';
import { lineClear } from './walker';
import { addPerson, assign, createCrew, direct, removePerson, stepCrew } from './brains';

const STEP = 1 / 30;

// ── small stations ──

const room = (id, x, z, w, d, o = {}) => ({ id, kind: 'corridor', name: id, section: 's', x, z, w, d, y: 0, h: 3, ...o });
const door = (id, a, b, x, z, axis, o = {}) => ({ id, a, b, x, z, axis, w: 2, h: 2.4, kind: 'slide', ...o });
const station = (rooms, doors = [], spots = {}, sections = { s: 'Block S' }) => {
  const at = { room: rooms[0].id, x: rooms[0].x, z: rooms[0].z, yaw: 0 };
  return { id: 't', name: 'Test', era: 'anh', sections, rooms, doors, lifts: [], starts: { rebel: at, imperial: at }, spots };
};

// Three rooms in a row, west to east, two doors apart.
const row = () =>
  station(
    [room('west', -12, 0, 8, 4), room('mid', 0, 0, 16, 3.2), room('east', 12, 0, 8, 4)],
    [door('wm', 'west', 'mid', -8, 0, 'z'), door('me', 'mid', 'east', 8, 0, 'z')],
    { a: { room: 'west', x: -14, z: 0, yaw: Math.PI / 2 }, b: { room: 'east', x: 14, z: 0, yaw: -Math.PI / 2 } },
  );

// One bare hall, 30 by 20.
const hall = () => station([room('hall', 0, 0, 30, 20, { h: 4 })]);

// A cell block: a hall with an office north and a side room east, and a
// vault west in another section behind a hatch that never opens, where you
// go to ground.
const block = () =>
  station(
    [room('hall', 0, 0, 20, 10), room('office', 0, -9, 8, 8), room('side', 15, 0, 10, 10), room('vault', -15, 0, 10, 10, { section: 'v' })],
    [door('ho', 'hall', 'office', 0, -5, 'x'), door('hs', 'hall', 'side', 10, 0, 'z'), door('hv', 'hall', 'vault', -10, 0, 'z', { kind: 'hatch', lock: 'flag:never' })],
    {
      post1: { room: 'hall', x: 5, z: -2, yaw: -Math.PI / 2 },
      post2: { room: 'hall', x: 5, z: 0, yaw: -Math.PI / 2 },
      post3: { room: 'hall', x: 5, z: 2, yaw: -Math.PI / 2 },
      desk: { room: 'office', x: 2, z: -11, yaw: 0 },
      crate: { room: 'side', x: 17, z: 3, yaw: 0 },
    },
    { s: 'Block S', v: 'The vault' },
  );

const rebel = (x, z, o = {}) => ({ id: 'you', x, y: 0, z, r: 0.35, h: 1.8, side: 'rebel', armour: false, helmet: false, hp: 100, room: 'hall', ...o });

// ── the simulation ──

function world(s, { seed = 1, you = null } = {}) {
  const layout = buildLayout(s);
  const nav = createNav(layout);
  return { layout, nav, crew: createCrew({ rand: seeded(seed), layout, nav }), doors: createDoors(layout), alarm: createAlarm(s), combat: createCombat(), flags: new Set(), now: 0, you, log: [], stims: [] };
}

// Steps the world as the game will: doors for whoever is near them, the
// crew, the radio calls turned into the alarm, the alarm’s clocks. `each`
// sees every step with its events and the doors as they were.
function simulate(w, steps, { dt = STEP, each } = {}) {
  for (let k = 0; k < steps; k++) {
    w.now += dt;
    const bodies = w.crew.people.filter((p) => p.hp > 0);
    const near = [...bodies, ...(w.you ? [w.you] : [])].map((b) => ({ x: b.x, y: b.y, z: b.z, side: b.side, disguised: Boolean(b.armour && b.helmet) }));
    stepDoors(w.doors, w.layout, dt, { near, flags: w.flags, lockdown: lockdowns(w.alarm) });
    clearDoorway(w.doors, w.layout, bodies);
    const open = (id) => passable(w.doors, id);
    const events = stepCrew(w.crew, dt, { you: w.you, alarm: w.alarm, doors: w.doors, combat: w.combat, flags: w.flags, now: w.now, open, stims: w.stims.splice(0) });
    for (const e of events) {
      if (e.type === 'call') raise(w.alarm, e.section, e.how, e.at, w.now);
      w.log.push({ t: w.now, ...e });
    }
    stepAlarm(w.alarm, dt, w.now);
    each?.(w, events, open);
  }
  return w;
}

const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const of = (w, type) => w.log.filter((e) => e.type === type);

// Every step’s move, read at the knee, must not cross a wall that was shut
// then, and every body must stand in a room.
function walled(w) {
  const was = new Map();
  const faults = [];
  return (wd, events, open) => {
    for (const p of wd.crew.people) {
      const prev = was.get(p.id);
      const now = { x: p.x, y: p.y + 0.5, z: p.z };
      if (prev && !lineClear(wd.layout, open, prev, now)) faults.push(`${p.id} crossed a wall at ${now.x.toFixed(2)}, ${now.z.toFixed(2)} at ${wd.now.toFixed(2)} s`);
      if (wd.layout.roomAt(p.x, p.y + 0.1, p.z) === null) faults.push(`${p.id} stood in no room at ${p.x.toFixed(2)}, ${p.z.toFixed(2)}`);
      was.set(p.id, now);
    }
    w.faults = faults;
  };
}

describe('the crew’s minds', () => {
  it('builds the test stations sound, so a failure is the minds’ and not the map’s', () => {
    expect(validateStation(row())).toEqual([]);
    expect(validateStation(hall())).toEqual([]);
    expect(validateStation(block())).toEqual([]);
  });

  it('walks a patrol’s round through two doors and back', () => {
    const w = world(row());
    const p = addPerson(w.crew, { id: 'tk', kind: 'stormtrooper', room: 'west', x: -14, z: 0, yaw: Math.PI / 2, role: { type: 'patrol', spots: ['a', 'b'] } });
    const rooms = [p.room];
    let atB = false;
    let backAtA = false;
    simulate(w, 60 * 30, {
      each: () => {
        if (rooms.at(-1) !== p.room) rooms.push(p.room);
        if (flat(p, { x: 14, z: 0 }) < 0.5) atB = true;
        if (atB && flat(p, { x: -14, z: 0 }) < 0.5) backAtA = true;
      },
    });
    expect(rooms.slice(0, 5)).toEqual(['west', 'mid', 'east', 'mid', 'west']);
    expect(atB).toBe(true);
    expect(backAtA).toBe(true);
    expect(of(w, 'arrive').map((e) => e.spot)).toEqual(expect.arrayContaining(['a', 'b']));
  });

  it('sends a trooper who sees an undisguised Rebel at 10 m into a fight, with a shot token, and calls it in', () => {
    const w = world(hall(), { you: rebel(5, 0) });
    const p = addPerson(w.crew, { id: 'tk', kind: 'stormtrooper', room: 'hall', x: -5, z: 0, yaw: Math.PI / 2, role: { type: 'post' } });
    simulate(w, 60);
    expect(p.mode).toBe('fight');
    expect(of(w, 'saw')).toMatchObject([{ id: 'tk', target: 'you' }]);
    expect(of(w, 'call')[0]).toMatchObject({ id: 'tk', section: 's', how: 'seen' });
    expect(w.crew.fights.tokens.held('shot', 'tk', 'you')).toBe(true);
    expect(of(w, 'shoot').length).toBeGreaterThan(0);
    expect(of(w, 'shoot')[0]).toMatchObject({ owner: 'tk', weapon: 'e11', side: 'imperial' });
    expect(levelOf(w.alarm, 's')).toBe('alert');
    expect(of(w, 'say')[0]).toMatchObject({ id: 'tk', key: 'seen' });
  });

  it('shares the shooting: three troopers hold a shot token, the fourth waits', () => {
    const w = world(hall(), { you: rebel(5, 0) });
    const ids = ['tk1', 'tk2', 'tk3', 'tk4'];
    ids.forEach((id, i) => addPerson(w.crew, { id, kind: 'stormtrooper', room: 'hall', x: -5, z: -3 + 2 * i, yaw: Math.PI / 2, role: { type: 'post' } }));
    simulate(w, 60);
    const people = w.crew.people;
    expect(people.map((p) => p.mode)).toEqual(['fight', 'fight', 'fight', 'fight']);
    const holders = ids.filter((id) => w.crew.fights.tokens.held('shot', id, 'you'));
    expect(holders).toHaveLength(3);
    const waiting = ids.find((id) => !holders.includes(id));
    const shooters = new Set(of(w, 'shoot').map((e) => e.owner));
    expect(shooters.has(waiting)).toBe(false);
    expect(shooters.size).toBeGreaterThan(0);
    for (const s of shooters) expect(holders).toContain(s);
  });

  it('aims at where it believes you are, not through you', () => {
    const w = world(hall(), { you: rebel(5, 0) });
    addPerson(w.crew, { id: 'tk', kind: 'stormtrooper', room: 'hall', x: -5, z: 0, yaw: Math.PI / 2, role: { type: 'post' } });
    simulate(w, 60);
    const shot = of(w, 'shoot')[0];
    // straight down the hall towards you, a little up from the muzzle to your chest
    expect(shot.dir.x).toBeGreaterThan(0.99);
    expect(Math.hypot(shot.dir.x, shot.dir.y, shot.dir.z)).toBeCloseTo(1, 6);
  });

  it('searches the section when it loses you, and goes back to its routine once the alarm stands down', () => {
    const you = rebel(-5, 0);
    const w = world(block(), { you, seed: 4 });
    const squad = ['post1', 'post2', 'post3'].map((spot, i) => addPerson(w.crew, { id: `tk${i + 1}`, kind: 'stormtrooper', room: 'hall', ...w.layout.station.spots[spot], role: { type: 'post', spot }, squad: 'block' }));
    const searched = new Set();
    let early = null;
    let searching = false;
    simulate(w, 90 * 30, {
      each: (wd) => {
        // after a second and a half in sight, you go to ground behind the hatch
        if (wd.now > 1.5 && you.room === 'hall') Object.assign(you, { x: -15, z: 0, room: 'vault' });
        if (squad.every((p) => p.mode === 'search')) searching = true;
        for (const p of squad) if (p.mode === 'search') searched.add(p.room);
        const level = levelOf(wd.alarm, 's');
        if (wd.now > 5 && ['alert', 'lockdown', 'hunt'].includes(level) && squad.some((p) => p.mode === 'routine')) early ??= `${squad.find((p) => p.mode === 'routine').id} went back at ${wd.now.toFixed(1)} s with the section at ${level}`;
      },
    });
    expect(searching).toBe(true);
    expect(searched).toEqual(new Set(['hall', 'office', 'side']));
    expect(of(w, 'lost').length).toBeGreaterThan(0);
    expect(early).toBeNull();
    expect(levelOf(w.alarm, 's')).toBe('wary');
    expect(squad.map((p) => p.mode)).toEqual(['routine', 'routine', 'routine']);
  });

  it('walks nobody through a wall, on a small station or on the first Death Star', () => {
    const w = world(row(), { seed: 2 });
    addPerson(w.crew, { id: 'tk1', kind: 'stormtrooper', room: 'west', x: -14, z: 0, role: { type: 'patrol', spots: ['a', 'b'] } });
    addPerson(w.crew, { id: 'tk2', kind: 'stormtrooper', room: 'east', x: 14, z: 0, role: { type: 'patrol', spots: ['b', 'a'] } });
    addPerson(w.crew, { id: 'm1', kind: 'mouse', room: 'mid', x: 0, z: 0, role: { type: 'droid' } });
    addPerson(w.crew, { id: 'o1', kind: 'officer', room: 'west', x: -12, z: 1, role: { type: 'chat', with: 'o2' } });
    addPerson(w.crew, { id: 'o2', kind: 'officer', room: 'east', x: 12, z: -1, role: { type: 'chat', with: 'o1' } });
    simulate(w, 30 * 30, { each: walled(w) });
    expect(w.faults).toEqual([]);

    const ds = world(DS1, { seed: 3 });
    const spot = (name) => ({ room: DS1.spots[name].room, x: DS1.spots[name].x, z: DS1.spots[name].z, yaw: DS1.spots[name].yaw });
    addPerson(ds.crew, { id: 'p1', kind: 'stormtrooper', ...spot('ranks'), role: { type: 'patrol', spots: ['ranks', 'lift1'] } });
    addPerson(ds.crew, { id: 'p2', kind: 'technician', ...spot('scan-crew'), role: { type: 'work', spot: 'scomp327' } });
    addPerson(ds.crew, { id: 'p3', kind: 'stormtrooper', ...spot('aa23-desk'), role: { type: 'post', spot: 'aa23-guards' } });
    addPerson(ds.crew, { id: 'p4', kind: 'mouse', ...spot('cellbay-squad'), role: { type: 'droid' } });
    addPerson(ds.crew, { id: 'p5', kind: 'dstrooper', ...spot('falcon-ramp'), role: { type: 'march', spots: ['falcon-ramp', 'beacon'] } });
    addPerson(ds.crew, { id: 'p6', kind: 'vader', ...spot('vader-bay'), role: { type: 'scripted' } });
    simulate(ds, 20 * 30, { each: walled(ds) });
    expect(ds.faults).toEqual([]);
    expect(of(ds, 'arrive').length).toBeGreaterThan(0);
  });

  it('sends a mouse droid squealing away from a roar within 8 m, and leaves one further off be', () => {
    const w = world(hall(), { you: rebel(0, 0, { side: 'imperial' }) });
    const near = addPerson(w.crew, { id: 'm1', kind: 'mouse', room: 'hall', x: 3, z: 0, role: { type: 'droid' } });
    const far = addPerson(w.crew, { id: 'm2', kind: 'mouse', room: 'hall', x: -12, z: 0, role: { type: 'droid' } });
    w.stims.push({ type: 'roar', at: { x: 0, y: 0, z: 0 }, from: 'you' });
    simulate(w, 60);
    expect(of(w, 'fled')).toEqual([expect.objectContaining({ id: 'm1', kind: 'mouse', from: 'roar', sound: 'squeal' })]);
    expect(near.mode).toBe('flee');
    expect(flat(near, { x: 0, z: 0 })).toBeGreaterThan(6);
    expect(far.mode).toBe('routine');
  });

  it('asks for a disguise check while a trooper watches a Rebel in armour, and leaves him be', () => {
    const you = rebel(5, 0, { armour: true, helmet: true, doubt: 0 });
    const w = world(hall(), { you });
    const p = addPerson(w.crew, { id: 'tk', kind: 'stormtrooper', room: 'hall', x: -5, z: 0, yaw: Math.PI / 2, role: { type: 'post' } });
    simulate(w, 45);
    const asks = of(w, 'challenge');
    expect(asks.length).toBeGreaterThan(0);
    expect(asks.at(-1)).toMatchObject({ id: 'tk', watchers: 1, officerAt: null });
    expect(p.mode).not.toBe('fight');
    expect(of(w, 'shoot')).toEqual([]);
    // blown: the same trooper turns on him
    you.doubt = 1;
    simulate(w, 30);
    expect(p.mode).toBe('fight');
  });

  it('lets a trooper the game has shot dead fall, once, and hand back its token', () => {
    const w = world(hall(), { you: rebel(5, 0) });
    const p = addPerson(w.crew, { id: 'tk', kind: 'stormtrooper', room: 'hall', x: -5, z: 0, yaw: Math.PI / 2, role: { type: 'post' }, tag: 'guard' });
    simulate(w, 45);
    expect(w.crew.fights.tokens.held('shot', 'tk', 'you')).toBe(true);
    p.hp = 0;
    simulate(w, 30);
    expect(of(w, 'died')).toEqual([expect.objectContaining({ id: 'tk', kind: 'stormtrooper', tag: 'guard', room: 'hall' })]);
    expect(p.mode).toBe('dead');
    expect(p.anim).toBe('die');
    expect(w.crew.fights.tokens.held('shot', 'tk', 'you')).toBe(false);
  });

  it('keeps Vader where the story put him, whatever he sees', () => {
    const w = world(hall(), { you: rebel(3, 0) });
    const v = addPerson(w.crew, { id: 'vader', kind: 'vader', room: 'hall', x: -3, z: 0, yaw: Math.PI / 2 });
    simulate(w, 90);
    expect(v.mode).toBe('scripted');
    expect(flat(v, { x: -3, z: 0 })).toBeLessThan(1e-6);
    expect(of(w, 'shoot')).toEqual([]);
  });

  it('walks a scripted person where the story directs, and says it has arrived', () => {
    const w = world(row());
    const v = addPerson(w.crew, { id: 'vader', kind: 'vader', room: 'west', x: -12, z: 0 });
    direct(w.crew, 'vader', [{ to: 'b' }, { face: 'b' }, { anim: 'attention' }]);
    simulate(w, 25 * 30);
    expect(v.mode).toBe('scripted');
    expect(flat(v, { x: 14, z: 0 })).toBeLessThan(0.5);
    expect(of(w, 'arrive')).toEqual([expect.objectContaining({ id: 'vader', spot: 'b', room: 'east' })]);
    expect(v.anim).toBe('attention');
  });

  it('refuses a spot the station hasn’t got, so a story’s typo fails its test', () => {
    const w = world(row());
    expect(() => addPerson(w.crew, { id: 'tk', kind: 'stormtrooper', room: 'west', x: -12, z: 0, role: { type: 'patrol', spots: ['a', 'nowhere'] } })).toThrow(/nowhere/);
    expect(() => addPerson(w.crew, { id: 'x', kind: 'wookiee', room: 'west', x: -12, z: 0 })).toThrow(/wookiee/);
  });

  it('gives someone a new role: a guard told to follow keeps up with you', () => {
    const you = rebel(12, 0, { room: 'east', side: 'imperial' });
    const w = world(row(), { you });
    const tk = addPerson(w.crew, { id: 'tk', kind: 'stormtrooper', room: 'west', x: -14, z: 0, role: { type: 'post' } });
    assign(w.crew, 'tk', { type: 'follow', who: 'you' });
    simulate(w, 20 * 30);
    expect(tk.mode).toBe('routine');
    expect(flat(tk, you)).toBeLessThan(3.2);
  });

  it('takes someone off the station, handing back what they held', () => {
    const w = world(hall(), { you: rebel(5, 0) });
    addPerson(w.crew, { id: 'tk', kind: 'stormtrooper', room: 'hall', x: -5, z: 0, yaw: Math.PI / 2, role: { type: 'post' } });
    simulate(w, 45);
    expect(w.crew.fights.tokens.held('shot', 'tk', 'you')).toBe(true);
    expect(removePerson(w.crew, 'tk')).toBe(true);
    expect(w.crew.people).toEqual([]);
    expect(w.crew.fights.tokens.held('shot', 'tk', 'you')).toBe(false);
    expect(removePerson(w.crew, 'tk')).toBe(false);
  });
});
