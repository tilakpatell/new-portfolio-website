import { describe, expect, it } from 'vitest';
import { createSolids } from './walker';
import { SITES } from './sites';
import { CREW } from './crew';
import { gunOf } from './soldier';
import { GUNS } from '../../universe/gunplay';
import { ASSAULTS } from './missions/assaults';
import { GCW } from '../gcw';
import { WARS } from '../sides';
import { readAllegiance, swear } from '../allegiance';
import { CHEST, EYE, UNITS, battleWar, coverSpots, hitChance, hitUnit, lineOfSight, newSkirmish, placeUnit, skirmishView, stepSkirmish, swearHere, yourSide } from './skirmish';

// a beach: the Republic dug in behind a low wall at z = 12, the droids coming from z = 60
const SPEC = {
  sides: {
    rep: { name: 'Republic', colour: '#5ab8ff', kinds: [['clone', 3], ['wookiee', 2]], spawn: { at: [0, -10], spread: 4 }, respawn: 9 },
    sep: { name: 'Separatists', colour: '#ff5a3a', kinds: [['battledroid', 4], ['superdroid', 1]], spawn: { at: [0, 60], spread: 6 }, wave: 15 },
  },
  front: [0, 12],
  field: { min: [-40, -25], max: [40, 75] },
  you: 'rep',
};
const world = () => {
  const solids = createSolids();
  solids.box(0, 12, 15, 0.6, 0, { top: 1.25 }); // the wall
  solids.circle(-20, 30, 1.2, { top: 1.4 }); // a rock out in the open
  solids.box(20, 32, 1.5, 0.8, 0.4, { top: 1.1 }); // a crate
  return { solids };
};
// a side of one kind each, for a scenario
const duel = (rep, sep, extra = {}) => ({ ...SPEC, ...extra, sides: { rep: { ...SPEC.sides.rep, kinds: rep }, sep: { ...SPEC.sides.sep, kinds: sep } } });
const run = (b, secs, you = null, each = null) => {
  const all = [];
  for (let t = 0; t < secs; t += 0.1) {
    const ev = stepSkirmish(b, 0.1, you);
    all.push(...ev);
    each?.(b, ev);
  }
  return all;
};
const byKind = (b, kind) => b.units.filter((u) => u.kind === kind);
const dist = (a, x, z) => Math.hypot(a.x - x, a.z - z);

describe('line of sight', () => {
  const { solids } = world();
  it('is clear over open ground', () => {
    expect(lineOfSight(solids, [-30, 1.55, 40], [-30, 1.25, 0])).toBe(true);
  });
  it('lets a standing soldier fire over the low wall, and hides a kneeling one behind it', () => {
    expect(lineOfSight(solids, [0, EYE.stand, 40], [0, CHEST.stand, 10.7])).toBe(true);
    expect(lineOfSight(solids, [0, EYE.stand, 40], [0, CHEST.kneel, 10.7])).toBe(false);
  });
  it('is blocked by anything as tall as you like, and not by a floor overhead or a gate that’s up', () => {
    const s = createSolids();
    s.circle(0, 5, 1);
    expect(lineOfSight(s, [0, 1.5, 0], [0, 1.5, 10])).toBe(false);
    const t = createSolids();
    t.box(0, 5, 3, 0.5, 0, { base: 4 });
    t.circle(0, 7, 1).off = true;
    expect(lineOfSight(t, [0, 1.5, 0], [0, 1.5, 10])).toBe(true);
  });
  it('is blocked by the ground, where it’s given', () => {
    const hill = (x, z) => (Math.abs(z - 20) < 4 ? 3 : 0);
    expect(lineOfSight(createSolids(), [0, 1.5, 0], [0, 1.5, 40], hill)).toBe(false);
    expect(lineOfSight(createSolids(), [0, 1.5, 0], [0, 1.5, 40])).toBe(true);
  });
});

