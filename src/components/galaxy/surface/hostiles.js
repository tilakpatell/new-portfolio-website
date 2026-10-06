// How the worlds' enemies fight, beyond standing and shooting (activity.js
// runs these on its targets each frame; the site's spawn says which, in
// `hostile`): bursts of fire, strafing round you, a shield that soaks hits
// before any land, and a blade that parries yours. Pure, so it's tested in
// Node.
//
//   hostile.burst   { n, gap }: n shots, `gap` seconds apart, each time it fires
//   hostile.strafe  { speed, every, keep }: it circles you at `speed` m/s, turning about every `every` seconds, holding about `keep` metres off
//   hostile.shield  n: hits it soaks before it's hurt (a droideka's bubble)
//   hostile.parry   0…1: the share of your swings its blade turns away
//
//   startBurst(hostile) → the shots left and the wait: { left, wait }
//   stepBurst(burst, dt) → how many shots fall due this frame (the burst
//     counted down; 0 once it's spent)
//   strafeStep(b, you, hostile, dt, time) → the new { x, z, yaw } (yaw: facing you)
//   absorb(t, damage) → { shield, hp } after a hit: the shield first, then the body
//   parries(hostile, roll) → whether a swing is turned away, `roll` 0…1

export const startBurst = (hostile) => ({ left: Math.max(1, hostile?.burst?.n ?? 1), wait: 0 });

export function stepBurst(burst, dt, gap = 0.12) {
  if (!burst || burst.left <= 0) return 0;
  burst.wait -= dt;
  let n = 0;
  while (burst.wait <= 0 && burst.left > 0) {
    n++;
    burst.left--;
    burst.wait += gap;
  }
  return n;
}

export function strafeStep(b, you, hostile, dt, time) {
  const s = hostile.strafe;
  const dx = you.x - b.x;
  const dz = you.z - b.z;
  const d = Math.hypot(dx, dz) || 1e-6;
  const yaw = Math.atan2(dx, dz);
  // across the line to you, one way then the other
  const side = Math.floor(time / (s.every ?? 2.2)) % 2 === 0 ? 1 : -1;
  const tx = -dz / d;
  const tz = dx / d;
  // and in or out, to hold the distance it likes
  const keep = s.keep ?? 10;
  const radial = d > keep * 1.25 ? 1 : d < keep * 0.75 ? -1 : 0;
  const step = (s.speed ?? 2.5) * dt;
  return { x: b.x + (tx * side + (dx / d) * radial * 0.6) * step, z: b.z + (tz * side + (dz / d) * radial * 0.6) * step, yaw };
}

export function absorb(t, damage) {
  const shield = Math.max(0, (t.shield ?? 0) - damage);
  const through = Math.max(0, damage - (t.shield ?? 0));
  return { shield, hp: t.hp - through };
}

export const parries = (hostile, roll) => Boolean(hostile?.parry) && roll < hostile.parry;
