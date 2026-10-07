import { describe, expect, it } from 'vitest';
import { seeded } from '../seeded';
import { createSocial } from './social';

const DT = 0.1;
// a walker's step toward where it's told, at walking pace (the world's part)
function walk(p, to, dt = DT, speed = 1.4) {
  if (!to) return;
  const dx = to.x - p.x;
  const dz = to.z - p.z;
  const d = Math.hypot(dx, dz);
  if (d < 1e-6) return;
  const k = Math.min(d, speed * dt) / d;
  p.x += dx * k;
  p.z += dz * k;
}
const byWho = (out) => Object.fromEntries(out.map((e) => [e.who, e]));

describe('conversations', () => {
  it('two who want company meet a step apart, face each other, take turns, and part', () => {
    const s = createSocial({ rand: seeded(4) });
    const a = { id: 'a', x: 0, z: 0, company: 0.9 };
    const b = { id: 'b', x: 6, z: 1, company: 0.8 };
    const people = [a, b];
    const speakers = [];
    let met = false;
    let ended = false;
    let t = 0;
    for (let i = 0; i < 1200 && !ended; i++, t += DT) {
      const out = byWho(s.step(people, t, DT));
      for (const p of people) if (out[p.id]?.mode === 'walk') walk(p, out[p.id].to);
      const modes = people.map((p) => out[p.id]?.mode);
      if (modes.includes('talk')) {
        met = true;
        // one speaks, the other listens to them; each looks at the other
        const speaker = people.find((p) => out[p.id].mode === 'talk');
        const listener = people.find((p) => p !== speaker);
        expect(out[listener.id].mode).toBe('listen');
        expect(out[listener.id].look).toBe(speaker.id);
        expect(out[speaker.id].look).toBe(listener.id);
        if (speakers[speakers.length - 1] !== speaker.id) speakers.push(speaker.id);
        // a step apart
        expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(0.9);
        expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeLessThan(1.8);
      } else if (met) ended = true;
    }
    expect(met).toBe(true);
    expect(ended).toBe(true);
    // turns alternate, more than one each way
    expect(speakers.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < speakers.length; i++) expect(speakers[i]).not.toBe(speakers[i - 1]);
    // and having just talked, they don't start again at once
    const again = s.step(people, t + 1, DT);
    expect(again.filter((e) => e.mode === 'talk' || e.mode === 'listen')).toHaveLength(0);
  });

  it('leave out whoever doesn’t want company, is busy, or is too far', () => {
    const s = createSocial({ rand: seeded(2) });
    const out = s.step(
      [
        { id: 'a', x: 0, z: 0, company: 0.2 },
        { id: 'b', x: 1, z: 0, company: 0.9 },
        { id: 'c', x: 1.5, z: 0, company: 0.9, busy: true },
        { id: 'd', x: 40, z: 0, company: 0.9 },
      ],
      0,
      DT,
    );
    expect(out).toEqual([]);
  });

  it('a third may join, and the listeners look at the speaker', () => {
    let threes = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const s = createSocial({ rand: seeded(seed) });
      const people = [
        { id: 'a', x: 0, z: 0, company: 0.9 },
        { id: 'b', x: 3, z: 0, company: 0.9 },
        { id: 'c', x: 1.5, z: 2, company: 0.9 },
      ];
      let three = false;
      let last = null;
      for (let t = 0; t < 40; t += DT) {
        const out = byWho(s.step(people, t, DT));
        for (const p of people) if (out[p.id]?.mode === 'walk') walk(p, out[p.id].to);
        const talking = people.filter((p) => out[p.id]?.mode === 'talk' || out[p.id]?.mode === 'listen');
        const sp = people.find((p) => out[p.id]?.mode === 'talk');
        if (talking.length === 3 && sp) three = true;
        if (sp && sp.id !== last) {
          // a new speaker: the listeners look at them
          last = sp.id;
          for (const p of talking) if (p !== sp) expect(out[p.id].look).toBe(sp.id);
          // and the speaker looks at one of them
          expect(talking.map((p) => p.id)).toContain(out[sp.id].look);
        }
      }
      if (three) threes++;
    }
    // some seeds make a three, not all
    expect(threes).toBeGreaterThan(0);
    expect(threes).toBeLessThan(12);
  });

  it('two who stop a little short still talk, a moment later, and are told where to settle', () => {
    const s = createSocial({ rand: seeded(4) });
    const a = { id: 'a', x: 0, z: 0, company: 0.9 };
    const b = { id: 'b', x: 2, z: 0, company: 0.9 };
    let talk = null;
    let t = 0;
    for (; t < 6 && !talk; t += DT) talk = s.step([a, b], t, DT).find((e) => e.mode === 'talk') ?? null;
    expect(talk).not.toBeNull();
    expect(t).toBeGreaterThan(3);
    expect(Math.abs(talk.to.x - (talk.who === 'a' ? 0.35 : 1.65))).toBeLessThan(1e-9);
  });

  it('breaks off when one of them is called away', () => {
    const s = createSocial({ rand: seeded(4) });
    const a = { id: 'a', x: 0, z: 0, company: 0.9 };
    const b = { id: 'b', x: 1.3, z: 0, company: 0.9 };
    let t = 0;
    let talking = false;
    for (; t < 30 && !talking; t += DT) talking = s.step([a, b], t, DT).some((e) => e.mode === 'talk');
    expect(talking).toBe(true);
    b.busy = true;
    expect(s.step([a, b], t, DT).filter((e) => e.who === 'a')).toEqual([]);
  });
});

