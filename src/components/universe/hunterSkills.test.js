import { describe, expect, it } from 'vitest';
import { PACE, SHIP } from './ship';
import { FACTIONS, FIGHT, HOLDOFF, HUNTER_KINDS, ION, LASER, MISSILE, RAM, SKILLS, SNIPER, TRAITS, createHunt, hasTrait, traitsOf } from './hunterRules';

// the pilots' skill, and the kinds that fight their own new ways
// (hunterRules.js's SKILLS and TRAITS; the old ways are hunterRules.test.js's)

const seeded = (seed = 7) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const DT = 1 / 60;
const start = (over = {}) => ({ x: 0, y: 0, z: 0, heading: 0, pitch: 0, speed: 0, vy: 0, ...over });
const move = (s) => {
  const level = Math.cos(s.pitch);
  const vy = Math.sin(s.pitch) * s.speed;
  return { ...s, x: s.x - Math.sin(s.heading) * level * s.speed * DT, y: s.y + vy * DT, z: s.z - Math.cos(s.heading) * level * s.speed * DT, vy };
};
const apart = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const noseOf = (s) => [-Math.sin(s.heading) * Math.cos(s.pitch), Math.sin(s.pitch), -Math.cos(s.heading) * Math.cos(s.pitch)];

// one kind, in a faction of its own
const solo = (over, { size = [1, 3] } = {}) => ({
  kinds: { ...HUNTER_KINDS, odd: { ...HUNTER_KINDS.tie, hp: 3, ...over } },
  factions: { odd: { kinds: [['odd', 1]], laser: [1, 1, 1], size } },
});
// a fight flown frame by frame: each(hunt, ship, events, t)
function run({ seed = 7, seconds = 60, size = 2, over = {}, skill, fly = (s) => ({ ...s, speed: SHIP.cruise }), each, faction = 'odd', kinds, factions } = {}) {
  const k = kinds ? { kinds, factions } : solo(over);
  const hunt = createHunt({ rand: seeded(seed), kinds: k.kinds, factions: k.factions });
  let s = start();
  hunt.pack(faction, s, { size, skill });
  const seen = { shots: 0, hits: 0, damage: [], events: [], hunt };
  for (let t = 0; t < seconds; t += DT) {
    s = move(fly(s, t, hunt));
    const events = hunt.update(DT, s);
    for (const e of events) {
      if (e.type === 'shot') seen.shots += 1;
      else if (e.type === 'laser') {
        seen.hits += 1;
        seen.damage.push(e);
      } else seen.events.push(e);
    }
    each?.(hunt, s, events, t);
  }
  seen.ship = s;
  return seen;
}

