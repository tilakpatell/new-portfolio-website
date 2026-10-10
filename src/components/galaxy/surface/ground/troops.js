// One table of troops for everyone who fights on the ground: each kind's
// health, gun, senses, pace and nerve, the kinds each side fields, and the
// soldier a spec becomes. The old tables that named the same kinds
// (activity.js's ARMS, garrison.js's FAMILIES, needs.js's SOLDIERS) are
// kept here, with their values, and re-exported under their names. Pure,
// tested. The design:
// docs/superpowers/specs/2026-10-08-ground-factions-design.md, section 5.
//
// TROOPS[kind] → { hp, weapon (weaponRules.js's WEAPONS key, or null), range,
//   speed, cone (cos of the half-angle it sees across), nerve (how much its
//   squad's confidence moves it: a droid never breaks), tall, shield? };
// KINDS_OF_SIDE[side] → [kind]; kindFor(side, rand); newSoldier(spec, rand)
// → Soldier; damageOf(weapon, dist); hurt(s, damage) → 'hurt' | 'down';
// hpOf(spec) → a quest spec's hp on this scale.

import { weaponOf } from '../weaponRules';

const T = (hp, weapon, o = {}) => ({ hp, weapon, range: 48, speed: 3.2, cone: 0.3, nerve: 1, tall: 1.8, ...o });
export const TROOPS = {
  stormtrooper: T(100, 'rifle'),
  sandtrooper: T(100, 'rifle'),
  snowtrooper: T(100, 'rifle'),
  scouttrooper: T(90, 'blaster', { speed: 3.6 }),
  deathtrooper: T(130, 'rifle', { range: 56, nerve: 0.5 }),
  shoretrooper: T(100, 'rifle'),
  probe: T(40, null, { range: 60, cone: 0.1, nerve: 0, speed: 2, tall: 2.2 }),
  rebel: T(100, 'a280', { range: 52 }),
  hothtrooper: T(100, 'a280', { range: 52 }),
  clone: T(100, 'dc15', { range: 52 }),
  clonephase1: T(100, 'dc15', { range: 52 }),
  battledroid: T(60, 'e5', { range: 40, speed: 2.6, nerve: 0, cone: 0.4 }),
  superdroid: T(160, 'rifle', { range: 44, speed: 2.4, nerve: 0 }),
  droideka: T(120, 'e5', { range: 44, speed: 2, nerve: 0, shield: 3, tall: 1.4 }),
  dwarfspider: T(200, 'dlt19', { range: 50, speed: 2, nerve: 0, tall: 1.6 }),
  mercenary: T(90, 'westar', { range: 40, speed: 3.4, nerve: 1.3 }),
  weequay: T(90, 'westar', { range: 40, speed: 3.4, nerve: 1.3 }),
  // (the walkers stay actors.js's: the rows are here so every kind has one)
  atst: T(800, 'dlt19', { range: 80, speed: 2.2, nerve: 0, tall: 8.6 }),
  atrt: T(300, 'dlt19', { range: 60, speed: 3, nerve: 0, tall: 3.2 }),
  atap: T(700, 'dlt19', { range: 80, speed: 1.6, nerve: 0, tall: 6 }),
  atte: T(1200, 'dlt19', { range: 90, speed: 1.4, nerve: 0, tall: 6 }),
};

// the kinds each side puts on the ground (figures.js draws every one; the
// first is warEffects.js's `troops` for the side)
export const KINDS_OF_SIDE = {
  empire: ['stormtrooper'],
  remnant: ['stormtrooper'],
  rebel: ['rebel'],
  newrepublic: ['rebel'],
  republic: ['clone'],
  separatists: ['battledroid'],
  hutt: ['mercenary'],
};
export const kindFor = (side, rand = Math.random) => {
  const kinds = KINDS_OF_SIDE[side] ?? [];
  return kinds.length ? kinds[Math.floor(rand() * kinds.length) % kinds.length] : null;
};

