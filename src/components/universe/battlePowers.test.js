import { describe, expect, it } from 'vitest';
import { BATTLE, createBattle } from './battle';
import { WARS } from './wars';
import { holdFighters, stepBattle } from './battlePowers';
import { shotAt } from './shipPowers';

// a seeded random, so every run of a battle is the same (battle.test.js's)
const seeded = (seed = 7) => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const make = (o = {}) => createBattle({ war: WARS.starwars, attacker: 0, at: [0, 0, 0], axis: [1, 0], perSide: 8, rand: seeded(), ...o });
const run = (b, seconds, you = null, opts = {}, dt = 1 / 30) => {
  const events = [];
  for (let t = 0; t < seconds && !b.over; t += dt) events.push(...stepBattle(b, dt, you, opts));
  return events;
};
const apart = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

// The ship powers in the war's battles go through these, and only through
// the battle's own public fields and its hit(): the same whichever way
// battle.js fights it inside.
describe('the ship powers in a battle', () => {
  it('slows its fighters with Force Focus, but its clock runs on real time', () => {
    const fast = make();
    const slow = make();
    for (const b of [fast, slow]) b.setYou(0);
    const path = (b, opts) => {
      let moved = 0;
      for (let t = 0; t < 1; t += 1 / 30) {
        const was = b.fighters.map((f) => ({ x: f.pos.x, y: f.pos.y, z: f.pos.z }));
        stepBattle(b, 1 / 30, null, opts);
        b.fighters.forEach((f, i) => (moved += f.alive ? apart(f.pos, was[i]) : 0));
      }
      return moved;
    };
    const clock = slow.clock;
    const normal = path(fast, {});
    const slowed = path(slow, { slow: 0.35 });
    expect(slow.clock - clock).toBeCloseTo(1, 1);
    // (to within one of the battle's fixed steps: it steps its own time a
    // whole step at a time, so a slowed one has a part-step still owed)
    expect(Math.abs(fast.clock - slow.clock)).toBeLessThanOrEqual(BATTLE.step + 1e-9);
    expect(slowed / normal).toBeGreaterThan(0.25);
    expect(slowed / normal).toBeLessThan(0.45);
  });

  it('lets a ghost through: none of its fire hurts you while you are one, and it hurts you again after', () => {
    const you = { x: 0, y: 0, z: 0, alive: true };
    const b = make();
    b.setYou(0);
    const ghosted = run(b, 30, you, { ghost: true });
    expect(ghosted.filter((e) => e.type === 'hurt')).toEqual([]);
    expect(b.ghost).toBe(false); // (it's only a ghost while it's stepped as one)
    const after = run(b, 30, you);
    expect(after.some((e) => e.type === 'hurt' && e.damage > 0)).toBe(true);
  });

  it('holds the other side’s fighters near a magnet with their guns quiet, then lets them go', () => {
    const b = make();
    b.setYou(0);
    run(b, 4);
    // a magnet where one of theirs is
    const theirs = b.fighters.find((f) => f.alive && f.team === 1);
    const at = { x: theirs.pos.x, y: theirs.pos.y, z: theirs.pos.z };
    const near = (f) => apart(f.pos, at) <= 22;
    const want = b.fighters.filter((f) => f.alive && f.team === 1 && near(f));
    const ours = b.fighters.filter((f) => f.alive && f.team === 0 && near(f));
    expect(want.length).toBeGreaterThan(1);
    expect(holdFighters(b, at, 22, 4, 1)).toBe(want.length);
    for (const f of want) expect(f.held).toBeGreaterThan(0);
    for (const f of ours) expect(f.held ?? 0).toBe(0);
    // (who fires, from where: a held one's guns would fire from just off its nose)
    const shots = [];
    const fire = b.fire;
    b.fire = (team, from, ...rest) => {
      shots.push({ team, at: { x: from.x, y: from.y, z: from.z }, quiet: want.filter((f) => f.alive && f.held > 0).map((f) => ({ x: f.pos.x, y: f.pos.y, z: f.pos.z })) });
      return fire(team, from, ...rest);
    };
    run(b, 2, null, { magnet: at, pull: 16 });
    expect(shots.length).toBeGreaterThan(0); // (the rest of the battle fires on)
    for (const s of shots) for (const q of s.quiet) expect(apart(s.at, q)).toBeGreaterThan(1.5);
    for (const f of want.filter((o) => o.alive)) expect(apart(f.pos, at)).toBeLessThan(3);
    // (a ball of them, not all on the one point inside each other)
    const held = want.filter((o) => o.alive);
    for (let i = 1; i < held.length; i++) expect(apart(held[i].pos, held[0].pos)).toBeGreaterThan(0.2);
    // let go (the magnet off): free again, and quiet a moment longer (the daze)
    run(b, 1 / 30, null, { magnet: null });
    for (const f of want.filter((o) => o.alive)) {
      expect(f.held).toBe(0);
      expect(f.cool).toBeGreaterThan(0.5);
    }
    b.fire = fire;
  });

  it('holds nobody while you’re nobody’s, or once it’s over', () => {
    const b = make();
    run(b, 2);
    const f = b.fighters.find((o) => o.alive);
    expect(holdFighters(b, f.pos, 50, 4, 1)).toBe(0);
    b.setYou(0);
    b.end(1);
    expect(holdFighters(b, f.pos, 50, 4, 1)).toBe(0);
  });

  it('lands a power’s shot on the very one it’s aimed at, through the battle’s own hit()', () => {
    const b = make();
    b.setYou(0);
    const you = { x: -40, y: 0, z: 0, alive: true };
    run(b, 5, you);
    const aimed = [...b.targets].filter((t) => t.kind !== 'turret' && t.kind !== 'subsystem');
    expect(aimed.length).toBeGreaterThan(3);
    let landed = 0;
    for (const t of aimed) {
      const s = shotAt(t, you);
      const r = b.hit(s.from, s.to, 0);
      if (r?.id === t.id) landed++;
    }
    expect(landed / aimed.length).toBeGreaterThanOrEqual(0.9);
  });
});
