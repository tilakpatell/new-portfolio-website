// Who Middle-earth's people are in the cast, and how their bodies read
// what the towns already do with them. The cast is twenty-nine rigged
// Meshy figures in the world's toy style (public/models/middleearth/cast/,
// scripts/meshy-middleearth.mjs): the story's people by name, and five
// archetypes for everyone else (a hobbit, a Bree man, an elf, a Rider, a
// Citadel guard) besides the foes (an orc, an Uruk-hai, an Easterling, a
// goblin). cast3d.js puts them on the towns' figures; this is the part of
// it that's plain numbers, so it's tested in Node.
//
// castFor(id, look, { town }) → a cast figure's name, or null (no one in
//   the cast is them: Gollum, Treebeard). A town's own name for someone
//   (Strider, the Gaffer, a Bree-lander, folk0) goes to whoever plays
//   them; anyone else to the town's townsfolk, or the hobbit when they're
//   hobbit-sized.
// tintFor(name, look) → a colour for an archetype dressed in a look's coat
//   (a crowd of one figure shouldn't read as clones), or null for the named.
// moveFor(speed, walk, run) → locomotion.js's `move` (0…1) for a figure
//   going `speed` whose walk covers `walk` and run `run` at their own pace:
//   standing, walking, running, and the blends between.
// motionFrom(prev, next, dt, { teleport }) → { speed, side, turn } from two
//   placings a frame apart ({ x, z, yaw }: yaw 0 along +x, + turning left,
//   as the toys face), in the units they're in; a jump further than
//   `teleport` a second (a figure put somewhere new) is standing still.
// createGreeter({ near, far }) → (distance) → true the moment someone comes
//   within `near`, armed again once they're further than `far` (the map's
//   greeting, for every town; lib/ai/talk.js's, re-exported).
// manner(name) → { greet: { clip, loop }, talk: [clips…], fidgets: [clips…] }:
//   how each kind of person greets, gestures as they talk and fidgets.
// pick(list, seed) → one of a list, the figure's own.
// stepFollower(f, goal, others, dt, opts) → the follower moved: a drawn
//   follower toward its place in the line at its own pace, easing in and
//   out, kept a little apart from the others (lib/ai/steer's separation,
//   in its simplest form). f, goal: { x, z } (goal may say `speed`, how fast
//   the line's going); others: [{ x, z }…]. opts: { pace, spacing, accel }.

import { turn } from '../../lib/three/gait';

export const CAST = ['frodo', 'sam', 'merry', 'pippin', 'bilbo', 'rosie', 'hobbit', 'gandalf', 'gandalfwhite', 'aragorn', 'legolas', 'gimli', 'boromir', 'faramir', 'galadriel', 'elrond', 'arwen', 'elf', 'theoden', 'eowyn', 'rohirrim', 'gondorguard', 'saruman', 'butterbur', 'breeman', 'orc', 'uruk', 'easterling', 'goblin'];
const NAMED = new Set(CAST);
const ARCHETYPES = new Set(['hobbit', 'breeman', 'elf', 'rohirrim', 'gondorguard']);

// the towns' own names for people, to who plays them
const ALIAS = {
  strider: 'aragorn',
  white: 'gandalfwhite',
  'gandalf-white': 'gandalfwhite',
  gandalfWhite: 'gandalfwhite',
  // the Shire
  maggot: 'hobbit',
  gaffer: 'hobbit',
  lobelia: 'rosie',
  guest: 'hobbit',
  // Bree
  harry: 'breeman',
  carrot: 'breeman',
  ferny: 'breeman',
  breelander: 'breeman',
  folk: 'breeman',
  man: 'breeman',
  townsfolk: 'breeman',
  henchman: 'breeman',
  // the elves
  haldir: 'elf',
  celeborn: 'elf',
  glorfindel: 'elf',
  lindir: 'elf',
  galadhrim: 'elf',
  // Rohan
  hama: 'rohirrim',
  gamling: 'rohirrim',
  eomer: 'rohirrim',
  rider: 'rohirrim',
  theodenOld: 'theoden',
  grima: 'breeman',
  // Gondor
  beregond: 'gondorguard',
  guard: 'gondorguard',
  keeper: 'gondorguard',
  denethor: 'gondorguard',
  // a dwarf
  dwarf: 'gimli',
};
// who's no one in the cast
const NONE = new Set(['gollum', 'treebeard', 'ent']);
// each town's townsfolk
const TOWNSFOLK = { shire: 'hobbit', bree: 'breeman', rivendell: 'elf', lorien: 'elf', edoras: 'rohirrim', minastirith: 'gondorguard' };

