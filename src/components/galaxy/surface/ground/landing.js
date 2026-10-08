// Where you set down: on your side's world, the Hutts', or one you're
// unsworn in, at the pad; on the other side's, out of sight of its posts
// (the site's authored `covert`, else the best spot on a ring 150 to 220 m
// round the pad), and the arrival line says so. Pure, tested; scene.js
// hands it the world's standable ground and line of sight. The design:
// docs/superpowers/specs/2026-10-08-ground-factions-design.md, section 8.
//
// landingFor(site, effects, { standable, seesThrough, posts }) → { at, yaw,
// covert, line }; covertFor(site, { standable, seesThrough, posts, height? })
// → [x, z] | null. standable([x, z]) → bool; seesThrough({x, z}, {x, z}) →
// bool (a post sees SIGHT m at most); posts [[x, z]]; height(x, z) → y.

import { standingOf } from './standing';

export const RING = { inner: 150, outer: 220, bearings: 24, radii: 3 };
// how far a post sees (past it nobody's stepped: fight.js), and the steepest
// ground a ship sets down on (rise over run, across 6 m)
export const SIGHT = 120;
const STEEP = 0.25;
const slopeAt = (height, [x, z]) => Math.max(Math.abs(height(x + 3, z) - height(x - 3, z)), Math.abs(height(x, z + 3) - height(x, z - 3))) / 6;

// whose ground it is, as the line names them
const HELD = { empire: 'Imperial', remnant: 'Imperial', separatists: 'Separatist', rebel: 'Rebel', republic: 'Republic', newrepublic: 'New Republic' };

export function covertFor(site, { standable, seesThrough, posts = [], height = null }) {
  const [cx, cz] = site.land.at;
  let best = null;
  let bestD = -1;
  for (let r = 0; r < RING.radii; r++) {
    const rad = RING.inner + ((RING.outer - RING.inner) * r) / (RING.radii - 1);
    for (let i = 0; i < RING.bearings; i++) {
      const a = (i / RING.bearings) * Math.PI * 2;
      const at = [+(cx + Math.cos(a) * rad).toFixed(2), +(cz + Math.sin(a) * rad).toFixed(2)];
      if ((site.reach && Math.hypot(at[0], at[1]) > site.reach - 20) || !standable(at) || (height && slopeAt(height, at) > STEEP)) continue;
      const p = { x: at[0], z: at[1] };
      if (posts.some(([x, z]) => Math.hypot(x - p.x, z - p.z) < SIGHT && seesThrough({ x, z }, p))) continue;
      const d = posts.length ? Math.min(...posts.map(([x, z]) => Math.hypot(x - at[0], z - at[1]))) : rad;
      if (d > bestD) {
        bestD = d;
        best = at;
      }
    }
  }
  return best;
}

export function landingFor(site, effects, kit) {
  const pad = { at: site.land.at, yaw: site.land.yaw ?? 0, covert: false, line: null };
  if (site.noGround || !effects?.owner || standingOf(effects.owner, { side: effects.side, war: effects.war }) !== 'enemy') return pad;
  const line = `${HELD[effects.owner] ?? effects.owner}-held. We set down out of sight of the garrison.`;
  if (site.covert) {
    const c = Array.isArray(site.covert) ? { at: site.covert } : site.covert;
    return { at: c.at, yaw: c.yaw ?? pad.yaw, covert: true, line };
  }
  const at = covertFor(site, kit);
  if (!at) return pad;
  return { at, yaw: pad.yaw, covert: true, line };
}
