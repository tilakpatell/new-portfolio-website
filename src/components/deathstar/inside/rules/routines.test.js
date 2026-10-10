import { beforeEach, describe, expect, it, vi } from 'vitest';
import { seeded } from '../../../../lib/seeded';
import { FAILED, RUNNING } from '../../../../lib/ai/tree';
import { buildLayout } from './layout';
import { createNav, route } from './nav';
import { DS1 } from './stations/ds1';
import { rememberedWay, ROLES, resetRoutine, routineFor, runRoutine, wayBetween } from './routines';

// nav.route as it is, counted, so a test can tell a way remembered from one worked out anew
vi.mock('./nav', async (real) => {
  const nav = await real();
  return { ...nav, route: vi.fn((...args) => nav.route(...args)) };
});

// A stand-in for the body a routine drives: `go` takes `legs` ticks to get
// anywhere, and everything asked of it is written down in order.
function fakeBody({ legs = 2, near = () => false, rand = seeded(7) } = {}) {
  const log = [];
  let walking = null;
  const bb = {
    clock: 0,
    rand,
    timers: {},
    pose: (anim) => {
      bb.anim = anim;
    },
    face: (target) => log.push(['face', target]),
    say: (key, text) => log.push(['say', key, text]),
    near: (who, m) => near(who, m),
    go: (where, opts) => {
      const key = JSON.stringify(where);
      if (walking?.key !== key) {
        walking = { key, left: legs };
        log.push(['go', where, opts ?? null]);
      }
      bb.anim = 'walk';
      if (--walking.left > 0) return 'running';
      walking = null;
      return 'done';
    },
  };
  return { bb, log };
}

// Ticks a routine for `seconds` at `dt`, keeping the blackboard’s clock;
// stops at a failure, as the brain does, since the next tick starts over.
function run(node, bb, seconds, dt = 0.1) {
  let status = null;
  for (let t = 0; t < seconds && status !== FAILED; t += dt) {
    bb.clock += dt;
    status = runRoutine(node, bb, dt);
  }
  return status;
}

const goes = (log) => log.filter(([what]) => what === 'go').map(([, where]) => where);