export function castFor(id, look = null, { town = null } = {}) {
  if (id == null) return null;
  const key = String(id);
  if (NONE.has(key)) return null;
  if (NAMED.has(key)) return key;
  if (ALIAS[key]) return ALIAS[key];
  // a numbered one of many (folk3, guard12), or someone somewhere (sam-dawn, galadriel-mirror): as they are
  const stem = key.replace(/\d+$/, '').split('-')[0];
  if (stem !== key && (ALIAS[stem] || NAMED.has(stem))) return ALIAS[stem] ?? stem;
  // hobbit-sized: a hobbit, unless wide as a dwarf
  const tall = look?.tall ?? 1;
  if (tall < 1.15) return (look?.wide ?? 1) > 1.25 ? 'gimli' : 'hobbit';
  return TOWNSFOLK[town] ?? 'breeman';
}

// a look's coat, a quarter of the way from white: enough to tell one of a
// crowd from the next, not so much as to stain the face
export function tintFor(name, look = null) {
  if (!ARCHETYPES.has(name) && !(name === 'rosie' && look && look.seed !== 25)) return null;
  const c = look?.coat ?? look?.robe ?? null;
  if (c == null || !Number.isFinite(c)) return null;
  const mix = (v) => Math.round(255 - (255 - v) * 0.28);
  return (mix((c >> 16) & 255) << 16) | (mix((c >> 8) & 255) << 8) | mix(c & 255);
}

const smooth01 = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
// locomotion.js reads `move` as: idle under 0.04, the walk all there from
// 0.3, the run coming in from 0.55 and all there at 0.9
export function moveFor(speed, walk, run) {
  const v = Math.abs(Number.isFinite(speed) ? speed : 0);
  const w = walk > 0 ? walk : 1;
  const r = run > w ? run : w * 1.6;
  if (v < 1e-3) return 0;
  // starting off: into the walk by a third of its pace
  if (v < w * 0.35) return 0.3 * smooth01(v / (w * 0.35));
  // walking, a little past its own pace
  if (v < w * 1.25) return 0.3 + 0.25 * ((v - w * 0.35) / (w * 0.9));
  // into the run by most of its pace
  const top = Math.max(r * 0.9, w * 1.25 + 1e-3);
  if (v < top) return 0.55 + 0.45 * smooth01((v - w * 1.25) / (top - w * 1.25));
  return 1;
}

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export function motionFrom(prev, next, dt, { teleport = Infinity } = {}) {
  const out = { speed: 0, side: 0, turn: 0 };
  if (!prev || !next || !(dt > 0)) return out;
  const dx = next.x - prev.x;
  const dz = next.z - prev.z;
  const turned = wrap((next.yaw ?? 0) - (prev.yaw ?? 0));
  if (Math.hypot(dx, dz) / dt > teleport) return out;
  // in the frame it faced halfway through: ahead (cos, −sin), its right (sin, cos)
  const yaw = (prev.yaw ?? 0) + turned / 2;
  const fx = Math.cos(yaw);
  const fz = -Math.sin(yaw);
  out.speed = (dx * fx + dz * fz) / dt;
  out.side = (dx * -fz + dz * fx) / dt;
  out.turn = turned / dt;
  for (const k of ['speed', 'side', 'turn']) if (!Number.isFinite(out[k])) out[k] = 0;
  return out;
}

