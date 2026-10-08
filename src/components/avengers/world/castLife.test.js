import { describe, expect, it } from 'vitest';
import { CAST } from './rules';
import { CLIPS } from '../../../lib/three/clipLibrary';
import { GREET_R, LEAVE_R, LIFE, createCastLife, lineTime } from './castLife';

const member = (id) => CAST.find((c) => c.id === id);
const home = (c) => c.face + Math.PI / 2;
// the hero `d` metres from a member, on the ground unless `low` is false
const heroAt = (c, d, low = true) => ({ x: c.x + d, y: low ? 0 : 12, z: c.z, low });
const FAR = (c) => heroAt(c, 60);

// run a life for `secs` at 30 frames a second; `ctx(t)` the world, the body's
// one-shots played through a second after they're asked for
function run(life, secs, ctx, { from = 0, log = [] } = {}) {
  let ended = null;
  let since = 0;
  let last = null;
  let out = null;
  const dt = 1 / 30;
  for (let t = from; t < from + secs; t += dt) {
    out = life.step(dt, { ...ctx(t), t, ended });
    ended = null;
    if (out.clip !== last?.clip || out.state !== last?.state) since = 0;
    since += dt;
    if (out.once && since > 1) ended = out.clip;
    last = out;
    log.push({ t, ...out });
  }
  return { out, log };
}

describe("the compound's people, left to themselves", () => {
  it('stand a while, then train with the library, each at their own spot and facing', () => {
    for (const id of ['thor', 'natasha', 'hulk', 'bot']) {
      const c = member(id);
      const life = createCastLife(c, { seed: 3 });
      const { log } = run(life, 120, () => ({ hero: FAR(c) }));
      const states = new Set(log.map((s) => s.state));
      expect(states.has('stand'), id).toBe(true);
      expect(states.has('train'), id).toBe(true);
      expect(states.has('greet')).toBe(false);
      const trained = new Set(log.filter((s) => s.state === 'train').map((s) => s.clip));
      for (const clip of trained) expect(LIFE[id].train.map((e) => e.clip)).toContain(clip);
      for (const s of log) expect(s.face).toBeCloseTo(home(c), 6);
      // a set is long enough to see, and not forever
      const runs = [];
      let start = null;
      for (const s of log) {
        if (s.state === 'train' && start == null) start = s.t;
        if (s.state !== 'train' && start != null) {
          runs.push(s.t - start);
          start = null;
        }
      }
      for (const r of runs) expect(r).toBeGreaterThan(4);
    }
  });

  it("don't keep in step with each other, and do the same again from the same seed", () => {
    const c = member('thor');
    const first = (seed) => run(createCastLife(c, { seed }), 60, () => ({ hero: FAR(c) })).log.find((s) => s.state === 'train')?.t;
    expect(first(1)).not.toBeCloseTo(first(2), 1);
    expect(first(5)).toBe(first(5));
  });
});

describe('when Spider-Man comes up to them', () => {
  it('they turn to him and greet him, then watch him, looking at him', () => {
    const c = member('natasha');
    const life = createCastLife(c, { seed: 1 });
    run(life, 5, () => ({ hero: FAR(c) }));
    const { log } = run(life, 6, () => ({ hero: heroAt(c, 6) }), { from: 5 });
    const greet = log.find((s) => s.state === 'greet');
    expect(greet.clip).toBe(LIFE.natasha.greet);
    expect(greet.once).toBe(true);
    expect(greet.look).toBe('hero');
    expect(greet.face).toBeCloseTo(Math.PI / 2, 6); // (he's along +x from her)
    expect(log.at(-1).state).toBe('watch');
    expect(log.at(-1).clip).toBe('idle');
    expect(log.at(-1).look).toBe('hero');
  });

  it("don't greet him while he swings overhead, though they watch him go by", () => {
    const c = member('thor');
    const life = createCastLife(c, { seed: 1 });
    const { log } = run(life, 6, () => ({ hero: heroAt(c, 5, false) }));
    expect(log.some((s) => s.state === 'greet')).toBe(false);
    expect(log.filter((s) => s.state !== 'train').every((s) => s.look === 'hero')).toBe(true);
  });

  it('the Hulk finishes his push-ups unless he comes right up', () => {
    const c = member('hulk');
    const life = createCastLife(c, { seed: 2 });
    // until he's at it
    let t = 0;
    while (life.step(1 / 30, { t, hero: FAR(c) }).state !== 'train') t += 1 / 30;
    const near = run(life, 2, () => ({ hero: heroAt(c, GREET_R - 2) }), { from: t }).log;
    expect(near.every((s) => s.state === 'train')).toBe(true);
    const close = run(life, 2, () => ({ hero: heroAt(c, 3) }), { from: t + 2 }).log;
    expect(close.some((s) => s.state === 'greet')).toBe(true);
  });

  it('greet him once, not every time he steps back and forth, and again after a while', () => {
    const c = member('thor');
    const life = createCastLife(c, { seed: 4 });
    const greets = (log) => log.filter((s, i) => s.state === 'greet' && log[i - 1]?.state !== 'greet').length;
    const a = run(life, 8, () => ({ hero: heroAt(c, 6) })).log;
    // off and back within a few seconds
    const b = run(life, 4, () => ({ hero: heroAt(c, LEAVE_R + 4) }), { from: 8 }).log;
    const c2 = run(life, 6, () => ({ hero: heroAt(c, 6) }), { from: 12 }).log;
    expect(greets([...a, ...b, ...c2])).toBe(1);
    expect(b.at(-1).state).not.toBe('watch'); // (back to what it was doing)
    // a minute on, he's greeted again
    run(life, 60, () => ({ hero: FAR(c) }), { from: 18 });
    const d = run(life, 6, () => ({ hero: heroAt(c, 6) }), { from: 78 }).log;
    expect(greets(d)).toBe(1);
  });
});

