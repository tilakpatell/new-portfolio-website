import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createBattle } from './battle';
import { seededRand } from './battleKit';
import { FLEET } from './battleFleet';
import { WARS } from './wars';

// The galaxy's capital ships fight as fleets (battleFleet.js, under
// createBattle's `tactics`): each side's batteries mostly on one ship at a
// time, the attacker's escorts forward at the final push and both lines
// turning a flank to bear, an escort nearly gone jumping out, and the
// losing fleet jumping out once it's over.
const war = WARS.starwars;
const make = (o = {}) => createBattle({ war, attacker: 0, at: [0, 0, 0], axis: [1, 0], perSide: 4, rand: seededRand('fleet'), tickets: false, tactics: true, ...o });
const step = 1 / 30;
const run = (b, seconds) => {
  const events = [];
  for (let i = 0, n = Math.round(seconds / step); i < n; i++) events.push(...b.update(step, null));
  return events;
};
// which of `caps` a shot from `from` along `dir` is aimed at: the one whose hull it passes nearest, for its size
const aimedAt = (caps, from, dir) => {
  const l = Math.hypot(dir.x, dir.y, dir.z);
  let best = null;
  let bd = Infinity;
  for (const cap of caps)
    for (const sp of cap.spheres) {
      const v = { x: sp.c.x - from.x, y: sp.c.y - from.y, z: sp.c.z - from.z };
      const along = (v.x * dir.x + v.y * dir.y + v.z * dir.z) / l;
      if (along < 0) continue;
      const off = Math.sqrt(Math.max(0, v.x * v.x + v.y * v.y + v.z * v.z - along * along)) / sp.r;
      if (off < bd) (bd = off), (best = cap);
    }
  return best;
};

describe('the fleets’ focus', () => {
  it('puts each side’s batteries mostly on one ship at a time: more than half its turbolaser shots at its focus', () => {
    const b = make();
    const shots = [
      [0, 0],
      [0, 0],
    ];
    const fire = b.fire;
    b.fire = (team, from, dir, kind, target) => {
      if (kind === 'turbo') {
        const foes = b.capitals.filter((c) => c.team !== team && c.alive);
        shots[team][1] += 1;
        if (aimedAt(foes, from, dir) === b.fleet.focusOf(team)) shots[team][0] += 1;
      }
      return fire(team, from, dir, kind, target);
    };
    run(b, 60);
    for (const team of [0, 1]) {
      expect(shots[team][1], `team ${team}`).toBeGreaterThan(30);
      expect(shots[team][0] / shots[team][1], `team ${team}`).toBeGreaterThanOrEqual(0.55);
    }
  });

  it('chooses its focus every 15 s: the attacker the ship the objectives are on, the defender the attacker’s most hurt ship', () => {
    const b = make();
    run(b, 1);
    expect(b.fleet.focusOf(b.attacker)).toBe(b.capitals.find((c) => c.objective));
    expect(b.fleet.focusOf(b.defender)).toBe(b.capitals.find((c) => c.team === b.attacker && c.role === 'flagship'));
    const hurt = b.capitals.find((c) => c.team === b.attacker && c.role === 'escort');
    hurt.hull = hurt.hullMax * 0.5;
    run(b, FLEET.every + 0.5);
    expect(b.fleet.focusOf(b.defender)).toBe(hurt);
  });
});

