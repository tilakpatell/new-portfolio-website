import { describe, expect, it } from 'vitest';
import { CAR, COLLIDERS, PLACES, ROADS, SPAWN, WORLD_RADIUS, hankAt, nearPlace, onRoad, progress, stepCar, stepHeat } from './rules';

const fresh = { served: 0, points: 0, money: 0, upgrades: [], visited: [] };
const drive = (car, input, seconds) => {
  for (let t = 0; t < seconds; t += 1 / 60) car = stepCar(car, input, 1 / 60).car;
  return car;
};

describe('Albuquerque, the world: the map', () => {
  it('starts you on Walt’s driveway, on the road network', () => {
    expect(onRoad(SPAWN.x, SPAWN.z)).toBe(true);
    const home = PLACES.find((p) => p.id === 'home');
    expect(Math.hypot(SPAWN.x - home.door.x, SPAWN.z - home.door.z)).toBeLessThan(home.radius);
  });

  it('puts every place’s door on a road you can drive to, inside the world', () => {
    for (const p of PLACES) {
      expect(onRoad(p.door.x, p.door.z), p.id).toBe(true);
      expect(Math.hypot(p.door.x, p.door.z), p.id).toBeLessThan(WORLD_RADIUS - 10);
    }
  });

  it('keeps every door clear of the buildings', () => {
    for (const p of PLACES)
      for (const c of COLLIDERS) {
        const inside = Math.abs(p.door.x - c.x) < c.w / 2 + CAR.radius && Math.abs(p.door.z - c.z) < c.d / 2 + CAR.radius;
        expect(inside, `${p.id} in ${c.id}`).toBe(false);
      }
  });

  it('has roads that join up: every road meets another somewhere along it', () => {
    for (const r of ROADS) {
      const len = Math.hypot(r.b.x - r.a.x, r.b.z - r.a.z);
      const along = Array.from({ length: Math.ceil(len / 2) + 1 }, (_, i) => Math.min(1, (i * 2) / len)).map((k) => ({ x: r.a.x + (r.b.x - r.a.x) * k, z: r.a.z + (r.b.z - r.a.z) * k }));
      const meets = ROADS.some((o) => o !== r && along.some((p) => onRoad(p.x, p.z, [o])));
      expect(meets, r.id).toBe(true);
    }
  });
});

describe('Albuquerque, the world: what’s open', () => {
  const open = (snap) => Object.fromEntries(progress(snap).places.map((p) => [p.id, p.open]));

  it('opens Walt’s house and the RV from the start, and points you to the RV', () => {
    const p = progress(fresh);
    expect(open(fresh)).toMatchObject({ home: true, rv: true, saul: false, pollos: false, superlab: false, casa: false });
    expect(p.next).toBe('rv');
    expect(p.objective).toMatch(/RV/);
  });

  it('opens Saul’s office after two orders, Los Pollos at Cap’n Cook, the superlab once it’s bought, Casa Tranquila after Gus', () => {
    expect(open({ ...fresh, served: 2 }).saul).toBe(true);
    expect(open({ ...fresh, points: 40 }).pollos).toBe(true);
    expect(open({ ...fresh, upgrades: ['superlab'] }).superlab).toBe(true);
    expect(open({ ...fresh, visited: ['pollos'] }).casa).toBe(true);
  });

  it('points to the next locked place with how to open it, once the open ones are visited', () => {
    const p = progress({ ...fresh, visited: ['home', 'rv'] });
    expect(p.next).toBe('saul');
    expect(p.objective).toMatch(/two orders/i);
    const q = progress({ ...fresh, served: 2, visited: ['home', 'rv'] });
    expect(q.next).toBe('saul');
    expect(q.objective).toMatch(/Saul/);
  });

  it('says so when everything’s open and visited', () => {
    const all = progress({ served: 9, points: 999, money: 0, upgrades: ['superlab'], visited: PLACES.map((p) => p.id) });
    expect(all.next).toBe(null);
    expect(all.places.every((p) => p.open)).toBe(true);
    expect(all.done).toBe(true);
  });
});