describe('cover', () => {
  const { solids } = world();
  const spots = coverSpots(solids, SPEC.field);
  it('finds spots along both faces of the wall, round the rock and by the crate, each facing out from it', () => {
    const wall = spots.filter((s) => Math.abs(s.z - 12) < 2.5 && Math.abs(s.x) < 16);
    expect(wall.filter((s) => s.z < 12).length).toBeGreaterThan(5);
    expect(wall.filter((s) => s.z > 12).length).toBeGreaterThan(5);
    for (const s of wall) expect(Math.sign(s.n[1])).toBe(Math.sign(s.z - 12));
    expect(spots.some((s) => dist(s, -20, 30) < 2.5)).toBe(true);
    expect(spots.some((s) => dist(s, 20, 32) < 3)).toBe(true);
    for (const s of spots) expect(s.low).toBe(true);
  });
  it('a spot behind the wall hides a kneeling soldier from the droids’ side and lets him fire standing', () => {
    const s = spots.find((p) => p.z < 12 && Math.abs(p.x) < 3);
    expect(lineOfSight(solids, [0, EYE.stand, 45], [s.x, CHEST.kneel, s.z])).toBe(false);
    expect(lineOfSight(solids, [s.x, EYE.stand, s.z], [0, CHEST.stand, 45])).toBe(true);
  });
});

describe('a skirmish laid out', () => {
  it('fields each side’s kinds, all up, the Republic at the wall and the droids at their spawn', () => {
    const b = newSkirmish(SPEC, { seed: 3, env: world() });
    expect(byKind(b, 'clone')).toHaveLength(3);
    expect(byKind(b, 'wookiee')).toHaveLength(2);
    expect(byKind(b, 'battledroid')).toHaveLength(4);
    expect(byKind(b, 'superdroid')).toHaveLength(1);
    for (const u of b.units) {
      expect(u.up).toBe(true);
      expect(u.hp).toBe(UNITS[u.kind].hp);
      if (u.side === 'sep') expect(dist(u, 0, 60)).toBeLessThan(8);
      else expect(u.z).toBeLessThan(12);
    }
  });
  it('is the same battle for the same seed, and scaled down on a smaller device', () => {
    const a = newSkirmish(SPEC, { seed: 9, env: world() });
    const b = newSkirmish(SPEC, { seed: 9, env: world() });
    run(a, 20);
    run(b, 20);
    expect(a.units.map((u) => [u.x, u.z, u.hp])).toEqual(b.units.map((u) => [u.x, u.z, u.hp]));
    expect(newSkirmish(SPEC, { seed: 9, size: 0.5, env: world() }).units.length).toBeLessThan(a.units.length);
  });
});