// a kind in a world's own uniform (a site's `uniforms`: Hoth's Empire in
// snow armour, its Rebels in parkas); the kind itself where it has none
export const dressOf = (kind, uniforms) => uniforms?.[kind] ?? kind;

// ── the old tables, one place ──
// what a quest's hostile carries in its hand, by kind (universe/gunplay.js's GUNS: activity.js)
export const ARMS = {
  tusken: 'sniper',
  jango: 'westar',
  greedo: 'blaster',
  aqualish: 'blaster',
  scouttrooper: 'blaster',
  stormtrooper: 'e11',
  sandtrooper: 'e11',
  snowtrooper: 'e11',
  shoretrooper: 'e11',
  deathtrooper: 'e11',
  clone: 'dc15',
  battledroid: 'e5',
  mercenary: 'rifle',
  hothtrooper: 'a280',
  rebel: 'a280',
};
// the troopers of each side's look, as the sites name them (garrison.js)
export const FAMILIES = {
  stormtrooper: ['stormtrooper', 'sandtrooper', 'snowtrooper', 'scouttrooper'],
  rebel: ['rebel', 'hothtrooper'],
  clone: ['clone'],
  battledroid: ['battledroid', 'superdroid'],
  mercenary: ['mercenary'],
};
// the ones with a gun who stand their ground and raise it (needs.js)
export const SOLDIERS = new Set(['stormtrooper', 'sandtrooper', 'snowtrooper', 'scouttrooper', 'shoretrooper', 'deathtrooper', 'tiepilot', 'officer', 'clone', 'rex', 'battledroid', 'superdroid', 'rebel', 'hothtrooper', 'wingguard', 'senateguard', 'bobafett', 'greedo', 'jango', 'mando', 'bokatan', 'fennec', 'caradune', 'ig11', 'greef']);

// ── soldiers ──
export const hpOf = (spec) => (spec?.hp ?? 10) * 10;

export function damageOf(weapon, dist) {
  if (!weapon) return 0;
  const w = weaponOf(weapon);
  const d = w.damage * 10;
  return dist > (w.range * 2) / 3 ? +(d * 0.6).toFixed(3) : d;
}

export function newSoldier(spec, rand = Math.random) {
  const t = TROOPS[spec.kind] ?? TROOPS.stormtrooper;
  const [x, z] = spec.at;
  return {
    id: spec.id,
    kind: spec.kind,
    side: spec.side,
    hp: t.hp,
    hpMax: t.hp,
    weapon: t.weapon,
    b: { x, z, yaw: spec.yaw ?? 0, to: null, wait: rand() * 2 },
    home: spec.home ?? [x, z],
    leash: spec.role === 'patrol' || spec.role === 'raid' ? 80 : 30,
    beat: spec.beat ?? null,
    role: spec.role,
    mode: spec.role === 'patrol' ? 'patrol' : 'post',
    mind: { phase: rand() * 0.4, think: 0, sense: rand() * 0.1 },
    beliefs: new Map(),
    squad: spec.squad,
    turf: spec.turf ?? null,
    shield: t.shield ?? 0,
    suppressed: 0,
    heat: 0,
    grudge: 0,
    alive: true,
  };
}

export function hurt(s, damage) {
  s.hp = Math.max(0, s.hp - damage);
  if (s.hp > 0) return 'hurt';
  s.alive = false;
  return 'down';
}

// a soldier's trigger: bursts of the gun's own (three where it says none),
// `gap` apart, a pause between; cadenceOf(weapon) → the seconds a shot, on
// average (bolts.js's farExchange fires by it)
export const BURST = { gap: 0.15, pause: [1.1, 2] };
export const burstOf = (weapon) => weaponOf(weapon).burst ?? 3;
export function cadenceOf(weapon) {
  const n = burstOf(weapon);
  return ((n - 1) * Math.max(BURST.gap, weaponOf(weapon).every) + (BURST.pause[0] + BURST.pause[1]) / 2) / n;
}