// (the greeter is lib/ai/talk.js's now, re-exported as it was this file's)
export { createGreeter } from '../../lib/ai/talk';

const HOBBITS = new Set(['frodo', 'sam', 'merry', 'pippin', 'bilbo', 'rosie', 'hobbit']);
const WIZARDS = new Set(['gandalf', 'gandalfwhite', 'saruman']);
const ELVES = new Set(['legolas', 'galadriel', 'elrond', 'arwen', 'elf']);
const SOLDIERS = new Set(['rohirrim', 'gondorguard']);
const FOES = new Set(['orc', 'uruk', 'easterling', 'goblin']);
export function manner(name) {
  if (HOBBITS.has(name)) return { greet: { clip: 'wave', loop: true }, talk: ['talk', 'talk.open', 'talk.right'], fidgets: ['confused', 'hip'] };
  if (WIZARDS.has(name)) return { greet: { clip: 'wave.one', loop: false }, talk: ['talk.raised', 'talk.passion', 'talk.open'], fidgets: [] };
  // the elves bow, and talk with open hands
  if (ELVES.has(name)) return { greet: { clip: 'bow', loop: false }, talk: ['talk.open', 'talk.right'], fidgets: [] };
  if (SOLDIERS.has(name)) return { greet: { clip: 'bow', loop: false }, talk: ['talk', 'talk.hip'], fidgets: ['hip'] };
  if (name === 'gimli') return { greet: { clip: 'wave.one', loop: false }, talk: ['talk.passion', 'talk.raised'], fidgets: ['hip'] };
  if (name === 'butterbur') return { greet: { clip: 'wave', loop: true }, talk: ['talk.passion', 'talk.open'], fidgets: ['confused', 'headache'] };
  if (FOES.has(name)) return { greet: { clip: 'taunt', loop: false }, talk: ['talk.angry', 'talk.passion'], fidgets: ['scheme'] };
  return { greet: { clip: 'wave.one', loop: false }, talk: ['talk', 'talk.hip', 'talk.right'], fidgets: ['hip'] };
}

export function pick(list, seed = 0) {
  if (!list?.length) return null;
  const i = Math.abs(Math.floor(Number(seed) || 0)) % list.length;
  return list[i];
}

export function stepFollower(f, goal, others = [], dt = 0, { pace = 1, spacing = 0.7, accel = 9, top = 8 } = {}) {
  const out = { x: f.x, z: f.z, v: f.v ?? 0, face: f.face ?? 0 };
  if (!(dt > 0) || !goal) return out;
  // where it wants to be, and the push off anyone too close
  let dx = goal.x - f.x;
  let dz = goal.z - f.z;
  for (const o of others) {
    if (o === f) continue;
    const ox = f.x - o.x;
    const oz = f.z - o.z;
    const d = Math.hypot(ox, oz);
    if (d < spacing && d > 1e-6) {
      const k = (spacing - d) / spacing;
      dx += (ox / d) * k * spacing * 1.5;
      dz += (oz / d) * k * spacing * 1.5;
    }
  }
  const d = Math.hypot(dx, dz);
  // its own pace: the line's, a little more to catch up, eased to a stop on arriving
  const line = Math.max(0, goal.speed ?? 0);
  const want = d < 0.05 ? 0 : Math.min(top, Math.max(line, 0) * pace + d * 2.2, Math.sqrt(2 * accel * d));
  out.v = want > out.v ? Math.min(want, out.v + accel * dt) : Math.max(want, out.v - accel * 1.6 * dt);
  if (d > 1e-6 && out.v > 0) {
    const s = Math.min(d, out.v * dt);
    out.x += (dx / d) * s;
    out.z += (dz / d) * s;
    // turned toward where it's going, by time (no snap)
    if (out.v > 0.2) out.face = turn(out.face, Math.atan2(-dz, dx), dt, 8);
  }
  return out;
}
