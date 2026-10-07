// Hyperspace traffic in a system's sky: ships jumping out along the courses
// to the systems the lanes join this one to (routes.js), and ships dropping
// in along them, each a streak of light for a moment. A leaving one starts
// just off the planet on the side of its course, so it's seen pulling away
// past the limb, and runs out to the sky faster and faster, its tail lagging
// so the streak stretches as it goes; an arriving one comes in from the sky
// the same way backwards, slowing, and ends off the planet, out of
// hyperspace. Their courses are the way the other systems' stars are in the
// sky (sky.js's beacons, systems.js courseTo), so the streaks run to and from
// the stars you can jump to. A system off the lanes is a quiet backwater:
// none. Pure numbers, tested in Node; skyStreaks.js draws them.
//
// laneLinks(sysId) → [{ id, dir: [x, y, z] }]: every system the lanes take
//   this one to, and the course to it (a unit vector)
// createSkyTraffic({ links, rand }) → { update(dt) → [{ dir, kind: 'leave' | 'arrive', k, off }], live }
//   STREAKS.min to STREAKS.max of them at a time (none with no links), each
//   living STREAKS.life seconds; k is how far through its life (0…1), off
//   where its line runs off the course ([u, v], each -1…1)
// streakAt(streak, { r, sky }) → { head: [x, y, z], tail: [x, y, z], fade }:
//   where it is, round a planet of radius r at the origin, out to `sky`

import { SYSTEMS, courseTo, systemById } from './systems';
import { routeBetween } from './routes';

export const STREAKS = { min: 3, max: 6, life: 2.5 }; // how many at a time; seconds each
export const RATE = 1.8; // ships a second, on top of the least, while there's room (about four or five at a time)
export const SKY = 3000; // how far out a streak runs (well inside the camera's far plane from the system's edge)
const START = 1.3; // planet radii out along its course a ship leaves from (or ends at)
const SPREAD = 0.45; // planet radii: how far off its course a ship's own line can be
const LAG = 0.12; // of its life, how far behind the head the tail runs

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (k) => k * k * (3 - 2 * k);

export function laneLinks(sysId) {
  const from = systemById(sysId);
  if (!from) return [];
  return SYSTEMS.filter((o) => o !== from && routeBetween(from.id, o.id)?.onLane).map((o) => ({ id: o.id, dir: courseTo(from, o) }));
}

export function createSkyTraffic({ links = [], rand = Math.random, life = STREAKS.life } = {}) {
  const live = [];
  const born = (k = 0) => {
    const link = links[Math.min(links.length - 1, Math.floor(rand() * links.length))];
    const kind = rand() < 0.5 ? 'leave' : 'arrive';
    live.push({ dir: link.dir, kind, k, age: k * life, off: [rand() * 2 - 1, rand() * 2 - 1] });
  };
  // the sky as you come into it: already busy, the ships part-way through their lives
  if (links.length) {
    const n = STREAKS.min + Math.floor(rand() * (STREAKS.max - STREAKS.min + 1));
    for (let i = 0; i < n; i++) born(rand() * 0.9);
  }
  return {
    live,
    update(dt) {
      if (!links.length) return live;
      const step = Math.min(Math.max(Number(dt) || 0, 0), life);
      for (let i = live.length - 1; i >= 0; i--) {
        const s = live[i];
        s.age += step;
        s.k = s.age / life;
        if (s.k >= 1 - 1e-9) live.splice(i, 1);
      }
      while (live.length < STREAKS.min) born();
      if (live.length < STREAKS.max && rand() < RATE * step) born();
      return live;
    },
  };
}

export function streakAt(streak, { r, sky = SKY }) {
  const d = streak.dir;
  // two ways across the course, for the ship's own line off it
  const up = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let u = [d[1] * up[2] - d[2] * up[1], d[2] * up[0] - d[0] * up[2], d[0] * up[1] - d[1] * up[0]];
  const ul = Math.hypot(u[0], u[1], u[2]);
  u = u.map((v) => v / ul);
  const v = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]];
  const [ou, ov] = (streak.off ?? [0, 0]).map((o) => o * r * SPREAD);
  const at = (s) => [0, 1, 2].map((i) => d[i] * s + u[i] * ou + v[i] * ov);
  const near = r * START;
  const k = clamp01(streak.k);
  const back = Math.max(0, k - LAG);
  if (streak.kind === 'arrive') {
    // in from the sky, slowing (eased out), the tail out behind it
    const out = (x) => 1 - (1 - x) * (1 - x);
    return { head: at(sky + (near - sky) * out(k)), tail: at(sky + (near - sky) * out(back)), fade: smooth(clamp01(k / 0.25)) * smooth(clamp01((1 - k) / 0.1)) };
  }
  // away from the planet, faster and faster (eased in), the tail lagging
  return { head: at(near + (sky - near) * k * k), tail: at(near + (sky - near) * back * back), fade: smooth(clamp01(k / 0.1)) * smooth(clamp01((1 - k) / 0.3)) };
}
