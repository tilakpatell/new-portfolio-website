import { describe, expect, it } from 'vitest';
import { seeded } from '../../../../lib/seeded';
import { createAlarm, levelOf, lockdowns, raise, stepAlarm } from './alarm';
import { createCombat, fire, stepCombat } from './combat';
import { clearDoorway, createDoors, passable, stepDoors } from './doors';
import { buildLayout, validateStation } from './layout';
import { createNav } from './nav';
import { DS1 } from './stations/ds1';
import { lineClear } from './walker';
import { addPerson, assign, createCrew, direct, removePerson, stepCrew } from './brains';
import { perceptionOf } from './cast';

const STEP = 1 / 30;

// ── small stations ──

const room = (id, x, z, w, d, o = {}) => ({ id, kind: 'corridor', name: id, section: 's', x, z, w, d, y: 0, h: 3, ...o });
const door = (id, a, b, x, z, axis, o = {}) => ({ id, a, b, x, z, axis, w: 2, h: 2.4, kind: 'slide', ...o });
const station = (rooms, doors = [], spots = {}, sections = { s: 'Block S' }, lifts = []) => {
  const at = { room: rooms[0].id, x: rooms[0].x, z: rooms[0].z, yaw: 0 };
  return { id: 't', name: 'Test', era: 'anh', sections, rooms, doors, lifts, starts: { rebel: at, imperial: at }, spots };
};

// Three rooms in a row, west to east, two doors apart.
const row = () =>
  station([room('west', -12, 0, 8, 4), room('mid', 0, 0, 16, 3.2), room('east', 12, 0, 8, 4)], [door('wm', 'west', 'mid', -8, 0, 'z'), door('me', 'mid', 'east', 8, 0, 'z')], {
    a: { room: 'west', x: -14, z: 0, yaw: Math.PI / 2 },
    b: { room: 'east', x: 14, z: 0, yaw: -Math.PI / 2 },
  });

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

// The hall with an annex west of it through one door: cover from the hall.
const annexed = () => station([room('hall', 0, 0, 20, 10), room('annex', -15, 0, 10, 10)], [door('ha', 'hall', 'annex', -10, 0, 'z')]);

// Two corridors a level apart, a lift between their west ends.
const tower = () =>
  station(
    [room('up', 0, 0, 20, 4), room('car-up', -11.5, 0, 3, 3, { kind: 'lift' }), room('down', 0, 10, 20, 4, { y: -12 }), room('car-down', -11.5, 10, 3, 3, { kind: 'lift', y: -12 })],
    [door('u', 'up', 'car-up', -10, 0, 'z'), door('d', 'down', 'car-down', -10, 10, 'z')],
    { top: { room: 'up', x: 8, z: 0, yaw: 0 }, bottom: { room: 'down', x: 8, z: 10, yaw: 0 } },
    { s: 'Block S' },
    [{ id: 'lift', stops: ['car-up', 'car-down'] }],
  );

const rebel = (x, z, o = {}) => ({ id: 'you', x, y: 0, z, r: 0.35, h: 1.8, side: 'rebel', armour: false, helmet: false, hp: 100, room: 'hall', ...o });

// ── the simulation ──

