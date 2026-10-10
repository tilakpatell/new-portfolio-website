// A duel's rules (Evil Rick's lair, and any place whose hunter has
// `hunt.duel`): Morty's shots and the hunter's strikes, pure, so they can be
// tested in Node. Headings are the world's (rules.js: facing `face` looks
// along (cos, −sin)).
//
//   newDuel({ hp, mortyHp }) → { hp, max, mortyHp, mortyMax, over }
//   inCone(from, face, to, range, half) → whether `to` is within `range` of
//     `from` and within `half` radians of where `from` faces
//   aimFor(from, face, to, { range, half }) → where Morty's shot goes: at
//     `to` if it's in the cone (the duel's aim assist), else null (along
//     his facing). The shot is a bolt (lib/combat/bolt.js, ../rmShots.js)
//     that the arena's walls stop, so it's decided when it gets there:
//   land(duel) → the duel after a bolt hits the hunter: `hit`, `down`
//     whether that was the last
//   strike(duel) → the duel after a strike on Morty: `beaten` when he's out

export const SHOT = { range: 8, half: 0.45 }; // how far a shot carries, and how wide the aim is (radians either side)
export const STRIKE = { reach: 1.6, every: 1.3 }; // how close a hunter strikes from, and how often (seconds)

export const newDuel = ({ hp = 6, mortyHp = 3 } = {}) => ({ hp, max: hp, mortyHp, mortyMax: mortyHp, over: false });

export function inCone(from, face, to, range = SHOT.range, half = SHOT.half) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const d = Math.hypot(dx, dz);
  if (d > range || d < 1e-6) return false;
  const want = Math.atan2(-dz, dx);
  let diff = want - face;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  return Math.abs(diff) <= half;
}

export function aimFor(from, face, to, opts = {}) {
  return inCone(from, face, to, opts.range ?? SHOT.range, opts.half ?? SHOT.half) ? to : null;
}

export function land(duel) {
  if (duel.over) return { ...duel, hit: false, down: false };
  const hp = Math.max(0, duel.hp - 1);
  return { ...duel, hp, hit: true, down: hp === 0, over: hp === 0 };
}

export function strike(duel) {
  if (duel.over) return { ...duel, beaten: false };
  const mortyHp = Math.max(0, duel.mortyHp - 1);
  return { ...duel, mortyHp, beaten: mortyHp === 0, over: mortyHp === 0 };
}