describe('the soldiers think for themselves', () => {
  it('a clone under fire in the open runs to cover that blocks the shooter', () => {
    const env = world();
    const b = newSkirmish(duel([['clone', 1]], [['battledroid', 1]]), { seed: 2, env });
    const [clone, droid] = b.units;
    placeUnit(b, clone.id, 6, 4, 0);
    placeUnit(b, droid.id, 4, 40, Math.PI);
    droid.hold = true; // (it stands and shoots)
    run(b, 8);
    expect(clone.spot).toBeTruthy();
    expect(dist(clone, clone.spot.x, clone.spot.z)).toBeLessThan(0.8);
    expect(lineOfSight(env.solids, [droid.x, EYE.stand, droid.z], [clone.x, CHEST.kneel, clone.z])).toBe(false);
  });

  it('in cover it ducks and pops up, and only fires standing', () => {
    const b = newSkirmish(duel([['clone', 1]], [['battledroid', 1]]), { seed: 4, env: world() });
    const [clone, droid] = b.units;
    placeUnit(b, clone.id, 0, 10.4, 0);
    placeUnit(b, droid.id, 2, 38, Math.PI);
    droid.hold = true;
    droid.hp = 1e6;
    clone.hp = 1e6; // (it isn't worn down and sent running)
    let kneel = 0;
    let stand = 0;
    let shots = 0;
    run(b, 30, null, (bb, ev) => {
      if (clone.stance === 'kneel') kneel++;
      else stand++;
      for (const e of ev)
        if (e.type === 'shot' && e.id === clone.id) {
          shots++;
          expect(clone.stance).toBe('stand');
        }
    });
    expect(shots).toBeGreaterThan(5);
    expect(kneel).toBeGreaterThan(30);
    expect(stand).toBeGreaterThan(30);
  });

  it('reloads after a magazine', () => {
    const b = newSkirmish(duel([['clone', 1]], [['superdroid', 1]]), { seed: 5, env: { solids: createSolids() } });
    const [clone, droid] = b.units;
    placeUnit(b, clone.id, 0, 0, 0);
    placeUnit(b, droid.id, 0, 25, Math.PI);
    droid.hold = true;
    droid.hp = 1e6;
    clone.hold = true;
    clone.hp = 1e6;
    const times = [];
    run(b, 40, null, (bb, ev) => ev.forEach((e) => e.type === 'shot' && e.id === clone.id && times.push(bb.t)));
    const mag = UNITS.clone.mag;
    expect(times.length).toBeGreaterThan(mag);
    expect(times[mag] - times[mag - 1]).toBeGreaterThanOrEqual(UNITS.clone.reload - 0.11);
  });

  it('picks the enemy that’s hurt, and the one shooting at it', () => {
    const b = newSkirmish(duel([['clone', 1]], [['battledroid', 2]]), { seed: 6, env: { solids: createSolids() } });
    const [clone, d1, d2] = b.units;
    placeUnit(b, clone.id, 0, 0, 0);
    placeUnit(b, d1.id, -8, 30, Math.PI);
    placeUnit(b, d2.id, 8, 30, Math.PI);
    for (const u of [clone, d1, d2]) u.hold = true;
    d2.hp = 8;
    d1.cool = d2.cool = 99; // (not shooting yet)
    clone.think = 0;
    stepSkirmish(b, 0.1);
    expect(clone.target).toBe(d2.id);
    d2.hp = UNITS.battledroid.hp;
    clone.threat = { id: d1.id, x: d1.x, z: d1.z, t: b.t };
    clone.think = 0;
    stepSkirmish(b, 0.1);
    expect(clone.target).toBe(d1.id);
  });

  it('a super battle droid walks forward while it fires', () => {
    const b = newSkirmish(duel([['clone', 1]], [['superdroid', 1]]), { seed: 7, env: { solids: createSolids() } });
    const [clone, b2] = b.units;
    placeUnit(b, clone.id, 0, 0, 0);
    placeUnit(b, b2.id, 0, 40, Math.PI);
    clone.hold = true;
    clone.hp = 1e6;
    b2.hp = 1e6;
    let movingShots = 0;
    run(b, 8, null, (bb, ev) => ev.forEach((e) => e.type === 'shot' && e.id === b2.id && b2.move > 0.1 && movingShots++));
    expect(b2.z).toBeLessThan(34);
    expect(movingShots).toBeGreaterThan(3);
  });

  it('a battle droid stops to shoot', () => {
    const b = newSkirmish(duel([['clone', 1]], [['battledroid', 3]]), { seed: 8, env: { solids: createSolids() } });
    const [clone] = b.units;
    placeUnit(b, clone.id, 0, 0, 0);
    clone.hold = true;
    clone.hp = 1e6;
    let shots = 0;
    run(b, 40, null, (bb, ev) => {
      for (const e of ev) {
        if (e.type !== 'shot') continue;
        const u = bb.units[e.id];
        if (u.kind !== 'battledroid') continue;
        shots++;
        expect(u.move).toBe(0);
      }
    });
    expect(shots).toBeGreaterThan(5);
  });

  it('a Wookiee charges a droid that comes close, tears it down and pounds his chest', () => {
    const b = newSkirmish(duel([['wookiee', 1]], [['battledroid', 1]]), { seed: 9, env: { solids: createSolids() } });
    const [wook, droid] = b.units;
    placeUnit(b, wook.id, 0, 0, 0);
    placeUnit(b, droid.id, 0, 11, Math.PI);
    droid.hold = true;
    const ev = run(b, 8);
    expect(ev.some((e) => e.type === 'melee' && e.id === wook.id) || ev.some((e) => e.type === 'kill' && e.by === wook.id)).toBe(true);
    expect(ev.some((e) => e.type === 'kill' && e.victim === droid.id)).toBe(true);
    expect(ev.some((e) => e.type === 'taunt' && e.id === wook.id)).toBe(true);
  });

  it('clones go round a droid that won’t come out of cover', () => {
    const env = world();
    const b = newSkirmish(duel([['clone', 3]], [['battledroid', 1]]), { seed: 10, env });
    const clones = byKind(b, 'clone');
    const droid = byKind(b, 'battledroid')[0];
    // the droid down behind the far side of the wall, the clones out in front of it
    placeUnit(b, droid.id, 0, 13.4, Math.PI);
    droid.hold = true;
    droid.stance = 'kneel';
    droid.cool = 1e9;
    clones.forEach((c, i) => placeUnit(b, c.id, -4 + i * 4, -8, 0));
    const ev = run(b, 40);
    expect(ev.some((e) => e.type === 'flank')).toBe(true);
    expect(droid.up === false || droid.hp < UNITS.battledroid.hp).toBe(true);
  });

  it('a hurt soldier falls back away from what’s shooting it', () => {
    const b = newSkirmish(duel([['clone', 1]], [['superdroid', 1]]), { seed: 11, env: world() });
    const [clone, b2] = b.units;
    placeUnit(b, clone.id, 4, 8, 0);
    placeUnit(b, b2.id, 4, 30, Math.PI);
    b2.hold = true;
    b2.cool = 1e9;
    clone.hp = 20;
    clone.brave = 0; // (it always runs)
    clone.threat = { id: b2.id, x: b2.x, z: b2.z, t: 0 };
    const ev = run(b, 4);
    expect(ev.some((e) => e.type === 'fallback' && e.id === clone.id)).toBe(true);
    expect(dist(clone, b2.x, b2.z)).toBeGreaterThan(22);
  });

  it('being shot at spoils a soldier’s aim', () => {
    const u = { u: UNITS.clone, suppress: 0, move: 0 };
    const t = { stance: 'stand', move: 0 };
    const calm = hitChance(u, 20, t);
    expect(hitChance({ ...u, suppress: 1 }, 20, t)).toBeLessThan(calm * 0.7);
    expect(hitChance(u, 50, t)).toBeLessThan(calm);
    expect(hitChance(u, 20, { ...t, stance: 'kneel' })).toBeLessThan(calm);
  });
});

