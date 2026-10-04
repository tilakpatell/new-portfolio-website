import { describe, expect, it } from 'vitest';
import { ROLL, boostSpeed, jump, newRun, stagesFor, stepRun, transform } from './rules';
import { autopilot } from './pilot';

const DT = 1 / 60;
// run for `secs` with the given held input (and an optional per-frame hook)
const run = (g, secs, input = {}, each) => {
  for (let t = 0; t < secs && g.status === 'running'; t += DT) {
    g.input = { steer: 0, boost: false, ...input };
    each?.(g);
    stepRun(g, DT);
  }
};
// nothing on the road but what the test puts there
const quiet = (g) => {
  g.cars = [];
  g.debris = [];
  g.barricades = [];
  g.gaps = [];
  g.cubes = [];
  g.enemies = [];
  g.bolts = [];
  g.bombs = [];
  g.triggers = [];
  g.sparks = [];
};
const settle = (g, secs = ROLL.transformTime + 0.6) => run(g, secs);

describe('rolling out', () => {
  it('starts in vehicle mode, on the road, with the bot’s shields and some energon', () => {
    const g = newRun({ seed: 1, bot: 'optimus', level: 'autobot' });
    expect(g.status).toBe('running');
    expect(g.mode).toBe('vehicle');
    expect(g.morph).toBe(0);
    expect(g.shields).toBe(ROLL.bots.optimus.shields);
    expect(g.energon).toBe(ROLL.energon.start);
    expect(g.stage).toBe(0);
    expect(g.cars.length + g.debris.length + g.barricades.length + g.gaps.length).toBeGreaterThan(10);
  });

  it('gives Bumblebee fewer shields than Optimus, and the levels more or fewer', () => {
    expect(newRun({ seed: 1, bot: 'bumblebee' }).shields).toBeLessThan(newRun({ seed: 1, bot: 'optimus' }).shields);
    expect(newRun({ seed: 1, level: 'recruit' }).shields).toBeGreaterThan(newRun({ seed: 1, level: 'prime' }).shields);
  });

  it('lays the same road for the same seed, and a different one for another', () => {
    const a = newRun({ seed: 9 });
    const b = newRun({ seed: 9 });
    const c = newRun({ seed: 10 });
    expect(a.barricades.map((x) => x.z)).toEqual(b.barricades.map((x) => x.z));
    expect(a.cars.map((x) => [x.x, x.z])).toEqual(b.cars.map((x) => [x.x, x.z]));
    expect(JSON.stringify(a.cars.map((x) => x.z))).not.toBe(JSON.stringify(c.cars.map((x) => x.z)));
  });

  it('never blocks all four lanes at once with traffic and debris', () => {
    for (let seed = 1; seed < 30; seed++) {
      const g = newRun({ seed, level: 'prime' });
      const blockers = [...g.cars, ...g.debris].sort((p, q) => p.z - q.z);
      for (const b of blockers) {
        const near = blockers.filter((o) => Math.abs(o.z - b.z) < 5);
        const lanes = new Set(near.map((o) => o.lane));
        expect(lanes.size).toBeLessThan(4);
      }
    }
  });

  it('leaves room to transform before every barricade and gap', () => {
    for (let seed = 1; seed < 30; seed++) {
      const g = newRun({ seed });
      const walls = [...g.barricades.map((b) => b.z), ...g.gaps.map((p) => p.z - ROLL.ramp.len)].sort((a, b) => a - b);
      for (let i = 1; i < walls.length; i++) expect(walls[i] - walls[i - 1]).toBeGreaterThanOrEqual(ROLL.spacing.wall);
    }
  });
});