function world(s, { seed = 1, you = null } = {}) {
  const layout = buildLayout(s);
  const nav = createNav(layout);
  return {
    layout,
    nav,
    crew: createCrew({ rand: seeded(seed), layout, nav }),
    doors: createDoors(layout),
    alarm: createAlarm(s),
    combat: createCombat(),
    flags: new Set(),
    now: 0,
    you,
    log: [],
    stims: [],
  };
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
    expect(validateStation(annexed())).toEqual([]);
    expect(validateStation(tower())).toEqual([]);
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
    const squad = ['post1', 'post2', 'post3'].map((spot, i) =>
      addPerson(w.crew, { id: `tk${i + 1}`, kind: 'stormtrooper', room: 'hall', ...w.layout.station.spots[spot], role: { type: 'post', spot }, squad: 'block' }),
    );
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
        if (wd.now > 5 && ['alert', 'lockdown', 'hunt'].includes(level) && squad.some((p) => p.mode === 'routine'))
          early ??= `${squad.find((p) => p.mode === 'routine').id} went back at ${wd.now.toFixed(1)} s with the section at ${level}`;
      },
    });
    expect(searching).toBe(true);
    expect(searched).toEqual(new Set(['hall', 'office', 'side']));
    expect(of(w, 'lost').length).toBeGreaterThan(0);
    expect(early).toBeNull();
    expect(levelOf(w.alarm, 's')).toBe('wary');
    expect(squad.map((p) => p.mode)).toEqual(['routine', 'routine', 'routine']);
  });

  it('stays stood down after a firefight: a shot heard in the fight isn’t called in again once the squad is back at its posts', () => {
    const you = rebel(-5, 0);
    const w = world(block(), { you, seed: 4 });
    const squad = ['post1', 'post2', 'post3'].map((spot, i) =>
      addPerson(w.crew, { id: `tk${i + 1}`, kind: 'stormtrooper', room: 'hall', ...w.layout.station.spots[spot], role: { type: 'post', spot }, squad: 'block' }),
    );
    const aim = seeded(9);
    const levels = [];
    simulate(w, 100 * 30, {
      each: (wd, events, open) => {
        // your bolts fly (and your gun's gap clears) as the game's would
        stepCombat(wd.combat, STEP, { layout: wd.layout, open, bodies: [] });
        // a second and a half shooting down the hall at them, then to ground behind the hatch
        if (wd.now <= 1.5) fire(wd.combat, { from: { x: you.x + 0.3, y: 1.3, z: you.z }, dir: { x: 1, y: 0, z: 0 }, owner: 'you', side: 'rebel', weapon: 'e11' }, aim);
        else if (you.room === 'hall') Object.assign(you, { x: -15, z: 0, room: 'vault' });
        const level = levelOf(wd.alarm, 's');
        if (levels.at(-1) !== level) levels.push(level);
      },
    });
    expect(of(w, 'call').some((e) => e.how === 'shots' && e.t <= 1.6)).toBe(true);
    const lastLost = Math.max(...of(w, 'lost').map((e) => e.t));
    expect(of(w, 'call').filter((e) => e.how === 'shots' && e.t > lastLost)).toEqual([]);
    expect(levels.slice(levels.indexOf('hunt'))).toEqual(['hunt', 'wary', 'calm']);
    expect(squad.map((p) => p.mode)).toEqual(['routine', 'routine', 'routine']);
  });

  it('walks nobody through a wall, on a small station or on the first Death Star', () => {
    const w = world(row(), { seed: 2 });
    addPerson(w.crew, { id: 'tk1', kind: 'stormtrooper', room: 'west', x: -14, z: 0, role: { type: 'patrol', spots: ['a', 'b'] } });
    addPerson(w.crew, { id: 'tk2', kind: 'stormtrooper', room: 'east', x: 14, z: 0, role: { type: 'patrol', spots: ['b', 'a'] } });
    addPerson(w.crew, { id: 'm1', kind: 'mouse', room: 'mid', x: 0, z: 0, role: { type: 'droid' } });
    addPerson(w.crew, { id: 'o1', kind: 'officer', room: 'west', x: -12, z: 1, role: { type: 'chat', with: 'o2' } });
    addPerson(w.crew, { id: 'o2', kind: 'officer', room: 'east', x: 12, z: -1, role: { type: 'chat', with: 'o1' } });
    // long enough for each patrol’s third leg, the first again, walked on the way it remembers
    simulate(w, 75 * 30, { each: walled(w) });
    expect(w.faults).toEqual([]);
    for (const id of ['tk1', 'tk2']) expect(of(w, 'arrive').filter((e) => e.id === id).length).toBeGreaterThanOrEqual(3);

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

  it('asks for no disguise check when there is no disguise: an Imperial is simply one of them', () => {
    const w = world(hall(), { you: rebel(5, 0, { side: 'imperial', armour: true, helmet: true }) });
    addPerson(w.crew, { id: 'tk', kind: 'stormtrooper', room: 'hall', x: -5, z: 0, yaw: Math.PI / 2, role: { type: 'post' } });
    simulate(w, 45);
    expect(of(w, 'challenge')).toEqual([]);
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

  it('takes a furnished spot (one that names its room) as a role’s place, and says when it gets there', () => {
    const w = world(row());
    const desk = { name: 'east/work1', kind: 'work', room: 'east', x: 13, y: 0, z: 1, yaw: Math.PI / 2 };
    const p = addPerson(w.crew, { id: 'tech', kind: 'technician', room: 'west', x: -12, z: 0, role: { type: 'work', spot: desk } });
    simulate(w, 20 * 30);
    expect(of(w, 'arrive')).toEqual([expect.objectContaining({ id: 'tech', spot: 'east/work1', room: 'east' })]);
    expect(p.anim === 'work' || p.anim === 'idle').toBe(true);
    expect(Math.abs(p.yaw - Math.PI / 2)).toBeLessThan(0.05);
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

  it('sends a trooper with no shot to take into cover through the next door, and keeps him there while his friends keep you in sight', () => {
    const you = rebel(5, 0);
    const w = world(annexed(), { you });
    const ids = ['tk1', 'tk2', 'tk3', 'tk4'];
    ids.forEach((id, i) => addPerson(w.crew, { id, kind: 'stormtrooper', room: 'hall', x: -5, z: -3 + 2 * i, yaw: Math.PI / 2, role: { type: 'post' } }));
    simulate(w, 5 * 30);
    const holders = ids.filter((id) => w.crew.fights.tokens.held('shot', id, 'you'));
    expect(holders).toHaveLength(3);
    const waiting = w.crew.byId.get(ids.find((id) => !holders.includes(id)));
    expect(waiting.mode).toBe('fight');
    expect(waiting.room).toBe('annex');
    const open = (id) => passable(w.doors, id);
    expect(lineClear(w.layout, open, { x: you.x, y: 1.2, z: you.z }, { x: waiting.x, y: waiting.y + 1.2, z: waiting.z })).toBe(false);
  });

  it('keeps a trooper in cover in the fight on his friends’ word, at the place they see you, long after he last saw you himself', () => {
    const you = rebel(5, 0);
    const w = world(annexed(), { you });
    ['tk1', 'tk2', 'tk3', 'tk4'].forEach((id, i) => addPerson(w.crew, { id, kind: 'stormtrooper', room: 'hall', x: -5, z: -3 + 2 * i, yaw: Math.PI / 2, role: { type: 'post' } }));
    simulate(w, 5 * 30);
    const waiting = w.crew.people.find((p) => !w.crew.fights.tokens.held('shot', p.id, 'you'));
    expect(waiting.room).toBe('annex');
    // you move across the hall while his friends keep you in sight; he hasn’t seen you for longer than a belief lasts unseen
    Object.assign(you, { x: 7, z: 3 });
    const modes = new Set();
    const rooms = new Set();
    simulate(w, 12 * 30, { each: () => modes.add(waiting.mode) && rooms.add(waiting.room) });
    expect(modes).toEqual(new Set(['fight']));
    expect(rooms).toEqual(new Set(['annex']));
    const told = waiting.mind.eye.beliefs.you;
    expect(told.visible).toBe(false);
    expect(flat(told.at, you)).toBeLessThan(0.5);
    expect(of(w, 'lost')).toEqual([]);
  });

  it('counts you lost to a trooper in cover only from when his friends lost you, not from when he last saw you', () => {
    const you = rebel(-5, 0);
    const w = world(block(), { you, seed: 4 });
    ['tk1', 'tk2', 'tk3', 'tk4'].forEach((id, i) => addPerson(w.crew, { id, kind: 'stormtrooper', room: 'hall', x: 5, z: -3 + 2 * i, yaw: -Math.PI / 2, role: { type: 'post' } }));
    simulate(w, 8 * 30);
    const waiting = w.crew.people.find((p) => !w.crew.fights.tokens.held('shot', p.id, 'you'));
    expect(waiting.mode).toBe('fight');
    expect(waiting.mind.eye.now - waiting.mind.eye.beliefs.you.seenAt).toBeGreaterThan(3);
    // to ground behind the hatch: nobody sees you from now on
    Object.assign(you, { x: -15, z: 0, room: 'vault' });
    const gone = w.now;
    simulate(w, 10 * 30);
    const lost = of(w, 'lost');
    expect(lost.map((e) => e.id).sort()).toEqual(['tk1', 'tk2', 'tk3', 'tk4']);
    expect(Math.min(...lost.map((e) => e.t)) - gone).toBeGreaterThan(2);
  });

  it('knocks a trooper down with a hard hit; he gets up, turns to where it came from and fights', () => {
    const w = world(hall(), { you: rebel(5, 0) });
    const p = addPerson(w.crew, { id: 'tk', kind: 'stormtrooper', room: 'hall', x: -5, z: 0, yaw: -Math.PI / 2, role: { type: 'post' } });
    simulate(w, 5);
    p.hp -= 30;
    simulate(w, 6);
    expect(p.mode).toBe('down');
    expect(p.anim).toBe('hit');
    simulate(w, 24);
    expect(p.anim).toBe('kneel');
    simulate(w, 4 * 30);
    expect(p.mode).toBe('fight');
  });

  it('only staggers a trooper with a lesser hit', () => {
    const w = world(hall(), { you: rebel(5, 0) });
    const p = addPerson(w.crew, { id: 'tk', kind: 'stormtrooper', room: 'hall', x: -5, z: 0, yaw: -Math.PI / 2, role: { type: 'post' } });
    simulate(w, 5);
    p.hp -= 10;
    simulate(w, 3);
    expect(p.anim).toBe('hit');
    expect(p.mode).not.toBe('down');
  });

  it('calls in a shot it hears and goes to look, out of sight of whoever fired it', () => {
    // you fire in the office, behind its shut door; the trooper stands in the side room facing away
    const you = rebel(0, -9, { room: 'office' });
    const w = world(block(), { you });
    const p = addPerson(w.crew, { id: 'tk', kind: 'stormtrooper', room: 'side', x: 12, z: 3, yaw: Math.PI / 2, role: { type: 'post' } });
    fire(w.combat, { from: { x: 0.3, y: 1.3, z: -9 }, dir: { x: 1, y: 0, z: 0 }, owner: 'you', side: 'rebel', weapon: 'e11' }, seeded(1));
    simulate(w, 3 * 30);
    expect(of(w, 'call')[0]).toMatchObject({ id: 'tk', how: 'shots', section: 's' });
    expect(p.mode).toBe('wary');
    expect(flat(p, you)).toBeLessThan(flat({ x: 12, z: 3 }, you) - 2);
  });

  it('turns round at running steps close behind, and leaves quiet ones be', () => {
    const run = (steps) => {
      const you = rebel(0, 0);
      const w = world(hall(), { you });
      const p = addPerson(w.crew, { id: 'tk', kind: 'stormtrooper', room: 'hall', x: -3, z: 0, yaw: -Math.PI / 2, role: { type: 'post' } });
      for (let k = 0; k < 60; k++) {
        if (steps) w.stims.push({ type: 'steps', at: { x: 0, y: 0, z: 0 }, from: 'you' });
        simulate(w, 1);
      }
      return p.mode;
    };
    expect(run(true)).toBe('fight');
    expect(run(false)).toBe('routine');
  });

  it('sees as far as the cast says: an officer makes you out at 24 m, a trooper doesn’t', () => {
    expect(perceptionOf('stormtrooper').sight).toBeLessThan(24);
    expect(perceptionOf('officer').sight).toBeGreaterThan(24);
    const at24 = (kind) => {
      const w = world(hall(), { you: rebel(12, 0) });
      const p = addPerson(w.crew, { id: 'p', kind, room: 'hall', x: -12, z: 0, yaw: Math.PI / 2, role: { type: 'post' } });
      simulate(w, 3 * 30);
      return p.mode;
    };
    expect(at24('officer')).toBe('fight');
    expect(at24('stormtrooper')).toBe('routine');
  });

  it('hears running steps as far as the cast says, and no further', () => {
    const { steps } = perceptionOf('stormtrooper');
    const behind = (metres) => {
      const you = rebel(-3 + metres, 0);
      const w = world(hall(), { you });
      const p = addPerson(w.crew, { id: 'tk', kind: 'stormtrooper', room: 'hall', x: -3, z: 0, yaw: -Math.PI / 2, role: { type: 'post' } });
      for (let k = 0; k < 30; k++) {
        w.stims.push({ type: 'steps', at: { x: you.x, y: 0, z: you.z }, from: 'you' });
        simulate(w, 1);
      }
      return p.mode;
    };
    expect(behind(steps - 0.5)).not.toBe('routine');
    expect(behind(steps + 0.5)).toBe('routine');
  });

  it('calls in a fallen comrade once, and goes to him', () => {
    const w = world(hall());
    const dead = addPerson(w.crew, { id: 'tk1', kind: 'stormtrooper', room: 'hall', x: 2, z: 3, role: { type: 'post' } });
    const p = addPerson(w.crew, { id: 'tk2', kind: 'stormtrooper', room: 'hall', x: -8, z: 3, yaw: Math.PI / 2, role: { type: 'post' } });
    dead.hp = 0;
    simulate(w, 8 * 30);
    expect(of(w, 'call').filter((e) => e.how === 'body')).toEqual([expect.objectContaining({ id: 'tk2', section: 's' })]);
    expect(p.mode).toBe('wary');
    expect(flat(p, dead)).toBeLessThan(1);
  });

  it('stands a guard down under the mind trick: he says its line and lets you be until it wears off', () => {
    const w = world(hall(), { you: rebel(3, 0) });
    const p = addPerson(w.crew, { id: 'tk', kind: 'stormtrooper', room: 'hall', x: -3, z: 0, yaw: Math.PI / 2, role: { type: 'post' } });
    simulate(w, 30);
    expect(p.mode).toBe('fight');
    w.stims.push({ type: 'trick', id: 'tk', s: 8, line: 'You can go about your business.' });
    const before = of(w, 'shoot').length;
    simulate(w, 7 * 30);
    expect(of(w, 'say').at(-1)).toMatchObject({ id: 'tk', key: 'trick', text: 'You can go about your business.' });
    expect(p.mode).toBe('routine');
    expect(of(w, 'shoot').length).toBe(before);
    simulate(w, 3 * 30);
    expect(p.mode).toBe('fight');
  });

  it('draws a guard off his post to a noise, and back to it when he finds nothing', () => {
    const w = world(block());
    const p = addPerson(w.crew, { id: 'tk', kind: 'stormtrooper', room: 'hall', x: 5, z: 0, yaw: -Math.PI / 2, role: { type: 'post', spot: 'post2' } });
    w.stims.push({ type: 'noise', at: { x: 15, y: 0, z: 2 }, heard: ['tk'] });
    simulate(w, 8 * 30);
    expect(p.mode).toBe('wary');
    expect(p.room).toBe('side');
    simulate(w, 25 * 30);
    expect(p.mode).toBe('routine');
    expect(flat(p, { x: 5, z: 0 })).toBeLessThan(0.5);
  });

  it('sends an unarmed technician running from a Rebel, calling it in', () => {
    const you = rebel(5, 0);
    const w = world(annexed(), { you });
    const p = addPerson(w.crew, { id: 'tech', kind: 'technician', room: 'hall', x: -3, z: 0, yaw: Math.PI / 2, role: { type: 'post' } });
    simulate(w, 3 * 30);
    expect(of(w, 'fled')).toEqual([expect.objectContaining({ id: 'tech', kind: 'technician', from: 'fight' })]);
    expect(of(w, 'call')[0]).toMatchObject({ id: 'tech', how: 'seen' });
    expect(p.mode).toBe('flee');
    expect(flat(p, you)).toBeGreaterThan(8);
  });

  it('calls a squad to the trouble on an alert, and out to search the section on the hunt', () => {
    const w = world(block());
    const p = addPerson(w.crew, { id: 'tk', kind: 'stormtrooper', room: 'office', x: 2, z: -11, role: { type: 'post', spot: 'desk' } });
    raise(w.alarm, 's', 'seen', { x: -5, y: 1.2, z: 0 }, 0);
    simulate(w, 3 * 30);
    expect(p.mode).toBe('wary');
    expect(p.room).toBe('hall');
    // ten seconds after the lockdown with nobody seen, the hunt
    simulate(w, 14 * 30);
    expect(levelOf(w.alarm, 's')).toBe('hunt');
    expect(p.mode).toBe('search');
  });

  it('rides a lift to a spot on another level', () => {
    const w = world(tower());
    const p = addPerson(w.crew, { id: 'tk', kind: 'stormtrooper', room: 'up', x: 8, z: 0, role: { type: 'patrol', spots: ['top', 'bottom'] } });
    let below = null;
    simulate(w, 40 * 30, { each: (wd, events) => events.some((e) => e.type === 'arrive' && e.spot === 'bottom') && (below ??= { y: p.y, room: p.room }) });
    expect(below).toEqual({ y: -12, room: 'down' });
  });

  it('ends its own ride without moving again when the game’s lift has already carried it down', () => {
    const w = world(tower());
    const p = addPerson(w.crew, { id: 'tk', kind: 'stormtrooper', room: 'up', x: 8, z: 0, role: { type: 'patrol', spots: ['top', 'bottom'] } });
    let carried = false;
    simulate(w, 40 * 30, {
      each: () => {
        // you ride the same car: game.js moves everyone wholly inside it by the offset between the cars
        if (!carried && p.mind.legs.ride) {
          carried = true;
          Object.assign(p, { y: p.y - 12, z: p.z + 10, room: 'car-down' });
        }
      },
    });
    expect(carried).toBe(true);
    expect(p.y).toBe(-12);
    expect(['down', 'car-down']).toContain(p.room);
  });

  it('brings two who chat together to talk', () => {
    const w = world(row());
    const a = addPerson(w.crew, { id: 'o1', kind: 'officer', room: 'west', x: -12, z: 0, role: { type: 'chat', with: 'o2' } });
    const b = addPerson(w.crew, { id: 'o2', kind: 'officer', room: 'east', x: 12, z: 0, role: { type: 'chat', with: 'o1' } });
    const talked = new Set();
    simulate(w, 20 * 30, { each: () => [a, b].filter((p) => p.anim === 'talk').forEach((p) => talked.add(p.id)) });
    expect(flat(a, b)).toBeLessThan(2.4);
    expect(talked).toEqual(new Set(['o1', 'o2']));
  });

  it('works out at most two new ways a step, so a squad setting off at once doesn’t stall the station', () => {
    const w = world(row());
    // each from a metre cell of his own, so none can take a way another worked out
    const people = [0, 1, 2, 3, 4].map((i) => addPerson(w.crew, { id: `tk${i}`, kind: 'stormtrooper', room: 'west', x: -15.5 + i * 1.1, z: 1, role: { type: 'march', spots: ['b', 'a'] } }));
    const started = [];
    simulate(w, 4, { each: () => started.push(people.filter((p) => p.mind.legs.nav.path).length) });
    expect(started).toEqual([2, 4, 5, 5]);
  });

  it('walks no way worked out with a floor that has since been drawn back: everyone works his out again, and a newcomer doesn’t get the old one', () => {
    // a chasm across the middle of a room, its bridge a floor tagged `bridge`, there only while the flag is set
    const gap = room('gap', 0, 0, 12, 4, { floors: [{ x: -5, z: 0, w: 2, d: 4, y: 0 }, { x: 0, z: 0, w: 8, d: 1.6, y: 0, tag: 'bridge' }, { x: 5, z: 0, w: 2, d: 4, y: 0 }] });
    const w = world(station([gap], [], { a: { room: 'gap', x: -5, z: 0, yaw: 0 }, b: { room: 'gap', x: 5, z: 0, yaw: 0 } }));
    w.flags = new Set(['bridge']);
    const march = (id, x, z) => addPerson(w.crew, { id, kind: 'stormtrooper', room: 'gap', x, z, role: { type: 'march', spots: ['b', 'a'] } });
    const tk1 = march('tk1', -5.6, 0.3);
    simulate(w, 1);
    expect(w.crew.routes).toBe(1);
    const tk2 = march('tk2', -5.1, 0.7);
    simulate(w, 1);
    // from the same metre cell: tk1’s way, remembered
    expect(w.crew.routes).toBe(0);
    const routed = () => [tk1, tk2].map((p) => p.mind.legs.nav.routedAt === w.now);
    expect(routed()).toEqual([false, true]);
    // the bridge drawn back: each works his way out again, and finds there is none across the void
    w.flags = new Set();
    simulate(w, 1);
    expect(w.crew.routes).toBe(2);
    expect([tk1, tk2].map((p) => p.mind.legs.nav.path)).toEqual([null, null]);
    const tk3 = march('tk3', -5.3, 0.5);
    w.flags = new Set(['bridge']);
    simulate(w, 1);
    // the bridge run out again: the newcomer takes the first way, remembered while it was, at no cost,
    // and the two who found none take it up once they try again
    expect(w.crew.routes).toBe(0);
    expect(tk3.mind.legs.nav.routedAt).toBe(w.now);
    simulate(w, 4 * 30);
    expect([tk1, tk2, tk3].every((p) => p.mind.legs.nav.path || p.x > 2)).toBe(true);
  });

  it('sets a squad off together from where they stand: a way one of them worked out is remembered, and costs the rest nothing', () => {
    const w = world(row());
    const people = [0, 1, 2, 3, 4].map((i) =>
      addPerson(w.crew, { id: `tk${i}`, kind: 'stormtrooper', room: 'west', x: -14.9 + (i % 3) * 0.4, z: 1.1 + Math.floor(i / 3) * 0.5, role: { type: 'march', spots: ['b', 'a'] } }),
    );
    const started = [];
    simulate(w, 2, { each: () => started.push(people.filter((p) => p.mind.legs.nav.path).length) });
    expect(started).toEqual([5, 5]);
  });
});

describe('people the game lets sleep', () => {
  it('neither walk their round nor see you while asleep, and take up where they were when woken', () => {
    const w = world(row(), { you: rebel(-2, 0, { room: 'mid' }) });
    const p = addPerson(w.crew, { id: 'p', kind: 'stormtrooper', room: 'west', x: -14, z: 0, role: { type: 'patrol', spots: ['a', 'b'] } });
    const at = { x: p.x, z: p.z };
    for (let k = 0; k < 90; k++) {
      w.now += STEP;
      const events = stepCrew(w.crew, STEP, { you: w.you, alarm: w.alarm, doors: w.doors, combat: w.combat, flags: w.flags, now: w.now, open: () => true, awake: () => false });
      expect(events.filter((e) => e.type === 'saw')).toEqual([]);
    }
    expect(p.x).toBe(at.x);
    expect(p.z).toBe(at.z);
    expect(p.mode).toBe('routine');
    // (a patrol stands a while at each spot of its round before walking on)
    for (let k = 0; k < 20 * 30; k++) {
      w.now += STEP;
      stepCrew(w.crew, STEP, { you: null, alarm: w.alarm, doors: w.doors, combat: w.combat, flags: w.flags, now: w.now, open: () => true, awake: () => true });
    }
    expect(Math.hypot(p.x - at.x, p.z - at.z)).toBeGreaterThan(1);
  });
});

describe('people lying low', () => {
  it('are not seen or fought by the other side while hidden', () => {
    const w = world(hall());
    const t = addPerson(w.crew, { id: 't', kind: 'stormtrooper', room: 'hall', x: 0, z: 0, yaw: Math.PI / 2, role: { type: 'post' } });
    const h = addPerson(w.crew, { id: 'h', kind: 'han', room: 'hall', x: 6, z: 0, yaw: -Math.PI / 2, role: { type: 'post' } });
    h.hidden = true;
    simulate(w, 90);
    expect(of(w, 'saw').filter((e) => e.target === 'h')).toEqual([]);
    expect(t.mode).toBe('routine');
  });
});

describe('who barks', () => {
  it('leaves the garrison’s barks to the garrison: a Rebel who sees a trooper or runs from him says none of them', () => {
    const w = world(hall());
    addPerson(w.crew, { id: 'tk', kind: 'stormtrooper', room: 'hall', x: 8, z: 0, yaw: -Math.PI / 2, role: { type: 'post', spot: { room: 'hall', x: 8, z: 0, yaw: -Math.PI / 2 } } });
    // Han armed, who fights; Chewbacca with nothing in his hands, who runs
    addPerson(w.crew, { id: 'han', kind: 'han', room: 'hall', x: -2, z: 0, yaw: Math.PI / 2, role: { type: 'post', spot: { room: 'hall', x: -2, z: 0, yaw: Math.PI / 2 } } });
    addPerson(w.crew, { id: 'chewie', kind: 'chewie', room: 'hall', x: -2, z: 2, yaw: Math.PI / 2, role: { type: 'post', spot: { room: 'hall', x: -2, z: 2, yaw: Math.PI / 2 } } });
    simulate(w, 120);
    const fought = w.log.some((e) => (e.type === 'saw' && e.id === 'han') || (e.type === 'fled' && e.id === 'chewie'));
    expect(fought).toBe(true);
    expect(w.log.filter((e) => e.type === 'say' && (e.id === 'han' || e.id === 'chewie'))).toEqual([]);
    // (and the trooper still calls it)
    expect(w.log.some((e) => e.type === 'say' && e.id === 'tk')).toBe(true);
  });
});