describe('a pilot’s skill', () => {
  it('has four tiers, each truer, quicker and harder to line up on than the last', () => {
    const tiers = Object.keys(SKILLS);
    expect(tiers).toEqual(['rookie', 'regular', 'veteran', 'elite']);
    for (let i = 1; i < tiers.length; i++) {
      const a = SKILLS[tiers[i - 1]];
      const b = SKILLS[tiers[i]];
      expect(b.lead).toBeGreaterThan(a.lead);
      expect(b.spread).toBeLessThan(a.spread);
      expect(b.fire).toBeLessThan(a.fire);
      expect(b.react).toBeLessThan(a.react);
      expect(b.jink).toBeGreaterThan(a.jink);
      expect(b.flinch).toBeLessThan(a.flinch);
    }
  });

  it('flies a pack sent with no skill exactly as it always has', () => {
    const a = run({ seed: 5, seconds: 30 });
    const b = run({ seed: 5, seconds: 30, skill: null });
    expect(b.shots).toBe(a.shots);
    expect(b.hits).toBe(a.hits);
    expect(b.ship).toEqual(a.ship);
  });

  it('lands more of its shots the better it is', () => {
    const ratio = (skill) => {
      let shots = 0;
      let hits = 0;
      for (const seed of [3, 5, 7, 9, 11, 13]) {
        const seen = run({ seed, seconds: 50, size: 3, skill, fly: (s, t) => ({ ...s, speed: 8 * PACE, heading: s.heading + Math.sin(t * 0.7) * 0.012 }) });
        shots += seen.shots;
        hits += seen.hits;
      }
      return { shots, hits, r: hits / Math.max(1, shots) };
    };
    const rookie = ratio('rookie');
    const elite = ratio('elite');
    expect(elite.shots).toBeGreaterThan(rookie.shots);
    expect(elite.r).toBeGreaterThan(rookie.r * 1.3);
    expect(elite.hits).toBeGreaterThan(rookie.hits * 1.6);
  });

  it('breaks off its line when you line up on it, the good ones more often', () => {
    // you chase the nearest of them, turning your nose on to it as quick as a ship can
    const chase = (s, t, hunt) => {
      const h = hunt.live[0];
      if (!h) return { ...s, speed: 8 * PACE };
      const dx = h.pos.x - s.x;
      const dy = h.pos.y - s.y;
      const dz = h.pos.z - s.z;
      const wantH = Math.atan2(-dx, -dz);
      const wantP = Math.atan2(dy, Math.hypot(dx, dz));
      let dh = wantH - s.heading;
      while (dh > Math.PI) dh -= 2 * Math.PI;
      while (dh < -Math.PI) dh += 2 * Math.PI;
      const max = 2.2 * DT;
      return { ...s, speed: 8 * PACE, heading: s.heading + Math.max(-max, Math.min(max, dh)), pitch: s.pitch + Math.max(-max, Math.min(max, wantP - s.pitch)) };
    };
    // and fire a bolt down your nose whenever it's lined up: how many land
    const lined = (skill) => {
      let fired = 0;
      let landed = 0;
      let jinks = 0;
      for (const seed of [2, 4, 6, 8, 10, 12]) {
        const bolts = [];
        let cool = 0;
        run({
          seed,
          seconds: 40,
          size: 1,
          over: { hp: 1e6 },
          skill,
          fly: chase,
          each: (hunt, s) => {
            const h = hunt.live[0];
            if (!h) return;
            jinks = Math.max(jinks, h.jinks ?? 0);
            for (let i = bolts.length - 1; i >= 0; i--) {
              const b = bolts[i];
              const to = { x: b.x + b.v[0] * DT, y: b.y + b.v[1] * DT, z: b.z + b.v[2] * DT };
              if (hunt.hit(b, to, 0)) {
                landed += 1;
                bolts.splice(i, 1);
                continue;
              }
              Object.assign(b, to);
              if ((b.life -= DT) <= 0) bolts.splice(i, 1);
            }
            cool -= DT;
            const d = apart(h.pos, s);
            if (cool > 0 || d > 25 || d < 2) return;
            const n = noseOf(s);
            if ((n[0] * (h.pos.x - s.x) + n[1] * (h.pos.y - s.y) + n[2] * (h.pos.z - s.z)) / d < Math.cos(0.05)) return;
            cool = 0.2;
            fired += 1;
            bolts.push({ x: s.x, y: s.y, z: s.z, v: [n[0] * 40, n[1] * 40, n[2] * 40], life: 1.1 });
          },
        });
      }
      return { share: landed / Math.max(1, fired), jinks, fired };
    };
    const regular = lined(null);
    const elite = lined('elite');
    expect(regular.jinks).toBe(0);
    expect(elite.jinks).toBeGreaterThan(2);
    expect(regular.fired).toBeGreaterThan(20);
    expect(elite.share).toBeLessThan(regular.share * 0.75);
  });

  it('makes room on the run for one more of a skilled pack, and they’re slow to flinch', () => {
    const hunt = createHunt({ rand: seeded() });
    hunt.pack('empire', start(), { size: 4, ace: false, skill: 'veteran' });
    expect(hunt.live[0].pack.slots).toBe(3);
    const plain = createHunt({ rand: seeded() });
    plain.pack('empire', start(), { size: 4, ace: false });
    expect(plain.live[0].pack.slots).toBe(2);
  });

  it('flies the ace of a skilled pack a tier better, never worse than a veteran', () => {
    const hunt = createHunt({ rand: seeded() });
    hunt.pack('empire', start(), { size: 3, ace: true, skill: 'regular' });
    const ace = hunt.live.find((h) => h.kind === FACTIONS.empire.ace);
    expect(ace.skill).toBe(SKILLS.veteran);
    expect(hunt.live.find((h) => h !== ace).skill).toBe(SKILLS.regular);
    const top = createHunt({ rand: seeded() });
    top.pack('empire', start(), { size: 3, ace: true, skill: 'elite' });
    expect(top.live.find((h) => h.kind === FACTIONS.empire.ace).skill).toBe(SKILLS.elite);
  });
});

