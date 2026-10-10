// Lightsaber fighting as plain numbers: a fighter strikes light or heavy,
// raises a guard, dodges, and tires. A stroke winds up, lands its blow at
// a set moment and recovers; the caller hears the blow as an event and
// asks resolveClash what it met, which answers once for each fighter. A
// guard that has only just come up (the first 0.18 s of it) parries: the
// striker reels and its stroke ends, so timing beats strength. A guard
// put down and raised again within 0.3 s is the same guard, so tapping it
// opens no new window. A guard held longer blocks a light stroke for a
// little stamina, but a heavy one breaks it, so a turtle can be cracked;
// a guard that runs out of stamina breaks too. Guards and dodges are what
// stamina is for, so it only comes back when you aren’t swinging, and
// slower behind a guard. A guard also turns blaster bolts: each step sets
// `deflect = { yaw, active }` on the fighter for combat.js, which sends a
// bolt back when it comes from within 70° of that yaw. The minds that
// fight Vader’s and the Emperor’s duels live in force.js, since they
// choose between the blade and the Force. Pure; no rand needed.
//
//   createFighter({ id, x, z, yaw = 0, side, hp = 100 }) → fighter
//     fighter: { id, x, z, yaw, hp, stamina 0…100, guard: bool, guardT: s since it came up, down: s since it was last up,
//                stroke: { kind: 'light' | 'heavy', t, hit, met: [id] } | null, stagger: s, dodge: s, side, deflect }
//       met: the fighters its blow has been resolved against
//   saberStep(fighter, input, dt) → events (a staggered fighter’s stroke is dropped)
//     input: { strike: 'light' | 'heavy' | null, guard: bool, dodge: bool }
//     events: { type: 'stroke', id, kind } (begun) | { type: 'blow', id, kind } (call resolveClash now)
//             | { type: 'guard', id } (raised) | { type: 'dodge', id }
//   resolveClash(a, b) → { result, damage, dead }: what a’s blow did to b, the first time it is asked
//     result: 'none' (a isn’t at a blow, or its blow has met b already) | 'miss' | 'dodged' | 'parry' | 'block' | 'break' | 'hit'
//   facing(fighter, point, deg) → bool: the point lies within `deg` either side of where it looks
//   STROKES, GUARD, PARRY, REGUARD, REGEN, DODGE, DEFLECT: the numbers

// s: the whole stroke; at: when its blow lands; reach: metres centre to
// centre; arc: degrees either side of the striker’s facing it sweeps;
// flinch: how long a hit leaves its target reeling.
export const STROKES = {
  light: { s: 0.4, at: 0.18, damage: 18, cost: 10, reach: 2.2, arc: 60, flinch: 0.25 },
  heavy: { s: 0.8, at: 0.5, damage: 40, cost: 25, reach: 2.4, arc: 70, flinch: 0.5 },
};
export const PARRY = 0.18; // the window at the start of a guard that parries
// A guard raised again within this of coming down keeps the guard it was
// rather than parrying afresh, so the window rewards timing, not tapping.
export const REGUARD = 0.3;
// arc: a guard only covers blows from within this of where it faces (the
// same as a bolt it can deflect); block: stamina a blocked light stroke
// costs; break: stamina a broken guard loses; broken: how long it reels.
export const GUARD = { arc: 70, block: 8, break: 25, broken: 0.6 };
const PARRIED = 0.9; // how long a parried striker reels: long enough to answer with a heavy
export const REGEN = { rest: 20, guard: 8 }; // stamina a second
export const DODGE = { s: 0.4, cost: 20 };
export const DEFLECT = 70; // degrees either side of a guard’s facing that a bolt is turned from

export function createFighter({ id, x, z, yaw = 0, side, hp = 100 }) {
  return { id, x, z, yaw, hp, stamina: 100, guard: false, guardT: 0, down: Infinity, stroke: null, stagger: 0, dodge: 0, side, deflect: { yaw, active: false } };
}

