import { describe, expect, it } from 'vitest';
import {
  ENEMY_KINDS,
  ROBOT,
  SHOT,
  TRANSFORM,
  VEHICLE,
  available,
  buildWorld,
  canTransform,
  damage,
  feedMission,
  fire,
  hurtEnemy,
  newEnemy,
  newMissions,
  newPlayer,
  segmentClear,
  startMission,
  stepEnemies,
  stepPickups,
  stepPlayer,
  stepShots,
  nearby,
} from './rules';

// a little test yard: a tall wall at x = 10, a low platform at x = -10
const AREA = {
  id: 'yard',
  bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 },
  spawn: { x: 0, z: 0, yaw: 0 },
  solids: [
    { kind: 'box', x: 10, z: 0, hw: 1, hd: 20, top: 30, tag: 'wall' },
    { kind: 'box', x: -10, z: 0, hw: 3, hd: 3, top: 1, tag: 'step' },
  ],
  people: [{ id: 'bee', kind: 'bumblebee-wfc', name: 'Bumblebee', x: 0, z: 6, lines: ['Hi.'] }],
  exits: [{ id: 'bridge', x: 0, z: -50, r: 8, to: 'base', label: 'Space bridge' }],
  missions: [],
};

const still = { moveX: 0, moveZ: 0, run: false, jump: false, throttle: 0, steer: 0, boost: false, fire: false, transform: false, use: false, aimYaw: 0, aimPitch: 0 };
const run = (p, input, seconds, world, dt = 1 / 60) => {
  const events = [];
  for (let t = 0; t < seconds; t += dt) events.push(...stepPlayer(p, { ...still, ...input }, dt, world));
  return events;
};
const settle = (p, world) => run(p, {}, 0.5, world);

describe('the robot', () => {
  it('walks into a wall and stops at it', () => {
    const world = buildWorld(AREA);
    const p = newPlayer(AREA);
    settle(p, world);
    run(p, { moveX: 1 }, 4, world);
    expect(p.x).toBeLessThanOrEqual(10 - 1 - ROBOT.radius + 1e-6);
    expect(p.x).toBeGreaterThan(10 - 1 - ROBOT.radius - 0.5);
  });

  it('steps up onto a low platform', () => {
    const world = buildWorld(AREA);
    const p = newPlayer(AREA);
    settle(p, world);
    run(p, { moveX: -1 }, 1.45, world);
    expect(p.x).toBeLessThan(-8);
    expect(p.x).toBeGreaterThan(-12);
    expect(p.y).toBeCloseTo(1, 3);
  });

  it('jumps and lands', () => {
    const world = buildWorld(AREA);
    const p = newPlayer(AREA);
    settle(p, world);
    const up = stepPlayer(p, { ...still, jump: true }, 1 / 60, world);
    expect(up.some((e) => e.type === 'jump')).toBe(true);
    expect(p.vy).toBeGreaterThan(0);
    const after = run(p, {}, 2, world);
    expect(after.some((e) => e.type === 'land')).toBe(true);
    expect(p.grounded).toBe(true);
  });

  it("doesn't pass through a wall on a huge frame", () => {
    const world = buildWorld(AREA);
    const p = newPlayer(AREA, { x: 7, z: 0, yaw: 0 });
    settle(p, world);
    stepPlayer(p, { ...still, moveX: 1, run: true }, 30, world);
    expect(p.x).toBeLessThan(10 - 1);
  });
});

