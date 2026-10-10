import { describe, expect, it } from 'vitest';
import { CAST_AT, CIVILIANS, castFor, createErrand, createStreet, ringOf } from './street';
import { CLIPS } from '../../../lib/three/clipLibrary';
import { ABQ } from '../wardrobe';
import { CITY, PLACES } from './rules';

const at = (id) => {
  const [, x, z, yaw, place] = CAST_AT.find(([k]) => k === id);
  return { x, z, yaw, place };
};
// a frame's acts, the car `d` metres from someone (south of them, facing them)
const run = (street, frames, carAt) => {
  const out = [];
  for (let i = 0; i < frames; i++) out.push(street.step(1 / 30, carAt(i)));
  return out;
};

describe('who’s out', () => {
  it('puts everyone out on a computer with the bloom, and the three you go to see first on a phone', () => {
    expect(castFor({ phone: false, bloom: 1 })).toHaveLength(CAST_AT.length);
    expect(castFor({ phone: true, bloom: 1 })).toEqual(['jesse', 'saul', 'gus']);
    expect(castFor({ phone: false, bloom: 0 })).toHaveLength(3);
    for (const id of castFor()) expect(ABQ[id], id).toBeTruthy();
  });

  it('stands everyone at a real place of theirs, and plays only clips the library has', () => {
    for (const [id, , , , place] of CAST_AT) if (place) expect(PLACES.some((p) => p.id === place), id).toBe(true);
    const s = createStreet();
    // (every clip any of them can play, by driving at them every way)
    const clips = new Set(['scared', 'wave', 'beckon', 'bow', 'wave.one', 'taunt.trooper']);
    for (const c of clips) expect(CLIPS[c], c).toBeTruthy();
    expect(s).toBeTruthy();
  });
});

describe('the street and Walt’s car', () => {
  it('turns their heads to the car when it’s near, and not when it’s far', () => {
    const s = createStreet();
    const g = at('gus');
    const far = s.step(1 / 30, { car: { x: g.x + 40, z: g.z, yaw: 0, speed: 0 } }).gus;
    expect(far.look).toBeNull();
    const close = s.step(1 / 30, { car: { x: g.x + 8, z: g.z, yaw: 0, speed: 0 } }).gus;
    expect(close.look).toMatchObject({ x: g.x + 8, z: g.z });
  });

  it('has Saul wave you in when you pull up at his office, then beckon, once a visit', () => {
    const s = createStreet();
    const sa = at('saul');
    const car = { x: sa.x, z: sa.z - 6, yaw: 0, speed: 0 };
    const acts = run(s, 200, () => ({ car, near: 'saul' })).map((a) => a.saul);
    const clips = acts.map((a) => a.clip).filter(Boolean);
    expect(clips).toEqual(['wave', 'beckon']);
    // gone and back: again
    run(s, 10, () => ({ car: { ...car, x: car.x + 200 }, near: null }));
    const again = run(s, 30, () => ({ car, near: 'saul' })).map((a) => a.saul.clip).filter(Boolean);
    expect(again).toEqual(['wave']);
  });

  it('has Mike fold his arms, and Gus bow, when you pull up at theirs', () => {
    const s = createStreet();
    const m = at('mike');
    const mike = run(s, 5, () => ({ car: { x: m.x, z: m.z - 6, yaw: 0, speed: 0.5 }, near: 'superlab' })).map((a) => a.mike);
    expect(mike.map((a) => a.gesture).filter(Boolean)).toEqual(['fold']);
    const g = at('gus');
    const gus = run(s, 5, () => ({ car: { x: g.x, z: g.z - 6, yaw: 0, speed: 0.5 }, near: 'pollos' })).map((a) => a.gus);
    expect(gus.map((a) => a.clip).filter(Boolean)).toEqual(['bow']);
  });

  it('has Tuco pound his chest as you drive up, and not again till you’ve been away', () => {
    const s = createStreet();
    const t = at('tuco');
    const up = run(s, 60, (i) => ({ car: { x: t.x - 25 + i * 0.3, z: t.z + 5, yaw: Math.PI / 2, speed: 9 } })).map((a) => a.tuco.clip).filter(Boolean);
    expect(up).toEqual(['taunt.trooper']);
    const stay = run(s, 60, () => ({ car: { x: t.x - 6, z: t.z + 3, yaw: 0, speed: 0 } })).map((a) => a.tuco.clip).filter(Boolean);
    expect(stay).toEqual([]);
  });

  it('sends someone out of the way of a car coming at them fast, and not every frame', () => {
    const s = createStreet();
    const j = at('jesse');
    // (south of him, heading north at him: yaw π faces −z)
    const acts = run(s, 30, (i) => ({ car: { x: j.x, z: j.z + 9 - i * 0.3, yaw: Math.PI, speed: 12 } })).map((a) => a.jesse);
    const scared = acts.filter((a) => a.clip === 'scared');
    expect(scared).toHaveLength(1);
    expect(scared[0].layer).toBe('full');
    // (one going past, not at him: nothing)
    const s2 = createStreet();
    const past = run(s2, 30, (i) => ({ car: { x: j.x + 6, z: j.z + 9 - i * 0.3, yaw: Math.PI / 2, speed: 12 } })).map((a) => a.jesse.clip);
    expect(past).not.toContain('scared');
  });

  it('has Badger and Pete talk, turn and turn about, looking at each other', () => {
    const s = createStreet({ seed: 4 });
    const acts = run(s, 30 * 20, () => ({ car: null }));
    const speakers = acts.map((a) => (a.badger.talk ? 'badger' : a.pete.talk ? 'pete' : null));
    expect(new Set(speakers.filter(Boolean))).toEqual(new Set(['badger', 'pete']));
    for (const a of acts) expect(a.badger.talk && a.pete.talk).toBe(false);
    const p = at('pete');
    expect(acts[0].badger.look).toMatchObject({ x: p.x, z: p.z });
  });
});

