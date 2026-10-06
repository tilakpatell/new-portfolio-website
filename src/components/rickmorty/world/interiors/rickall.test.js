import { describe, expect, it } from 'vitest';
import { HOUSE_SPOTS } from '../rules';
import { FAMILY, PARASITES, RICKALL, newRickall, parasitesLeft, shoot, stepRickall, tell } from './rickall';

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
      expect(p, p.id).toMatchObject({ kind: who.kind, name: who.name, r: who.r, parasite: PARASITES.includes(who) });
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
