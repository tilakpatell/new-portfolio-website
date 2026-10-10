import { describe, expect, it } from 'vitest';
import { seeded } from '../../../../lib/seeded';
import { COMBAT, WEAPONS, createCombat, fire, gunOf, heatStep, hurt, regen, stepCombat } from './combat';

const STEP = 1 / 30;

// A corridor with one wall across it 3 m north of the origin, x −5 to 5, 4 m
// tall. `extra` adds more segments (a doorway, a field’s edge).
function hall(extra = []) {
  return {
    rooms: new Map([
      ['c', { id: 'c', kind: 'corridor' }],
      ['f', { id: 'f', kind: 'field' }],
    ]),
    walls: [{ x0: -5, z0: -3, x1: 5, z1: -3, y0: 0, y1: 4, room: 'c' }, ...extra],
  };
}

const body = (id, side, x, z, more = {}) => ({ id, x, y: 0, z, r: 0.35, h: 1.8, side, hp: 100, ...more });
const north = { x: 0, y: 0, z: -1 };
const shot = (more = {}) => ({ from: { x: 0, y: 1.4, z: 0 }, dir: north, owner: 'you', side: 'rebel', weapon: 'e11', npc: false, ...more });
const shut = () => false;

// Steps the combat at the game’s rate for a while and returns every event with the time it came at.
function run(combat, seconds, world) {
  const events = [];
  for (let i = 1; i <= Math.round(seconds / STEP); i++) for (const e of stepCombat(combat, STEP, world)) events.push({ ...e, t: i * STEP });
  return events;
}

const degrees = (a, b) => (Math.acos(Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z)) * 180) / Math.PI;

describe('weapons', () => {
  it('holds the four blasters with the numbers from the constraints', () => {
    expect(WEAPONS.e11).toEqual({ damage: 18, gap: 0.18, heat: 0.09, speed: 55, spread: 0.6, npcSpread: 2.4, range: 60 });
    expect(WEAPONS.dl44).toEqual({ damage: 30, gap: 0.32, heat: 0.14, speed: 50, spread: 0.4, npcSpread: 2.0, range: 50 });
    expect(WEAPONS.dh17).toEqual({ damage: 16, gap: 0.14, heat: 0.07, speed: 55, spread: 0.8, npcSpread: 2.8, range: 45 });
    expect(WEAPONS.a280).toEqual({ damage: 24, gap: 0.22, heat: 0.1, speed: 60, spread: 0.4, npcSpread: 2.0, range: 80 });
  });

  it('makes a bolt with the gun’s speed, damage and range, and none again until the gap has passed', () => {
    const combat = createCombat();
    const rand = seeded(1);
    const bolt = fire(combat, shot(), rand);
    expect(bolt).toMatchObject({ owner: 'you', side: 'rebel', weapon: 'e11', damage: 18, speed: 55, npc: false });
    expect(bolt.life).toBeCloseTo(60 / 55);
    expect(Math.hypot(bolt.dx, bolt.dy, bolt.dz)).toBeCloseTo(1);
    expect(combat.bolts).toEqual([bolt]);
    expect(fire(combat, shot(), rand)).toBeNull();
    heatStep(gunOf(combat, 'you', 'e11'), 0.18);
    expect(fire(combat, shot(), rand)).not.toBeNull();
  });

  it('scatters a player’s shots within 0.6° and an NPC’s within 2.4°, wider than the player’s', () => {
    const rand = seeded(7);
    const angles = (npc) => {
      const combat = createCombat();
      return Array.from({ length: 200 }, (_, i) => {
        const b = fire(combat, shot({ owner: `o${i}`, npc }), rand);
        return degrees({ x: b.dx, y: b.dy, z: b.dz }, north);
      });
    };
    const you = angles(false);
    const them = angles(true);
    expect(Math.max(...you)).toBeLessThanOrEqual(0.6 + 1e-9);
    expect(Math.max(...them)).toBeLessThanOrEqual(2.4 + 1e-9);
    expect(Math.max(...them)).toBeGreaterThan(0.6);
  });
});

