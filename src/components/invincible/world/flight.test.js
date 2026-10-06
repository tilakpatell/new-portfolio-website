import { describe, expect, it } from 'vitest';
import { FLY, newHero, speedOf, stepHero } from './flight';
import { SPAWN, WORLD, buildWorld, groundAt } from './map';

const W = buildWorld();
const still = { fwd: 0, side: 0, up: 0, down: 0, boost: false, run: false, jump: false, look: [0, 0, -1] };
// run the rules for t seconds, frame by frame, gathering the events
function fly(h, input, t, dt = 1 / 60) {
  const ev = [];
  for (let s = 0; s < t - 1e-9; s += dt) {
    h = stepHero(h, typeof input === 'function' ? input(h, s) : input, dt, W);
    ev.push(...h.ev);
  }
  return { h, ev };
}
// up in the air over open ground: the big park north of downtown
const AIR = { x: -240, y: 120, z: -880, face: Math.PI };
const airborne = () => ({ ...newHero(AIR), mode: 'air' });

describe('on the ground', () => {
  it('starts standing on the Graysons’ lawn', () => {
    const h = newHero(SPAWN);
    expect(h.mode).toBe('ground');
    expect(h.p[1]).toBe(groundAt(SPAWN.x, SPAWN.z));
  });
  it('walks and runs', () => {
    const walk = fly(newHero(SPAWN), { ...still, fwd: 1, look: [1, 0, 0] }, 1).h;
    const run = fly(newHero(SPAWN), { ...still, fwd: 1, run: true, look: [1, 0, 0] }, 1).h;
    expect(speedOf(walk)).toBeCloseTo(FLY.walk, 0);
    expect(speedOf(run)).toBeCloseTo(FLY.run, 0);
  });
  it('takes off with a jump', () => {
    const { h, ev } = fly(newHero(SPAWN), (_, s) => ({ ...still, jump: s === 0 }), 0.5);
    expect(h.mode).toBe('air');
    expect(h.p[1]).toBeGreaterThan(3);
    expect(ev.filter((e) => e.type === 'takeoff')).toHaveLength(1);
  });
});

describe('in the air', () => {
  it('hangs there with nothing pressed', () => {
    const { h } = fly(airborne(), still, 2);
    expect(Math.hypot(h.p[0] - AIR.x, h.p[1] - AIR.y, h.p[2] - AIR.z)).toBeLessThan(0.01);
    expect(h.mode).toBe('air');
  });
  it('cruises where the camera looks', () => {
    const { h } = fly(airborne(), { ...still, fwd: 1, look: [0, 0, 1] }, 3);
    expect(speedOf(h)).toBeGreaterThan(FLY.cruise - 2);
    expect(speedOf(h)).toBeLessThanOrEqual(FLY.cruise + 1e-6);
    expect(h.v[2]).toBeGreaterThan(0);
  });
  it('climbs and drops', () => {
    expect(fly(airborne(), { ...still, up: 1 }, 1).h.p[1]).toBeGreaterThan(AIR.y + 5);
    expect(fly(airborne(), { ...still, down: 1 }, 1).h.p[1]).toBeLessThan(AIR.y - 5);
  });
  it('goes flat out with a boost, breaking the sound barrier once', () => {
    // north over the hills, high enough to clear them
    const start = { ...newHero({ x: 0, y: 900, z: 2000, face: Math.PI }), mode: 'air' };
    const { h, ev } = fly(start, { ...still, boost: true, look: [0, 0, -1] }, 4);
    expect(speedOf(h)).toBeGreaterThan(240);
    expect(ev.filter((e) => e.type === 'boom')).toHaveLength(1);
  });
  it('slows back to a cruise when the boost is let go, and can break it again', () => {
    const start = { ...newHero({ x: 0, y: 900, z: 2000, face: Math.PI }), mode: 'air' };
    const north = { ...still, look: [0, 0, -1] };
    const { ev } = fly(start, (_, s) => ({ ...north, boost: s < 3 || s > 7, fwd: 1 }), 10);
    expect(ev.filter((e) => e.type === 'boom')).toHaveLength(2);
  });
});

