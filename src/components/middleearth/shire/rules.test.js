import { describe, expect, it } from 'vitest';
import {
  CAST,
  COLLIDERS,
  DOG_ROUNDS,
  FIELD,
  HOBBIT,
  HOLES,
  HOLLOW,
  HUNT,
  LEAVES,
  LOBELIA,
  LOBELIA_LEN,
  MAGGOT_GATE,
  MUSHROOMS,
  PASTURE,
  QUESTS,
  RIDER,
  RIDER_RETRY,
  RINGS,
  SHOW,
  SIDE,
  SPOONS,
  SPOON_SPOTS,
  SPOTS,
  START,
  TREES,
  WORLD,
  burstScore,
  dogSees,
  groundY,
  hidden,
  hisAt,
  inField,
  inWater,
  launch,
  lobeliaAt,
  nearSpot,
  newHobbit,
  newFlock,
  newHunt,
  newRider,
  newRings,
  newShow,
  newSpoons,
  onRoad,
  progress,
  puff,
  riderTrigger,
  stepFlock,
  stepGaze,
  stepHobbit,
  stepHunt,
  stepRider,
  stepRings,
  stepShow,
  stepSpoons,
  stepStride,
  STRIDE,
  stepFade,
  FADE,
} from './rules';
import { LANDINGS } from '../../universe/landings/landings';

const DT = 1 / 60;
const walk = (h, move, seconds) => {
  for (let t = 0; t < seconds; t += DT) h = stepHobbit(h, move, DT);
  return h;
};
const blocked = (x, z) =>
  COLLIDERS.some((c) => (c.kind === 'circle' ? Math.hypot(x - c.x, z - c.z) < c.r + HOBBIT.radius : Math.abs(x - c.x) < c.w / 2 + HOBBIT.radius && Math.abs(z - c.z) < c.d / 2 + HOBBIT.radius));

describe('Hobbiton: the lie of the land', () => {
  it('starts you on the lane, on dry land', () => {
    expect(onRoad(START.x, START.z)).toBe(true);
    expect(inWater(START.x, START.z)).toBe(false);
    expect(blocked(START.x, START.z)).toBe(false);
  });

  it('puts every place to stop, and everyone to meet, where a hobbit can stand', () => {
    for (const q of QUESTS) {
      expect(blocked(q.at.x, q.at.z), q.id).toBe(false);
      expect(inWater(q.at.x, q.at.z), q.id).toBe(false);
      expect(Math.hypot(q.at.x, q.at.z), q.id).toBeLessThan(WORLD.radius);
    }
    for (const s of SPOTS) expect(blocked(s.x, s.z), s.id).toBe(false);
    for (const c of CAST) {
      expect(blocked(c.x, c.z), c.id).toBe(false);
      expect(inWater(c.x, c.z), c.id).toBe(false);
    }
  });

  it('keeps the trees off the roads and out of the water', () => {
    expect(TREES.length).toBeGreaterThan(40);
    for (const t of TREES) {
      expect(onRoad(t.x, t.z)).toBe(false);
      expect(inWater(t.x, t.z)).toBe(false);
    }
  });

  it('has the leaves under the trees the Shire’s landing has', () => {
    expect(LEAVES).toEqual(LANDINGS.middleearth.leaves);
  });

  it('grows all ten mushrooms inside Maggot’s fence, clear of everything', () => {
    expect(MUSHROOMS).toHaveLength(HUNT.mushrooms);
    for (const m of MUSHROOMS) {
      expect(inField(m.x, m.z, -1)).toBe(true);
      expect(blocked(m.x, m.z)).toBe(false);
    }
    for (const round of DOG_ROUNDS) for (const [x, z] of round) expect(inField(x, z, -1)).toBe(true);
  });

  it('lets you over the bridge, but not into the pond', () => {
    const over = walk(newHobbit({ x: 12, z: 8, face: 0 }), { x: 0, z: 1 }, 5);
    expect(over.z).toBeGreaterThan(21);
    expect(groundY(12, 15.4)).toBeGreaterThan(1.2); // up on the hump
    const wade = walk(newHobbit({ x: -6, z: 4, face: 0 }), { x: 0, z: 1 }, 4);
    expect(inWater(wade.x, wade.z)).toBe(false);
    expect(wade.z).toBeLessThan(7.6);
  });

  it('keeps you out of Maggot’s field but for the gate and the stile', () => {
    const fence = walk(newHobbit({ x: -30, z: 19, face: 0 }), { x: 0, z: 1 }, 3);
    expect(fence.z).toBeLessThan(FIELD.z0);
    const gate = walk(newHobbit({ x: -38, z: 19, face: 0 }), { x: 0, z: 1 }, 2);
    expect(inField(gate.x, gate.z)).toBe(true);
  });

  it('lets you up to each round door, through its garden gate', () => {
    for (const h of HOLES) {
      const at = walk(newHobbit({ x: h.x, z: h.z + h.r + 2.4, face: 0 }), { x: 0, z: -1 }, 4);
      expect(at.z, h.id).toBeLessThan(h.z + 0.62 * h.r);
    }
  });

  it('gets you to Gandalf’s bench through Bag End’s gate, but not over the fence', () => {
    const over = walk(newHobbit({ x: -14, z: -14.5, face: 0 }), { x: 0, z: -1 }, 3);
    expect(over.z).toBeGreaterThan(-16.6);
    let h = walk(newHobbit({ x: -18, z: -14.5, face: 0 }), { x: 0, z: -1 }, 0.9);
    h = walk(h, { x: 1, z: 0 }, 1.4);
    expect(nearSpot(h.x, h.z)?.id).toBe('rings');
  });

  it('hides you under the old tree’s roots', () => {
    const h = stepHobbit(newHobbit({ x: HOLLOW.x, z: HOLLOW.z }), {}, DT);
    expect(hidden(h)).toBe(true);
    expect(onRoad(HOLLOW.x, HOLLOW.z)).toBe(false);
  });
});