describe('falling and coming back', () => {
  it('goes down the way the shot pushed it', () => {
    const b = newSkirmish(duel([['clone', 1]], [['battledroid', 3]]), { seed: 12, env: { solids: createSolids() } });
    const [, a, c, d] = b.units;
    for (const u of [a, c, d]) u.yaw = 0; // facing +z
    expect(hitUnit(b, a.id, 999, [0, -1]).find((e) => e.type === 'down').clip).toBe('die'); // shot from the front, thrown back
    expect(hitUnit(b, c.id, 999, [0, 1]).find((e) => e.type === 'down').clip).toBe('dieFwd'); // from behind
    expect(hitUnit(b, d.id, 999, [1, 0], 'you', { blown: true }).find((e) => e.type === 'down').clip).toBe('dieBlown');
  });

  it('your kill is yours, and counts', () => {
    const b = newSkirmish(duel([['clone', 1]], [['battledroid', 1]]), { seed: 13, env: { solids: createSolids() } });
    const droid = b.units[1];
    const ev = hitUnit(b, droid.id, 999, [0, 1]);
    expect(ev.find((e) => e.type === 'kill')).toMatchObject({ victim: droid.id, side: 'sep', by: 'you' });
    expect(skirmishView(b).kills).toBe(1);
    expect(hitUnit(b, droid.id, 999, [0, 1])).toEqual([]);
  });

  it('a clone comes back at his spawn; the droids come back together, in a wave out of the lagoon', () => {
    const b = newSkirmish(SPEC, { seed: 14, env: world() });
    const clone = byKind(b, 'clone')[0];
    const droids = byKind(b, 'battledroid').slice(0, 2);
    hitUnit(b, clone.id, 999, [0, 1]);
    droids.forEach((d) => hitUnit(b, d.id, 999, [0, 1]));
    const ev = run(b, SPEC.sides.rep.respawn + 0.5);
    expect(clone.up).toBe(true);
    expect(dist(clone, 0, -10)).toBeLessThan(8);
    // (both together, in the one wave)
    let wave = ev.find((e) => e.type === 'wave');
    run(b, SPEC.sides.sep.wave, null, (bb, got) => {
      const w = got.find((e) => e.type === 'wave');
      if (!w || wave) return;
      wave = w;
      for (const d of droids) {
        expect(d.up).toBe(true);
        expect(got.some((e) => e.type === 'spawn' && e.id === d.id)).toBe(true);
        expect(d.z).toBeGreaterThan(50);
      }
    });
    expect(wave).toBeTruthy();
    expect(wave.n).toBeGreaterThanOrEqual(2);
  });
});

