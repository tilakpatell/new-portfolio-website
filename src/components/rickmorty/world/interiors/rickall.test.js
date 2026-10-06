import { describe, expect, it } from 'vitest';
import { HOTSPOTS, HOUSE_SPOTS, MORTY, PLAN, behindYaw, newMorty, stepMorty } from '../rules';
import { AIM, CAM, FAMILY, MORTY_AT, PARASITES, RICKALL, SIGHT, aimAt, ending, newRickall, parasitesLeft, shoot, sight, stepRickall, tell, view } from './rickall';

const FIGURES = ['pencilvester', 'sleepygary', 'hamurai', 'amishcyborg', 'mrbeauregard', 'cousinnicky', 'frankenstein'];
const PROPS = ['reversegiraffe', 'ghostinajar', 'photographyraptor', 'tinkles', 'babywizard', 'mrsrefrigerator'];
const SMITHS = ['rick', 'morty', 'beth', 'jerry', 'summer'];
const EVERYONE = [...PARASITES, ...FAMILY];
const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1);

// the spot someone in a game stands on, and the parasites that game chose
const spotOf = (p) => HOUSE_SPOTS.find((s) => s.x === p.x && s.z === p.z);
const parasitesIn = (g) => g.people.filter((p) => p.parasite).map((p) => p.id);