describe('driving', () => {
  it('steers toward the input and stays on the road', () => {
    const g = newRun({ seed: 2 });
    quiet(g);
    run(g, 2, { steer: 1 });
    expect(g.x).toBeGreaterThan(4);
    expect(g.x).toBeLessThanOrEqual(ROLL.bounds + 1e-9);
    run(g, 3, { steer: -1 });
    expect(g.x).toBeGreaterThanOrEqual(-ROLL.bounds - 1e-9);
    expect(g.x).toBeLessThan(-4);
  });

  it('moves down the road at vehicle speed, and faster on boost while it burns energon', () => {
    const g = newRun({ seed: 3 });
    quiet(g);
    run(g, 1.5);
    const cruise = g.speed;
    expect(cruise).toBeCloseTo(g.vehicleSpeed, 0);
    const e0 = g.energon;
    run(g, 1.2, { boost: true });
    expect(g.speed).toBeGreaterThan(cruise * 1.2);
    expect(g.speed).toBeLessThanOrEqual(boostSpeed(g) + 1e-6);
    expect(g.energon).toBeLessThan(e0);
  });

  it('pays for distance, more as a vehicle than as a robot', () => {
    const g = newRun({ seed: 3 });
    quiet(g);
    run(g, 2);
    expect(g.score).toBeGreaterThan(g.z * 0.9);
    const h = newRun({ seed: 3 });
    quiet(h);
    transform(h);
    run(h, 2);
    expect(h.score).toBeGreaterThan(0);
    expect(h.score).toBeLessThan(g.score);
  });

  it('charges energon back in vehicle mode', () => {
    const g = newRun({ seed: 3 });
    quiet(g);
    g.energon = 20;
    run(g, 2);
    expect(g.energon).toBeGreaterThan(20);
  });
});

describe('transforming', () => {
  it('takes a moment, and ends standing as a robot, slower', () => {
    const g = newRun({ seed: 4 });
    quiet(g);
    run(g, 1);
    expect(transform(g)).toBe(true);
    stepRun(g, DT);
    expect(g.morph).toBeGreaterThan(0);
    expect(g.morph).toBeLessThan(1);
    settle(g, ROLL.transformTime + 1.5);
    expect(g.mode).toBe('robot');
    expect(g.morph).toBe(1);
    expect(g.speed).toBeCloseTo(g.robotSpeed, 0);
    expect(g.events.some((e) => e.type === 'transform' && e.to === 'robot') || g.log.includes('transform:robot')).toBe(true);
  });

  it('won’t stand up as a robot without energon to run on', () => {
    const g = newRun({ seed: 4 });
    quiet(g);
    g.energon = 2;
    expect(transform(g)).toBe(false);
    expect(g.mode).toBe('vehicle');
  });

  it('drains energon as a robot, and folds back into the vehicle when it runs out', () => {
    const g = newRun({ seed: 5 });
    quiet(g);
    transform(g);
    settle(g);
    const e0 = g.energon;
    run(g, 1);
    expect(g.energon).toBeLessThan(e0);
    g.energon = 0.5;
    run(g, 1.5);
    expect(g.mode).toBe('vehicle');
    expect(g.log).toContain('empty');
  });

  it('keeps a jump pressed while standing up, and jumps as soon as the robot can', () => {
    const g = newRun({ seed: 6 });
    quiet(g);
    run(g, 0.5);
    transform(g);
    run(g, 0.1);
    expect(g.morph).toBeLessThan(0.6);
    expect(jump(g)).toBe(false); // too soon to jump, but it's kept
    let top = 0;
    run(g, 0.8, {}, (s) => (top = Math.max(top, s.y)));
    expect(g.log).toContain('jump');
    expect(top).toBeGreaterThan(1.5);
  });

  it('a jump kept through a transform is dropped if it folds back into the vehicle', () => {
    const g = newRun({ seed: 6 });
    quiet(g);
    transform(g);
    run(g, 0.05);
    jump(g);
    run(g, ROLL.transformTime + 0.2);
    transform(g); // straight back
    run(g, 1);
    expect(g.log.filter((l) => l === 'jump').length).toBeLessThanOrEqual(1);
  });

  it('transforming with boost held leaps as it stands, carrying the speed into the air', () => {
    const g = newRun({ seed: 6 });
    quiet(g);
    g.energon = 100;
    run(g, 1.5, { boost: true });
    const fast = g.speed;
    expect(fast).toBeGreaterThan(g.vehicleSpeed * 1.2);
    g.input = { steer: 0, boost: true };
    transform(g);
    let leapSpeed = 0;
    run(g, 0.7, { boost: true }, (s) => {
      if (!leapSpeed && !s.grounded) leapSpeed = s.speed;
    });
    expect(g.log).toContain('leap');
    expect(leapSpeed).toBeGreaterThan(g.robotSpeed * 1.25);
    expect(leapSpeed).toBeLessThanOrEqual(g.vehicleSpeed * ROLL.leap + 1e-6);
  });

  it('a leap still can’t clear a broken bridge: that takes the vehicle and the ramp', () => {
    for (const level of ['recruit', 'autobot', 'prime']) {
      for (let lead = 0.3; lead < 1.6; lead += 0.1) {
        const g = newRun({ seed: 8, level });
        quiet(g);
        g.energon = 100;
        run(g, 1.5, { boost: true });
        // the ramp starts `lead` seconds ahead at boost speed
        g.gaps.push({ z: g.z + ROLL.ramp.len + g.speed * lead, len: g.gapLen });
        g.input = { steer: 0, boost: true };
        transform(g);
        run(g, 4, { boost: true });
        expect({ level, lead, cleared: g.log.includes('clear:gap') }).toMatchObject({ cleared: false });
      }
    }
  });

  it('jumps only as a robot, and only from the ground', () => {
    const g = newRun({ seed: 6 });
    quiet(g);
    expect(jump(g)).toBe(false);
    transform(g);
    settle(g);
    expect(jump(g)).toBe(true);
    stepRun(g, DT);
    expect(g.y).toBeGreaterThan(0);
    run(g, 0.1);
    expect(jump(g)).toBe(false);
    run(g, 1.5);
    expect(g.y).toBe(0);
    expect(g.grounded).toBe(true);
  });
});