describe('transforming', () => {
  it('is refused in the air', () => {
    const world = buildWorld(AREA);
    const p = newPlayer(AREA);
    settle(p, world);
    stepPlayer(p, { ...still, jump: true }, 1 / 60, world);
    run(p, {}, 0.1, world);
    expect(p.grounded).toBe(false);
    expect(canTransform(p)).toBe(false);
    const events = stepPlayer(p, { ...still, transform: true }, 1 / 60, world);
    expect(events.some((e) => e.type === 'transform')).toBe(false);
  });

  it('is refused while already transforming', () => {
    const world = buildWorld(AREA);
    const p = newPlayer(AREA);
    settle(p, world);
    const first = stepPlayer(p, { ...still, transform: true }, 1 / 60, world);
    expect(first).toContainEqual(expect.objectContaining({ type: 'transform', to: 'vehicle' }));
    expect(canTransform(p)).toBe(false);
    const again = stepPlayer(p, { ...still, transform: true }, 1 / 60, world);
    expect(again.some((e) => e.type === 'transform')).toBe(false);
  });

  it('flips the mode once the transformation is done', () => {
    const world = buildWorld(AREA);
    const p = newPlayer(AREA);
    settle(p, world);
    stepPlayer(p, { ...still, transform: true }, 1 / 60, world);
    expect(p.mode).toBe('robot');
    const events = run(p, {}, TRANSFORM.time + 0.1, world);
    expect(events).toContainEqual(expect.objectContaining({ type: 'transformed', to: 'vehicle' }));
    expect(p.mode).toBe('vehicle');
  });

  it('pushes the truck clear of a wall it would overlap', () => {
    const world = buildWorld(AREA);
    const p = newPlayer(AREA, { x: 10 - 1 - ROBOT.radius - 0.2, z: 0, yaw: 0 });
    settle(p, world);
    stepPlayer(p, { ...still, transform: true }, 1 / 60, world);
    run(p, {}, TRANSFORM.time + 0.2, world);
    expect(p.mode).toBe('vehicle');
    expect(p.x).toBeLessThanOrEqual(10 - 1 - VEHICLE.radius + 1e-6);
  });
});

describe('the truck', () => {
  const truck = (at) => {
    const world = buildWorld({ ...AREA, solids: AREA.solids.slice(0, 1) });
    const p = newPlayer(AREA, at);
    settle(p, world);
    stepPlayer(p, { ...still, transform: true }, 1 / 60, world);
    run(p, {}, TRANSFORM.time + 0.1, world);
    return { p, world };
  };

  it('reaches its top speed and no more', () => {
    const { p, world } = truck({ x: -60, z: -95, yaw: 0 });
    run(p, { throttle: 1 }, 4, world);
    expect(p.speed).toBeGreaterThan(VEHICLE.top * 0.9);
    expect(p.speed).toBeLessThanOrEqual(VEHICLE.top + 1e-6);
  });

  it('goes faster on boost, and boost runs down', () => {
    const { p, world } = truck({ x: -60, z: -95, yaw: 0 });
    run(p, { throttle: 1 }, 3, world);
    const before = p.boost;
    let top = 0;
    for (let t = 0; t < 2; t += 1 / 60) {
      stepPlayer(p, { ...still, throttle: 1, boost: true }, 1 / 60, world);
      top = Math.max(top, p.speed);
    }
    expect(top).toBeGreaterThan(VEHICLE.top + 2);
    expect(top).toBeLessThanOrEqual(VEHICLE.boost + 1e-6);
    expect(p.boost).toBeLessThan(before);
  });

  it('bumps off a wall and never goes through it', () => {
    const { p, world } = truck({ x: -40, z: 0, yaw: Math.PI / 2 });
    const events = run(p, { throttle: 1 }, 5, world);
    expect(events.some((e) => e.type === 'bump')).toBe(true);
    expect(p.x).toBeLessThanOrEqual(10 - 1 - VEHICLE.radius + 1e-6);
    expect(Math.abs(p.speed)).toBeLessThan(VEHICLE.top * 0.5);
  });

  it('steers', () => {
    const { p, world } = truck({ x: -60, z: -60, yaw: 0 });
    run(p, { throttle: 1 }, 1.5, world);
    const yaw = p.yaw;
    run(p, { throttle: 1, steer: 1 }, 0.6, world);
    expect(p.yaw).toBeGreaterThan(yaw + 0.3);
  });
});

describe('health and sight', () => {
  it('dies at zero', () => {
    const p = newPlayer(AREA);
    expect(damage(p, 40)).toContainEqual(expect.objectContaining({ type: 'hurt' }));
    expect(damage(p, 100)).toContainEqual(expect.objectContaining({ type: 'dead' }));
    expect(p.dead).toBe(true);
    expect(damage(p, 10)).toEqual([]);
  });

  it('sees past a wall only from above it', () => {
    const world = buildWorld(AREA);
    expect(segmentClear(world, 0, 5, 0, 20, 5, 0)).toBe(false);
    expect(segmentClear(world, 0, 40, 0, 20, 40, 0)).toBe(true);
    expect(segmentClear(world, 0, 5, 0, 0, 5, 50)).toBe(true);
  });
});

