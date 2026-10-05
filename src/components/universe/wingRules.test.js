import { describe, expect, it } from 'vitest';
import { createHunt } from './hunterRules';
import { WING, WING_KINDS, createWing } from './wingRules';

// a seeded random, so a fight is the same every time
const seeded = (seed = 7) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const DT = 1 / 60;
const start = (over = {}) => ({ x: 0, y: 0, z: 0, heading: 0, pitch: 0, speed: 5.5, vy: 0, ...over });
const move = (s) => ({ ...s, x: s.x - Math.sin(s.heading) * s.speed * DT, z: s.z - Math.cos(s.heading) * s.speed * DT });
const apart = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const finite = (p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);

// a fight with a wing in it: the pack after you, the wing after them, its
// hits put on the hunters as the scene does
function fight({ seed = 5, seconds = 60, size = 3, n = 2, kind = 'xwing', fly = (s) => s, joinAt = 0 } = {}) {
  const rand = seeded(seed);
  const hunt = createHunt({ rand });
  const wing = createWing({ rand });
  let s = start();
  hunt.pack('empire', s, { size, ace: false });
  const seen = { downs: 0, hits: 0, events: [], firstDownAt: null };
  for (let t = 0; t < seconds; t += DT) {
    s = move(fly(s, t));
    hunt.update(DT, s);
    if (t >= joinAt && t < joinAt + DT) wing.join(kind, s, n);
    const r = wing.update(DT, s, hunt.targets);
    for (const e of r.events) seen.events.push(e.type);
    for (const h of r.hits) {
      seen.hits += 1;
      const got = hunt.damage(h.id, h.damage);
      if (got?.down) {
        seen.downs += 1;
        seen.firstDownAt ??= t;
      }
    }
    for (const w of wing.live) expect(finite(w.pos)).toBe(true);
  }
  return { ...seen, hunt, wing, ship: s };
}