describe('what each mode is for', () => {
  const barricadeAhead = (g, dist = 30) => {
    g.barricades.push({ z: g.z + dist, l: ROLL.barricade.l, h: ROLL.barricade.h, broken: false });
  };

  it('a barricade wrecks a car that drives into it', () => {
    const g = newRun({ seed: 7 });
    quiet(g);
    barricadeAhead(g);
    const s0 = g.shields;
    run(g, 2);
    expect(g.shields).toBe(s0 - 1);
    expect(g.log).toContain('hit:barricade');
  });

  it('a robot that jumps clears the barricade', () => {
    const g = newRun({ seed: 7 });
    quiet(g);
    transform(g);
    settle(g);
    barricadeAhead(g, 14);
    const s0 = g.shields;
    const b = g.barricades[0];
    // jump when the barricade is a few metres off
    run(g, 2.5, {}, (s) => {
      if (s.grounded && b.z - s.z < 6 && b.z - s.z > 1) jump(s);
    });
    expect(g.shields).toBe(s0);
    expect(g.z).toBeGreaterThan(b.z + 2);
  });

  it('a robot that walks into the barricade is hit', () => {
    const g = newRun({ seed: 7 });
    quiet(g);
    transform(g);
    settle(g);
    barricadeAhead(g, 10);
    const s0 = g.shields;
    run(g, 2);
    expect(g.shields).toBe(s0 - 1);
  });

  const gapAhead = (g, dist = 40) => {
    const len = g.gapLen;
    g.gaps.push({ z: g.z + dist, len });
  };

  it('a car takes the ramp and flies the broken bridge', () => {
    const g = newRun({ seed: 8, level: 'recruit' });
    quiet(g);
    gapAhead(g);
    const gap = g.gaps[0];
    const s0 = g.shields;
    let flew = false;
    run(g, 4, {}, (s) => {
      if (s.y > 1.2) flew = true;
    });
    expect(flew).toBe(true);
    expect(g.shields).toBe(s0);
    expect(g.z).toBeGreaterThan(gap.z + gap.len);
  });

  it('a robot can’t jump the broken bridge, and is dropped on the far side for a shield', () => {
    for (const level of ['recruit', 'autobot', 'prime']) {
      const g = newRun({ seed: 8, level });
      quiet(g);
      transform(g);
      settle(g);
      gapAhead(g, 20);
      const gap = g.gaps[0];
      const s0 = g.shields;
      // the best a robot can do: jump right at the lip
      run(g, 5, {}, (s) => {
        if (s.grounded && s.z >= gap.z - 0.25) jump(s);
      });
      expect(g.shields).toBe(s0 - 1);
      expect(g.log).toContain('fell');
      expect(g.z).toBeGreaterThan(gap.z + gap.len);
      expect(g.y).toBeGreaterThanOrEqual(0);
    }
  });

  it('a robot’s blaster takes down a Vehicon in its way, and scores it', () => {
    const g = newRun({ seed: 9 });
    quiet(g);
    transform(g);
    settle(g);
    g.enemies.push({ kind: 'vehicon', state: 'stand', x: g.x, z: g.z + 26, hp: ROLL.vehicon.hp, cool: 99, alive: true, t: 0 });
    const s0 = g.score;
    run(g, 2);
    expect(g.enemies.every((e) => !e.alive)).toBe(true);
    expect(g.kills.vehicon).toBe(1);
    expect(g.score).toBeGreaterThan(s0 + ROLL.points.vehicon - 1);
  });

  it('a car has no guns', () => {
    const g = newRun({ seed: 9 });
    quiet(g);
    g.enemies.push({ kind: 'vehicon', state: 'stand', x: 4.5, z: g.z + 26, hp: ROLL.vehicon.hp, cool: 99, alive: true, t: 0 });
    g.x = g.tx = -4.5;
    run(g, 0.4, { steer: -1 });
    expect(g.shots.length).toBe(0);
    expect(g.enemies[0].alive).toBe(true);
  });

  it('boosting smashes debris instead of being wrecked by it', () => {
    const g = newRun({ seed: 10 });
    quiet(g);
    const rock = { x: g.x, lane: 1, z: g.z + 25, w: 1.6, l: 1.4, h: 1.1, hp: 2, alive: true };
    g.debris.push(rock);
    const s0 = g.shields;
    run(g, 1.6, { boost: true });
    expect(g.shields).toBe(s0);
    expect(rock.alive).toBe(false);
    expect(g.kills.debris).toBe(1);
  });
});