// yaw 0 looks along −z and turning towards +x is positive, so forward is (sin, −cos)
export function facing(f, p, deg) {
  const dx = p.x - f.x;
  const dz = p.z - f.z;
  const d = Math.hypot(dx, dz);
  if (d < 1e-6) return true;
  return (Math.sin(f.yaw) * dx - Math.cos(f.yaw) * dz) / d >= Math.cos((deg * Math.PI) / 180);
}

export function saberStep(f, input, dt) {
  const events = [];
  f.stagger = Math.max(0, f.stagger - dt);
  f.dodge = Math.max(0, f.dodge - dt);
  // a fighter knocked off balance (a flinch, a parry, a shove, a grip) loses the stroke it was in, so a reeling body never lands a blow
  if (f.stagger > 0) f.stroke = null;
  const free = f.stagger <= 0 && !f.stroke && f.dodge <= 0;
  if (free && input.dodge && f.stamina >= DODGE.cost) {
    f.dodge = DODGE.s;
    f.stamina -= DODGE.cost;
    f.guard = false;
    events.push({ type: 'dodge', id: f.id });
  } else if (free && input.strike && f.stamina >= STROKES[input.strike].cost) {
    f.stroke = { kind: input.strike, t: 0, hit: false, met: [] };
    f.stamina -= STROKES[input.strike].cost;
    f.guard = false;
    events.push({ type: 'stroke', id: f.id, kind: input.strike });
  }
  const guard = !!input.guard && f.stagger <= 0 && !f.stroke && f.dodge <= 0;
  if (guard && !f.guard) {
    f.guardT = f.down < REGUARD ? PARRY : 0;
    events.push({ type: 'guard', id: f.id });
  }
  f.guard = guard;
  if (f.guard) f.guardT += dt;
  // counted from the end of the last step it was up, so a guard knocked down between steps (broken, hit, gripped) counts too
  f.down = f.guard ? 0 : f.down + dt;
  // the stroke runs on the step it starts, so its blow lands on the step that crosses `at`
  if (f.stroke) {
    const k = STROKES[f.stroke.kind];
    f.stroke.t += dt;
    if (!f.stroke.hit && f.stroke.t >= k.at) {
      f.stroke.hit = true;
      events.push({ type: 'blow', id: f.id, kind: f.stroke.kind });
    }
    if (f.stroke.t >= k.s) f.stroke = null;
  }
  if (!f.stroke && f.dodge <= 0) f.stamina = Math.min(100, f.stamina + (f.guard ? REGEN.guard : REGEN.rest) * dt);
  f.deflect = { yaw: f.yaw, active: f.guard };
  return events;
}

function breakGuard(b, cost) {
  b.stamina = Math.max(0, b.stamina - cost);
  b.guard = false;
  b.stagger = Math.max(b.stagger, GUARD.broken);
}

export function resolveClash(a, b) {
  // a blow lands once on each fighter, however many steps of its stroke are left when the caller asks again
  const met = a.stroke?.hit ? (a.stroke.met ??= []) : null;
  if (!met || met.includes(b.id)) return { result: 'none', damage: 0, dead: false };
  met.push(b.id);
  const k = STROKES[a.stroke.kind];
  const out = (result, damage = 0) => ({ result, damage, dead: b.hp <= 0 });
  if (Math.hypot(b.x - a.x, b.z - a.z) > k.reach || !facing(a, b, k.arc)) return out('miss');
  if (b.dodge > 0) return out('dodged');
  if (b.guard && facing(b, a, GUARD.arc)) {
    if (b.guardT < PARRY) {
      a.stroke = null;
      a.stagger = Math.max(a.stagger, PARRIED);
      return out('parry');
    }
    if (a.stroke.kind === 'heavy') {
      breakGuard(b, GUARD.break);
      return out('break');
    }
    if (b.stamina <= GUARD.block) {
      breakGuard(b, GUARD.block);
      return out('break');
    }
    b.stamina -= GUARD.block;
    return out('block');
  }
  b.hp = Math.max(0, b.hp - k.damage);
  b.stroke = null;
  b.guard = false;
  b.stagger = Math.max(b.stagger, k.flinch);
  return out('hit', k.damage);
}