describe('while their bubble is up', () => {
  it("say each line with the line's own gesture, as long as it takes, then watch", () => {
    const c = member('thor');
    const life = createCastLife(c, { seed: 1 });
    const line = c.lines[1];
    const { log } = run(life, lineTime(line) + 2, () => ({ hero: heroAt(c, 2), say: line }));
    const talk = log.filter((s) => s.state === 'talk');
    expect(talk[0].clip).toBe(LIFE.thor.lines[1]);
    expect(talk.at(-1).t - talk[0].t).toBeCloseTo(lineTime(line), 0);
    expect(log.at(-1).state).toBe('watch');
    expect(talk.every((s) => s.look === 'hero')).toBe(true);
  });

  it('a one-shot gesture goes on into talking until the line is said', () => {
    const c = member('hulk');
    const life = createCastLife(c, { seed: 1 });
    const line = c.lines[1]; // Hulk smash!
    const { log } = run(life, lineTime(line), () => ({ hero: heroAt(c, 2), say: line }));
    const clips = [...new Set(log.filter((s) => s.state === 'talk').map((s) => s.clip))];
    expect(clips[0]).toBe(LIFE.hulk.lines[1]);
    if (lineTime(line) > 1.5) expect(clips[1]).toBe(LIFE.hulk.talk);
  });

  it("celebrate their game won the first time they see him after, and only then", () => {
    const c = member('thor');
    const life = createCastLife(c, { seed: 1 });
    const line = c.after.lines[0];
    const { log } = run(life, 6, () => ({ hero: heroAt(c, 2), say: line, won: true }));
    const clips = [...new Set(log.filter((s) => s.state === 'talk').map((s) => s.clip))];
    expect(clips[0]).toBe(LIFE.thor.won);
    expect(clips[1]).toBe(LIFE.thor.after[0]);
    // the next line's just said
    run(life, 2, () => ({ hero: heroAt(c, 2), won: true }), { from: 6 });
    const next = run(life, 3, () => ({ hero: heroAt(c, 2), say: c.after.lines[1], won: true }), { from: 8 }).log;
    expect(next.find((s) => s.state === 'talk').clip).toBe(LIFE.thor.after[1]);
  });

  it('a line it has no gesture for is said with its talk', () => {
    const c = member('natasha');
    const life = createCastLife(c, { seed: 1 });
    const { log } = run(life, 1, () => ({ hero: heroAt(c, 2), say: 'Something new.' }));
    expect(log.find((s) => s.state === 'talk').clip).toBe(LIFE.natasha.talk);
  });
});

describe('what happens round them', () => {
  it('a hard landing beside them gets a reaction, one far off or soft does not', () => {
    const c = member('natasha');
    const life = createCastLife(c, { seed: 1 });
    run(life, 3, () => ({ hero: FAR(c) }));
    life.event('land', { x: c.x + 30, z: c.z, impact: 20 });
    life.event('land', { x: c.x + 1, z: c.z, impact: 3 });
    let { log } = run(life, 1, () => ({ hero: FAR(c) }), { from: 3 });
    expect(log.some((s) => s.state === 'react')).toBe(false);
    life.event('land', { x: c.x + 2, z: c.z + 1, impact: 18 });
    ({ log } = run(life, 1, () => ({ hero: heroAt(c, 2.2) }), { from: 4 }));
    const r = log.find((s) => s.state === 'react');
    expect(r.clip).toBe(LIFE.natasha.land);
    expect(r.look).toBe('hero');
  });

  it('they look up at the portal as it opens', () => {
    const c = member('thor');
    const life = createCastLife(c, { seed: 1 });
    run(life, 2, () => ({ hero: FAR(c) }));
    life.event('portal');
    const { log } = run(life, 8, () => ({ hero: FAR(c) }), { from: 2 });
    expect(log[0].look).toBe('portal');
    expect(log.at(-1).look).toBe(null);
  });

  it('every clip it asks for is one the body can have', () => {
    for (const id of Object.keys(LIFE)) {
      const L = LIFE[id];
      const names = [...L.train.map((e) => e.clip), ...L.fidgets, L.greet, L.won, L.land, L.talk, ...L.lines, ...L.after].filter(Boolean);
      // the real people's from the library; the bot's its kit figure's own
      const kit = ['jacks', 'wave', 'cheer', 'talk', 'idle'];
      for (const n of names) expect(id === 'bot' ? kit : Object.keys(CLIPS), `${id}: ${n}`).toContain(n);
      const c = member(id);
      expect(L.lines.length).toBeLessThanOrEqual(c.lines.length);
      expect(L.after.length).toBeLessThanOrEqual(c.after?.lines.length ?? 0);
    }
  });
});