describe('reading the road pays', () => {
  const barricadeAhead = (g, dist) => g.barricades.push({ z: g.z + dist, l: ROLL.barricade.l, h: ROLL.barricade.h, broken: false });
  // jump when the barricade is a few metres off
  const hop = (b) => (s) => {
    if (s.mode === 'robot' && s.morph > 0.6 && s.grounded && b.z - s.z < 6 && b.z - s.z > 1) jump(s);
  };

  it('jumping a roadblock scores the clear', () => {
    const g = newRun({ seed: 40 });
    quiet(g);
    transform(g);
    settle(g, 2.5);
    barricadeAhead(g, 14);
    const b = g.barricades[0];
    const s0 = g.points;
    run(g, 2.5, {}, hop(b));
    expect(g.log).toContain('clear:barricade');
    expect(g.clears).toBe(1);
    const e = g.events.find((x) => x.type === 'cleared');
    expect(e).toMatchObject({ kind: 'barricade', clutch: false });
    expect(g.points - s0).toBeGreaterThanOrEqual(ROLL.points.clear.barricade);
  });

  it('standing up just in time for the roadblock pays double', () => {
    const g = newRun({ seed: 41 });
    quiet(g);
    run(g, 1);
    // a second out at vehicle speed: transform now, jump when it's close
    barricadeAhead(g, g.speed * 0.95);
    const b = g.barricades[0];
    transform(g);
    run(g, 2.5, {}, hop(b));
    const e = g.events.find((x) => x.type === 'cleared');
    expect(e).toMatchObject({ kind: 'barricade', clutch: true, points: ROLL.points.clear.barricade * 2 });
    expect(g.shields).toBe(g.maxShields);
  });

  it('flying a broken bridge scores the clear; a robot dropped through it doesn’t', () => {
    const g = newRun({ seed: 42, level: 'recruit' });
    quiet(g);
    g.gaps.push({ z: g.z + 40, len: g.gapLen });
    run(g, 4);
    expect(g.log).toContain('clear:gap');
    expect(g.events.find((x) => x.type === 'cleared')).toMatchObject({ kind: 'gap' });

    const h = newRun({ seed: 42, level: 'recruit' });
    quiet(h);
    transform(h);
    settle(h);
    h.gaps.push({ z: h.z + 20, len: h.gapLen });
    run(h, 5);
    expect(h.log).toContain('fell');
    expect(h.log).not.toContain('clear:gap');
  });

  it('folding into the vehicle just before the ramp pays double for the bridge', () => {
    const g = newRun({ seed: 43, level: 'recruit' });
    quiet(g);
    transform(g);
    settle(g, 1.5);
    g.energon = 100;
    // the ramp starts a second away at robot speed
    g.gaps.push({ z: g.z + ROLL.ramp.len + g.speed * 1.0, len: g.gapLen });
    transform(g);
    run(g, 5);
    expect(g.events.find((x) => x.type === 'cleared')).toMatchObject({ kind: 'gap', clutch: true, points: ROLL.points.clear.gap * 2 });
  });

  it('transforming in the air off a ramp and landing it is a stunt', () => {
    const g = newRun({ seed: 44, level: 'recruit' });
    quiet(g);
    g.energon = 100;
    g.gaps.push({ z: g.z + 40, len: g.gapLen });
    let turned = false;
    run(g, 4, {}, (s) => {
      if (!turned && !s.grounded && s.vy > 0) turned = transform(s);
    });
    expect(turned).toBe(true);
    expect(g.mode).toBe('robot');
    expect(g.log).toContain('stunt:aerial');
    expect(g.stunts).toBe(1);
    expect(g.shields).toBe(g.maxShields);
  });
});