describe('a wing', () => {
  it('comes up from behind you and says so', () => {
    const wing = createWing({ rand: seeded(1) });
    const s = start();
    wing.join('xwing', s, 2);
    expect(wing.live).toHaveLength(2);
    for (const w of wing.live) {
      expect(w.pos.z).toBeGreaterThan(s.z + WING.from * 0.9); // (behind: you face −z)
      expect(Math.abs(w.pos.x)).toBeGreaterThan(2); // (out to the sides)
    }
    expect(wing.update(DT, s, []).events.map((e) => e.type)).toEqual(['joined']);
    expect(wing.update(DT, s, []).events).toEqual([]);
  });

  it('shoots the hunters down: real shots, most of them hitting nothing', () => {
    let downs = 0;
    let hits = 0;
    let shots = 0;
    for (const seed of [3, 5, 9]) {
      const seen = fight({ seed, seconds: 45 });
      downs += seen.downs;
      hits += seen.hits;
      shots += seen.wing.fired;
    }
    expect(downs).toBeGreaterThanOrEqual(3); // (of nine, in three fights, with no help from you)
    expect(shots).toBeGreaterThan(hits);
    expect(hits / shots).toBeLessThan(0.6); // (a help, not a turret)
  });

  it('spreads out: they go after different hunters while two or more are coming at you', () => {
    let both = 0;
    let frames = 0;
    const rand = seeded(4);
    const hunt = createHunt({ rand });
    const wing = createWing({ rand });
    let s = start();
    hunt.pack('empire', s, { size: 4, ace: false });
    wing.join('xwing', s, 2);
    for (let t = 0; t < 40; t += DT) {
      s = move(s);
      hunt.update(DT, s);
      wing.update(DT, s, hunt.targets);
      const [a, b] = wing.live;
      const threats = hunt.targets.filter((h) => h.threat > 0).length;
      if (threats >= 2 && a?.target != null && b?.target != null) {
        frames += 1;
        if (a.target !== b.target) both += 1;
      }
    }
    expect(frames).toBeGreaterThan(30);
    expect(both / frames).toBeGreaterThan(0.8);
  });

  it('covers you: it goes only after the ones coming at you, not those swinging wide', () => {
    const wing = createWing({ rand: seeded(3) });
    let s = start();
    wing.join('xwing', s, 2);
    const wide = { id: 7, at: { x: 6, y: 0, z: -4 }, vel: { x: 8, y: 0, z: 0 }, size: 0.3, threat: 0 };
    for (let t = 0; t < WING.settle + 2; t += DT) {
      s = move(s);
      wing.update(DT, s, [wide]);
    }
    expect(wing.live.every((w) => w.target === null)).toBe(true);
    expect(wing.fired).toBe(0);
    const coming = { ...wide, threat: 1 };
    for (let t = 0; t < 0.5; t += DT) wing.update(DT, s, [coming]);
    expect(wing.live.some((w) => w.target === 7)).toBe(true);
  });

  it('waits on your wing a moment before it goes in, and comes back between passes', () => {
    const rand = seeded(9);
    const hunt = createHunt({ rand });
    const wing = createWing({ rand });
    let s = start();
    hunt.pack('empire', s, { size: 4, ace: false });
    for (let t = 0; t < 8; t += DT) {
      s = move(s);
      hunt.update(DT, s);
    }
    wing.join('xwing', s, 2);
    let longest = 0;
    for (let t = 0; t < 30; t += DT) {
      s = move(s);
      hunt.update(DT, s);
      wing.update(DT, s, hunt.targets);
      if (t < WING.settle - DT) expect(wing.live.every((w) => w.target === null)).toBe(true);
      for (const w of wing.live) longest = Math.max(longest, w.chase);
    }
    expect(longest).toBeGreaterThan(1);
    expect(longest).toBeLessThanOrEqual(WING.chase + DT);
  });

  it('forms up on your wing with nobody to fight, then peels away and goes', () => {
    const wing = createWing({ rand: seeded(2) });
    let s = start({ speed: 8 });
    wing.join('birdperson', s, 2);
    const kinds = new Set();
    const events = [];
    let near = Infinity;
    for (let t = 0; t < WING.stay - 0.5; t += DT) {
      s = move(s);
      events.push(...wing.update(DT, s, []).events.map((e) => e.type));
      for (const w of wing.live) kinds.add(w.kind);
      if (t > WING.stay - 2) for (const w of wing.live) near = Math.min(near, apart(w.pos, s));
    }
    expect([...kinds]).toEqual(['birdperson']);
    expect(near).toBeLessThan(6); // (on your wing)
    expect(events).not.toContain('leaving');
    for (let t = 0; t < WING.leave + 2; t += DT) {
      s = move(s);
      events.push(...wing.update(DT, s, []).events.map((e) => e.type));
    }
    expect(events).toContain('leaving');
    expect(events).toContain('gone');
    expect(wing.active).toBe(false);
  });

  it('keeps up with you on the boost, and doesn’t overshoot its slot', () => {
    const wing = createWing({ rand: seeded(6) });
    let s = start({ speed: 20 });
    wing.join('xwing', s, 2);
    let far = 0;
    for (let t = 0; t < 6; t += DT) {
      s = move(s);
      wing.update(DT, s, []);
      if (t > 4) for (const w of wing.live) far = Math.max(far, apart(w.pos, s));
    }
    expect(far).toBeLessThan(8);
  });

  it('leaves when you stop flying, and clear() takes them all at once', () => {
    const wing = createWing({ rand: seeded(8) });
    wing.join('xwing', start(), 3);
    expect(wing.live).toHaveLength(3);
    const ev = wing.update(DT, null, []).events.map((e) => e.type);
    expect(ev).toContain('leaving');
    wing.clear();
    expect(wing.active).toBe(false);
    expect(wing.bolts.every((b) => !b.on)).toBe(true);
  });

  it('knows every kind it can send', () => {
    for (const k of Object.values(WING_KINDS)) {
      expect(k.speed).toBeGreaterThan(20); // (a boost's speed and more: they can catch you up)
      expect(k.fire[0]).toBeLessThan(k.fire[1]);
    }
  });
});