describe('heat', () => {
  it('leaves an E-11 warm after five quick shots and overheats it at the eleventh, then vents it for 2 s', () => {
    const combat = createCombat();
    const rand = seeded(3);
    const gun = gunOf(combat, 'you', 'e11');
    const quick = () => {
      const bolt = fire(combat, shot(), rand);
      heatStep(gun, WEAPONS.e11.gap);
      return bolt;
    };
    for (let i = 0; i < 5; i++) expect(quick()).not.toBeNull();
    expect(gun.heat).toBeCloseTo(0.45);
    expect(gun.vent).toBe(0);
    for (let i = 6; i <= 10; i++) expect(quick()).not.toBeNull();
    expect(gun.vent).toBe(0);
    expect(fire(combat, shot(), rand)).not.toBeNull();
    expect(gun.vent).toBe(COMBAT.vent);
    expect(heatStep(gun, 1.9)).toBeNull();
    expect(fire(combat, shot(), rand)).toBeNull();
    expect(stepCombat(combat, 0.1, { layout: hall(), open: shut, bodies: [] })).toContainEqual({ type: 'vented', owner: 'you', weapon: 'e11' });
    expect(gun.heat).toBe(0);
    expect(fire(combat, shot(), rand)).not.toBeNull();
  });

  it('cools 0.5 a second once the gun is ready again', () => {
    const combat = createCombat();
    fire(combat, shot(), seeded(2));
    const gun = gunOf(combat, 'you', 'e11');
    heatStep(gun, 0.18 + 0.1);
    expect(gun.heat).toBeCloseTo(0.09 - 0.05);
    heatStep(gun, 1);
    expect(gun.heat).toBe(0);
  });
});

describe('bolts', () => {
  it('stops a bolt fired at a wall 3 m away within 0.1 s, with the wall’s normal', () => {
    const combat = createCombat();
    fire(combat, shot({ npc: false }), seeded(4));
    const events = run(combat, 0.1, { layout: hall(), open: shut, bodies: [] });
    const wall = events.find((e) => e.type === 'wall');
    expect(wall).toBeDefined();
    expect(wall.t).toBeLessThanOrEqual(0.1 + 1e-9);
    expect(wall.z).toBeCloseTo(-3);
    expect(wall.normal.x).toBeCloseTo(0, 1);
    expect(wall.normal.y).toBe(0);
    expect(wall.normal.z).toBeCloseTo(1);
    expect(combat.bolts).toEqual([]);
  });

  it('with dt = 2 still stops at the wall and never hits a body behind it', () => {
    const combat = createCombat();
    fire(combat, shot(), seeded(5));
    const events = stepCombat(combat, 2, { layout: hall(), open: shut, bodies: [body('tk', 'imperial', 0, -6)] });
    expect(events.map((e) => e.type)).toEqual(['wall']);
    expect(combat.bolts).toEqual([]);
  });

  it('hits a body in front of the wall, with the gun’s damage', () => {
    const combat = createCombat();
    fire(combat, shot(), seeded(5));
    const events = stepCombat(combat, 2, { layout: hall(), open: shut, bodies: [body('tk', 'imperial', 0, -2)] });
    expect(events).toEqual([expect.objectContaining({ type: 'hit', target: 'tk', owner: 'you', side: 'rebel', weapon: 'e11', damage: 18 })]);
    expect(events[0].z).toBeCloseTo(-2 + 0.35, 1);
  });

  it('passes the shooter, the shooter’s own side and the dead', () => {
    const combat = createCombat();
    fire(combat, shot(), seeded(5));
    const bodies = [body('you', 'rebel', 0, 0), body('han', 'rebel', 0, -1), body('tk', 'imperial', 0, -2, { hp: 0 })];
    expect(stepCombat(combat, 2, { layout: hall(), open: shut, bodies }).map((e) => e.type)).toEqual(['wall']);
  });

  it('flies through an open doorway, stops at a closed one, and ignores a field’s edge', () => {
    const doorway = { x0: -1, z0: -3, x1: 1, z1: -3, y0: 0, y1: 2.4, room: 'c', door: 'd' };
    const layout = { ...hall(), walls: [doorway, { x0: -5, z0: -1, x1: 5, z1: -1, y0: 0, y1: 4, room: 'f' }] };
    const bodies = [body('tk', 'imperial', 0, -6)];
    const shut = createCombat();
    fire(shut, shot(), seeded(6));
    expect(stepCombat(shut, 2, { layout, open: () => false, bodies })).toEqual([expect.objectContaining({ type: 'wall', door: 'd' })]);
    const open = createCombat();
    fire(open, shot(), seeded(6));
    expect(stepCombat(open, 2, { layout, open: (id) => id === 'd', bodies })).toEqual([expect.objectContaining({ type: 'hit', target: 'tk' })]);
  });

  it('flies over a wall lower than it and fades out past the gun’s range', () => {
    const combat = createCombat();
    fire(combat, shot(), seeded(8));
    const layout = { ...hall(), walls: [{ x0: -5, z0: -3, x1: 5, z1: -3, y0: 0, y1: 1, room: 'c' }] };
    expect(stepCombat(combat, 2, { layout, open: shut, bodies: [body('tk', 'imperial', 0, -70)] })).toEqual([]);
    expect(combat.bolts).toEqual([]);
  });
});