describe('getting hurt', () => {
  it('a bolt costs a shield, and a moment of cover stops the next one', () => {
    const g = newRun({ seed: 11 });
    quiet(g);
    const s0 = g.shields;
    g.bolts.push({ x: g.x, y: 0.9, z: g.z + 6, vx: 0, vz: -30, life: 2 });
    g.bolts.push({ x: g.x, y: 0.9, z: g.z + 7, vx: 0, vz: -30, life: 2 });
    run(g, 0.8);
    expect(g.shields).toBe(s0 - 1);
  });

  // a bomb marked where the car will be when it goes off
  const bombOnPath = (g, x) => {
    run(g, 1);
    g.bombs.push({ x, z: g.z + g.speed * 0.8, t: 0, fuse: 0.8, r: ROLL.bomb.r, done: false });
  };

  it('bombs mark the road first, then go off where they marked', () => {
    const g = newRun({ seed: 12 });
    quiet(g);
    g.x = g.tx = -4.5;
    bombOnPath(g, -4.5);
    const s0 = g.shields;
    run(g, 0.4);
    expect(g.shields).toBe(s0); // only marked so far
    run(g, 0.8);
    expect(g.bombs.every((b) => b.done)).toBe(true);
    expect(g.shields).toBe(s0 - 1);
  });

  it('dodging a bomb by changing lane keeps the shields', () => {
    const g = newRun({ seed: 12 });
    quiet(g);
    g.x = g.tx = -4.5;
    bombOnPath(g, -4.5);
    const s0 = g.shields;
    run(g, 1.2, { steer: 1 });
    expect(g.shields).toBe(s0);
  });

  it('hitting a car costs a shield; passing close by one pays', () => {
    const g = newRun({ seed: 13 });
    quiet(g);
    g.cars.push({ x: g.x, lane: 1, z: g.z + 20, speed: 10, w: 1.8, l: 3.8, alive: true });
    const s0 = g.shields;
    run(g, 1.5);
    expect(g.shields).toBe(s0 - 1);

    const h = newRun({ seed: 13 });
    quiet(h);
    h.x = h.tx = 0;
    h.cars.push({ x: 2.15, lane: 2, z: h.z + 20, speed: 10, w: 1.8, l: 3.8, alive: true });
    run(h, 2);
    expect(h.shields).toBe(ROLL.bots[h.bot].shields);
    expect(h.log).toContain('near');
  });

  it('runs out of shields and the run is lost', () => {
    const g = newRun({ seed: 14 });
    quiet(g);
    g.shields = 1;
    g.bolts.push({ x: g.x, y: 0.9, z: g.z + 4, vx: 0, vz: -30, life: 2 });
    run(g, 0.5);
    expect(g.status).toBe('lost');
  });

  it('energon cubes refill energon and score', () => {
    const g = newRun({ seed: 15 });
    quiet(g);
    g.energon = 30;
    for (let i = 0; i < 4; i++) g.cubes.push({ x: g.x, z: g.z + 12 + i * 3, y: 0.9, taken: false });
    run(g, 1.5);
    expect(g.cubes.every((c) => c.taken)).toBe(true);
    expect(g.energon).toBeGreaterThan(30 + ROLL.energon.cube * 3);
    expect(g.score).toBeGreaterThanOrEqual(ROLL.points.cube * 4);
  });
});