describe('routines', () => {
  it('knows every role the brief names', () => {
    expect(ROLES).toEqual(expect.arrayContaining(['patrol', 'post', 'work', 'chat', 'march', 'droid', 'scripted']));
  });

  it('refuses a role it doesn’t know, so a typo in a story fails its test', () => {
    expect(() => routineFor({ type: 'dance' })).toThrow(/dance/);
  });

  it('walks a patrol’s round in order and round again, pausing at each spot', () => {
    const { bb, log } = fakeBody();
    const node = routineFor({ type: 'patrol', spots: ['a', 'b', 'c'] });
    run(node, bb, 40);
    expect(goes(log).slice(0, 7)).toEqual(['a', 'b', 'c', 'a', 'b', 'c', 'a']);
    // between arriving and leaving it stood: the pose was idle at some point
    expect(log.some(([what, target]) => what === 'face' && target === 'b')).toBe(true);
  });

  it('stands a pause of at least two seconds at each patrol spot', () => {
    const { bb, log } = fakeBody({ legs: 1 });
    const node = routineFor({ type: 'patrol', spots: ['a', 'b'] });
    const times = [];
    let seen = 0;
    for (let t = 0; t < 30; t += 0.1) {
      bb.clock += 0.1;
      runRoutine(node, bb, 0.1);
      const n = goes(log).length;
      if (n > seen) times.push(bb.clock);
      seen = n;
    }
    for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(2);
  });

  it('goes to its post once, then stands to attention there, glancing about', () => {
    const { bb, log } = fakeBody();
    const node = routineFor({ type: 'post', spot: 'door' });
    run(node, bb, 30);
    expect(goes(log)).toEqual(['door']);
    expect(bb.anim).toBe('attention');
    const faces = log.filter(([what]) => what === 'face').map(([, target]) => target);
    expect(faces[0]).toBe('door');
    expect(faces.some((f) => typeof f === 'object' && f.spot === 'door' && f.turn !== 0)).toBe(true);
  });

  it('works at its console, with a breather now and then', () => {
    const { bb } = fakeBody();
    const node = routineFor({ type: 'work', spot: 'console' });
    const poses = new Set();
    for (let t = 0; t < 40; t += 0.1) {
      bb.clock += 0.1;
      runRoutine(node, bb, 0.1);
      poses.add(bb.anim);
    }
    expect(poses).toContain('work');
    expect(poses).toContain('idle');
  });

  it('walks over to whoever it chats with, then faces them and talks', () => {
    let close = false;
    const { bb, log } = fakeBody({ near: () => close });
    const node = routineFor({ type: 'chat', with: 'officer-2' });
    run(node, bb, 0.5);
    expect(goes(log)[0]).toEqual({ who: 'officer-2' });
    close = true;
    const poses = new Set();
    for (let t = 0; t < 10; t += 0.1) {
      bb.clock += 0.1;
      runRoutine(node, bb, 0.1);
      poses.add(bb.anim);
    }
    expect(poses).toContain('talk');
    expect(log.some(([what, target]) => what === 'face' && target?.who === 'officer-2')).toBe(true);
  });

  it('marches its spots without a pause', () => {
    const { bb, log } = fakeBody({ legs: 3 });
    const node = routineFor({ type: 'march', spots: ['a', 'b'] });
    const poses = new Set();
    for (let t = 0; t < 2.4; t += 0.1) {
      bb.clock += 0.1;
      runRoutine(node, bb, 0.1);
      poses.add(bb.anim);
    }
    expect(goes(log).slice(0, 6)).toEqual(['a', 'b', 'a', 'b', 'a', 'b']);
    expect([...poses]).toEqual(['walk']);
  });

  it('sends a droid off to wander, room to room, with short stops', () => {
    const { bb, log } = fakeBody();
    const node = routineFor({ type: 'droid' });
    run(node, bb, 20);
    const ways = goes(log);
    expect(ways.length).toBeGreaterThan(3);
    expect(ways.every((w) => w.wander === true)).toBe(true);
  });

  it('keeps up with whoever it follows and waits when close', () => {
    let close = false;
    const { bb, log } = fakeBody({ near: () => close });
    const node = routineFor({ type: 'follow', who: 'you' });
    run(node, bb, 0.3);
    expect(goes(log)[0]).toEqual({ who: 'you' });
    close = true;
    const before = goes(log).length;
    run(node, bb, 3);
    expect(goes(log).length).toBe(before);
    expect(bb.anim).toBe('idle');
  });

  it('plays a script once, step by step, and then stands as it was left', () => {
    const { bb, log } = fakeBody({ legs: 2 });
    const node = routineFor({ type: 'scripted' }, [
      { to: 'dais' },
      { face: 'window' },
      { say: 'Everything is proceeding as I have foreseen.', key: 'foreseen' },
      { anim: 'kneel', s: 1 },
      { wait: 1 },
      { anim: 'attention' },
    ]);
    const status = run(node, bb, 6);
    expect(status).toBe(RUNNING);
    expect(log.map(([what]) => what)).toEqual(['go', 'face', 'say']);
    expect(log[2]).toEqual(['say', 'foreseen', 'Everything is proceeding as I have foreseen.']);
    expect(bb.anim).toBe('attention');
  });

  it('holds a kneel for as long as the script says before going on', () => {
    const { bb } = fakeBody();
    const node = routineFor({ type: 'scripted' }, [{ anim: 'kneel', s: 2 }, { anim: 'idle' }]);
    run(node, bb, 1);
    expect(bb.anim).toBe('kneel');
    run(node, bb, 1.5);
    expect(bb.anim).toBe('idle');
  });

  it('stands still when it has no script at all', () => {
    const { bb, log } = fakeBody();
    const node = routineFor({ type: 'scripted' });
    run(node, bb, 3);
    expect(log).toEqual([]);
    expect(bb.anim).toBe('idle');
  });

  it('fails when the way to a spot is gone, and starts its round afresh once reset', () => {
    const { bb, log } = fakeBody({ legs: 1 });
    const go = bb.go;
    // the way to b is cut once the patrol has stood its time at a
    bb.go = (where, opts) => (where === 'b' ? 'failed' : go(where, opts));
    const node = routineFor({ type: 'patrol', spots: ['a', 'b'] });
    expect(run(node, bb, 8)).toBe(FAILED);
    bb.go = go;
    resetRoutine(node, bb);
    run(node, bb, 0.2);
    expect(goes(log)).toEqual(['a', 'a']);
  });
});

