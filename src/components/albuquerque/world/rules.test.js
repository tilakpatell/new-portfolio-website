import { describe, expect, it } from 'vitest';
import { CAR, COLLIDERS, DRIVING, DRIVING_DEFAULTS, PLACES, ROADS, SPAWN, WORLD_RADIUS, hankAt, nearPlace, onRoad, progress, readDriving, slipOf, stepCar, stepHeat, stepSteer } from './rules';

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

// Central Avenue runs east–west through (0, 0) with nothing on it: room to
// throw the car about. East is yaw π/2.
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
    expect(far).toBeLessThan(12); // Central is 12 m wide
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
    const sand = run({ x: 160, z: 140, yaw: EAST, speed: 11 }, { throttle: 1, steer: 1 }, 0.8);
    expect(onRoad(160, 140)).toBe(false);
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
    let car = { x: wall.x - wall.w / 2 - 4, z: south + CAR.radius + 0.4, yaw: EAST + 0.12, speed: 14 };
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
    // flat out along Central's edge, then off it
    const off = run({ x: 90, z: 140, yaw: EAST, speed: CAR.top }, { throttle: 1, steer: 0 }, 0.5).car;
    expect(onRoad(90, 140)).toBe(false);
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
