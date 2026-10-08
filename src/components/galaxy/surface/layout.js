// Where a world's scattered things go (scene.js's scatter, from the
// `scatter` entries in sites/*.js), pure so it's tested:
//   spotMaker(s, rand, reach) → () => [x, z]  a spot at a time: anywhere in
//     the ring `within` (round the origin, or round `around`: a place's
//     own trees), or gathered into patches, `clumps: [how many, spread]`
//     (a meadow's flowers, a ring of toadstools)
//   trailItems(path, { spacing, jitter, rand }) → [{ at, yaw }]  stepping
//     stones along a path, each turned along it, a little off the line
//   tintOf([a, b], t) → [r, g, b]  a colour between a scatter's pair (its
//     `tint`), in linear light, for an instance's colour
// The ring draws two numbers a spot, angle then distance, as the scatter
// always has: the worlds' existing scatters land where they did.

import * as THREE from 'three';

const TAU = Math.PI * 2;

export function spotMaker(s, rand, reach) {
  const [r0, r1] = s.within ?? [20, reach];
  const [cx, cz] = s.around ?? [0, 0];
  const ring = () => {
    const a = rand() * TAU;
    const d = Math.sqrt(r0 * r0 + rand() * (r1 * r1 - r0 * r0));
    return [cx + Math.cos(a) * d, cz + Math.sin(a) * d];
  };
  if (!s.clumps) return ring;
  const [count, spread] = s.clumps;
  const centres = Array.from({ length: count }, ring);
  return () => {
    const [x, z] = centres[Math.floor(rand() * count) % count];
    const a = rand() * TAU;
    // (thick in the middle of a patch, thinning out to its edge)
    const d = spread * rand() ** 1.5;
    return [x + Math.cos(a) * d, z + Math.sin(a) * d];
  };
}

export function trailItems(path, { spacing = 1.6, jitter = 0.3, rand = Math.random } = {}) {
  const out = [];
  let carry = 0; // (how far into the next leg its first stone is)
  for (let i = 0; i + 1 < path.length; i++) {
    const [ax, az] = path[i];
    const [bx, bz] = path[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const yaw = Math.atan2(bx - ax, bz - az);
    let d = carry;
    for (; d <= len + 1e-9; d += spacing) {
      const t = len > 0 ? d / len : 0;
      const side = (rand() - 0.5) * 2 * jitter;
      const turn = (rand() - 0.5) * 0.6 * Math.min(1, jitter * 3);
      out.push({ at: [ax + (bx - ax) * t + Math.cos(yaw) * side, az + (bz - az) * t - Math.sin(yaw) * side], yaw: yaw + turn });
    }
    carry = d - len;
  }
  return out;
}

const a = new THREE.Color();
const b = new THREE.Color();
export const tintOf = ([from, to], t) => a.set(from).lerp(b.set(to), t).toArray();