describe('shots', () => {
  const target = (x, z, extra = {}) => ({ id: 't', x, y: 0, z, r: 1.2, h: 7, hp: 40, dead: false, ...extra });

  it('hit a target ahead', () => {
    const world = buildWorld({ ...AREA, solids: [] });
    const p = newPlayer(AREA);
    settle(p, world);
    const t = target(0, 50);
    const shots = fire(p, [t], { yaw: 0, pitch: 0 });
    expect(shots.length).toBeGreaterThan(0);
    const hits = [];
    for (let s = 0; s < 0.5; s += 1 / 60) hits.push(...stepShots(shots, 1 / 60, world, [t]));
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].target).toBe(t);
  });

  it('are stopped by a wall', () => {
    const world = buildWorld(AREA);
    const p = newPlayer(AREA);
    settle(p, world);
    const t = target(40, 0);
    const shots = fire(p, [t], { yaw: Math.PI / 2, pitch: 0 });
    const hits = [];
    for (let s = 0; s < 1; s += 1 / 60) hits.push(...stepShots(shots, 1 / 60, world, [t]));
    expect(hits).toEqual([]);
    expect(shots.length).toBe(0);
  });

  it('aim at what is nearly in line, not what is well off it', () => {
    const world = buildWorld({ ...AREA, solids: [] });
    const p = newPlayer(AREA);
    settle(p, world);
    const near = target(Math.sin((8 * Math.PI) / 180) * 60, Math.cos((8 * Math.PI) / 180) * 60, { id: 'near' });
    const [s1] = fire(p, [near], { yaw: 0, pitch: 0 });
    expect(Math.atan2(s1.vx, s1.vz)).toBeGreaterThan((5 * Math.PI) / 180);
    p.cooldown = 0;
    const far = target(Math.sin((20 * Math.PI) / 180) * 60, Math.cos((20 * Math.PI) / 180) * 60, { id: 'far' });
    const [s2] = fire(p, [far], { yaw: 0, pitch: 0 });
    expect(Math.abs(Math.atan2(s2.vx, s2.vz))).toBeLessThan((1 * Math.PI) / 180);
  });

  it('wait for the guns to cool', () => {
    const world = buildWorld({ ...AREA, solids: [] });
    const p = newPlayer(AREA);
    settle(p, world);
    expect(fire(p, [], { yaw: 0, pitch: 0 }).length).toBe(1);
    expect(fire(p, [], { yaw: 0, pitch: 0 }).length).toBe(0);
    run(p, {}, SHOT.cooldownRobot + 0.02, world);
    expect(fire(p, [], { yaw: 0, pitch: 0 }).length).toBe(1);
  });
});

describe('the Decepticons', () => {
  const rand = (() => {
    let s = 7;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  })();

  it('advance from far off, then strafe and fire in range', () => {
    const world = buildWorld({ ...AREA, solids: [] });
    const p = newPlayer(AREA);
    settle(p, world);
    const e = newEnemy('trooper', 0, 100, { id: 'e1' });
    stepEnemies([e], p, 0.5, world, rand);
    expect(e.state).toBe('advance');
    expect(e.z).toBeLessThan(100);
    const near = newEnemy('trooper', 0, 40, { id: 'e2' });
    let shots = 0;
    for (let t = 0; t < 3; t += 1 / 30) shots += stepEnemies([near], p, 1 / 30, world, rand).shots.length;
    expect(near.state).toBe('strafe');
    expect(shots).toBeGreaterThan(0);
  });

  it("don't fire once dead", () => {
    const world = buildWorld({ ...AREA, solids: [] });
    const p = newPlayer(AREA);
    const e = newEnemy('trooper', 0, 30, { id: 'e3' });
    const events = hurtEnemy(e, ENEMY_KINDS.trooper.hp);
    expect(events).toContainEqual(expect.objectContaining({ type: 'kill', id: 'e3', kind: 'trooper' }));
    let shots = 0;
    for (let t = 0; t < 3; t += 1 / 30) shots += stepEnemies([e], p, 1 / 30, world, rand).shots.length;
    expect(shots).toBe(0);
  });
});

