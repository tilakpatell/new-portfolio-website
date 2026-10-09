// The station coming apart round you through the last of the Rebel story
// (the flag `breach`, from the carry on): every few seconds a tremor, its
// size the shake the camera takes and how loud the boom, and with most of
// them a panel bursting off a wall of the room you are in, a little way
// from you, in fire and smoke. It hurts nobody: the clock is the danger.
// Pure but for the game's seeded rand and the timer it keeps on the game.
//
//   GAP → [least, most]   seconds between one tremor and the next
//   stepBreach(g, dt) → event | null   { type: 'quake', size: 0.35…1, at: { x, y, z } | null }:
//     at, the burst on a wall of your room (null: a tremor with nothing bursting)

export const GAP = [2.2, 5.5];
const REACH = 12; // metres from you a wall may be to burst
const ALONG = [2.5, 6]; // metres along the wall from the point nearest you
const UP = [1.4, 2.6]; // metres over the floor it bursts at
const OFF = 0.6; // metres out from the wall: in front of its panels, not inside them
const BURSTS = 0.75; // of the tremors, how many burst a panel

const pick = (rand, [a, b]) => a + rand() * (b - a);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// a point on a wall of your room's box (OFF out from it) within REACH of you, off to one side of the point on it
// nearest you (so never in your face), or null when every wall is further off
function wallBy(g, rand) {
  const you = g.you;
  const box = g.layout.rooms.get(you.room)?.box;
  if (!box) return null;
  const { x0, x1, z0, z1 } = box;
  const [ix0, ix1, iz0, iz1] = [x0 + OFF, x1 - OFF, z0 + OFF, z1 - OFF];
  const walls = [
    { x: ix0, z: clamp(you.z, iz0, iz1), along: 'z' },
    { x: ix1, z: clamp(you.z, iz0, iz1), along: 'z' },
    { x: clamp(you.x, ix0, ix1), z: iz0, along: 'x' },
    { x: clamp(you.x, ix0, ix1), z: iz1, along: 'x' },
  ].filter((w) => Math.hypot(w.x - you.x, w.z - you.z) <= REACH);
  if (!walls.length) return null;
  const w = walls[Math.floor(rand() * walls.length)];
  const slide = (rand() < 0.5 ? -1 : 1) * pick(rand, ALONG);
  const at = w.along === 'z' ? { x: w.x, z: clamp(w.z + slide, iz0, iz1) } : { x: clamp(w.x + slide, ix0, ix1), z: w.z };
  return Math.hypot(at.x - you.x, at.z - you.z) <= REACH ? { x: at.x, y: you.y + pick(rand, UP), z: at.z } : null;
}

export function stepBreach(g, dt) {
  if (!g.flags?.has('breach')) {
    g.quakeIn = null;
    return null;
  }
  const rand = g.rand ?? Math.random;
  // (the first comes soon after the station starts to go)
  g.quakeIn = (g.quakeIn ?? GAP[0] * 0.5) - dt;
  if (g.quakeIn > 0) return null;
  g.quakeIn = pick(rand, GAP);
  const size = 0.35 + rand() * 0.65;
  return { type: 'quake', size, at: rand() < BURSTS ? wallBy(g, rand) : null };
}