describe('you, in the fight', () => {
  it('no more than three of them shoot at you at once', () => {
    const b = newSkirmish(duel([['clone', 1]], [['battledroid', 8]]), { seed: 15, env: { solids: createSolids() } });
    placeUnit(b, b.units[0].id, -30, -20, 0);
    const you = { x: 0, z: 0, y: 0 };
    let most = 0;
    const ev = run(b, 30, you, (bb) => {
      most = Math.max(most, bb.units.filter((u) => u.up && u.target === 'you').length);
    });
    expect(most).toBeGreaterThan(0);
    expect(most).toBeLessThanOrEqual(3);
    expect(ev.some((e) => e.type === 'shot' && e.target === 'you')).toBe(true);
  });
});

describe('out of the water', () => {
  it('a droid wading in with the water over its chest doesn’t shoot till it’s out', () => {
    // the ground falls away into a lagoon past z = 40
    const ground = (x, z) => (z > 40 ? 1 - (z - 40) * 0.4 : 1);
    const b = newSkirmish(duel([['clone', 1]], [['battledroid', 1]]), { seed: 19, env: { solids: createSolids(), ground, water: 0 } });
    const [clone, droid] = b.units;
    placeUnit(b, clone.id, 0, 10, 0);
    clone.hold = true;
    clone.hp = 1e6;
    clone.cool = 1e9;
    placeUnit(b, droid.id, 0, 52, Math.PI); // (3.8 m down)
    let firstShotZ = null;
    run(b, 20, null, (bb, ev) => {
      for (const e of ev) if (e.type === 'shot' && e.id === droid.id && firstShotZ == null) firstShotZ = droid.z;
    });
    expect(firstShotZ).not.toBeNull();
    expect(ground(0, firstShotZ) + CHEST.stand).toBeGreaterThanOrEqual(0);
  });
});

describe('fighting for the other side', () => {
  it('with the droids, it’s the Republic that shoots at you, from behind the barricades they still hold', () => {
    const b = newSkirmish({ ...SPEC, you: 'sep' }, { seed: 17, env: world() });
    expect(b.spec.hold).toBe('rep');
    const you = { x: 4, z: 30, y: 0 };
    let atYou = new Set();
    const ev = run(b, 30, you, (bb) => {
      for (const u of bb.units) if (u.up && u.target === 'you') atYou.add(u.side);
    });
    expect([...atYou]).toEqual(['rep']);
    expect(ev.some((e) => e.type === 'shot' && e.target === 'you' && b.units[e.id].side === 'rep')).toBe(true);
    for (const u of b.units) if (u.up && u.side === 'rep') expect(u.z).toBeLessThan(16);
  });

  it('takes its sides from the spec in either order, the holders named', () => {
    const flipped = { ...SPEC, hold: 'rep', sides: { sep: SPEC.sides.sep, rep: SPEC.sides.rep } };
    const b = newSkirmish(flipped, { seed: 18, env: world() });
    expect(b.spec.hold).toBe('rep');
    expect(b.spec.comes).toBe('sep');
    expect(b.spec.you).toBe('rep');
    for (const u of b.units) if (u.side === 'rep') expect(u.z).toBeLessThan(12);
    const ev = run(b, 60);
    expect(ev.some((e) => e.type === 'wave' && e.side === 'sep') || !b.units.some((u) => u.side === 'sep' && !u.up)).toBe(true);
  });
});