describe('someone with an errand on the sidewalk', () => {
  const ring = { x0: 0, z0: 0, x1: 40, z1: 30 };
  it('walks round the block without a jump, stopping at each stop for its time, doing its thing', () => {
    const e = createErrand({ ring, stops: [{ at: 0.25, dwell: 5, clip: 'phone' }], seed: 3, pace: 1.3 });
    const dt = 1 / 30;
    let last = null;
    let dwelt = 0;
    let longest = 0;
    for (let i = 0; i < 30 * 400; i++) {
      const p = e.step(dt);
      if (last) {
        expect(Math.hypot(p.x - last.x, p.z - last.z)).toBeLessThan(1.3 * dt + 1e-6);
        expect(Math.abs(Math.atan2(Math.sin(p.yaw - last.yaw), Math.cos(p.yaw - last.yaw)))).toBeLessThan(0.3);
      }
      // (always on the ring's line)
      const onLine = Math.min(Math.abs(p.x - ring.x0), Math.abs(p.x - ring.x1), Math.abs(p.z - ring.z0), Math.abs(p.z - ring.z1));
      expect(onLine).toBeLessThan(1e-6);
      if (p.doing === 'phone') {
        dwelt += dt;
        longest = Math.max(longest, dwelt);
        expect(p.speed).toBe(0);
      } else dwelt = 0;
      last = p;
    }
    expect(longest).toBeGreaterThan(4.5);
    expect(longest).toBeLessThan(5.2);
  });

  it('stops and steps back from a car up on the sidewalk beside it', () => {
    const e = createErrand({ ring, stops: [], seed: 2, pace: 1.3 });
    let p;
    for (let i = 0; i < 60; i++) p = e.step(1 / 30);
    const car = { x: p.x + 2, z: p.z, speed: 6 };
    for (let i = 0; i < 20; i++) p = e.step(1 / 30, car);
    expect(p.doing).toBe('scared');
    expect(p.speed).toBeLessThan(0.3);
  });

  it('has a ring of its own round a real block for each who walks', () => {
    for (const c of CIVILIANS) {
      expect(ABQ[c.id], c.id).toBeTruthy();
      const b = CITY.blocks.find((k) => c.near.x > k.kerb.x0 && c.near.x < k.kerb.x1 && c.near.z > k.kerb.z0 && c.near.z < k.kerb.z1);
      expect(b, c.id).toBeTruthy();
      const r = ringOf(b.kerb);
      expect(r.x1 - r.x0).toBeGreaterThan(20);
      expect(r.z1 - r.z0).toBeGreaterThan(20);
      for (const s of c.stops) if (s.clip) expect(CLIPS[s.clip], s.clip).toBeTruthy();
    }
  });
});
