// A duel's rules (Evil Rick's lair, and any place whose hunter has
// `hunt.duel`): Morty's shots and the hunter's strikes, pure, so they can be
// tested in Node. Headings are the world's (rules.js: facing `face` looks
// along (cos, −sin)).
//
//   newDuel({ hp, mortyHp }) → { hp, max, mortyHp, mortyMax, over }
//   inCone(from, face, to, range, half) → whether `to` is within `range` of
//     `from` and within `half` radians of where `from` faces
//   fire(duel, shooter, face, target, { range, half }) → the duel after a
//     shot: `hit` says whether it landed, `down` whether that was the last
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

export function fire(duel, shooter, face, target, opts = {}) {
  if (duel.over) return { ...duel, hit: false, down: false };
  const hit = inCone(shooter, face, target, opts.range ?? SHOT.range, opts.half ?? SHOT.half);
  const hp = hit ? Math.max(0, duel.hp - 1) : duel.hp;
  return { ...duel, hp, hit, down: hit && hp === 0, over: hp === 0 };
}

export function strike(duel) {
  if (duel.over) return { ...duel, beaten: false };
  const mortyHp = Math.max(0, duel.mortyHp - 1);
  return { ...duel, mortyHp, beaten: mortyHp === 0, over: mortyHp === 0 };
}