// ── the ways remembered ──

const room = (id, x, z, w, d) => ({ id, kind: 'corridor', name: id, section: 's', x, z, w, d, y: 0, h: 3 });
const door = (id, a, b, x, z, axis) => ({ id, a, b, x, z, axis, w: 2, h: 2.4, kind: 'slide' });
const station = (rooms, doors = []) => {
  const at = { room: rooms[0].id, x: rooms[0].x, z: rooms[0].z, yaw: 0 };
  return { id: 't', name: 'Test', era: 'anh', sections: { s: 'Test' }, rooms, doors, lifts: [], starts: { rebel: at, imperial: at }, spots: {} };
};

// A hall (x −10…10, z −5…5) with a crate in its middle, and a panel from
// its west wall to x 0.5 along z 0.5, splitting the metre cells on that line.
const CRATE = { box: { x0: -1, x1: 1, z0: -3, z1: -1.5, y0: 0, y1: 1.2 } };
const PANEL = { box: { x0: -10, x1: 0.5, z0: 0.45, z1: 0.55, y0: 0, y1: 2.4 } };
const hall = () => {
  const nav = createNav(buildLayout(station([room('hall', 0, 0, 20, 10)])));
  return { nav, solidsOf: (id) => (id === 'hall' ? [CRATE, PANEL] : []) };
};

// The hall again, with a west room joined to it two ways: straight through
// door A, or round by the north corridor (doors B and C).
const loop = () =>
  createNav(
    buildLayout(
      station(
        [room('hall', 0, 0, 20, 10), room('west', -15, 0, 10, 10), room('north', -10, -7, 20, 4)],
        [door('A', 'west', 'hall', -10, 0, 'z'), door('B', 'west', 'north', -15, -5, 'x'), door('C', 'north', 'hall', -3, -5, 'x')],
      ),
    ),
  );

const at = (x, z, r = 'hall') => ({ x, z, room: r });
const doorsOf = (path) => path.filter((p) => p.door).map((p) => p.door);