describe('Hobbiton: walking', () => {
  it('walks, and runs faster, and turns to face the way it goes', () => {
    const w = walk(newHobbit({ x: 4, z: -4, face: 0 }), { x: 1, z: 0 }, 2);
    const r = walk(newHobbit({ x: 4, z: -4, face: 0 }), { x: 1, z: 0, run: true }, 2);
    expect(w.x - 4).toBeGreaterThan(HOBBIT.walk * 1.6);
    expect(r.x - 4).toBeGreaterThan(w.x - 4 + 3);
    const north = walk(newHobbit({ x: 4, z: -4, face: 0 }), { x: 0, z: -1 }, 1);
    expect(Math.cos(north.face)).toBeCloseTo(0, 1);
    expect(Math.sin(north.face)).toBeCloseTo(1, 1); // -z is north
  });

  it('stays inside the Shire', () => {
    const h = walk(newHobbit({ x: 0, z: -50, face: 0 }), { x: 0, z: -1, run: true }, 10);
    expect(Math.hypot(h.x, h.z)).toBeLessThanOrEqual(WORLD.radius + 1e-6);
  });

  it('finds the place you’ve stopped at', () => {
    const s = SPOTS.find((x) => x.id === 'party');
    expect(nearSpot(s.x, s.z)?.id).toBe('party');
    expect(nearSpot(START.x, START.z)).toBe(null);
  });
});

describe('Hobbiton: what there is to do', () => {
  it('opens the mushrooms, the smoke rings and the fireworks first', () => {
    const p = progress([]);
    expect(p.quests.filter((q) => q.open).map((q) => q.id)).toEqual(['maggot', 'rings', 'party']);
    expect(p.sky).toBe('day');
    expect(p.hasRing).toBe(false);
  });

  it('brings the night with the fireworks, and Bag End with it', () => {
    const p = progress(['party']);
    expect(p.sky).toBe('night');
    expect(p.quests.find((q) => q.id === 'ring').open).toBe(true);
    expect(p.quests.find((q) => q.id === 'rider').open).toBe(false);
  });

  it('sends the Rider once you have the Ring, and the road at dawn after', () => {
    expect(progress(['party', 'ring']).next).toBe('maggot');
    expect(progress(['party', 'ring', 'maggot', 'rings']).next).toBe('rider');
    const end = progress(QUESTS.map((q) => q.id));
    expect(end.finished).toBe(true);
    expect(end.sky).toBe('dawn');
  });
});

