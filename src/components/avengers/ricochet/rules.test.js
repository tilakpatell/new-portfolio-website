import { describe, expect, it } from 'vitest';
import { ROOMS, SHIELD, botAt, botsLeft, newRoom, simulateThrow, starsFor, stepRoom, throwShield } from './rules';

const deg = (d) => (d * Math.PI) / 180;

// Fly a throw to the end.
function play(room, angle) {
  throwShield(room, angle);
  const events = [];
  for (let i = 0; i < 4000 && room.phase === 'flying'; i++) events.push(...stepRoom(room, 1 / 120));
  return events;
}

// What a throw achieves, for searching: bots down, switches, glass, and
// whether it fails the room.
function value(room, f) {
  if (f.end === 'hostage') return -1;
  const before = room.bots.filter((b) => b.down).length;
  const sw = f.events.filter((e) => e.type === 'switch').length;
  return (f.downs.length - before) * 10 + sw * 4 + f.events.filter((e) => e.type === 'glass').length;
}

// Search for a way to clear the room in `throws` throws: at each step try
// every angle (and, where bots patrol, a spread of moments to throw), keep
// the best few, and go deeper.
function solve(index, throws = ROOMS[index].par, { step = 0.1, keep = 6 } = {}) {
  const moving = ROOMS[index].bots.some((b) => b.patrol);
  const waits = moving ? Array.from({ length: 12 }, (_, i) => i * 0.5) : [0];
  const go = (room, left) => {
    const options = [];
    for (const wait of waits) {
      for (let a = -88; a <= 88; a += step) {
        const r = structuredClone({ ...room, def: undefined });
        r.def = room.def;
        r.t += wait;
        const f = simulateThrow(r, deg(a));
        const v = value(r, f);
        if (v > 0) options.push({ a, wait, v });
      }
    }
    options.sort((p, q) => q.v - p.v);
    for (const o of options.slice(0, keep)) {
      const r = structuredClone({ ...room, def: undefined });
      r.def = room.def;
      r.t += o.wait;
      play(r, deg(o.a));
      if (r.phase === 'cleared') return [o];
      if (r.phase === 'aim' && left > 1) {
        const rest = go(r, left - 1);
        if (rest) return [o, ...rest];
      }
    }
    return null;
  };
  return go(newRoom(index), throws);
}