describe('pickups and using things', () => {
  it('collects within reach only', () => {
    const p = newPlayer(AREA);
    const pickups = [
      { id: 'a', kind: 'energon', x: 3, y: 0, z: 0 },
      { id: 'b', kind: 'energon', x: 9, y: 0, z: 0 },
    ];
    expect(stepPickups(pickups, p)).toEqual(['a']);
    expect(stepPickups(pickups, p)).toEqual([]);
  });

  it('talks to someone close on foot; in the truck, says to get out first', () => {
    const world = buildWorld(AREA);
    const p = newPlayer(AREA);
    expect(nearby(p, AREA)).toEqual(expect.objectContaining({ type: 'talk', id: 'bee' }));
    settle(p, world);
    stepPlayer(p, { ...still, transform: true }, 1 / 60, world);
    run(p, {}, TRANSFORM.time + 0.1, world);
    expect(nearby(p, AREA)).toEqual(expect.objectContaining({ type: 'shift', id: 'bee' }));
  });

  it('drives into an exit', () => {
    const p = newPlayer(AREA, { x: 0, z: -48, yaw: 0 });
    p.mode = 'vehicle';
    expect(nearby(p, AREA)).toEqual(expect.objectContaining({ type: 'exit', id: 'bridge' }));
  });
});

describe('missions', () => {
  const MISSION = {
    id: 'run',
    title: 'Energon run',
    giver: 'bee',
    area: 'yard',
    steps: [
      { type: 'talk', target: 'bee', text: 'Talk to Bumblebee' },
      { type: 'collect', kind: 'energon', count: 3, text: 'Collect energon', within: 30 },
      { type: 'drive', gates: [{ x: 0, z: 20, r: 6 }, { x: 0, z: 60, r: 6 }], text: 'Drive the gates' },
    ],
  };
  const area = { ...AREA, missions: [MISSION, { id: 'later', giver: 'bee', requires: ['run'], steps: [{ type: 'talk', target: 'bee' }] }] };

  it('walks through its steps', () => {
    const ms = newMissions();
    startMission(ms, MISSION);
    expect(feedMission(ms, area, { type: 'talk', id: 'bee' }).advanced).toBe(true);
    feedMission(ms, area, { type: 'pickup', kind: 'energon', id: 'a' });
    feedMission(ms, area, { type: 'pickup', kind: 'energon', id: 'b' });
    expect(ms.step).toBe(1);
    expect(feedMission(ms, area, { type: 'pickup', kind: 'energon', id: 'c' }).advanced).toBe(true);
    // gates in order: the second first doesn't count
    expect(feedMission(ms, area, { type: 'move', x: 0, z: 60 }).advanced).toBe(false);
    expect(ms.count).toBe(0);
    feedMission(ms, area, { type: 'move', x: 0, z: 20 });
    expect(ms.count).toBe(1);
    const last = feedMission(ms, area, { type: 'move', x: 1, z: 59 });
    expect(last.completed).toBe('run');
    expect(ms.active).toBe(null);
    expect(ms.done).toContain('run');
  });

  it('runs out of time and starts the step over', () => {
    const ms = newMissions();
    startMission(ms, MISSION);
    feedMission(ms, area, { type: 'talk', id: 'bee' });
    feedMission(ms, area, { type: 'pickup', kind: 'energon', id: 'a' });
    const out = feedMission(ms, area, { type: 'tick', dt: 31 });
    expect(out.failed).toBe(true);
    expect(ms.step).toBe(1);
    expect(ms.count).toBe(0);
    expect(ms.timer).toBeCloseTo(30);
  });

  it('keeps its progress through a trip to another area', () => {
    const ms = newMissions();
    startMission(ms, MISSION);
    feedMission(ms, area, { type: 'talk', id: 'bee' });
    feedMission(ms, area, { type: 'pickup', kind: 'energon', id: 'a' });
    feedMission(ms, area, { type: 'exit', to: 'base' });
    const elsewhere = { id: 'base', missions: [] };
    feedMission(ms, elsewhere, { type: 'pickup', kind: 'energon', id: 'x' });
    expect(ms.active).toBe('run');
    expect(ms.step).toBe(1);
    expect(ms.count).toBe(1);
  });

  it('counts only what happens where the step is played', () => {
    const ms = newMissions();
    const there = { ...MISSION, area: 'yard', steps: [{ type: 'collect', kind: 'energon', count: 2 }] };
    startMission(ms, there);
    const all = { missions: [there] };
    feedMission(ms, all, { type: 'pickup', kind: 'energon', area: 'base' });
    expect(ms.count).toBe(0);
    feedMission(ms, all, { type: 'pickup', kind: 'energon', area: 'yard' });
    expect(ms.count).toBe(1);
  });

  it('offers a mission only once what it needs is done', () => {
    const ms = newMissions();
    expect(available(area, ms).map((m) => m.id)).toEqual(['run']);
    ms.done.push('run');
    expect(available(area, ms).map((m) => m.id)).toEqual(['later']);
  });
});