describe('Hobbiton: shortcut to mushrooms', () => {
  it('picks a mushroom you walk over, and says when all ten are in', () => {
    const hunt = newHunt([...Array(HUNT.mushrooms - 1).keys()]);
    const last = MUSHROOMS[HUNT.mushrooms - 1];
    const ev = stepHunt(hunt, { x: last.x, z: last.z, running: false }, DT);
    expect(ev.map((e) => e.type)).toEqual(['pick', 'all']);
  });

  it('is seen in front of a dog, not behind it, and heard running close by', () => {
    const dog = { x: 0, z: 0, face: 0, look: 0 };
    expect(dogSees(dog, { x: 4, z: 0 })).toBe(true);
    expect(dogSees(dog, { x: -4, z: 0 })).toBe(false);
    expect(dogSees(dog, { x: 0, z: 5 })).toBe(false);
    expect(dogSees(dog, { x: -1.5, z: 0, running: true })).toBe(true);
    expect(dogSees(dog, { x: HUNT.sight + 1, z: 0 })).toBe(false);
  });

  it('barks, then chases, and catches a hobbit that stands still', () => {
    const hunt = newHunt();
    const dog = hunt.dogs[0];
    dog.wait = 0;
    const h = { x: dog.x + 3, z: dog.z, running: false };
    dog.face = 0;
    let types = [];
    for (let t = 0; t < 3; t += DT) types = types.concat(stepHunt(hunt, h, DT).map((e) => e.type));
    expect(types[0]).toBe('seen');
    expect(types).toContain('caught');
  });

  it('gives up when you get out of the field', () => {
    const hunt = newHunt();
    const dog = hunt.dogs[0];
    dog.mode = 'chase';
    dog.t = 0;
    const ev = stepHunt(hunt, { x: MAGGOT_GATE.x, z: FIELD.z0 - 3, running: true }, DT);
    expect(ev.map((e) => e.type)).toContain('lost');
  });

  it('can be outrun by a running hobbit', () => {
    expect(HUNT.chase).toBeGreaterThan(HOBBIT.walk);
    expect(HUNT.chase).toBeLessThan(HOBBIT.run);
  });

  it('is slow to be sure of you at the edge of its sight (HUNT.far), the way the docs say', () => {
    const hunt = newHunt();
    const dog = hunt.dogs[0];
    dog.wait = 0;
    const h = { x: dog.x + 5.9, z: dog.z, running: false };
    let types = [];
    for (let t = 0; t < 0.3; t += DT) types = types.concat(stepHunt(hunt, h, DT).map((e) => e.type));
    expect(types).not.toContain('seen');
    for (let t = 0; t < 3; t += DT) types = types.concat(stepHunt(hunt, h, DT).map((e) => e.type));
    expect(types).toContain('seen');
  });

  it('says which dog barked', () => {
    const hunt = newHunt();
    const dog = hunt.dogs[0];
    dog.wait = 0;
    const h = { x: dog.x + 1.5, z: dog.z, running: false };
    let seen = null;
    for (let t = 0; t < 2 && !seen; t += DT) seen = stepHunt(hunt, h, DT).find((e) => e.type === 'seen');
    expect(seen.dog).toBe(0);
  });

  it('sniffs about where it lost you (HUNT.search), then goes back to its round', () => {
    const hunt = newHunt();
    const dog = hunt.dogs[0];
    dog.wait = 0;
    const h = { x: dog.x + 1.5, z: dog.z, running: false };
    for (let t = 0; t < 2 && dog.mode !== 'chase'; t += DT) stepHunt(hunt, h, DT);
    expect(dog.mode).toBe('chase');
    // gone, far off across the field
    const far = { x: FIELD.x1 - 1, z: FIELD.z1 - 1, running: false };
    let types = [];
    for (let t = 0; t < 0.5; t += DT) types = types.concat(stepHunt(hunt, far, DT).map((e) => e.type));
    expect(types).toContain('lost');
    expect(dog.mode).toBe('search');
    for (let t = 0; t < HUNT.search + 12 && dog.mode !== 'patrol'; t += DT) stepHunt(hunt, { x: 0, z: -40, running: false }, DT);
    expect(dog.mode).toBe('patrol');
  });

  it('casts about for you on a seeded random, the same every visit', () => {
    const a = newHunt().opts.rand;
    const b = newHunt().opts.rand;
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('keeps the dogs in the field, chasing', () => {
    const hunt = newHunt();
    const dog = hunt.dogs[0];
    dog.wait = 0;
    const h = { x: FIELD.x0 + 0.4, z: dog.z, running: false };
    dog.x = FIELD.x0 + 3;
    dog.face = Math.PI;
    dog.mode = 'chase';
    dog.t = 0;
    for (let t = 0; t < 3; t += DT) {
      stepHunt(hunt, h, DT);
      expect(dog.x).toBeGreaterThanOrEqual(FIELD.x0 + 0.5 - 1e-9);
    }
  });
});

describe('Hobbiton: the sheep', () => {
  const run = (f, seconds, near = []) => {
    for (let t = 0; t < seconds; t += DT) stepFlock(f, DT, { near });
    return f;
  };

  it('wander the same way every visit', () => {
    const a = run(newFlock(6, 7), 20);
    const b = run(newFlock(6, 7), 20);
    expect(a.sheep.map((s) => [s.x, s.z, s.face])).toEqual(b.sheep.map((s) => [s.x, s.z, s.face]));
    const c = run(newFlock(6, 8), 20);
    expect(c.sheep.map((s) => s.x)).not.toEqual(a.sheep.map((s) => s.x));
  });

  it('stay in the pasture', () => {
    const f = newFlock(8, 3);
    for (let t = 0; t < 120; t += DT) {
      stepFlock(f, DT);
      for (const s of f.sheep) expect(Math.hypot(s.x - PASTURE.x, s.z - PASTURE.z)).toBeLessThanOrEqual(PASTURE.r + 1e-6);
    }
  });

  it('graze standing between walks, and walk at a sheep’s pace', () => {
    const f = newFlock(6, 5);
    let grazed = 0;
    let walked = 0;
    for (let t = 0; t < 60; t += DT) {
      stepFlock(f, DT);
      for (const s of f.sheep) {
        if (s.speed < 0.01) grazed++;
        if (s.speed > 0.5) walked++;
        expect(s.speed).toBeLessThan(0.8);
      }
    }
    expect(grazed).toBeGreaterThan(0);
    expect(walked).toBeGreaterThan(0);
  });

  it('turn by easing round, not snapping', () => {
    const f = newFlock(6, 9);
    let last = f.sheep.map((s) => s.face);
    for (let t = 0; t < 60; t += DT) {
      stepFlock(f, DT);
      f.sheep.forEach((s, i) => {
        const d = Math.abs(Math.atan2(Math.sin(s.face - last[i]), Math.cos(s.face - last[i])));
        expect(d).toBeLessThan(0.2);
      });
      last = f.sheep.map((s) => s.face);
    }
  });

  it('trot off from a hobbit who comes up close', () => {
    const f = newFlock(1, 2);
    const s = f.sheep[0];
    s.x = PASTURE.x;
    s.z = PASTURE.z;
    const you = { x: PASTURE.x - 1, z: PASTURE.z };
    run(f, 2, [you]);
    expect(Math.hypot(s.x - you.x, s.z - you.z)).toBeGreaterThan(2.2);
  });
});

describe('Hobbiton: smoke rings', () => {
  it('puffs at most two at a time, and eight in all', () => {
    const s = newRings(3);
    expect(puff(s, 0, 1)).toBe(true);
    expect(puff(s, 0, 1)).toBe(true);
    expect(puff(s, 0, 1)).toBe(false);
    expect(s.puffs).toBe(RINGS.puffs - 2);
  });

  it('threads a ring led to where Gandalf’s will be, and wins on the third', () => {
    const s = newRings(5);
    let won = false;
    for (let n = 0; n < 3; n++) {
      const aim = hisAt(s.his, RINGS.flight);
      puff(s, aim.u, aim.v);
      for (let t = 0; t < RINGS.flight + 0.05; t += DT) won = stepRings(s, DT).some((e) => e.type === 'won') || won;
    }
    expect(s.hits).toBe(3);
    expect(won).toBe(true);
  });

  it('runs out of pipe-weed if you keep missing', () => {
    const s = newRings(7);
    let out = false;
    for (let n = 0; n < RINGS.puffs; n++) {
      const at = hisAt(s.his, RINGS.flight);
      puff(s, at.u > 0 ? -RINGS.u : RINGS.u, at.v > 1.3 ? RINGS.v0 : RINGS.v1);
      for (let t = 0; t < RINGS.flight + 0.05; t += DT) out = stepRings(s, DT).some((e) => e.type === 'out') || out;
    }
    expect(s.hits).toBe(0);
    expect(out).toBe(true);
  });
});

describe('Hobbiton: Gandalf’s fireworks', () => {
  it('cheers a new colour in a new part of the sky, quickly, most', () => {
    const recent = [
      { colour: 'gold', u: 0, v: 0.5 },
      { colour: 'green', u: 0.1, v: 0.5 },
    ];
    const same = burstScore(recent, { colour: 'green', u: 0.05, v: 0.5 }, 2);
    const best = burstScore(recent, { colour: 'red', u: -0.8, v: 0.9 }, 0.4);
    expect(best).toBeCloseTo(SHOW.base + SHOW.fresh + SHOW.spread + SHOW.quick);
    expect(same).toBeCloseTo(SHOW.base);
  });

  it('lights the dragon when the cheer is full, and finishes', () => {
    const show = newShow();
    const colours = ['gold', 'green', 'red', 'blue', 'white'];
    const spots = [[-0.8, 0.9], [0.8, 0.4], [0, 0.95], [-0.5, 0.3], [0.5, 0.75]];
    const types = [];
    let i = 0;
    for (let t = 0; t < 30 && show.state !== 'done'; t += DT) {
      if (show.state === 'on' && show.t - show.lastLaunch > 0.5) {
        launch(show, spots[i % 5][0], spots[i % 5][1], colours[i % 5]);
        i += 1;
      }
      types.push(...stepShow(show, DT).map((e) => e.type));
    }
    expect(types).toContain('burst');
    expect(types).toContain('dragon');
    expect(types[types.length - 1]).toBe('done');
  });

  it('loses the party if nothing goes up', () => {
    const show = newShow();
    let over = false;
    for (let t = 0; t < SHOW.time + 1 && !over; t += DT) over = stepShow(show, DT).some((e) => e.type === 'over');
    expect(over).toBe(true);
    expect(show.t).toBeLessThan(SHOW.start / SHOW.drain + 0.1);
  });
});

describe('Hobbiton: get off the road!', () => {
  const ride = (h, { wearing = false, moving = false } = {}) => {
    const r = newRider();
    const types = [];
    for (let t = 0; t < 40 && !['found', 'gone'].includes(r.phase); t += DT) types.push(...stepRider(r, { ...h, speed: moving && r.phase === 'sniff' ? 2 : 0 }, wearing, DT).map((e) => e.type));
    return types;
  };

  it('starts when you take the Ring out along the East Road', () => {
    expect(riderTrigger({ x: 44, z: -4 })).toBe(true);
    expect(riderTrigger({ x: 0, z: -4 })).toBe(false);
  });

  it('passes you by under the roots, keeping still', () => {
    const types = ride({ x: HOLLOW.x, z: HOLLOW.z });
    expect(types).toEqual(['coming', 'sniff', 'leaving', 'gone']);
  });

  it('finds you on the road, moving, or wearing the Ring', () => {
    expect(ride({ x: RIDER_RETRY.x + 10, z: 2 })).toContain('found');
    expect(ride({ x: HOLLOW.x, z: HOLLOW.z }, { moving: true })).toContain('found');
    expect(ride({ x: HOLLOW.x, z: HOLLOW.z }, { wearing: true })).toContain('found');
  });

  it('gives you time to get there from where it starts', () => {
    const run = Math.hypot(RIDER_RETRY.x - HOLLOW.x, RIDER_RETRY.z - HOLLOW.z) / HOBBIT.run;
    expect(RIDER.warn + 10 / RIDER.speed).toBeGreaterThan(run);
  });

  it('pulls the Ring off by itself if you wear it too long', () => {
    let g = 0;
    for (let t = 0; t < 10; t += DT) g = stepGaze(g, true, DT);
    expect(g).toBe(1);
    for (let t = 0; t < 10; t += DT) g = stepGaze(g, false, DT);
    expect(g).toBe(0);
  });
});

describe('Hobbiton, on the side: Bilbo’s spoons', () => {
  const H = SPOONS.home;
  // a hobbit who knows the way: the hedge and the mill, home; the reeds and
  // the bridge, home; the Green Dragon and the Party Tree, home
  const PLAN = [
    [-13.2, -4.6], [-29.4, -4.6], [-14.2, -3.6], [-19.3, 7], [-18.2, 7.1],
    [-19.3, 7], [-14.2, -3.6], [-15, -10], [H.x, H.z],
    [-15, -10], [-13.2, -4.6], [-1.5, 5.3], [11.4, 5.6], [12, 13.4],
    [12, 10.4], [11, -4], [-13.2, -4.4], [-15, -10], [H.x, H.z],
    [-15, -10], [-13.2, -4.4], [11, -4], [12, 10.4], [12, 20.4], [14, 28.8], [17.4, 29.4],
    [14, 28.8], [12, 20.4], [12, 10.4], [11, -4], [13.5, -11], [17.6, -16.8],
    [6, -16.8], [-6, -16], [H.x, H.z],
  ];
  const race = (run) => {
    let h = newHobbit({ x: LOBELIA.x, z: LOBELIA.z + 1.3 });
    const sp = newSpoons();
    const types = [];
    let i = 0;
    for (let t = 0; t < 150 && sp.state === 'on' && i < PLAN.length; t += 1 / 30) {
      const [x, z] = PLAN[i];
      const d = Math.hypot(x - h.x, z - h.z);
      if (d < 0.6) i++;
      h = stepHobbit(h, d > 0.01 ? { x: (x - h.x) / d, z: (z - h.z) / d, run } : {}, 1 / 30);
      types.push(...stepSpoons(sp, h, 1 / 30).map((e) => e.type));
    }
    return { sp, types };
  };

  it('hides every spoon where a hobbit can stand, and sends Lobelia round by the lanes', () => {
    expect(SPOON_SPOTS.length).toBeGreaterThanOrEqual(SPOONS.need + SPOONS.lose - 1);
    for (const p of SPOON_SPOTS) {
      expect(blocked(p.x, p.z), p.id).toBe(false);
      expect(inWater(p.x, p.z), p.id).toBe(false);
    }
    for (let s = 0; s <= LOBELIA_LEN; s += 0.5) {
      const p = lobeliaAt(s);
      expect(blocked(p.x, p.z) || inWater(p.x, p.z), `${s}`).toBe(false);
    }
    // she goes past every hiding place, and ends where she began
    for (const p of SPOON_SPOTS) expect(Array.from({ length: Math.ceil(LOBELIA_LEN * 4) }, (_, k) => lobeliaAt(k / 4)).some((q) => Math.hypot(q.x - p.x, q.z - p.z) < SPOONS.take), p.id).toBe(true);
    const end = lobeliaAt(LOBELIA_LEN + 5);
    expect(Math.hypot(end.x - LOBELIA.x, end.z - LOBELIA.z)).toBeLessThan(0.01);
  });

  it('fills your pockets two at a time, and empties them at Bag End’s gate', () => {
    const sp = newSpoons();
    const at = (p) => stepSpoons(sp, { x: p.x, z: p.z }, 0.01).map((e) => e.type);
    expect(at(SPOON_SPOTS[0])).toEqual(['found']);
    expect(at(SPOON_SPOTS[1])).toEqual(['found']);
    expect(at(SPOON_SPOTS[2])).toEqual(['full']);
    expect(sp.carried).toEqual([0, 1]);
    expect(at(H)).toEqual(['home']);
    expect(sp.home).toEqual([0, 1]);
    expect(sp.carried).toEqual([]);
  });

  it('lets Lobelia pocket what she gets to first, and gives her the game at two', () => {
    const sp = newSpoons();
    const far = { x: 40, z: -30 };
    const types = [];
    for (let t = 0; t < 120 && sp.state === 'on'; t += 0.05) types.push(...stepSpoons(sp, far, 0.05).map((e) => e.type));
    expect(types).toEqual(['pocketed', 'pocketed', 'lost']);
    expect(sp.hers).toEqual([0, 1]);
  });

  it('is won by a hobbit who runs for it, and lost by one who dawdles', () => {
    const fast = race(true);
    expect(fast.sp.state).toBe('won');
    expect(fast.sp.hers.length).toBeLessThan(SPOONS.lose);
    const slow = race(false);
    expect(slow.sp.state).toBe('lost');
  });

  it('is on the side: the story never waits on it', () => {
    expect(QUESTS.some((q) => q.id === SIDE.id)).toBe(false);
    expect(blocked(SIDE.at.x, SIDE.at.z)).toBe(false);
    expect(nearSpot(SIDE.at.x, SIDE.at.z)?.id).toBe('spoons');
    expect(blocked(LOBELIA.x, LOBELIA.z)).toBe(false);
  });
});

describe('Hobbiton: the camera', () => {
  it('walks you away from the camera on forward, and behind you is behind you', async () => {
    const { behindYaw, cameraMove } = await import('./rules');
    const yaw = 0.7;
    const f = cameraMove(yaw, 1, 0);
    // the camera sits at (sin yaw, cos yaw) from the hobbit: forward points the other way
    expect(f.x * Math.sin(yaw) + f.z * Math.cos(yaw)).toBeCloseTo(-1);
    const r = cameraMove(yaw, 0, 1);
    expect(f.x * r.x + f.z * r.z).toBeCloseTo(0);
    const face = 1.1;
    const b = behindYaw(face);
    expect(Math.sin(b) * Math.cos(face) + Math.cos(b) * -Math.sin(face)).toBeCloseTo(-1);
  });
});

describe('footsteps', () => {
  const steps = (h, seconds, hz = 60) => {
    let acc = STRIDE.first;
    let n = 0;
    for (let i = 0; i < seconds * hz; i++) {
      let foot;
      [acc, foot] = stepStride(acc, h, 1 / hz);
      if (foot) n++;
    }
    return n;
  };

  it('falls a stride of ground apart, whatever the frame rate', () => {
    const h = { speed: HOBBIT.walk, running: false };
    const n = steps(h, 2);
    expect(n).toBe(Math.floor((HOBBIT.walk * 2) / STRIDE.walk + STRIDE.first));
    expect(steps(h, 2, 144)).toBe(n);
  });

  it('starts soon after setting off, and is silent standing still', () => {
    const h = { speed: HOBBIT.walk, running: false };
    expect(steps(h, (STRIDE.walk * (1 - STRIDE.first)) / HOBBIT.walk + 0.02)).toBe(1);
    expect(steps({ speed: 0, running: false }, 3)).toBe(0);
  });

  it('takes longer strides running', () => {
    expect(STRIDE.run).toBeGreaterThan(STRIDE.walk);
    expect(steps({ speed: HOBBIT.run, running: true }, 2)).toBeLessThan((HOBBIT.run * 2) / STRIDE.walk);
  });
});

describe('the fade when he’s put back', () => {
  it('moves him once the screen is dark, 260 ms on, and only once', () => {
    expect(FADE).toBe(0.26);
    let left = FADE;
    let moved = 0;
    let frames = 0;
    while (left != null) {
      let done;
      [left, done] = stepFade(left, 1 / 60);
      if (done) moved++;
      frames++;
    }
    expect(moved).toBe(1);
    expect(frames).toBe(Math.ceil(FADE * 60 - 1e-9));
    expect(stepFade(null, 1 / 60)).toEqual([null, false]);
  });
});