describe('Ricochet: the shield', () => {
  it('flies straight up the room and takes down a bot in its way', () => {
    const room = newRoom(0);
    const ev = play(room, Math.atan2(0.6, 8.1));
    expect(ev.some((e) => e.type === 'down')).toBe(true);
    expect(room.phase).toBe('cleared');
  });

  it('bounces off steel at the same angle it came in', () => {
    const room = newRoom(0);
    room.bots = [];
    const f = simulateThrow(room, deg(30));
    const [p0, p1, p2] = f.path;
    // incoming and outgoing directions, mirrored across the wall's normal
    const din = [(p1.x - p0.x) / Math.hypot(p1.x - p0.x, p1.z - p0.z), (p1.z - p0.z) / Math.hypot(p1.x - p0.x, p1.z - p0.z)];
    const dout = [(p2.x - p1.x) / Math.hypot(p2.x - p1.x, p2.z - p1.z), (p2.z - p1.z) / Math.hypot(p2.x - p1.x, p2.z - p1.z)];
    expect(f.events[0].type).toBe('bounce');
    expect(Math.abs(din[0] + dout[0]) < 1e-6 || Math.abs(din[1] + dout[1]) < 1e-6).toBe(true);
  });

  it('stops dead in a padded mat', () => {
    const room = newRoom(3);
    const f = simulateThrow(room, deg(-80));
    expect(f.end).toBe('mat');
    expect(f.events.at(-1).type).toBe('mat');
  });

  it('breaks glass once and goes through it', () => {
    const room = newRoom(4);
    room.bots = [];
    const f = simulateThrow(room, deg(5));
    expect(f.events.some((e) => e.type === 'glass')).toBe(true);
    expect(f.events.filter((e) => e.type === 'glass').length).toBe(1);
  });

  it('bounces off a shut door until the switch opens it', () => {
    const shut = simulateThrow(newRoom(6), 0);
    expect(shut.events.find((e) => e.type === 'bounce')?.kind).toBe('door');
    const room = newRoom(6);
    room.switches[0].on = true;
    room.walls.find((w) => w.id === 'door').open = true;
    const open = simulateThrow(room, 0);
    expect(open.events.some((e) => e.type === 'down')).toBe(true);
  });

  it('is caught when it comes back past Cap', () => {
    const room = newRoom(0);
    room.bots = [];
    const f = simulateThrow(room, 0);
    expect(f.end).toBe('caught');
  });

  it('gives up after five bounces', () => {
    const room = newRoom(0);
    room.bots = [];
    const f = simulateThrow(room, deg(47));
    expect(f.events.filter((e) => e.type === 'bounce').length).toBeLessThanOrEqual(SHIELD.bounces + 1);
    expect(['dropped', 'caught']).toContain(f.end);
  });

  it('fails the room on hitting the hostage', () => {
    const room = newRoom(8);
    const ev = play(room, 0);
    expect(ev.some((e) => e.type === 'hostage')).toBe(true);
    expect(room.phase).toBe('failed');
    expect(room.failReason).toBe('hostage');
  });

  it('needs two hits in one throw to put down an armoured bot', () => {
    const room = newRoom(10);
    const b = room.bots[0];
    // a glancing throw that only passes it once
    const once = simulateThrow(room, Math.atan2(b.x - 1.4, -(b.z - room.def.cap[1])) + deg(4));
    const straight = simulateThrow(room, Math.atan2(b.x, -(b.z - room.def.cap[1])));
    expect(straight.events.filter((e) => e.type === 'armor').length).toBe(1);
    expect(straight.downs).toContain(0);
    expect(once.downs.includes(0) && !once.events.some((e) => e.type === 'armor')).toBe(false);
  });

  it('moves patrolling bots back and forth with the clock', () => {
    const b = ROOMS[5].bots[0];
    const [x0] = botAt(b, 0);
    const [x1] = botAt(b, 1);
    const len = Math.hypot(b.patrol.to[0] - b.x, b.patrol.to[1] - b.z);
    const [xBack] = botAt(b, (2 * len) / b.patrol.speed);
    expect(x1).toBeGreaterThan(x0);
    expect(xBack).toBeCloseTo(x0, 5);
  });

  it('works out the same throw the same way', () => {
    const a = simulateThrow(newRoom(9), deg(12.5));
    const b = simulateThrow(newRoom(9), deg(12.5));
    expect(a).toEqual(b);
  });
});

describe('Ricochet: the rooms', () => {
  it('fails a room after par plus three misses', () => {
    const room = newRoom(1);
    for (let i = 0; i < 4; i++) play(room, deg(-89));
    expect(room.phase).toBe('failed');
    expect(room.failReason).toBe('throws');
  });

  it('gives three stars at par, fewer after', () => {
    const room = newRoom(0);
    room.throws = 1;
    expect(starsFor(room)).toBe(3);
    room.throws = 2;
    expect(starsFor(room)).toBe(2);
    room.throws = 4;
    expect(starsFor(room)).toBe(1);
  });

  ROOMS.forEach((r, i) => {
    it(`room ${i + 1}, ${r.name}, can be cleared in ${r.par}`, () => {
      const sol = solve(i);
      expect(sol, `no par solution for ${r.name}`).toBeTruthy();
      // and replaying the solution clears it
      const room = newRoom(i);
      for (const o of sol) {
        room.t += o.wait;
        play(room, deg(o.a));
      }
      expect(room.phase).toBe('cleared');
      expect(botsLeft(room)).toBe(0);
    }, 60000);
  });

  it('cannot be cleared by throwing straight ahead every time (from room 2 on)', () => {
    for (let i = 1; i < ROOMS.length; i++) {
      const room = newRoom(i);
      for (let k = 0; k < ROOMS[i].par && room.phase === 'aim'; k++) play(room, 0);
      expect(room.phase === 'cleared', ROOMS[i].name).toBe(false);
    }
  });
});