describe('C-137: Total Rickall’s people', () => {
  it('has the thirteen parasites, each a rigged figure or a prop and named, and the family', () => {
    expect(PARASITES.map((p) => p.id)).toEqual([...FIGURES, ...PROPS]);
    expect(PARASITES.filter((p) => p.kind === 'figure').map((p) => p.id)).toEqual(FIGURES);
    expect(PARASITES.filter((p) => p.kind === 'prop').map((p) => p.id)).toEqual(PROPS);
    expect(FAMILY.map((p) => p.id)).toEqual([...SMITHS, 'poopybutthole']);
    expect(FAMILY.every((p) => p.kind === 'figure')).toBe(true);
    expect(Object.fromEntries(EVERYONE.map((p) => [p.id, p.name]))).toEqual({
      pencilvester: 'Pencilvester',
      sleepygary: 'Sleepy Gary',
      hamurai: 'Hamurai',
      amishcyborg: 'Amish Cyborg',
      mrbeauregard: 'Mr. Beauregard',
      cousinnicky: 'Cousin Nicky',
      frankenstein: 'Frankenstein’s monster',
      reversegiraffe: 'Reverse Giraffe',
      ghostinajar: 'Ghost in a Jar',
      photographyraptor: 'Photography Raptor',
      tinkles: 'Tinkles',
      babywizard: 'Baby Wizard',
      mrsrefrigerator: 'Mrs. Refrigerator',
      rick: 'Rick',
      morty: 'Morty',
      beth: 'Beth',
      jerry: 'Jerry',
      summer: 'Summer',
      poopybutthole: 'Mr. Poopybutthole',
    });
    // the floor each takes: a person's 0.3, the raptor's tail the most
    for (const p of EVERYONE) expect(p.r, p.id).toBeGreaterThanOrEqual(0.3);
    expect(Math.max(...EVERYONE.map((p) => p.r))).toBe(PARASITES.find((p) => p.id === 'photographyraptor').r);
    expect(RICKALL).toEqual({ count: 8, time: 120 });
  });

  it('remembers only good times with a parasite, and bad ones too with the family, three apiece, in the site’s voice', () => {
    for (const p of PARASITES) expect(p.memories.every((m) => m.good === true), p.id).toBe(true);
    for (const p of FAMILY) {
      expect(p.memories.some((m) => m.good === false), p.id).toBe(true);
      expect(p.memories.some((m) => m.good === true), p.id).toBe(true);
    }
    // everyone has as many, so how many are left gives nothing away
    for (const p of EVERYONE) expect(p.memories, p.id).toHaveLength(3);
    // Mr. Poopybutthole's bad one comes last: look at him twice and he seems a parasite
    expect(FAMILY.find((p) => p.id === 'poopybutthole').memories.map((m) => m.good)).toEqual([true, true, false]);
    const texts = EVERYONE.flatMap((p) => p.memories.map((m) => m.text));
    expect(new Set(texts).size).toBe(texts.length);
    for (const t of texts) {
      // plain sentences: curly apostrophes, no quoted dialogue, no shouting, no American spelling
      expect(t, t).not.toMatch(/['"“”!]/);
      expect(t, t).toMatch(/^[A-Z].*\.$/);
      expect(t.length, t).toBeLessThan(110);
      expect(t, t).not.toMatch(/\b(color|favorite|center|theater|gray|neighbor)/i);
    }
  });
});

describe('C-137: Total Rickall’s rules', () => {
  it('fills the living room the same way for the same seed: eight parasites and the family, each on a spot of their own', () => {
    const g = newRickall(1);
    expect(newRickall(1)).toEqual(g);
    expect(newRickall()).toEqual(g);
    expect(g).toMatchObject({ told: {}, shot: [], state: 'on', t: 0 });
    expect(g.people).toHaveLength(RICKALL.count + FAMILY.length);
    expect(parasitesIn(g)).toHaveLength(RICKALL.count);
    expect(g.people.filter((p) => !p.parasite).map((p) => p.id).sort()).toEqual(FAMILY.map((p) => p.id).sort());
    for (const p of g.people) {
      const who = EVERYONE.find((o) => o.id === p.id);
      expect(p, p.id).toMatchObject({ kind: who.kind, name: who.name, r: who.r, h: who.h, parasite: PARASITES.includes(who) });
      expect(spotOf(p), p.id).toBeTruthy();
      expect(p.face, p.id).toBe(spotOf(p).face);
    }
    expect(new Set(g.people.map(spotOf)).size).toBe(g.people.length);
    expect(parasitesLeft(g)).toBe(RICKALL.count);
  });

  it('fits everyone, whatever the seed, on a spot with room for them, and chooses different parasites', () => {
    const chosen = new Set();
    for (const seed of SEEDS) {
      const g = newRickall(seed);
      expect(new Set(g.people.map(spotOf)).size, `seed ${seed}`).toBe(14);
      for (const p of g.people) expect(spotOf(p)?.r, `seed ${seed}: ${p.id}`).toBeGreaterThanOrEqual(p.r);
      chosen.add(parasitesIn(g).sort().join());
    }
    expect(chosen.size).toBeGreaterThan(100);
    // every one of them turns up
    expect(new Set([...chosen].flatMap((c) => c.split(',')))).toEqual(new Set(PARASITES.map((p) => p.id)));
  });

  it('tells each one’s memories in turn, the next unseen one, then round again', () => {
    const g = newRickall(1);
    const id = parasitesIn(g)[0];
    const { memories } = PARASITES.find((p) => p.id === id);
    expect(tell(g, id)).toEqual({ memory: memories[0], remaining: 2 });
    expect(tell(g, id)).toEqual({ memory: memories[1], remaining: 1 });
    expect(tell(g, id)).toEqual({ memory: memories[2], remaining: 0 });
    expect(tell(g, id)).toEqual({ memory: memories[0], remaining: 0 });
    expect(g.told[id]).toBe(4);
    // the family: a bad one, heard out
    for (const who of FAMILY) expect([0, 1, 2].map(() => tell(g, who.id).memory.good), who.id).toContain(false);
    // nobody who isn't in the room
    const away = PARASITES.find((p) => !parasitesIn(g).includes(p.id));
    expect(tell(g, away.id)).toBe(null);
    expect(tell(g, 'snuffles')).toBe(null);
  });

  it('counts a parasite shot, and wins when the eighth falls', () => {
    const g = newRickall(3);
    const ids = parasitesIn(g);
    ids.slice(0, -1).forEach((id, i) => {
      expect(shoot(g, id)).toBe('parasite');
      expect(g.shot).toEqual(ids.slice(0, i + 1));
      expect(parasitesLeft(g)).toBe(RICKALL.count - i - 1);
    });
    expect(g.state).toBe('on');
    expect(shoot(g, ids.at(-1))).toBe('won');
    expect(g.state).toBe('won');
    expect(parasitesLeft(g)).toBe(0);
    // and it's over
    expect(shoot(g, 'beth')).toBe(null);
    expect(tell(g, 'beth')).toBe(null);
  });

  it('ends it on a real Smith, who never counts as a parasite, and nothing counts after', () => {
    for (const id of SMITHS) {
      const g = newRickall(5);
      const [first, second] = parasitesIn(g);
      expect(shoot(g, first)).toBe('parasite');
      expect(shoot(g, id), id).toBe('family');
      expect(g.state).toBe('family');
      expect(g.shot).toEqual([first, id]);
      expect(parasitesLeft(g)).toBe(RICKALL.count - 1);
      expect(shoot(g, second)).toBe(null);
      expect(shoot(g, id)).toBe(null);
      expect(tell(g, second)).toBe(null);
      expect(stepRickall(g, RICKALL.time)).toBe(null);
      expect(g.state).toBe('family');
    }
  });

  it('ends it on Mr. Poopybutthole, who was real', () => {
    const g = newRickall(7);
    expect(shoot(g, 'poopybutthole')).toBe('poopybutthole');
    expect(g.state).toBe('poopybutthole');
    expect(parasitesLeft(g)).toBe(RICKALL.count);
    expect(shoot(g, parasitesIn(g)[0])).toBe(null);
  });

  it('counts two shots at one person in the same frame once', () => {
    const g = newRickall(9);
    const id = parasitesIn(g)[0];
    expect(shoot(g, id)).toBe('parasite');
    expect(shoot(g, id)).toBe(null);
    expect(g.shot).toEqual([id]);
    expect(parasitesLeft(g)).toBe(RICKALL.count - 1);
    // the last of them twice: won once
    for (const p of parasitesIn(g).slice(1, -1)) shoot(g, p);
    const last = parasitesIn(g).at(-1);
    expect(shoot(g, last)).toBe('won');
    expect(shoot(g, last)).toBe(null);
    // and a Smith twice: one ending
    const h = newRickall(9);
    expect(shoot(h, 'jerry')).toBe('family');
    expect(shoot(h, 'jerry')).toBe(null);
    expect(h.shot).toEqual(['jerry']);
    // nobody who isn't in the room
    expect(shoot(newRickall(9), 'snuffles')).toBe(null);
  });

  it('runs out of time after two minutes, once', () => {
    const g = newRickall(11);
    expect(stepRickall(g, 60)).toBe(null);
    // (time never runs backwards)
    expect(stepRickall(g, -30)).toBe(null);
    expect(g.t).toBe(60);
    expect(stepRickall(g, 59.9)).toBe(null);
    expect(g.state).toBe('on');
    expect(stepRickall(g, 0.2)).toBe('out');
    expect(g.state).toBe('out');
    expect(stepRickall(g, 1)).toBe(null);
    expect(shoot(g, parasitesIn(g)[0])).toBe(null);
    // a game already won never runs out
    const w = newRickall(11);
    for (const id of parasitesIn(w)) shoot(w, id);
    expect(w.state).toBe('won');
    expect(stepRickall(w, RICKALL.time * 2)).toBe(null);
    expect(w.state).toBe('won');
  });
});

describe('C-137: Total Rickall, with someone left out', () => {
  it('chooses no parasite that can’t be drawn, and leaves out anyone else who can’t', () => {
    const gone = ['hamurai', 'tinkles', 'ghostinajar'];
    for (const seed of SEEDS.slice(0, 60)) {
      const g = newRickall(seed, { absent: [...gone, 'morty', 'poopybutthole'] });
      const ids = g.people.map((p) => p.id);
      for (const id of [...gone, 'morty', 'poopybutthole']) expect(ids, `seed ${seed}`).not.toContain(id);
      expect(parasitesIn(g), `seed ${seed}`).toHaveLength(RICKALL.count);
      expect(g.people.filter((p) => !p.parasite).map((p) => p.id).sort()).toEqual(['beth', 'jerry', 'rick', 'summer']);
      expect(new Set(g.people.map(spotOf)).size).toBe(g.people.length);
      for (const p of g.people) expect(spotOf(p).r, `seed ${seed}: ${p.id}`).toBeGreaterThanOrEqual(p.r);
    }
    // nobody left out: the game it always was, for the same seed
    expect(newRickall(4, { absent: [] })).toEqual(newRickall(4));
    expect(newRickall(4, { absent: ['beth'] })).toEqual(newRickall(4, { absent: ['beth'] }));
  });

  it('plays with as many parasites as can be drawn, if that’s fewer than eight, and is won when they’re all shot', () => {
    const g = newRickall(2, { absent: PARASITES.slice(0, 8).map((p) => p.id) });
    expect(parasitesIn(g).sort()).toEqual(PARASITES.slice(8).map((p) => p.id).sort());
    expect(parasitesLeft(g)).toBe(5);
    const ids = parasitesIn(g);
    for (const id of ids.slice(0, -1)) expect(shoot(g, id)).toBe('parasite');
    expect(shoot(g, ids.at(-1))).toBe('won');
  });
});

describe('C-137: Total Rickall’s sights', () => {
  it('stands everyone as tall as the house draws them, under the living room’s beams', () => {
    const h = Object.fromEntries(EVERYONE.map((p) => [p.id, p.h]));
    // the Smiths as the house has them (interiors/furniture.js), Morty as the world does
    expect(h).toMatchObject({ rick: 2.0, morty: 1.7, beth: 1.88, jerry: 1.95, summer: 1.8 });
    for (const p of EVERYONE) {
      expect(p.h, p.id).toBeGreaterThanOrEqual(0.8);
      expect(p.h, p.id).toBeLessThanOrEqual(2.43);
    }
    // Frankenstein’s monster the tallest person, Tinkles the smallest of them all
    expect(Math.max(...EVERYONE.filter((p) => p.kind === 'figure').map((p) => p.h))).toBe(h.frankenstein);
    expect(Math.min(...EVERYONE.map((p) => p.h))).toBe(h.tinkles);
    expect(h.poopybutthole).toBeLessThan(h.morty + 0.01);
  });

  it('looks from Morty’s eyes, over his right shoulder, the way the camera looks', () => {
    // facing north, the camera behind him: his right is east
    const s = sight({ x: 0, z: 0, y: 0 }, behindYaw(Math.PI / 2));
    expect(s.x).toBeCloseTo(SIGHT.right, 6);
    expect(s.z).toBeCloseTo(0, 6);
    expect(s.y).toBeCloseTo(SIGHT.eye, 6);
    expect(Math.hypot(s.dx, s.dy, s.dz)).toBeCloseTo(1, 6);
    expect(s.dx).toBeCloseTo(0, 6);
    expect(s.dz).toBeLessThan(-0.9);
    // a little down at the walking camera's lift, further down as the camera rises, and only so far
    expect(s.dy).toBeLessThan(0);
    expect(s.dy).toBeGreaterThan(-0.2);
    const yaw = behindYaw(0);
    expect(sight({ x: 0, z: 0 }, yaw, SIGHT.level + 0.4).dy).toBeLessThan(sight({ x: 0, z: 0 }, yaw).dy);
    expect(sight({ x: 0, z: 0 }, yaw, 5).dy).toBeCloseTo(-Math.sin(SIGHT.down), 6);
    expect(sight({ x: 0, z: 0 }, yaw, -5).dy).toBeCloseTo(Math.sin(SIGHT.up), 6);
    // facing east, his right is south; and up off the floor in a jump
    const e = sight({ x: 3, z: 4, y: 0.5 }, yaw);
    expect(e.x).toBeCloseTo(3, 6);
    expect(e.z).toBeCloseTo(4 + SIGHT.right, 6);
    expect(e.y).toBeCloseTo(0.5 + SIGHT.eye, 6);
    expect(e.dx).toBeGreaterThan(0.9);
  });

  // a game of people stood in a line north of (0, 0), each as tall as `h`
  const lineUp = (...who) => ({ state: 'on', shot: [], people: who.map(([id, z, h = 1.8, r = 0.3, x = 0]) => ({ id, x, z, r, h, parasite: true })) });
  const level = (x = 0, y = 1.5) => ({ x, y, z: 0, dx: 0, dy: 0, dz: -1 });

  it('is on the first one standing in the line, nearest first', () => {
    const g = lineUp(['near', -2], ['far', -5]);
    expect(aimAt(g, level())).toBe('near');
    g.shot.push('near');
    expect(aimAt(g, level())).toBe('far');
    // off to one side by more than a body’s width: nobody; within it: them
    expect(aimAt(g, level(AIM.r + 0.05))).toBe(null);
    expect(aimAt(g, level(AIM.r - 0.05))).toBe('far');
    // behind him, or too far off
    expect(aimAt(lineUp(['behind', 3]), level())).toBe(null);
    expect(aimAt(lineUp(['away', -(AIM.reach + 1)]), level())).toBe(null);
    // nobody, once it’s over
    const over = lineUp(['near', -2]);
    over.state = 'won';
    expect(aimAt(over, level())).toBe(null);
  });

  it('is on whoever the crosshair is over: past someone small to someone tall, or down at the small one', () => {
    const g = lineUp(['tinkles', -2, 0.9], ['giraffe', -4, 2.3]);
    // level, at the eyes: over Tinkles’ head, onto the giraffe
    expect(aimAt(g, level())).toBe('giraffe');
    // looking down at her
    const down = { x: 0, y: 1.5, z: 0, dx: 0, dy: -Math.sin(0.4), dz: -Math.cos(0.4) };
    expect(aimAt(g, down)).toBe('tinkles');
    // someone big takes more of the line, but no more than AIM.wide (looked at, under the top of his head)
    const raptor = lineUp(['raptor', -3, 1.45, 0.9]);
    expect(aimAt(raptor, level(AIM.wide - 0.05, 1.2))).toBe('raptor');
    expect(aimAt(raptor, level(AIM.wide + 0.05, 1.2))).toBe(null);
  });

  it('is on someone small with the crosshair just over their head, and on nobody with it well over', () => {
    const g = lineUp(['tinkles', -2, 0.9]);
    // just over her head, as the line comes to her: her, without looking right down
    expect(aimAt(g, level(0, 0.9 + AIM.over - 0.05))).toBe('tinkles');
    // well over it: nobody
    expect(aimAt(g, level(0, 0.9 + AIM.over + 0.05))).toBe(null);
    const up = { x: 0, y: 1.5, z: 0, dx: 0, dy: Math.sin(0.5), dz: -Math.cos(0.5) };
    expect(aimAt(lineUp(['tinkles', -2, 0.9], ['giraffe', -4, 2.3]), up)).toBe(null);
  });

  it('is never on someone taller just because the line passes over them, however near they are', () => {
    // the Photography Raptor right in front of him, the crosshair up over his
    // head on the far side of the room, and someone off to the side of it there
    const up = { x: 0, y: 1.55, z: 0, dx: 0, dy: Math.sin(0.3), dz: -Math.cos(0.3) };
    const g = lineUp(['raptor', -1.6, 1.45, 0.9], ['beth', -6, 1.88, 0.3, 1.2]);
    expect(aimAt(g, up)).toBe(null);
    // and nobody shorter than AIM.small is that tall
    for (const p of EVERYONE) if (p.h <= AIM.small) expect(['tinkles', 'ghostinajar', 'babywizard'], p.id).toContain(p.id);
    for (const id of ['tinkles', 'ghostinajar', 'babywizard']) expect(EVERYONE.find((p) => p.id === id).h, id).toBeLessThanOrEqual(AIM.small);
  });

  it('is never on someone right at his shoulder, who the camera can’t see past', () => {
    // the line starts inside them: not them, but whoever's beyond
    const g = lineUp(['beside', -0.3], ['far', -4]);
    expect(aimAt(g, level())).toBe('far');
    // someone small there is under the line: it can see over them
    expect(aimAt(lineUp(['tinkles', -0.3, 0.9]), { ...level(), dy: -Math.sin(0.6), dz: -Math.cos(0.6) })).toBe('tinkles');
  });
});

describe('C-137: Total Rickall’s camera', () => {
  // a game of people stood in a line south of (0, 0), behind him as he looks north
  const lineUp = (...who) => ({ state: 'on', shot: [], people: who.map(([id, z, h = 1.8, r = 0.3, x = 0]) => ({ id, x, z, r, h, parasite: true })) });
  const looking = (down = 0) => ({ x: 0, y: 1.55, z: 0, dx: 0, dy: -Math.sin(down), dz: -Math.cos(down) });

  it('stands CAM.back behind his shoulder with nobody behind him', () => {
    expect(view(lineUp(['ahead', -3]), looking())).toEqual({ back: CAM.back, hide: [] });
    // someone off to the side of the line, by more than their width
    expect(view(lineUp(['aside', 1, 1.8, 0.3, 0.8]), looking()).back).toBe(CAM.back);
    // someone small behind him: the camera's over them
    expect(view(lineUp(['tinkles', 1, 0.9]), looking(0.3)).back).toBe(CAM.back);
    // or someone shot
    const g = lineUp(['behind', 1.2]);
    g.shot.push('behind');
    expect(view(g, looking()).back).toBe(CAM.back);
  });

  it('comes in along the line in front of someone standing behind him', () => {
    // as wide as the crosshair takes them, and CAM.pad more
    const v = view(lineUp(['behind', 1.2], ['further', 1.5]), looking());
    expect(v.back).toBeCloseTo(1.2 - AIM.r - CAM.pad, 6);
    expect(v.hide).toEqual([]);
    // looking down, the camera rises as it goes back: still them, a little further back
    expect(view(lineUp(['behind', 1.2]), looking(0.4)).back).toBeCloseTo((1.2 - AIM.r - CAM.pad) / Math.cos(0.4), 6);
    // looking right down, it's up over their head by then
    expect(view(lineUp(['behind', 1.2]), looking(SIGHT.down)).back).toBe(CAM.back);
  });

  it('leaves anyone right at his shoulder out of the picture, but not someone small under it', () => {
    const v = view(lineUp(['beside', 0.2, 1.8, 0.3, 0.2], ['behind', 1.2]), looking());
    expect(v.hide).toEqual(['beside']);
    expect(v.back).toBeCloseTo(1.2 - AIM.r - CAM.pad, 6);
    expect(view(lineUp(['tinkles', 0.2, 0.9, 0.3, 0.2]), looking()).hide).toEqual([]);
  });
});

describe('C-137: Total Rickall, where Morty starts', () => {
  const living = PLAN.find((r) => r.id === 'living');
  const mid = { x: (living.x0 + living.x1) / 2, z: (living.z0 + living.z1) / 2 };
  const crowdOf = (g) => g.people.map(({ id, x, z, r }) => ({ id, x, z, r }));

  it('puts him at the egg, clear of every spot, so nobody stands where he is when a game starts', () => {
    const egg = HOTSPOTS.find((h) => h.id === 'egg');
    expect(MORTY_AT).toMatchObject({ x: egg.x, z: egg.z });
    for (const s of HOUSE_SPOTS) expect(Math.hypot(MORTY_AT.x - s.x, MORTY_AT.z - s.z), `${s.x}, ${s.z}`).toBeGreaterThanOrEqual(s.r + MORTY.radius);
    // whoever's in the room, he stands where he's put
    for (const seed of SEEDS.slice(0, 40)) {
      let m = newMorty(MORTY_AT, 'rickall');
      for (let i = 0; i < 10; i++) m = stepMorty(m, { x: 0, z: 0 }, 1 / 60, 'house', { crowd: crowdOf(newRickall(seed, { absent: ['morty'] })) });
      expect(Math.hypot(m.x - MORTY_AT.x, m.z - MORTY_AT.z), `seed ${seed}`).toBeLessThan(1e-6);
    }
  });

  it('turns him to the middle of the room, the crowd in front of him', () => {
    // (a heading turns +x round to (cos face, -sin face), as rules.js has it)
    const fx = Math.cos(MORTY_AT.face);
    const fz = -Math.sin(MORTY_AT.face);
    const to = { x: mid.x - MORTY_AT.x, z: mid.z - MORTY_AT.z };
    expect(fx * to.x + fz * to.z).toBeCloseTo(Math.hypot(to.x, to.z), 6);
    // most of the room within 35° of straight ahead of him, whoever's in it
    for (const seed of SEEDS.slice(0, 100)) {
      const g = newRickall(seed, { absent: ['morty'] });
      const ahead = g.people.filter((p) => (fx * (p.x - MORTY_AT.x) + fz * (p.z - MORTY_AT.z)) / Math.hypot(p.x - MORTY_AT.x, p.z - MORTY_AT.z) > Math.cos((35 * Math.PI) / 180));
      expect(ahead.length, `seed ${seed}`).toBeGreaterThanOrEqual(Math.ceil(g.people.length / 2));
    }
  });
});

describe('C-137: Total Rickall’s endings', () => {
  it('says how it ended, in the plan’s words', () => {
    const g = newRickall(3);
    expect(ending(g)).toBe(null);
    for (const id of parasitesIn(g)) shoot(g, id);
    expect(ending(g)).toEqual({ kind: 'won', title: expect.any(String), line: 'Ooh wee. You spared Mr. Poopybutthole.' });
    const b = newRickall(3);
    shoot(b, 'beth');
    expect(ending(b)).toMatchObject({ kind: 'family', line: 'That was Beth.' });
    const j = newRickall(3);
    shoot(j, 'jerry');
    expect(ending(j)).toMatchObject({ kind: 'family', line: 'That was Jerry.' });
    const p = newRickall(3);
    shoot(p, 'poopybutthole');
    expect(ending(p)).toMatchObject({ kind: 'poopybutthole', line: 'He was real. He always was.' });
    const o = newRickall(3);
    stepRickall(o, RICKALL.time);
    expect(ending(o)).toMatchObject({ kind: 'out' });
    // won without Mr. Poopybutthole in the room: nobody to have spared
    const w = newRickall(3, { absent: ['poopybutthole'] });
    for (const id of parasitesIn(w)) shoot(w, id);
    expect(ending(w).line).not.toMatch(/Poopybutthole/);
    for (const e of [g, b, p, o, w].map(ending)) {
      expect(e.title.length, e.kind).toBeGreaterThan(3);
      expect(`${e.title} ${e.line}`, e.kind).not.toMatch(/['"!]/);
      expect(e.line, e.kind).toMatch(/^[A-Z].*\.$/);
    }
  });
});