describe('Albuquerque, the world: driving', () => {
  it('pulls away, and goes no faster than the road allows', () => {
    const car = drive({ ...SPAWN, speed: 0 }, { throttle: 1, steer: 0 }, 1);
    expect(car.speed).toBeGreaterThan(5);
    const flat = drive({ x: 0, z: 0, yaw: Math.PI / 2, speed: 0 }, { throttle: 1, steer: 0 }, 6);
    expect(flat.speed).toBeLessThanOrEqual(CAR.top + 1e-6);
  });

  it('is slower off the road', () => {
    // well out in the sand
    const sand = drive({ x: 160, z: 140, yaw: -Math.PI / 2, speed: 0 }, { throttle: 1, steer: 0 }, 6);
    expect(onRoad(160, 140)).toBe(false);
    expect(sand.speed).toBeLessThanOrEqual(CAR.sand + 1e-6);
  });

  it('turns only while it moves, toward the stick', () => {
    const still = stepCar({ x: 0, z: 0, yaw: 0, speed: 0 }, { throttle: 0, steer: 1 }, 0.5).car;
    expect(still.yaw).toBe(0);
    const moving = drive({ x: 0, z: 0, yaw: 0, speed: 10 }, { throttle: 0.5, steer: 1 }, 0.5);
    expect(moving.yaw).toBeGreaterThan(0.2);
  });

  it('stops at a building instead of driving through it, and says it bumped', () => {
    const wall = COLLIDERS[0];
    let car = { x: wall.x, z: wall.z - wall.d / 2 - 6, yaw: 0, speed: 15 };
    let bumped = false;
    for (let i = 0; i < 120; i++) {
      const r = stepCar(car, { throttle: 1, steer: 0 }, 1 / 60);
      car = r.car;
      bumped ||= r.bump > 0;
    }
    expect(bumped).toBe(true);
    expect(car.z).toBeLessThan(wall.z - wall.d / 2);
  });

  it('keeps you inside the world', () => {
    const car = drive({ x: 0, z: WORLD_RADIUS - 5, yaw: 0, speed: 20 }, { throttle: 1, steer: 0 }, 3);
    expect(Math.hypot(car.x, car.z)).toBeLessThanOrEqual(WORLD_RADIUS);
  });

  it('knows when you’ve pulled up at a place', () => {
    const rv = PLACES.find((p) => p.id === 'rv');
    expect(nearPlace(rv.door.x, rv.door.z).id).toBe('rv');
    expect(nearPlace(rv.door.x + rv.radius + 1, rv.door.z)).toBe(null);
  });
});

describe('Albuquerque, the world: Hank', () => {
  it('drives his loop on the roads', () => {
    for (let t = 0; t < 120; t += 3.7) {
      const h = hankAt(t);
      expect(onRoad(h.x, h.z), `t=${t}`).toBe(true);
    }
    const a = hankAt(0);
    const b = hankAt(1);
    expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeGreaterThan(5);
  });

  it('heats up while he’s close, cools off when you get away, and catches you at the top', () => {
    let heat = 0;
    for (let i = 0; i < 60; i++) heat = stepHeat(heat, 8, 1 / 30).heat;
    expect(heat).toBeGreaterThan(0.4);
    const cooled = stepHeat(heat, 80, 1).heat;
    expect(cooled).toBeLessThan(heat);
    let caught = false;
    for (let i = 0; i < 400 && !caught; i++) ({ heat, caught } = stepHeat(heat, 5, 1 / 30));
    expect(caught).toBe(true);
  });
});

describe('Blue Sky', () => {
  it('leaves every crystal where the car can get to it', async () => {
    const { CAR, COLLIDERS, CRYSTALS, WORLD_RADIUS, onRoad } = await import('./rules');
    expect(CRYSTALS).toHaveLength(12);
    expect(new Set(CRYSTALS.map((c) => c.id)).size).toBe(12);
    for (const c of CRYSTALS) {
      expect(Math.hypot(c.x, c.z)).toBeLessThan(WORLD_RADIUS - 5);
      expect(onRoad(c.x, c.z)).toBe(false);
      for (const b of COLLIDERS) {
        const dx = Math.max(Math.abs(c.x - b.x) - b.w / 2, 0);
        const dz = Math.max(Math.abs(c.z - b.z) - b.d / 2, 0);
        expect(Math.hypot(dx, dz)).toBeGreaterThan(CAR.radius + 1);
      }
    }
  });

  it('gives a crystal once, when the car is on it', async () => {
    const { CRYSTALS, crystalAt } = await import('./rules');
    const c = CRYSTALS[3];
    expect(crystalAt(c.x + 1, c.z - 1)?.id).toBe(c.id);
    expect(crystalAt(c.x + 9, c.z)).toBe(null);
    expect(crystalAt(c.x, c.z, [c.id])).toBe(null);
  });
});

describe('the ground, the walls and the fence', () => {
  it('is flat through town and rolls gently out to the fence', async () => {
    const { DUNES, WORLD_RADIUS, groundHeight } = await import('./rules');
    expect(groundHeight(0, 0)).toBe(0);
    expect(groundHeight(DUNES - 1, 0)).toBe(0);
    for (let a = 0; a < 6.28; a += 0.2) {
      const y = groundHeight(Math.cos(a) * WORLD_RADIUS, Math.sin(a) * WORLD_RADIUS);
      expect(y).toBeGreaterThan(-2);
      expect(y).toBeLessThan(9);
      // no step where the dunes begin
      expect(Math.abs(groundHeight(Math.cos(a) * (DUNES + 2), Math.sin(a) * (DUNES + 2)))).toBeLessThan(0.2);
    }
  });

  it('stops the car at each building where its walls are, not short of them', async () => {
    const { COLLIDERS, LANDMARKS, PLACES } = await import('./rules');
    for (const p of [...PLACES, ...LANDMARKS]) {
      const c = COLLIDERS.find((x) => x.id === p.id);
      expect(c.w, p.id).toBeCloseTo(p.foot.w, 5);
      expect(c.d, p.id).toBeCloseTo(p.foot.d, 5);
      // and you can still pull up at the door
      if (p.door) expect(Math.max(Math.abs(p.door.x - c.x) - c.w / 2, Math.abs(p.door.z - c.z) - c.d / 2), p.id).toBeGreaterThan(2);
    }
  });
});