describe('groups', () => {
  it('walk with the leader, side by side, keeping their spacing', () => {
    const s = createSocial({ rand: seeded(1) });
    const lead = { id: 'L', x: 0, z: 0, yaw: 0, group: 'g', leader: true };
    const f = [1, 2, 3].map((k) => ({ id: `f${k}`, x: k * 0.4 - 0.8, z: -2 - k * 0.3, yaw: 0, group: 'g' }));
    const people = [lead, ...f];
    for (let t = 0; t < 20; t += DT) {
      // the leader on its route (the world's): up +z at a walk
      lead.z += 1.2 * DT;
      const out = byWho(s.step(people, t, DT));
      for (const p of f) walk(p, out[p.id]?.to, DT, 1.8);
      if (t > 6)
        for (let i = 0; i < people.length; i++)
          for (let j = i + 1; j < people.length; j++) expect(Math.hypot(people[i].x - people[j].x, people[i].z - people[j].z)).toBeGreaterThan(0.75);
    }
    // all near the leader, and at least one abreast of it
    for (const p of f) expect(Math.hypot(p.x - lead.x, p.z - lead.z)).toBeLessThan(3);
    expect(f.some((p) => Math.abs(p.z - lead.z) < 0.6 && Math.abs(p.x - lead.x) > 0.8)).toBe(true);
  });

  it('the leader waits for one left behind', () => {
    const s = createSocial({ rand: seeded(1) });
    const lead = { id: 'L', x: 0, z: 20, yaw: 0, group: 'g', leader: true };
    const late = { id: 'f', x: 0, z: 0, yaw: 0, group: 'g' };
    const out = byWho(s.step([lead, late], 0, DT));
    expect(out.L.mode).toBe('walk');
    expect(out.L.to).toEqual({ x: 0, z: 20 });
    expect(out.f.with).toBe('L');
  });
});

describe('making way', () => {
  it('a walker ahead of you steps out of your path, not into you', () => {
    const s = createSocial({ rand: seeded(1) });
    const w = { id: 'w', x: 0.2, z: 2, yaw: Math.PI };
    const you = { x: 0, z: 0, yaw: 0, speed: 1.5 };
    const out = byWho(s.step([w], 0, DT, { you }));
    expect(out.w.mode).toBe('makeway');
    // to the side it was already on, clear of your path, and not back at you
    expect(out.w.to.x).toBeGreaterThan(1);
    expect(out.w.to.z).toBeGreaterThan(1.5);
    expect(out.w.look).toEqual({ x: 0, z: 0 });
    // walking it there clears the way
    for (let t = 0; t < 2; t += DT) walk(w, byWho(s.step([w], t, DT, { you }))?.w?.to);
    expect(Math.abs(w.x)).toBeGreaterThan(0.9);
  });

  it('not one behind you, beside you, or when you stand still; and a shove when you walk into one', () => {
    const s = createSocial({ rand: seeded(1) });
    const you = { x: 0, z: 0, yaw: 0, speed: 1.5 };
    expect(s.step([{ id: 'b', x: 0, z: -2 }], 0, DT, { you })).toEqual([]);
    expect(s.step([{ id: 'c', x: 2, z: 1 }], 0, DT, { you })).toEqual([]);
    expect(s.step([{ id: 'd', x: 0, z: 2 }], 0, DT, { you: { ...you, speed: 0 } })).toEqual([]);
    expect(s.step([{ id: 'e', x: 0, z: 2, busy: true }], 0, DT, { you })).toEqual([]);
    const [hit] = s.step([{ id: 'f', x: -0.1, z: 0.4 }], 0, DT, { you });
    expect(hit.shove).toBe(true);
    expect(hit.to.x).toBeLessThan(-0.5);
  });
});