describe('the boss and the stages', () => {
  const toBoss = (g) => {
    quiet(g);
    g.z = g.stageLen - 1;
    run(g, 0.3);
  };

  it('brings out the stage’s boss at the end of the road', () => {
    const g = newRun({ seed: 16 });
    toBoss(g);
    expect(g.boss).toBeTruthy();
    expect(g.boss.kind).toBe(ROLL.stages[0].boss);
    expect(g.log).toContain('boss');
  });

  it('only a robot can hurt the boss', () => {
    const g = newRun({ seed: 17 });
    toBoss(g);
    g.boss.cool = 99;
    const hp = g.boss.hp;
    run(g, 1);
    expect(g.boss.hp).toBe(hp);
    transform(g);
    run(g, 2.5, {}, (s) => {
      if (s.boss) s.boss.cool = 99;
      s.x = s.tx = s.boss ? s.boss.x : 0;
    });
    expect(g.boss.hp).toBeLessThan(hp);
  });

  it('gets angrier as it weakens', () => {
    const g = newRun({ seed: 18 });
    toBoss(g);
    expect(g.boss.phase).toBe(1);
    g.boss.hp = g.boss.max * 0.5;
    run(g, 0.1);
    expect(g.boss.phase).toBe(2);
    g.boss.hp = g.boss.max * 0.2;
    run(g, 0.1);
    expect(g.boss.phase).toBe(3);
  });

  it('bridges to the next stage when the boss goes down, and wins after the last', () => {
    const g = newRun({ seed: 19 });
    toBoss(g);
    g.boss.hp = 0.5;
    transform(g);
    run(g, 3, {}, (s) => {
      if (s.boss) {
        s.boss.cool = 99;
        s.x = s.tx = s.boss.x;
      }
    });
    run(g, ROLL.bridgeTime + 1.5);
    expect(g.stage).toBe(1);
    expect(g.log).toContain('stage:1');
    expect(g.cars.length + g.barricades.length).toBeGreaterThan(5);

    const w = newRun({ seed: 20, stage: 2 });
    toBoss(w);
    w.boss.hp = 0.5;
    transform(w);
    run(w, 4, {}, (s) => {
      if (s.boss) {
        s.boss.cool = 99;
        s.x = s.tx = s.boss.x;
      }
    });
    expect(w.status).toBe('won');
  });

  // a robot in front of the boss, blaster up, as the boss starts to charge `attack`
  const facing = (g, attack) => {
    toBoss(g);
    g.energon = 100;
    transform(g);
    run(g, 2, {}, (s) => {
      s.boss.cool = 99;
      s.boss.dz = ROLL.bosses[s.boss.kind].dz;
      s.x = s.tx = s.boss.x;
    });
    g.boss.next = ROLL.bosses[g.boss.kind].attacks.indexOf(attack);
    g.boss.cool = 0;
  };

  it('pouring fire into a boss while it charges staggers it: the attack is off and it takes double', () => {
    const g = newRun({ seed: 23, stage: 2 });
    facing(g, 'fusion');
    const hp0 = g.boss.hp;
    run(g, 1.2, {}, (s) => {
      s.x = s.tx = s.boss.x;
    });
    expect(g.log).toContain('stagger');
    expect(g.beams.length).toBe(0);
    expect(g.warn).toBe(null);
    expect(g.boss.attack).toBe(null);
    expect(g.boss.exposed).toBeGreaterThan(0);
    // exposed: each hit counts double
    const hp = g.boss.hp;
    const hits = g.log.filter((l) => l === 'bossHit').length;
    run(g, 0.5, {}, (s) => {
      s.x = s.tx = s.boss.x;
      s.boss.cool = 99;
    });
    const more = g.log.filter((l) => l === 'bossHit').length - hits;
    expect(more).toBeGreaterThan(0);
    expect(hp - g.boss.hp).toBe(more * ROLL.bots.optimus.dmg * ROLL.stagger.mult);
    expect(hp0 - g.boss.hp).toBeGreaterThan(0);
  });

  it('a boss charging with nobody shooting at it isn’t staggered', () => {
    const g = newRun({ seed: 24, stage: 2 });
    toBoss(g);
    g.boss.next = ROLL.bosses.megatron.attacks.indexOf('fusion');
    g.boss.cool = 0;
    g.x = g.tx = 4.5;
    run(g, 1.6);
    expect(g.log).not.toContain('stagger');
    expect(g.log).toContain('fusion');
  });

  it('Shockwave’s floor beam has to be jumped', () => {
    const g = newRun({ seed: 21, stage: 1 });
    toBoss(g);
    expect(g.boss.kind).toBe('shockwave');
    g.waves.push({ z: g.z + 12, vz: -20, h: ROLL.wave.h, life: 3 });
    const s0 = g.shields;
    run(g, 1.2);
    expect(g.shields).toBe(s0 - 1);

    const h = newRun({ seed: 21, stage: 1 });
    toBoss(h);
    h.boss.cool = 99;
    transform(h);
    settle(h);
    h.boss.cool = 99;
    h.waves.push({ z: h.z + 14, vz: -20, h: ROLL.wave.h, life: 3 });
    const s1 = h.shields;
    run(h, 1.4, {}, (s) => {
      s.boss.cool = 99;
      const w = s.waves[0];
      if (w && s.grounded && w.z - s.z < 7 && w.z - s.z > 0) jump(s);
    });
    expect(h.shields).toBe(s1);
  });
});