describe('hitting things', () => {
  // the tallest tower, flown at from the west at its middle
  const tower = W.buildings.reduce((a, b) => (b.h > a.h ? b : a));
  const west = (speed) => ({ ...newHero({ x: tower.x - tower.w / 2 - 60, y: tower.h / 2, z: tower.z, face: Math.PI / 2 }), mode: 'air', v: [speed, 0, 0], spd: speed, dir: [1, 0, 0] });
  it('stops at a wall', () => {
    const { h, ev } = fly(west(30), { ...still, fwd: 1, look: [1, 0, 0] }, 4);
    expect(h.p[0]).toBeLessThan(tower.x - tower.w / 2);
    expect(ev.some((e) => e.type === 'impact')).toBe(false);
  });
  it('bounces off one hit hard, with a crash', () => {
    const { h, ev } = fly(west(200), { ...still, boost: true, look: [1, 0, 0] }, 1);
    expect(h.p[0]).toBeLessThan(tower.x - tower.w / 2);
    expect(ev.filter((e) => e.type === 'impact')).toHaveLength(1);
  });
  it('never goes under the ground, even diving flat out', () => {
    const start = { ...newHero({ x: -240, y: 400, z: -880, face: 0 }), mode: 'air' };
    const { h, ev } = fly(start, { ...still, boost: true, look: [0, -1, 0] }, 4);
    expect(h.p[1]).toBeGreaterThanOrEqual(groundAt(h.p[0], h.p[2]) - 1e-6);
    expect(h.mode).toBe('ground');
    expect(ev.some((e) => e.type === 'slam' && e.speed > 100)).toBe(true);
  });
  it('lands softly coming down slowly', () => {
    const start = { ...newHero({ x: -240, y: 6, z: -880, face: 0 }), mode: 'air' };
    const { h, ev } = fly(start, { ...still, down: 1 }, 3);
    expect(h.mode).toBe('ground');
    expect(ev.some((e) => e.type === 'land')).toBe(true);
    expect(ev.some((e) => e.type === 'slam')).toBe(false);
  });
  it('lands on a roof', () => {
    const b = W.buildings.find((x) => x.zone === 'mid' && !x.top && x.w > 20 && x.d > 20);
    const start = { ...newHero({ x: b.x, y: b.h + 8, z: b.z, face: 0 }), mode: 'air' };
    const { h } = fly(start, { ...still, down: 1 }, 3);
    expect(h.mode).toBe('ground');
    expect(h.p[1]).toBeCloseTo(b.h, 3);
  });
  it('stays inside the world and under its ceiling', () => {
    const out = fly({ ...newHero({ x: WORLD.half - 100, y: WORLD.ceiling - 50, z: 0, face: Math.PI / 2 }), mode: 'air' }, { ...still, boost: true, look: [0.7, 0.7, 0] }, 5).h;
    expect(out.p[0]).toBeLessThanOrEqual(WORLD.half);
    expect(out.p[1]).toBeLessThanOrEqual(WORLD.ceiling);
  });
});

describe('frame rate', () => {
  it('goes the same way at any frame rate', () => {
    const input = { ...still, fwd: 1, up: 0.3, look: [0.6, 0, 0.8] };
    const a = fly(airborne(), input, 2, 1 / 30).h;
    const b = fly(airborne(), input, 2, 1 / 144).h;
    expect(Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1], a.p[2] - b.p[2])).toBeLessThan(1);
  });
  it('takes a long frame (a tab coming back) without going through a tower', () => {
    const tower = W.buildings.reduce((a, b) => (b.h > a.h ? b : a));
    const h0 = { ...newHero({ x: tower.x - tower.w / 2 - 5, y: tower.h / 2, z: tower.z, face: Math.PI / 2 }), mode: 'air', v: [260, 0, 0], spd: 260, dir: [1, 0, 0] };
    const h = stepHero(h0, { ...still, boost: true, look: [1, 0, 0] }, 0.25, W);
    expect(h.p[0]).toBeLessThan(tower.x - tower.w / 2);
  });
});