describe('deflection', () => {
  const vader = (yaw) => body('vader', 'imperial', 0, -2, { deflect: { yaw, active: true } });
  const world = (guard) => ({ layout: hall(), open: shut, bodies: [body('you', 'rebel', 0, 0), guard] });

  it('sends a bolt back along its path from a guard facing it, with the side flipped, into the shooter', () => {
    const combat = createCombat();
    fire(combat, shot(), seeded(9));
    const events = stepCombat(combat, 0.5, world(vader(Math.PI + 0.5)));
    expect(events.map((e) => e.type)).toEqual(['deflect', 'hit']);
    expect(events[0]).toMatchObject({ by: 'vader', side: 'imperial' });
    expect(events[1]).toMatchObject({ target: 'you', owner: 'vader', side: 'imperial' });
  });

  it('flips the bolt’s side and owner and turns it round', () => {
    const combat = createCombat();
    const bolt = fire(combat, shot(), seeded(9));
    const dz = bolt.dz;
    stepCombat(combat, 2 / 55, { layout: hall(), open: shut, bodies: [vader(Math.PI)] });
    expect(combat.bolts).toHaveLength(1);
    expect(combat.bolts[0]).toMatchObject({ side: 'imperial', owner: 'vader' });
    expect(combat.bolts[0].dz).toBeCloseTo(-dz);
  });

  it('doesn’t save a guard turned more than 70° from the bolt, or one not guarding', () => {
    for (const guard of [vader(Math.PI + 1.3), vader(0), body('vader', 'imperial', 0, -2, { deflect: { yaw: Math.PI, active: false } })]) {
      const combat = createCombat();
      fire(combat, shot(), seeded(9));
      expect(stepCombat(combat, 0.5, world(guard))).toEqual([expect.objectContaining({ type: 'hit', target: 'vader' })]);
    }
  });
});

describe('damage', () => {
  it('hurts, knocks down on a heavy hit and kills at 0', () => {
    const trooper = { hp: COMBAT.health };
    expect(hurt(trooper, 18, 1)).toBe('hurt');
    expect(trooper).toMatchObject({ hp: 82, hurtAt: 1 });
    expect(hurt(trooper, 30, 2)).toBe('down');
    expect(hurt(trooper, 60, 3)).toBe('dead');
    expect(trooper.hp).toBe(0);
  });

  it('heals 8 a second only after 5 s unhurt, up to full, and never the dead', () => {
    const you = { hp: 50 };
    hurt(you, 10, 0);
    regen(you, 1, 4);
    expect(you.hp).toBe(40);
    regen(you, 1, 5);
    expect(you.hp).toBeCloseTo(48);
    regen(you, 100, 6);
    expect(you.hp).toBe(100);
    const dead = { hp: 0, hurtAt: 0 };
    regen(dead, 1, 10);
    expect(dead.hp).toBe(0);
  });
});