describe('the new ways to fight', () => {
  it('knows every trait any kind has, single or several', () => {
    for (const t of ['missile', 'ion', 'rammer', 'medic', 'sniper']) expect(TRAITS).toContain(t);
    for (const [k, type] of Object.entries(HUNTER_KINDS)) {
      for (const t of traitsOf(type)) expect(TRAITS, k).toContain(t);
      for (const st of type.stages ?? []) for (const t of st.traits ?? (st.trait ? [st.trait] : [])) expect(TRAITS, k).toContain(t);
    }
    expect(hasTrait({ trait: 'holdoff' }, 'holdoff')).toBe(true);
    expect(hasTrait({ traits: ['holdoff', 'missile'] }, 'missile')).toBe(true);
    expect(hasTrait({ traits: ['holdoff'], trait: 'bomber' }, 'bomber')).toBe(true);
    expect(hasTrait({}, 'missile')).toBe(false);
  });

  it('gives each side kinds that fight the new ways', () => {
    const uses = (t) => Object.values(HUNTER_KINDS).some((k) => hasTrait(k, t));
    for (const t of ['missile', 'rammer', 'medic', 'sniper']) expect(uses(t), t).toBe(true);
    for (const [k, type] of Object.entries(HUNTER_KINDS)) if (type.model) expect(HUNTER_KINDS[type.model] ?? type.model, `${k}'s model`).toBeTruthy();
  });

  it('hits for its own damage, when its kind says so', () => {
    const seen = run({ over: { damage: 20 }, seconds: 40, fly: (s) => s });
    expect(seen.hits).toBeGreaterThan(0);
    for (const e of seen.damage) expect(e.damage).toBe(20);
    const plain = run({ seconds: 40, fly: (s) => s });
    for (const e of plain.damage) expect(e.damage).toBe(LASER.damage);
  });

  it('has a missile boat fire missiles that come round after you, and say so', () => {
    let homed = false;
    const seen = run({
      over: { traits: ['holdoff', 'missile'], fire: [1.2, 1.8] },
      seconds: 40,
      fly: (s) => s,
      each: (hunt) => {
        for (const m of hunt.lasers) if (m.on && m.seek) homed = true;
      },
    });
    expect(homed).toBe(true);
    expect(seen.events.some((e) => e.type === 'missile')).toBe(true);
    expect(seen.damage.some((e) => e.damage === MISSILE.damage && e.missile)).toBe(true);
  });

  it('steers a missile round on to you where a laser fired the same way would miss, and you can outrun one', () => {
    const shoot = (seek, { ship = start(), at = { x: 4, y: 0, z: -12 }, v = [0, 0, 1] } = {}) => {
      const hunt = createHunt({ rand: seeded() });
      const m = hunt.lasers[0];
      const sp = seek ? MISSILE.speed : LASER.speed;
      // (by default fired across your way, well off you)
      Object.assign(m, { on: true, ...at, vx: v[0] * sp, vy: v[1] * sp, vz: v[2] * sp, life: seek ? MISSILE.life : LASER.life, at: 'you', faction: 'empire', seek: seek ? MISSILE.seek : 0, missile: Boolean(seek), r: seek ? MISSILE.burst : null, damage: seek ? MISSILE.damage : null });
      let s = ship;
      const out = [];
      for (let i = 0; i < 400; i++) {
        s = move(s);
        out.push(...hunt.update(DT, s));
      }
      return out.filter((e) => e.type === 'laser');
    };
    expect(shoot(false)).toHaveLength(0);
    expect(shoot(true)).toEqual([expect.objectContaining({ damage: MISSILE.damage, missile: true })]);
    // fired straight after you as you run flat out, from far enough: it burns out
    expect(shoot(true, { ship: start({ z: -40, speed: SHIP.boost }), at: { x: 0, y: 0, z: 0 }, v: [0, 0, -1] })).toHaveLength(0);
    // and from close, it gets you
    expect(shoot(true, { ship: start({ z: -8, speed: SHIP.boost }), at: { x: 0, y: 0, z: 0 }, v: [0, 0, -1] })).toHaveLength(1);
  });

  it('has an ion gun slow you instead of hurting much', () => {
    const seen = run({ over: { trait: 'ion' }, seconds: 40, fly: (s) => s });
    expect(seen.hits).toBeGreaterThan(0);
    for (const e of seen.damage) expect(e).toMatchObject({ ion: true, damage: ION.damage });
    expect(ION.slow).toBeGreaterThan(1);
  });

  it('has a rammer come straight in and burst on you, never firing, and gone after', () => {
    let gone = false;
    const seen = run({
      over: { trait: 'rammer', speed: 24 * PACE, accel: 22 * PACE },
      size: 1,
      seconds: 30,
      fly: (s) => ({ ...s, speed: SHIP.cruise }),
      each: (hunt) => {
        if (!hunt.live.length) gone = true;
      },
    });
    expect(seen.shots).toBe(0);
    expect(seen.damage.filter((e) => e.ram)).toHaveLength(1);
    expect(seen.damage[0].damage).toBe(RAM.damage);
    expect(seen.events.some((e) => e.type === 'rammed')).toBe(true);
    expect(gone).toBe(true);
  });

  it('has a rammer shot down before it reaches you do nothing', () => {
    const k = solo({ trait: 'rammer', hp: 1 });
    const hunt = createHunt({ rand: seeded(), kinds: k.kinds, factions: k.factions });
    const [h] = hunt.pack('odd', start(), { size: 1 });
    expect(hunt.damage(h.id, 1)).toMatchObject({ down: true });
    let rams = 0;
    for (let t = 0; t < 10; t += DT) for (const e of hunt.update(DT, start())) if (e.ram) rams += 1;
    expect(rams).toBe(0);
  });

  it('has a medic patch up the most hurt of its pack, never past whole, and not itself', () => {
    const kinds = { ...HUNTER_KINDS, grunt: { ...HUNTER_KINDS.tie, hp: 4 }, doc: { ...HUNTER_KINDS.tie, hp: 3, traits: ['medic', 'holdoff'] } };
    const factions = { odd: { kinds: [['grunt', 1]], laser: [1, 1, 1], size: [1, 3] } };
    const h2 = createHunt({ rand: seeded(), kinds, factions });
    const [a, b, doc] = h2.pack('odd', start(), { kinds: ['grunt', 'grunt', 'doc'] });
    expect(doc.kind).toBe('doc');
    h2.damage(a.id, 3);
    h2.damage(b.id, 1);
    h2.damage(doc.id, 1);
    const patched = [];
    let s = start();
    for (let t = 0; t < 30; t += DT) {
      s = move({ ...s, speed: SHIP.cruise });
      for (const e of h2.update(DT, s)) if (e.type === 'patched') patched.push(e);
    }
    expect(patched.length).toBeGreaterThan(1);
    expect(patched[0].id).toBe(a.id); // (the worst hurt first)
    expect(a.hp).toBe(4);
    expect(b.hp).toBe(4);
    expect(doc.hp).toBe(2); // (never itself)
    expect(a.target.hp).toBe(4);
  });

  it('has a sniper fire from well outside the usual range, keeping its distance', () => {
    let farShot = false;
    let nearest = Infinity;
    const seen = run({
      over: { trait: 'sniper', fire: [1.6, 2.4] },
      seconds: 60,
      fly: (s) => ({ ...s, speed: 4 * PACE }),
      each: (hunt, s, events) => {
        for (const h of hunt.live) nearest = Math.min(nearest, apart(h.pos, s));
        if (events.some((e) => e.type === 'shot') && hunt.live.some((h) => apart(h.pos, s) > FIGHT.range * 1.2)) farShot = true;
      },
    });
    expect(seen.shots).toBeGreaterThan(3);
    expect(farShot).toBe(true);
    expect(nearest).toBeGreaterThan(HOLDOFF.near);
    expect(SNIPER.near).toBeGreaterThan(HOLDOFF.near);
  });
});