describe('the final push', () => {
  it('brings the attacker’s escorts thirty units or more nearer the middle, everything on them with them, and turns both lines’ escorts a flank to bear', () => {
    const moved = new Set();
    const b = make({ elapsed: FLEET.push - 10, tactics: { push: FLEET.push, onMove: (cap) => moved.add(cap) } });
    const escorts = b.capitals.filter((c) => c.role === 'escort');
    const ours = escorts.filter((c) => c.team === b.attacker);
    const was = new Map(b.capitals.map((c) => [c, { pos: { ...c.pos }, sphere: { ...c.spheres[0].c }, turret: c.turrets[0] ? { ...c.turrets[0].at } : null, fwd: { ...c.fwd } }]));
    run(b, 5);
    for (const c of ours) expect(c.pos.x).toBeCloseTo(was.get(c).pos.x, 6); // (not before its time)
    run(b, FLEET.pushFor + 10);
    for (const c of ours) {
      const w = was.get(c);
      const d = { x: c.pos.x - w.pos.x, y: c.pos.y - w.pos.y, z: c.pos.z - w.pos.z };
      expect(Math.abs(w.pos.x) - Math.abs(c.pos.x), c.kind).toBeGreaterThanOrEqual(30);
      // (its hull and its batteries moved with it, as far, and turned about it)
      expect(Math.hypot(c.spheres[0].c.x - c.pos.x, c.spheres[0].c.z - c.pos.z)).toBeCloseTo(Math.hypot(w.sphere.x - w.pos.x, w.sphere.z - w.pos.z), 6);
      if (w.turret) expect(Math.hypot(c.turrets[0].at.x - c.pos.x, c.turrets[0].at.y - c.pos.y, c.turrets[0].at.z - c.pos.z)).toBeCloseTo(Math.hypot(w.turret.x - w.pos.x, w.turret.y - w.pos.y, w.turret.z - w.pos.z), 6);
      expect(Math.hypot(d.x, d.z)).toBeGreaterThan(30);
      expect(moved.has(c)).toBe(true);
    }
    for (const c of escorts) {
      const w = was.get(c);
      const turned = Math.acos(Math.max(-1, Math.min(1, c.fwd.x * w.fwd.x + c.fwd.y * w.fwd.y + c.fwd.z * w.fwd.z)));
      expect(turned, `${c.kind} of ${c.team}`).toBeCloseTo(FLEET.turn, 3);
    }
    // (the ship the objectives are on, and the flagships, hold their places)
    for (const c of b.capitals.filter((x) => x.role === 'flagship' || x.objective)) expect(c.pos).toEqual(was.get(c).pos);
  });

  it('is the same whenever you came: a battle joined at the push’s end has its escorts where one there all along has them', () => {
    const along = make({ elapsed: FLEET.push - 5 });
    run(along, 60);
    const late = make({ elapsed: FLEET.push + 55 });
    run(late, step);
    const at = (b) => b.capitals.map((c) => [+c.pos.x.toFixed(3), +c.pos.z.toFixed(3)]);
    expect(at(late)).toEqual(at(along));
  });
});

describe('jumping out', () => {
  it('an escort down to a tenth of its hull jumps out: gone, said so, and not counted destroyed', () => {
    const b = make();
    const esc = b.capitals.find((c) => c.team === 1 && c.role === 'escort');
    esc.hull = esc.hullMax * 0.1;
    const events = run(b, 0.2);
    expect(events.filter((e) => e.type === 'jumped' && e.id === esc.id)).toHaveLength(1);
    expect(events.some((e) => e.type === 'capital' && e.id === esc.id)).toBe(false);
    expect(esc.alive).toBe(false);
    expect(esc.jumped).toBe(true);
  });

  it('once it’s over, the losing fleet jumps out, a ship every three seconds, and the winner’s stays', () => {
    const b = make();
    run(b, 1);
    b.end(0, 'flagship');
    const losers = b.capitals.filter((c) => c.team === 1 && c.alive && c.dying <= 0);
    const events = run(b, losers.length * FLEET.jumpEvery + 1);
    expect(losers.every((c) => !c.alive && c.jumped)).toBe(true);
    const times = events.filter((e) => e.type === 'jumped').length;
    expect(times).toBe(losers.length);
    expect(b.capitals.filter((c) => c.team === 0).every((c) => c.alive)).toBe(true);
  });

  it('with the clock every pilot shares (the galaxy’s), jumps out on it, not on its own steps: a slow screen sees the fleet go when the rest do', () => {
    const shared = { t: 100 };
    const b = make({ tactics: { clock: () => shared.t } });
    run(b, 0.1);
    b.end(0, 'flagship');
    const losers = b.capitals.filter((c) => c.team === 1 && c.alive && c.dying <= 0);
    // (a frame now and then, the shared clock running on regardless)
    for (let i = 0; i < 4; i++) {
      shared.t += FLEET.jumpEvery;
      b.update(step, null);
    }
    expect(b.capitals.filter((c) => c.team === 1 && c.jumped).length).toBe(Math.min(4, losers.length));
  });

  it('shows a pilot arriving after the end the losing fleet already gone', () => {
    const b = make();
    run(b, 0.1);
    b.end(1, 'clock', 60);
    const events = run(b, 0.1);
    expect(b.capitals.filter((c) => c.team === 0).every((c) => !c.alive)).toBe(true);
    expect(events.filter((e) => e.type === 'jumped').every((e) => e.late)).toBe(true);
  });
});

describe('a battle without tactics', () => {
  it('keeps its capital ships where they are, at the push and after it’s over (the universe map’s wars)', () => {
    const b = createBattle({ war, attacker: 0, perSide: 2, rand: seededRand('plain'), elapsed: FLEET.push - 1, clock: 720 });
    const was = b.capitals.map((c) => ({ ...c.pos }));
    for (let i = 0; i < 30 * 45; i++) b.update(step, null);
    expect(b.capitals.map((c) => ({ ...c.pos }))).toEqual(was);
    expect(b.fleet).toBeNull();
  });

  it('stays under the health check’s warning line', () => {
    const lines = readFileSync(new URL('./battleFleet.js', import.meta.url), 'utf8').split('\n').length;
    expect(lines).toBeLessThan(800);
  });
});
