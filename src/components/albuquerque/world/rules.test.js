import { describe, expect, it } from 'vitest';
import { CAR, CITY, COLLIDERS, DRIVING, DRIVING_DEFAULTS, EDGES, GRID, HANK_ROUTE, NODES, PLACES, ROADS, SIGNAL, SPAWN, WORLD_RADIUS, collidersNear, createSafeSpot, STREET_PROPS, createStreets, nearPlace, onBlock, onRoad, progress, readDriving, signalAt, slipOf, stepCar, stepHeat, stepSteer, stepTraffic, surfaceHeight } from './rules';

const fresh = { served: 0, points: 0, money: 0, upgrades: [], visited: [] };
const drive = (car, input, seconds) => {
  for (let t = 0; t < seconds; t += 1 / 60) car = stepCar(car, input, 1 / 60).car;
  return car;
};
const gap = (a, b) => Math.max(Math.abs(a.x - b.x) - (a.w + b.w) / 2, Math.abs(a.z - b.z) - (a.d + b.d) / 2);
const reach = (c, x, z) => Math.hypot(Math.max(Math.abs(x - c.x) - c.w / 2, 0), Math.max(Math.abs(z - c.z) - c.d / 2, 0));

describe('Albuquerque, the world: the map', () => {
  it('starts you on Walt’s driveway, by his door, clear of everything', () => {
    const home = PLACES.find((p) => p.id === 'home');
    expect(Math.hypot(SPAWN.x - home.door.x, SPAWN.z - home.door.z)).toBeLessThan(home.radius);
    expect(onRoad(SPAWN.x, SPAWN.z)).toBe(false);
    for (const c of COLLIDERS) expect(reach(c, SPAWN.x, SPAWN.z), c.id).toBeGreaterThan(CAR.radius);
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

  it('is a grid: every street line runs the city’s width, and the blocks sit a kerb above it', () => {
    for (const z of GRID.zs) expect(onRoad(GRID.xs[0] + 1, z) && onRoad(GRID.xs.at(-1) - 1, z), `z=${z}`).toBe(true);
    for (const x of GRID.xs) expect(onRoad(x, GRID.zs[0] + 1) && onRoad(x, GRID.zs.at(-1) - 1), `x=${x}`).toBe(true);
    expect(CITY.blocks).toHaveLength((GRID.xs.length - 1) * (GRID.zs.length - 1));
    for (const b of CITY.blocks) {
      const mx = (b.x0 + b.x1) / 2;
      const mz = (b.z0 + b.z1) / 2;
      expect(onBlock(mx, mz)).toBe(true);
      expect(onRoad(mx, mz)).toBe(false);
      expect(surfaceHeight(mx, mz)).toBeCloseTo(GRID.kerb, 5);
    }
    expect(surfaceHeight(0, 0)).toBe(0);
  });
});

describe('Albuquerque, the city', () => {
  it('builds a city: houses, shops, towers downtown, warehouses by the tracks', () => {
    const kinds = new Set(CITY.buildings.map((b) => b.kind));
    expect(CITY.buildings.length).toBeGreaterThan(140);
    expect(kinds.size).toBeGreaterThanOrEqual(7);
    // downtown stands tall
    const tall = CITY.buildings.filter((b) => b.h > 40);
    expect(tall.length).toBeGreaterThan(2);
    for (const b of tall) expect(Math.hypot(b.x - 10, b.z + 50), b.id).toBeLessThan(130);
    expect(CITY.trees.length).toBeGreaterThan(150);
    expect(CITY.parked.length).toBeGreaterThan(50);
  });

  it('stands every building inside its block, off every road and sidewalk, clear of the others', () => {
    const built = CITY.buildings;
    for (const b of built) {
      const k = CITY.blocks.find((q) => b.x > q.x0 && b.x < q.x1 && b.z > q.z0 && b.z < q.z1);
      expect(k, b.id).toBeTruthy();
      expect(b.x - b.w / 2, b.id).toBeGreaterThanOrEqual(k.x0 - 1e-6);
      expect(b.x + b.w / 2, b.id).toBeLessThanOrEqual(k.x1 + 1e-6);
      expect(b.z - b.d / 2, b.id).toBeGreaterThanOrEqual(k.z0 - 1e-6);
      expect(b.z + b.d / 2, b.id).toBeLessThanOrEqual(k.z1 + 1e-6);
    }
    // shops on the strip may share a wall (just), the city's cars and walls
    // may sit close; nothing else comes near anything
    const city = (c) => /^c\d/.test(c.id) || c.kind;
    const bad = [];
    for (const c of COLLIDERS)
      for (const o of COLLIDERS) {
        if (o === c) continue;
        const need = city(c) && city(o) ? 0.15 : 0.9;
        if (gap(c, o) <= need) bad.push(`${c.id} and ${o.id}: ${gap(c, o).toFixed(2)}`);
      }
    expect(bad).toEqual([]);
  });

  it('finds what’s near a point: everything the car could touch there', () => {
    for (let x = -260; x <= 260; x += 7)
      for (let z = -200; z <= 200; z += 7) {
        const near = new Set(collidersNear(x, z));
        for (const c of COLLIDERS) if (reach(c, x, z) < 3) expect(near.has(c), `${c.id} at ${x},${z}`).toBe(true);
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
    const car = drive({ x: -95, z: -62.5, yaw: Math.PI / 2, speed: 0 }, { throttle: 1, steer: 0 }, 1);
    expect(car.speed).toBeGreaterThan(5);
    const flat = drive({ x: -230, z: 2, yaw: Math.PI / 2, speed: 0 }, { throttle: 1, steer: 0 }, 6);
    expect(flat.speed).toBeLessThanOrEqual(CAR.top + 1e-6);
  });

  it('is slower off the road', () => {
    // well out in the sand
    const sand = drive({ x: 330, z: 60, yaw: -Math.PI / 2, speed: 0 }, { throttle: 1, steer: 0 }, 6);
    expect(onRoad(330, 60)).toBe(false);
    expect(sand.speed).toBeLessThanOrEqual(CAR.sand + 1e-6);
  });

  it('turns only while it moves, toward the stick', () => {
    const still = stepCar({ x: 0, z: 0, yaw: 0, speed: 0 }, { throttle: 0, steer: 1 }, 0.5).car;
    expect(still.yaw).toBe(0);
    const moving = drive({ x: 0, z: 0, yaw: 0, speed: 10 }, { throttle: 0.5, steer: 1 }, 0.5);
    expect(moving.yaw).toBeGreaterThan(0.2);
  });

  it('stops at a building instead of driving through it, and says it bumped', () => {
    const wall = COLLIDERS.find((c) => c.id === 'pollos');
    let car = { x: wall.x, z: wall.z + wall.d / 2 + 9, yaw: Math.PI, speed: 15 };
    let bumped = false;
    for (let i = 0; i < 120; i++) {
      const r = stepCar(car, { throttle: 1, steer: 0 }, 1 / 60);
      car = r.car;
      bumped ||= r.bump > 0;
    }
    expect(bumped).toBe(true);
    expect(car.z).toBeGreaterThan(wall.z + wall.d / 2);
  });

  it('says how hard the bump was as a force, and where it touched', () => {
    const wall = COLLIDERS.find((c) => c.id === 'pollos');
    const face = wall.z + wall.d / 2;
    const at = (speed) => {
      let car = { x: wall.x, z: face + CAR.radius + 0.05, yaw: Math.PI, speed };
      for (let i = 0; i < 10; i++) {
        const r = stepCar(car, { throttle: 0, steer: 0 }, 1 / 60);
        if (r.bump > 0) return r;
        car = r.car;
      }
      return null;
    };
    const soft = at(5);
    const hard = at(20);
    expect(hard.force).toBeCloseTo(hard.bump * CAR.mass, 6);
    expect(hard.force).toBeGreaterThan(soft.force);
    // the old shake was full at 20 m/s into a wall: the hit law is full there too
    expect(hard.force).toBeGreaterThanOrEqual(110);
    expect(hard.at.z).toBeCloseTo(face, 1);
    expect(Math.abs(hard.at.x - wall.x)).toBeLessThan(0.5);
    // (no bump, no force and nowhere)
    const r = stepCar({ x: 0, z: 0, yaw: 0, speed: 5 }, {}, 1 / 60);
    expect(r.force).toBe(0);
    expect(r.at).toBe(null);
  });

  it('bumps off the traffic', () => {
    let car = { x: 0, z: -30, yaw: 0, speed: 12 };
    let bumped = false;
    for (let i = 0; i < 90; i++) {
      const r = stepCar(car, { throttle: 1, steer: 0 }, 1 / 60, [{ x: 0, z: -20, r: 1.5 }]);
      car = r.car;
      bumped ||= r.bump > 0;
    }
    expect(bumped).toBe(true);
    expect(car.z).toBeLessThan(-20 - 1.5 - CAR.radius + 0.01);
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

// Central Avenue runs east–west through (0, 0), four lanes and nothing parked
// on it (the traffic isn't in these): room to throw the car about. East is yaw π/2.
const EAST = Math.PI / 2;
const onCentral = (speed = 0, x = -150) => ({ x, z: 0, yaw: EAST, speed });
const run = (car, input, seconds, fps = 60) => {
  let out = { car, bump: 0, slip: 0 };
  let peak = 0;
  for (let i = 0; i < Math.round(seconds * fps); i++) {
    out = stepCar(out.car, input, 1 / fps);
    peak = Math.max(peak, out.slip);
  }
  return { ...out, peak };
};
// how far the way it's going is from the way it's pointing (radians)
const drift = (car) => Math.abs(Math.atan2(car.slide ?? 0, Math.abs(car.speed)));

describe('Albuquerque, the world: the Aztek’s handling', () => {
  it('steers tighter the slower it goes, and never quicker than its tyres can hold', () => {
    const turned = (speed) => {
      const a = run(onCentral(speed, 0), { throttle: 0.3, steer: 1 }, 0.5).car;
      return a.yaw - EAST;
    };
    expect(turned(8)).toBeGreaterThan(turned(24));
    expect(turned(24)).toBeGreaterThan(0.2); // still turns in at top speed
    // flat out with the wheel hard over, it holds the road: no spin, little slide
    const fast = run(onCentral(CAR.top, 0), { throttle: 1, steer: 1 }, 1.2);
    expect(drift(fast.car)).toBeLessThan(0.2);
  });

  it('turns round inside a street at parking speed', () => {
    // a slow half circle to the south: how far across it went
    let car = { x: 0, z: 0, yaw: EAST, speed: 4 };
    let far = 0;
    for (let i = 0; i < 600 && car.yaw - EAST < Math.PI; i++) {
      car = stepCar(car, { throttle: 0.1, steer: 1 }, 1 / 60).car;
      far = Math.max(far, Math.abs(car.z));
    }
    expect(car.yaw - EAST).toBeGreaterThanOrEqual(Math.PI - 0.05);
    expect(far).toBeLessThan(12); // inside Central's 16 m
  });

  it('steers the other way in reverse', () => {
    const back = run({ x: 0, z: 0, yaw: EAST, speed: -5 }, { throttle: -1, steer: 1 }, 0.5).car;
    expect(back.yaw).toBeLessThan(EAST - 0.1);
  });

  it('swings its tail out on the handbrake, and grips again when it’s let go', () => {
    const plain = run(onCentral(20, -60), { throttle: 0, steer: 1 }, 0.7);
    const pulled = run(onCentral(20, -60), { throttle: 0, steer: 1, handbrake: true }, 0.7);
    // further round, and sliding: pointing well off the way it's going
    expect(pulled.car.yaw).toBeGreaterThan(plain.car.yaw + 0.25);
    expect(drift(pulled.car)).toBeGreaterThan(0.3);
    expect(pulled.peak).toBeGreaterThan(0.5);
    expect(drift(plain.car)).toBeLessThan(0.15);
    // let go, wheel straight: the slide is over inside a second and a half
    const after = run(pulled.car, { throttle: 0.4, steer: 0 }, 1.5);
    expect(drift(after.car)).toBeLessThan(0.05);
    expect(Math.abs(after.car.yawRate)).toBeLessThan(0.1);
    expect(after.slip).toBeLessThan(0.1);
  });

  it('comes round in a handbrake turn without running off down the street', () => {
    // 18 m/s east, wheel over and the handbrake on until it has come half round
    let car = onCentral(18, -40);
    let t = 0;
    while (car.yaw - EAST < Math.PI * 0.75 && t < 4) {
      car = stepCar(car, { throttle: 0, steer: 1, handbrake: true }, 1 / 60).car;
      t += 1 / 60;
    }
    expect(t).toBeLessThan(2.5);
    expect(car.x - -40).toBeLessThan(45);
  });

  it('slows on the handbrake, but less than on the brakes', () => {
    const hand = run(onCentral(20), { throttle: 0, steer: 0, handbrake: true }, 0.5).car;
    const foot = run(onCentral(20), { throttle: -1, steer: 0 }, 0.5).car;
    const coast = run(onCentral(20), { throttle: 0, steer: 0 }, 0.5).car;
    expect(hand.speed).toBeLessThan(coast.speed);
    expect(foot.speed).toBeLessThan(hand.speed);
    expect(foot.speed).toBeGreaterThanOrEqual(0);
  });

  it('slides wider on sand than on the road', () => {
    const road = run(onCentral(11, 0), { throttle: 1, steer: 1 }, 0.8);
    const sand = run({ x: 330, z: 60, yaw: EAST, speed: 11 }, { throttle: 1, steer: 1 }, 0.8);
    expect(onRoad(330, 60)).toBe(false);
    expect(sand.peak).toBeGreaterThan(road.peak);
    expect(slipOf(sand.car)).toBeGreaterThanOrEqual(0);
  });

  it('drives the same whatever the frame rate', () => {
    const input = { throttle: 1, steer: 0.6 };
    const a = run(onCentral(6, 0), input, 2, 30).car;
    const b = run(onCentral(6, 0), input, 2, 144).car;
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeLessThan(0.6);
    expect(Math.abs(a.yaw - b.yaw)).toBeLessThan(0.05);
    expect(Math.abs(a.speed - b.speed)).toBeLessThan(0.3);
  });

  it('scrapes along a wall it clips, and stops dead at one it hits square', () => {
    const wall = COLLIDERS.find((c) => c.id === 'pollos');
    const south = wall.z + wall.d / 2;
    // along its south face, nosing in a little
    let car = { x: wall.x - wall.w / 2 - 2, z: south + CAR.radius + 0.4, yaw: EAST + 0.12, speed: 14 };
    let bump = 0;
    for (let i = 0; i < 60; i++) {
      const r = stepCar(car, { throttle: 1, steer: 0 }, 1 / 60);
      car = r.car;
      bump = Math.max(bump, r.bump);
    }
    expect(bump).toBeGreaterThan(0);
    expect(bump).toBeLessThan(6); // a scrape, not a crash
    expect(Math.hypot(car.speed, car.slide)).toBeGreaterThan(8);
    expect(car.z).toBeGreaterThanOrEqual(south + CAR.radius - 1e-6);
    // straight at it
    let head = { x: wall.x, z: south + 8, yaw: Math.PI, speed: 14 };
    let hard = 0;
    for (let i = 0; i < 60; i++) {
      const r = stepCar(head, { throttle: 0, steer: 0 }, 1 / 60);
      head = r.car;
      hard = Math.max(hard, r.bump);
    }
    expect(hard).toBeGreaterThan(8);
    expect(Math.abs(head.speed)).toBeLessThan(4);
  });

  it('stops spinning when it stops moving, and the handbrake holds it there', () => {
    const spun = run(onCentral(10, -60), { throttle: 0, steer: 1, handbrake: true }, 3).car;
    expect(Math.hypot(spun.speed, spun.slide)).toBeLessThan(0.05);
    expect(Math.abs(spun.yawRate)).toBeLessThan(0.05);
    // on the handbrake, neither gear moves it off
    for (const throttle of [1, -1]) {
      const held = run(onCentral(0, -60), { throttle, steer: 0, handbrake: true }, 3).car;
      expect(Math.abs(held.speed), `throttle ${throttle}`).toBeLessThan(0.05);
    }
  });

  it('keeps its speed when a spin leaves it going backwards', () => {
    // half round on the handbrake at speed: it's going backwards faster than reverse goes
    let car = onCentral(22, -100);
    let t = 0;
    let before = 0;
    let lost = 0;
    while (car.yaw - EAST < Math.PI * 0.9 && t < 3) {
      before = Math.hypot(car.speed, car.slide ?? 0);
      car = stepCar(car, { throttle: 0, steer: 1, handbrake: true }, 1 / 60).car;
      lost = Math.max(lost, before - Math.hypot(car.speed, car.slide));
      t += 1 / 60;
    }
    expect(car.yaw - EAST).toBeGreaterThan(Math.PI * 0.85);
    expect(lost).toBeLessThan(0.6); // no frame takes a bite out of it
  });

  it('shrugs off a stalled frame and inputs that aren’t numbers', () => {
    const r = stepCar(onCentral(10), { throttle: NaN, steer: Infinity, assist: 'x' }, 60);
    for (const k of ['x', 'z', 'yaw', 'speed', 'slide', 'yawRate']) expect(Number.isFinite(r.car[k]), k).toBe(true);
    expect(r.car.x - -150).toBeLessThan(4); // a quarter of a second of it, at most
    expect(Math.abs(stepCar(onCentral(5), { throttle: 50, steer: 0 }, 1 / 60).car.speed - 5)).toBeLessThan(0.3);
    expect(stepSteer(0.5, NaN, 10, 1 / 60)).toBeLessThan(0.5);
  });

  it('runs wide onto the sand without stopping dead: the speed comes off over a second', () => {
    // flat out off the end of town, into the sand
    const off = run({ x: 290, z: 40, yaw: EAST, speed: CAR.top }, { throttle: 1, steer: 0 }, 0.5).car;
    expect(onRoad(290, 40)).toBe(false);
    expect(off.speed).toBeGreaterThan(CAR.sand + 4);
    expect(off.speed).toBeLessThan(CAR.top - 3);
    expect(run(off, { throttle: 1, steer: 0 }, 1).car.speed).toBeCloseTo(CAR.sand, 6);
  });

  it('stays in hand whatever is done to it: finite, inside the fence, out of the walls, no faster than it can go', () => {
    let seed = 7;
    const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
    let car = { ...SPAWN, speed: 0 };
    let input = { throttle: 1, steer: 0, handbrake: false };
    const worst = { finite: true, out: 0, fast: 0, wall: Infinity, slid: 0, bumped: 0 };
    for (let i = 0; i < 60 * 240; i++) {
      if (i % 20 === 0) input = { throttle: rand() < 0.75 ? 1 : rand() < 0.5 ? -1 : 0, steer: Math.round(rand() * 2 - 1), handbrake: rand() < 0.25 };
      const r = stepCar(car, input, i % 7 === 0 ? 0.05 : 1 / 60);
      car = r.car;
      worst.finite &&= Number.isFinite(car.x + car.z + car.yaw + car.speed + car.slide + car.yawRate + r.bump + r.slip);
      worst.out = Math.max(worst.out, Math.hypot(car.x, car.z));
      worst.fast = Math.max(worst.fast, Math.hypot(car.speed, car.slide));
      worst.slid = Math.max(worst.slid, Math.abs(car.slide));
      worst.bumped = Math.max(worst.bumped, r.bump);
      for (const c of COLLIDERS) worst.wall = Math.min(worst.wall, Math.hypot(Math.max(Math.abs(car.x - c.x) - c.w / 2, 0), Math.max(Math.abs(car.z - c.z) - c.d / 2, 0)));
    }
    expect(worst.finite).toBe(true);
    expect(worst.out).toBeLessThanOrEqual(WORLD_RADIUS + 1e-6);
    expect(worst.fast).toBeLessThanOrEqual(CAR.top + 1e-6);
    expect(worst.wall).toBeGreaterThan(CAR.radius - 0.05);
    // (and the four minutes did have slides and knocks in them)
    expect(worst.slid).toBeGreaterThan(3);
    expect(worst.bumped).toBeGreaterThan(3);
  });

  it('takes a car that was parked before any of this (no slide, no spin) as it is', () => {
    const r = stepCar({ x: 0, z: 0, yaw: EAST, speed: 5 }, { throttle: 1, steer: 0 }, 1 / 60);
    for (const k of ['x', 'z', 'yaw', 'speed', 'slide', 'yawRate']) expect(Number.isFinite(r.car[k]), k).toBe(true);
    expect(Number.isFinite(r.slip)).toBe(true);
  });
});

describe('Albuquerque, the world: the wheel in your hands', () => {
  const turnFor = (seconds, from, to, speed, set) => {
    let s = from;
    for (let i = 0; i < Math.round(seconds * 60); i++) s = stepSteer(s, to, speed, 1 / 60, set);
    return s;
  };

  it('goes over quicker at low speed than flat out, and comes back quicker than it went', () => {
    const slow = turnFor(0.1, 0, 1, 3);
    const fast = turnFor(0.1, 0, 1, CAR.top);
    expect(slow).toBeGreaterThan(fast);
    expect(fast).toBeGreaterThan(0.15);
    const over = turnFor(0.1, 0, 1, 12);
    const back = 1 - turnFor(0.1, 1, 0, 12);
    expect(back).toBeGreaterThan(over);
    expect(turnFor(1.5, 0, 1, CAR.top)).toBe(1);
    expect(turnFor(1.5, 1, 0, CAR.top)).toBe(0);
  });

  it('makes a tap a small correction, and crosses from lock to lock quickest of all', () => {
    const tap = turnFor(0.05, 0, 1, 12);
    expect(tap).toBeGreaterThan(0.15);
    expect(tap).toBeLessThan(0.5);
    const letGo = 1 - turnFor(0.06, 1, 0, 12);
    const crossed = 1 - turnFor(0.06, 1, -1, 12);
    expect(crossed).toBeGreaterThan(letGo * 1.2);
    // and never past where it's wanted
    expect(turnFor(1, 0, 0.3, 12)).toBeCloseTo(0.3, 9);
  });

  it('turns faster the higher the steering is set, and never past full lock', () => {
    const low = turnFor(0.1, 0, 1, 12, { steer: DRIVING.steer.min });
    const high = turnFor(0.1, 0, 1, 12, { steer: DRIVING.steer.max });
    expect(high).toBeGreaterThan(low * 1.5);
    expect(turnFor(3, 0, 5, 12, { steer: DRIVING.steer.max })).toBe(1);
    expect(turnFor(3, 0, -5, 12)).toBe(-1);
  });

  it('gives a stick fine control near its middle', () => {
    // a third of the stick is well under a third of the lock; all of it is all of it
    expect(turnFor(2, 0, 1 / 3, 12, { analog: true })).toBeLessThan(0.25);
    expect(turnFor(2, 0, 1, 12, { analog: true })).toBe(1);
    expect(turnFor(2, 0, -1 / 3, 12, { analog: true })).toBeCloseTo(-turnFor(2, 0, 1 / 3, 12, { analog: true }), 6);
  });

  it('reads the kept settings back inside their sliders', () => {
    expect(readDriving(null)).toEqual(DRIVING_DEFAULTS);
    expect(readDriving({ steer: 99, assist: -3, camera: 'x' })).toEqual({ ...DRIVING_DEFAULTS, steer: DRIVING.steer.max, assist: DRIVING.assist.min });
    expect(readDriving({ steer: 1.25 }).steer).toBe(1.25);
  });

  it('straightens out of a slide sooner the more help it’s given', () => {
    // a dab of the handbrake: the tail a little way out
    const slid = run(onCentral(20, -60), { throttle: 0, steer: 1, handbrake: true }, 0.2).car;
    expect(drift(slid)).toBeGreaterThan(0.1);
    expect(drift(slid)).toBeLessThan(0.3);
    const left = (assist) => drift(run(slid, { throttle: 0.3, steer: 0, assist }, 0.15).car);
    expect(left(DRIVING.assist.max)).toBeLessThan(left(0));
  });
});

describe('the traffic', () => {
  it('has a corner wherever two streets cross, and a stretch of street between each pair', () => {
    expect(NODES).toHaveLength(GRID.xs.length * GRID.zs.length);
    expect(EDGES).toHaveLength((GRID.xs.length - 1) * GRID.zs.length + (GRID.zs.length - 1) * GRID.xs.length);
    // lights all along Central
    for (const x of GRID.xs) expect(NODES.find((n) => n.x === x && n.z === 0).signal).toBe(true);
  });

  it('runs the lights east–west then north–south, never both green', () => {
    for (let t = 0; t < SIGNAL.cycle * 2; t += 0.25) {
      const s = signalAt(t);
      expect(s.ew === 'red' || s.ns === 'red').toBe(true);
    }
    expect(signalAt(1).ew).toBe('green');
    expect(signalAt(SIGNAL.cycle / 2 + 1).ns).toBe('green');
  });

  it('keeps every car on the streets, apart, and moving, for five minutes', () => {
    const cars = createStreets(36);
    let t = 0;
    let closest = Infinity;
    const still = new Map();
    for (let i = 0; i < 60 * 300; i++) {
      t += 1 / 60;
      stepTraffic(cars, 1 / 60, t);
      if (i % 20) continue;
      for (const c of cars) {
        expect(onRoad(c.x, c.z), `${c.id} at ${c.x.toFixed(1)},${c.z.toFixed(1)}`).toBe(true);
        still.set(c.id, c.speed < 0.2 ? (still.get(c.id) ?? 0) + 1 / 3 : 0);
        expect(still.get(c.id), `${c.id} stuck`).toBeLessThan(60);
      }
      for (let a = 0; a < cars.length; a++) for (let b = a + 1; b < cars.length; b++) closest = Math.min(closest, Math.hypot(cars[a].x - cars[b].x, cars[a].z - cars[b].z));
    }
    expect(closest).toBeGreaterThan(2.4);
  });

  it('stops at a red light', () => {
    const cars = createStreets(24);
    let t = 0;
    for (let i = 0; i < 60 * 120; i++) {
      t += 1 / 60;
      const before = cars.map((c) => ({ seg: c.seg, node: c.path.node, axis: EDGES[c.e].axis }));
      stepTraffic(cars, 1 / 60, t);
      const light = signalAt(t);
      cars.forEach((c, k) => {
        const b = before[k];
        // into a corner with lights, only on green or amber
        if (b.seg === 'lane' && c.seg === 'turn' && NODES[b.node].signal) expect(b.axis === 'x' ? light.ew : light.ns).not.toBe('red');
      });
    }
  });

  it('takes Hank round his blocks, in the traffic and on the road', () => {
    const cars = createStreets(20);
    const hank = cars[0];
    const seen = new Set();
    let t = 0;
    for (let i = 0; i < 60 * 150; i++) {
      t += 1 / 60;
      stepTraffic(cars, 1 / 60, t);
      if (i % 30 === 0) expect(onRoad(hank.x, hank.z)).toBe(true);
      if (hank.seg === 'turn') seen.add(hank.turnNode);
    }
    for (const n of HANK_ROUTE) expect(seen.has(n), `node ${n}`).toBe(true);
    expect([...seen].every((n) => HANK_ROUTE.includes(n))).toBe(true);
  });

  it('waits behind you when you stop in its lane', () => {
    const cars = createStreets(30);
    const you = { x: 0, z: 0, yaw: 0, speed: 0 };
    let t = 0;
    for (let i = 0; i < 60 * 60; i++) {
      t += 1 / 60;
      stepTraffic(cars, 1 / 60, t, [you]);
      for (const c of cars) expect(Math.hypot(c.x - you.x, c.z - you.z), c.id).toBeGreaterThan(2.6);
    }
  });
});

describe('Hank’s heat', () => {
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

  it('leaves you be while you’re parked or crawling with nothing on board, however close he goes by', () => {
    let heat = 0;
    for (let i = 0; i < 600; i++) heat = stepHeat(heat, 5, 1 / 30, { speed: 0, load: false }).heat;
    expect(heat).toBe(0);
    for (let i = 0; i < 600; i++) heat = stepHeat(heat, 5, 1 / 30, { speed: 6, load: false }).heat;
    expect(heat).toBe(0);
    // (racing past him, or sitting by him with a load on, is another matter)
    for (let i = 0; i < 60; i++) heat = stepHeat(heat, 8, 1 / 30, { speed: 20, load: false }).heat;
    expect(heat).toBeGreaterThan(0.3);
    let loaded = 0;
    for (let i = 0; i < 60; i++) loaded = stepHeat(loaded, 8, 1 / 30, { speed: 0, load: true }).heat;
    expect(loaded).toBeGreaterThan(0.3);
  });
});

describe('Blue Sky', () => {
  it('leaves every crystal where the car can get to it', async () => {
    const { CRYSTALS } = await import('./rules');
    expect(CRYSTALS).toHaveLength(12);
    expect(new Set(CRYSTALS.map((c) => c.id)).size).toBe(12);
    for (const c of CRYSTALS) {
      expect(Math.hypot(c.x, c.z)).toBeLessThan(WORLD_RADIUS - 5);
      expect(onRoad(c.x, c.z)).toBe(false);
      for (const b of COLLIDERS) expect(reach(b, c.x, c.z), `${c.id} by ${b.id}`).toBeGreaterThan(CAR.radius + 1);
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
    const { DUNES, groundHeight } = await import('./rules');
    expect(groundHeight(0, 0)).toBe(0);
    expect(groundHeight(DUNES - 1, 0)).toBe(0);
    // the whole city is on the flat
    for (const x of [GRID.xs[0], GRID.xs.at(-1)]) for (const z of [GRID.zs[0], GRID.zs.at(-1)]) expect(groundHeight(x, z)).toBe(0);
    for (let a = 0; a < 6.28; a += 0.2) {
      const y = groundHeight(Math.cos(a) * WORLD_RADIUS, Math.sin(a) * WORLD_RADIUS);
      expect(y).toBeGreaterThan(-2);
      expect(y).toBeLessThan(9);
      // no step where the dunes begin
      expect(Math.abs(groundHeight(Math.cos(a) * (DUNES + 2), Math.sin(a) * (DUNES + 2)))).toBeLessThan(0.2);
    }
  });

  it('stops the car at each building where its walls are, not short of them', async () => {
    const { LANDMARKS } = await import('./rules');
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
    const { DROPS, RUN, startRun } = await import('./rules');
    for (const d of DROPS) {
      expect(Math.hypot(d.x, d.z), d.id).toBeLessThan(WORLD_RADIUS - 10);
      for (const b of COLLIDERS) expect(reach(b, d.x, d.z)).toBeGreaterThan(CAR.radius + 2);
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
    const { WASH, atWash } = await import('./rules');
    expect(atWash(WASH.x + 1, WASH.z)).toBe(true);
    expect(atWash(WASH.x + 20, WASH.z)).toBe(false);
    const b = COLLIDERS.find((c) => c.id === 'carwash');
    expect(reach(b, WASH.x, WASH.z)).toBeGreaterThan(CAR.radius);
    for (const c of COLLIDERS) expect(reach(c, WASH.x, WASH.z), c.id).toBeGreaterThan(CAR.radius);
  });
});

describe('the rest of town', () => {
  it('stands every building clear of the roads, the doors, the wash, and each other', async () => {
    const { DROPS, TOWN, WASH } = await import('./rules');
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

  it('keeps the city’s buildings, walls and parked cars off every road', () => {
    const bad = [];
    for (const b of COLLIDERS)
      for (const r of ROADS) {
        // (every road runs along x or along z)
        const [lo, hi] = r.a.z === r.b.z ? [Math.min(r.a.x, r.b.x), Math.max(r.a.x, r.b.x)] : [Math.min(r.a.z, r.b.z), Math.max(r.a.z, r.b.z)];
        const along = r.a.z === r.b.z ? [b.x - b.w / 2, b.x + b.w / 2] : [b.z - b.d / 2, b.z + b.d / 2];
        const apart = Math.max(0, lo - along[1], along[0] - hi);
        const across = r.a.z === r.b.z ? Math.max(0, Math.abs(b.z - r.a.z) - b.d / 2) : Math.max(0, Math.abs(b.x - r.a.x) - b.w / 2);
        if (Math.hypot(apart, across) <= r.w / 2 + 0.5) bad.push(`${b.id} on ${r.id}`);
      }
    expect(bad).toEqual([]);
  });
});

describe('Albuquerque, the world: the way out', () => {
  const step = (safe, car, bump, seconds) => {
    for (let t = 0; t < seconds - 1e-9; t += 0.05) safe.step(car, bump, 0.05);
  };

  it('starts where you start, and keeps the spot every half second of clean driving', () => {
    const safe = createSafeSpot({ x: 1, z: 2, yaw: 0.5 });
    expect(safe.spot).toEqual({ x: 1, z: 2, yaw: 0.5 });
    step(safe, { x: 10, z: 0, yaw: 1, speed: 8 }, 0, 0.45);
    expect(safe.spot.x).toBe(1);
    step(safe, { x: 10, z: 0, yaw: 1, speed: 8 }, 0, 0.05);
    expect(safe.spot).toEqual({ x: 10, z: 0, yaw: 1 });
  });

  it('never keeps a spot within half a second of a bump, or parked', () => {
    const safe = createSafeSpot({ x: 0, z: 0, yaw: 0 });
    step(safe, { x: 5, z: 5, yaw: 0, speed: 8 }, 0, 0.4);
    safe.step({ x: 6, z: 5, yaw: 0, speed: 3 }, 6, 0.05);
    step(safe, { x: 6, z: 5, yaw: 0, speed: 3 }, 0, 0.4);
    expect(safe.spot.x).toBe(0);
    // stood still (wedged, or parked) for any time: not a spot to come back to
    step(safe, { x: 7, z: 5, yaw: 0, speed: 0.2 }, 0, 3);
    expect(safe.spot.x).toBe(0);
  });

  it('puts the car back there stopped, facing the way it went', () => {
    const safe = createSafeSpot({ x: 3, z: 4, yaw: 2 });
    expect(safe.back()).toEqual({ x: 3, z: 4, yaw: 2, speed: 0, slide: 0, yawRate: 0 });
    const car = safe.back();
    car.x = 99;
    expect(safe.spot.x).toBe(3);
  });

  it('keeps nothing broken: a frame with no time, or none at all, changes nothing', () => {
    const safe = createSafeSpot({ x: 0, z: 0, yaw: 0 });
    safe.step({ x: 9, z: 9, yaw: 0, speed: 9 }, 0, NaN);
    safe.step({ x: 9, z: 9, yaw: 0, speed: 9 }, 0, 0);
    expect(safe.spot.x).toBe(0);
    safe.step({ x: NaN, z: 9, yaw: 0, speed: 9 }, 0, 1);
    expect(safe.spot.x).toBe(0);
  });
});

describe('Albuquerque, the world: the street’s props', () => {
  it('stands every prop on Central’s asphalt, clear of the buildings and the junctions', () => {
    expect(STREET_PROPS.length).toBeGreaterThan(20);
    for (const p of STREET_PROPS) {
      expect(onRoad(p.x, p.z), `${p.kind} at ${p.x}`).toBe(true);
      for (const c of COLLIDERS) expect(reach(c, p.x, p.z), `${p.kind} at ${p.x} by ${c.id}`).toBeGreaterThan(1);
      expect(Math.min(...GRID.xs.map((x) => Math.abs(p.x - x))), `${p.kind} at ${p.x}`).toBeGreaterThan(10);
    }
  });

  it('keeps them out of the traffic’s lanes', () => {
    // (a lane on Central runs 2.2 and 5.8 m either side of the middle, a car 2 m wide)
    for (const p of STREET_PROPS) expect(Math.abs(p.z)).toBeGreaterThan(5.8 + 1);
  });
});