describe('the battle goes on', () => {
  it('ten minutes of it: nobody leaves the field or goes missing, both sides fight on', () => {
    const b = newSkirmish(SPEC, { seed: 16, env: world() });
    const ev = run(b, 600, { x: -6, z: 0, y: 0 });
    for (const u of b.units) {
      expect(Number.isFinite(u.x) && Number.isFinite(u.z) && Number.isFinite(u.yaw)).toBe(true);
      expect(u.x).toBeGreaterThanOrEqual(SPEC.field.min[0] - 0.01);
      expect(u.x).toBeLessThanOrEqual(SPEC.field.max[0] + 0.01);
      expect(u.z).toBeGreaterThanOrEqual(SPEC.field.min[1] - 0.01);
      expect(u.z).toBeLessThanOrEqual(SPEC.field.max[1] + 0.01);
    }
    const kills = ev.filter((e) => e.type === 'kill');
    expect(kills.some((e) => e.side === 'sep')).toBe(true);
    expect(kills.some((e) => e.side === 'rep')).toBe(true);
    expect(ev.filter((e) => e.type === 'wave').length).toBeGreaterThan(5);
    expect(b.units.some((u) => u.up && u.side === 'rep')).toBe(true);
    expect(b.units.some((u) => u.up && u.side === 'sep')).toBe(true);
    for (const s of b.spots) if (s.by) expect(s.by.spot).toBe(s);
  });
});

describe('the worlds’ battles', () => {
  const battles = Object.entries(SITES).filter(([, site]) => site.skirmish);
  const inside = ({ min, max }, [x, z]) => x >= min[0] && x <= max[0] && z >= min[1] && z <= max[1];

  it('are on Kashyyyk, Geonosis and Hoth', () => {
    expect(battles.map(([id]) => id).sort()).toEqual(['geonosis', 'hoth', 'kashyyyk']);
  });

  it('each is laid out soundly: rigged soldiers with guns, its spawns, front and rally points on its field, one side holding and one coming in waves', () => {
    for (const [id, site] of battles) {
      const sk = site.skirmish;
      const sides = Object.keys(sk.sides);
      expect(sides, id).toHaveLength(2);
      expect(sides, id).toContain(sk.hold);
      expect(inside(sk.field, sk.front), `${id} front`).toBe(true);
      const comes = sides.find((x) => x !== sk.hold);
      expect(sk.sides[comes].wave, `${id} waves`).toBeGreaterThan(0);
      expect(sk.sides[sk.hold].wave, `${id} holders`).toBeFalsy();
      for (const side of sides) {
        const s = sk.sides[side];
        expect(inside(sk.field, s.spawn.at), `${id} ${side} spawn`).toBe(true);
        expect(inside(sk.field, s.youAt), `${id} ${side} rally`).toBe(true);
        expect(s.name && s.short && s.colour, `${id} ${side}`).toBeTruthy();
        for (const [kind, n] of s.kinds) {
          expect(CREW[kind]?.url, `${id}: ${kind} has a rigged model`).toBeTruthy();
          expect(UNITS[kind], `${id}: ${kind} has its numbers`).toBeTruthy();
          expect(GUNS[gunOf(kind)], `${id}: ${kind}'s gun`).toBeTruthy();
          expect(n).toBeGreaterThan(0);
        }
      }
    }
  });

  it('each counts its own sides’ soldiers standing, whatever they’re called', () => {
    for (const [id, site] of battles) {
      const b = newSkirmish(site.skirmish, { seed: 2, env: { solids: createSolids() } });
      const { up } = skirmishView(b);
      expect(Object.keys(up).sort(), id).toEqual(Object.keys(site.skirmish.sides).sort());
      for (const side of Object.keys(site.skirmish.sides)) expect(up[side], `${id} ${side}`).toBe(b.units.filter((u) => u.up && u.side === side).length);
    }
  });

  it('each runs a few minutes, both sides fighting on', () => {
    for (const [id, site] of battles) {
      const b = newSkirmish(site.skirmish, { seed: 3, env: { solids: createSolids() } });
      const ev = run(b, 180);
      expect(ev.some((e) => e.type === 'kill'), id).toBe(true);
      for (const side of Object.keys(site.skirmish.sides)) expect(b.units.some((u) => u.up && u.side === side), `${id} ${side}`).toBe(true);
      for (const u of b.units) expect(inside(site.skirmish.field, [u.x, u.z]), `${id} ${u.kind}`).toBe(true);
    }
  });
});