describe('greeting', () => {
  it('one who knows you turns its head inside 6 m, waves once per approach, and is re-armed past 9 m', () => {
    const s = createSocial({ rand: seeded(1) });
    const k = { id: 'k', x: 0, z: 0, knows: true };
    const stranger = { id: 's', x: 0.5, z: 0 };
    let waves = 0;
    const visit = (from, to, t0) => {
      let t = t0;
      for (let z = from; from < to ? z <= to : z >= to; z += from < to ? 0.25 : -0.25, t += DT) {
        const out = byWho(s.step([k, stranger], t, DT, { you: { x: 0, z, yaw: 0, speed: 0 } }));
        expect(out.s).toBeUndefined();
        if (Math.abs(z) < 6) {
          expect(out.k.mode).toBe('greet');
          expect(out.k.look).toEqual({ x: 0, z });
        }
        if (out.k?.wave) waves++;
      }
      return t;
    };
    let t = visit(-12, -2, 0);
    expect(waves).toBe(1);
    // back out to 7 m and in again: no second wave
    t = visit(-2, -7, t);
    t = visit(-7, -2, t);
    expect(waves).toBe(1);
    // past 9 m, and back: a wave again
    t = visit(-2, -12, t);
    visit(-12, -2, t);
    expect(waves).toBe(2);
  });

  it('one with a line greets too', () => {
    const s = createSocial({ rand: seeded(1) });
    const out = s.step([{ id: 'l', x: 0, z: 0, line: true }], 0, DT, { you: { x: 3, z: 0, yaw: 0, speed: 0 } });
    expect(out[0]).toMatchObject({ who: 'l', mode: 'greet', wave: true, look: { x: 3, z: 0 } });
  });

  it('a talker who knows you keeps talking, and waves once the talk is over', () => {
    const s = createSocial({ rand: seeded(4) });
    const a = { id: 'a', x: 0, z: 0, company: 0.9, knows: true };
    const b = { id: 'b', x: 1.3, z: 0, company: 0.9 };
    let t = 0;
    let out = [];
    for (; t < 30 && !out.some((e) => e.mode === 'talk'); t += DT) out = s.step([a, b], t, DT);
    const you = { x: 0, z: -4, yaw: 0, speed: 0 };
    let waved = false;
    for (; t < 90; t += DT) {
      out = byWho(s.step([a, b], t, DT, { you }));
      if (s.talking('a')) expect(['talk', 'listen']).toContain(out.a.mode);
      else if (out.a?.wave) waved = true;
    }
    expect(waved).toBe(true);
  });
});

describe('seeded', () => {
  it('two runs from the same seed say the same thing', () => {
    const run = () => {
      const s = createSocial({ rand: seeded(9) });
      const people = [
        { id: 'a', x: 0, z: 0, company: 0.9 },
        { id: 'b', x: 4, z: 0, company: 0.9 },
      ];
      const log = [];
      for (let t = 0; t < 30; t += DT) {
        const out = s.step(people, t, DT);
        for (const e of out) if (e.mode === 'walk') walk(people.find((p) => p.id === e.who), e.to);
        log.push(out.map((e) => `${e.who}:${e.mode}`).join(','));
      }
      return log.join('|');
    };
    expect(run()).toBe(run());
  });
});