describe('the Decepticons’ side', () => {
  const toBoss = (g) => {
    quiet(g);
    g.z = g.stageLen - 1;
    run(g, 0.3);
  };

  it('Knock Out and Breakdown drive for the Decepticons, through to Iacon', () => {
    const g = newRun({ seed: 50, bot: 'knockout' });
    expect(g.side).toBe('decepticon');
    expect(newRun({ seed: 50, bot: 'breakdown' }).side).toBe('decepticon');
    expect(newRun({ seed: 50, bot: 'optimus' }).side).toBe('autobot');
    expect(stagesFor('decepticon').map((s) => s.id)).toEqual(['jasper', 'mission', 'iacon']);
    expect(stagesFor('decepticon').map((s) => s.boss)).toEqual(['wheeljack', 'magnus', 'optimus']);
    expect(newRun({ seed: 50, bot: 'breakdown' }).shields).toBeGreaterThan(newRun({ seed: 50, bot: 'knockout' }).shields);
  });

  it('meets the Autobots’ bosses: Wheeljack’s Jackhammer flies like Starscream, Optimus waits in Iacon', () => {
    const g = newRun({ seed: 51, bot: 'knockout' });
    toBoss(g);
    expect(g.boss.kind).toBe('wheeljack');
    expect(ROLL.bosses.wheeljack.flyer).toBe(true);
    expect(g.boss.y).toBeGreaterThan(2);
    const h = newRun({ seed: 51, bot: 'breakdown', stage: 2 });
    toBoss(h);
    expect(h.boss.kind).toBe('optimus');
    expect(h.boss.name).toBe('Optimus Prime');
  });

  it('wins by taking Iacon', () => {
    const w = newRun({ seed: 52, bot: 'knockout', stage: 2 });
    toBoss(w);
    w.boss.hp = 0.5;
    transform(w);
    run(w, 4, {}, (s) => {
      if (s.boss) {
        s.boss.cool = 99;
        s.x = s.tx = s.boss.x;
      }
    });
    expect(w.status).toBe('won');
    expect(w.events.find((e) => e.type === 'won')?.text).toMatch(/Iacon/);
  });

  it('can be driven: the autopilot clears the first stage as Breakdown on every level, and as Knock Out as a recruit', () => {
    const runs = [...['recruit', 'autobot', 'prime'].flatMap((level) => [1, 2, 3].map((seed) => ({ level, seed, bot: 'breakdown' }))), ...[1, 2, 3].map((seed) => ({ level: 'recruit', seed, bot: 'knockout' }))];
    for (const { level, seed, bot } of runs) {
      const g = newRun({ seed, level, bot });
      for (let t = 0; t < 200 && g.status === 'running' && g.stage === 0; t += DT) {
        autopilot(g);
        stepRun(g, DT);
      }
      expect({ level, bot, stage: g.stage, status: g.status }).toMatchObject({ stage: 1, status: 'running' });
    }
  });
});

describe('fair play', () => {
  it('loses a run where nobody touches the controls', () => {
    const g = newRun({ seed: 22 });
    run(g, 120);
    expect(g.status).toBe('lost');
  });

  it('can be driven: a simple autopilot clears the first stage on every level', () => {
    for (const level of ['recruit', 'autobot', 'prime']) {
      for (const seed of [1, 2, 3]) {
        const g = newRun({ seed, level });
        for (let t = 0; t < 200 && g.status === 'running' && g.stage === 0; t += DT) {
          autopilot(g);
          stepRun(g, DT);
        }
        expect({ level, seed, stage: g.stage, status: g.status }).toMatchObject({ stage: 1, status: 'running' });
      }
    }
  });

  it('replays exactly for the same seed and the same hands on the controls', () => {
    const play = () => {
      const g = newRun({ seed: 33 });
      for (let t = 0; t < 40 && g.status === 'running'; t += DT) {
        autopilot(g);
        stepRun(g, DT);
      }
      return [g.z, g.x, g.score, g.shields, g.energon].map((v) => Math.round(v * 1000));
    };
    expect(play()).toEqual(play());
  });
});