describe('your side, by your oath (galaxy/allegiance.js)', () => {
  const NOW = GCW.start + 3600e3;
  const oath = (...sides) => sides.reduce((a, side) => swear(a, side, NOW), readAllegiance(null, { now: NOW }));
  const battle = (id) => SITES[id].skirmish.sides;

  it('each battle, on a world or an assault, is one war’s: its two sides that war’s two', () => {
    const all = [...Object.entries(SITES).filter(([, s]) => s.skirmish).map(([id, s]) => [id, s.skirmish.sides]), ...Object.entries(ASSAULTS).map(([id, m]) => [`assault ${id}`, m.sides])];
    for (const [id, sides] of all) {
      const war = battleWar(sides);
      expect(war, id).toBeTruthy();
      expect(new Set(Object.values(sides).map((s) => s.side)), id).toEqual(new Set([WARS[war].liberator, WARS[war].raider]));
    }
    expect([battleWar(battle('kashyyyk')), battleWar(battle('geonosis')), battleWar(battle('hoth'))]).toEqual(['clone', 'clone', 'gcw']);
  });

  it('puts you with the side you swore to in the battle’s war', () => {
    expect(yourSide(battle('kashyyyk'), oath('separatists'))).toBe('sep');
    expect(yourSide(battle('geonosis'), oath('separatists'))).toBe('sep');
    expect(yourSide(battle('geonosis'), oath('republic'))).toBe('rep');
    expect(yourSide(battle('hoth'), oath('empire'))).toBe('empire');
    expect(yourSide(battle('hoth'), oath('rebel'))).toBe('rebels');
  });

  it('an oath in another war doesn’t outweigh the battle’s own', () => {
    const a = oath('republic', 'empire');
    expect(yourSide(battle('kashyyyk'), a)).toBe('rep');
    expect(yourSide(battle('hoth'), a)).toBe('empire');
  });

  it('unsworn in the battle’s war, you lean the way your other oath does: sworn to the Empire, with the droids', () => {
    expect(yourSide(battle('kashyyyk'), oath('empire'))).toBe('sep');
    expect(yourSide(battle('geonosis'), oath('empire'))).toBe('sep');
    expect(yourSide(battle('kashyyyk'), oath('rebel'))).toBe('rep');
    expect(yourSide(battle('hoth'), oath('separatists'))).toBe('empire');
  });

  it('sworn to nothing: your crew’s suggestion, then the war’s liberators, whichever order the sides come in', () => {
    const sides = { sep: { side: 'separatists' }, rep: { side: 'republic' } };
    expect(yourSide(sides, oath())).toBe('rep');
    expect(yourSide(sides, oath(), 'separatists')).toBe('sep');
    expect(yourSide(battle('hoth'), null)).toBe('rebels');
    expect(yourSide({}, oath())).toBe(null);
  });

  it('a turncoat fights for the side they turned to', () => {
    const a = oath('rebel', 'empire');
    expect(a.oaths.gcw.turncoat).toBe(true);
    expect(yourSide(battle('hoth'), a)).toBe('empire');
  });

  it('on an assault’s choose card, the side to take: attack or defend', () => {
    expect(yourSide(ASSAULTS.hoth.sides, oath('rebel'))).toBe('defend');
    expect(yourSide(ASSAULTS.hoth.sides, oath('empire'))).toBe('attack');
    expect(yourSide(ASSAULTS.geonosis.sides, oath('separatists'))).toBe('defend');
    expect(yourSide(ASSAULTS.geonosis.sides, oath('empire'))).toBe('defend');
  });

  it('an oath sworn in a battle is in its war, and leaves the war you fly in as it was', () => {
    let a = oath('rebel');
    a = swearHere(a, 'separatists', NOW);
    expect(a.oaths.clone).toMatchObject({ side: 'separatists', turncoat: false });
    expect(a.oaths.gcw.side).toBe('rebel');
    expect(a.war).toBe('gcw');
    // the other side there: a turncoat's
    a = swearHere(a, 'republic', NOW);
    expect(a.oaths.clone).toMatchObject({ side: 'republic', turncoat: true });
    expect(a.war).toBe('gcw');
    // the same again, or nobody's: nothing
    expect(swearHere(a, 'republic', NOW)).toBe(a);
    expect(swearHere(a, undefined, NOW)).toBe(a);
    expect(swearHere(a, 'hutt', NOW)).toBe(a);
  });
});