describe('things to do', () => {
  it('sends a run somewhere far off, on open ground inside the fence, with time to make it', async () => {
    const { CAR, COLLIDERS, DROPS, RUN, SPAWN, WORLD_RADIUS, startRun } = await import('./rules');
    for (const d of DROPS) {
      expect(Math.hypot(d.x, d.z), d.id).toBeLessThan(WORLD_RADIUS - 10);
      for (const b of COLLIDERS) expect(Math.hypot(Math.max(Math.abs(d.x - b.x) - b.w / 2, 0), Math.max(Math.abs(d.z - b.z) - b.d / 2, 0))).toBeGreaterThan(CAR.radius + 2);
    }
    for (let pick = 0; pick < 12; pick++) {
      const run = startRun(SPAWN, pick);
      expect(run.dist).toBeGreaterThanOrEqual(RUN.far);
      // at the sand's top speed, in a straight line, there is time to spare
      expect(run.dist / CAR.sand).toBeLessThan(run.time * 1.35);
    }
    expect(startRun(SPAWN, 0).id).not.toBe(startRun(SPAWN, 1).id);
  });

  it('pays on arrival, more for time left, and nothing once the clock runs out', async () => {
    const { runPay, startRun, stepRun } = await import('./rules');
    const run = startRun({ x: 0, z: 0 }, 2);
    expect(stepRun(run, { x: 0, z: 0 }, 5, 0.1)).toMatchObject({ state: 'on' });
    expect(stepRun(run, { x: 0, z: 0 }, 0.05, 0.1).state).toBe('late');
    const made = stepRun(run, { x: run.x + 2, z: run.z - 2 }, 12, 0.1);
    expect(made.state).toBe('made');
    expect(made.pay).toBe(runPay(run, 12));
    expect(runPay(run, 12)).toBeGreaterThan(runPay(run, 1));
  });

  it('washes the car on the forecourt of the A1A, which is clear of its walls', async () => {
    const { CAR, COLLIDERS, WASH, atWash } = await import('./rules');
    expect(atWash(WASH.x + 1, WASH.z)).toBe(true);
    expect(atWash(WASH.x + 20, WASH.z)).toBe(false);
    const b = COLLIDERS.find((c) => c.id === 'carwash');
    expect(Math.hypot(Math.max(Math.abs(WASH.x - b.x) - b.w / 2, 0), Math.max(Math.abs(WASH.z - b.z) - b.d / 2, 0))).toBeGreaterThan(CAR.radius);
  });
});

describe('the rest of town', () => {
  it('stands every building clear of the roads, the doors, the wash, and each other', async () => {
    const { COLLIDERS, DROPS, PLACES, ROADS, TOWN, WASH, WORLD_RADIUS } = await import('./rules');
    const gap = (a, b) => Math.max(Math.abs(a.x - b.x) - (a.w + b.w) / 2, Math.abs(a.z - b.z) - (a.d + b.d) / 2);
    const reach = (c, x, z) => Math.hypot(Math.max(Math.abs(x - c.x) - c.w / 2, 0), Math.max(Math.abs(z - c.z) - c.d / 2, 0));
    expect(new Set(TOWN.map((t) => t.id)).size).toBe(TOWN.length);
    for (const t of TOWN) {
      const c = COLLIDERS.find((x) => x.id === t.id);
      expect(c, t.id).toBeTruthy();
      expect(Math.hypot(t.at.x, t.at.z), t.id).toBeLessThan(WORLD_RADIUS - 30);
      for (const o of COLLIDERS) if (o.id !== t.id) expect(gap(c, o), `${t.id} and ${o.id}`).toBeGreaterThan(3);
      // off every road, with room to drive past
      for (const r of ROADS)
        for (let k = 0; k <= 40; k++) {
          const x = r.a.x + ((r.b.x - r.a.x) * k) / 40;
          const z = r.a.z + ((r.b.z - r.a.z) * k) / 40;
          expect(reach(c, x, z), `${t.id} on ${r.id}`).toBeGreaterThan(r.w / 2 + 1);
        }
      for (const p of PLACES) expect(reach(c, p.door.x, p.door.z), `${t.id} at ${p.id}'s door`).toBeGreaterThan(p.radius + 2);
      expect(reach(c, WASH.x, WASH.z), t.id).toBeGreaterThan(WASH.radius + 2);
      for (const d of DROPS) expect(reach(c, d.x, d.z), t.id).toBeGreaterThan(8);
    }
  });
});