describe('the ways remembered', () => {
  beforeEach(() => {
    route.mockClear();
  });

  it('remembers a way by the cells it starts and ends in, and gives it again with its ends moved to where it is asked from', () => {
    const { nav, solidsOf } = hall();
    const first = wayBetween(nav, at(-3.2, -2.2), at(3.3, -2.3), { solidsOf });
    // round the crate
    expect(first.length).toBeGreaterThan(2);
    const again = wayBetween(nav, at(-3.6, -2.6), at(3.7, -2.9), { solidsOf });
    expect(route).toHaveBeenCalledTimes(1);
    expect(again[0]).toEqual(at(-3.6, -2.6));
    expect(again.at(-1)).toEqual(at(3.7, -2.9));
    expect(again.slice(1, -1)).toEqual(first.slice(1, -1));
    expect(rememberedWay(nav, at(-3.9, -2.1), at(3.1, -2.1), { solidsOf })).toEqual([at(-3.9, -2.1), ...first.slice(1, -1), at(3.1, -2.1)]);
    expect(route).toHaveBeenCalledTimes(1);
  });

  it('finds a way remembered from just over a cell’s edge, as people stop a little either side of a spot on a whole metre', () => {
    const { nav, solidsOf } = hall();
    wayBetween(nav, at(-3.1, -2.1), at(3.1, -2.9), { solidsOf });
    expect(rememberedWay(nav, at(-2.85, -1.85), at(2.9, -3.2), { solidsOf })).not.toBeNull();
    expect(route).toHaveBeenCalledTimes(1);
  });

  it('works a way out anew from another cell, to another, or when told to', () => {
    const { nav, solidsOf } = hall();
    wayBetween(nav, at(-3.2, -2.2), at(3.3, -2.3), { solidsOf });
    expect(rememberedWay(nav, at(-4.6, -2.2), at(3.3, -2.3), { solidsOf })).toBeNull();
    expect(rememberedWay(nav, at(-3.2, -2.2), at(3.3, -1.7), { solidsOf })).toBeNull();
    wayBetween(nav, at(-3.2, -2.2), at(3.3, -2.3), { solidsOf, fresh: true });
    expect(route).toHaveBeenCalledTimes(2);
  });

  it('remembers a way with the doors as they were: one shut since is gone round, and the first way comes back when it opens', () => {
    const nav = loop();
    const straight = wayBetween(nav, at(-15, 0, 'west'), at(5, 0));
    expect(doorsOf(straight)).toEqual(['A']);
    const shutA = { canPass: (id) => id !== 'A' };
    expect(rememberedWay(nav, at(-15, 0, 'west'), at(5, 0), shutA)).toBeNull();
    expect(doorsOf(wayBetween(nav, at(-15, 0, 'west'), at(5, 0), shutA))).toEqual(['B', 'C']);
    expect(doorsOf(rememberedWay(nav, at(-14.5, 0.5, 'west'), at(5.5, 0.5)))).toEqual(['A']);
    expect(route).toHaveBeenCalledTimes(2);
  });

  it('keeps a way worked out under one state from another: one round a crate since gone isn’t given for the hall without it', () => {
    const { nav, solidsOf } = hall();
    const bare = () => [];
    const round = wayBetween(nav, at(-3.2, -2.2), at(3.3, -2.3), { solidsOf, state: 'crate' });
    expect(round.length).toBeGreaterThan(2);
    expect(rememberedWay(nav, at(-3.2, -2.2), at(3.3, -2.3), { solidsOf: bare, state: 'bare' })).toBeNull();
    expect(wayBetween(nav, at(-3.2, -2.2), at(3.3, -2.3), { solidsOf: bare, state: 'bare' })).toHaveLength(2);
    expect(route).toHaveBeenCalledTimes(2);
    // each state still has its own
    expect(rememberedWay(nav, at(-3.4, -2.4), at(3.4, -2.4), { solidsOf, state: 'crate' }).slice(1, -1)).toEqual(round.slice(1, -1));
    expect(rememberedWay(nav, at(-3.4, -2.4), at(3.4, -2.4), { solidsOf: bare, state: 'bare' })).toHaveLength(2);
    expect(route).toHaveBeenCalledTimes(2);
  });

  it('won’t give a remembered way whose moved end would walk through something solid', () => {
    const { nav, solidsOf } = hall();
    // north of the panel, out round its end to the south side of the hall
    const north = wayBetween(nav, at(-3.5, 0.95), at(-3.5, 3.5), { solidsOf });
    expect(north).toHaveLength(2);
    const round = wayBetween(nav, at(-3.5, 0.95), at(-3.5, -3.5), { solidsOf });
    expect(round.length).toBeGreaterThan(2);
    // the same cell, south of the panel: the remembered first leg would cross it
    expect(rememberedWay(nav, at(-3.5, 0.05), at(-3.5, -3.5), { solidsOf })).toBeNull();
    expect(wayBetween(nav, at(-3.5, 0.05), at(-3.5, -3.5), { solidsOf })).toHaveLength(2);
  });

  it('takes a way remembered down Docking Control’s stair from a step off where it was first asked, by way of that place', () => {
    const nav = createNav(buildLayout(DS1));
    const bay = (x, z) => at(x, z, 'bay327');
    // from the landing by the control room’s door, down the stair and across the bay
    const first = wayBetween(nav, bay(21.75, -23.18), bay(-13, 2.5));
    const again = rememberedWay(nav, bay(21.72, -23.1), bay(-13.1, 2.4));
    expect(route).toHaveBeenCalledTimes(1);
    expect(again.slice(0, 2)).toEqual([bay(21.72, -23.1), first[0]]);
    expect(again.slice(2, -1)).toEqual(first.slice(1, -1));
    expect(again.at(-1)).toEqual(bay(-13.1, 2.4));
  });

  it('keeps only a few ways a room, forgetting the least lately used first', () => {
    const { nav, solidsOf } = hall();
    const ends = Array.from({ length: 40 }, (_, i) => at(-9.5 + (i % 20), i < 20 ? 4.5 : 3.5));
    for (const end of ends) wayBetween(nav, at(-0.5, 2.5), end, { solidsOf });
    // the first asked is long gone; the last is still there
    expect(rememberedWay(nav, at(-0.5, 2.5), ends[0], { solidsOf })).toBeNull();
    expect(rememberedWay(nav, at(-0.5, 2.5), ends.at(-1), { solidsOf })).not.toBeNull();
  });
});
