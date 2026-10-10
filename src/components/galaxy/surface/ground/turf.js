// Turf: who holds which ground on a world. The pad's turf is the holder's,
// placed where the landing party always stood (garrison.js's numbers); on a
// world the war is fighting over the other side holds a far turf out past
// the ridge, 220 to 300 m off, and the two meet on a front where their beats
// are bent to. Pure, tested. The design:
// docs/superpowers/specs/2026-10-08-ground-factions-design.md, section 3.
//
// Turf = { id, at, r, holder ('owner' | 'other' | 'hutt' | 'native' | side),
//   side, war, posts: [[x, z]], beats: [[[x, z]…]], front?: { at, dir } }
// turfsOf(site, effects, { standable, height }) → Turf[]; padTurf(site,
// effects, kit); farTurf(site, pad, effects, kit) → Turf | null;
// holderSide(turf, effects); strengthOf(turf, effects); turfAt(turfs, x, z);
// frontBetween(a, b, war?) → { at, dir } | null; bendBeat(beat, front).

import { WARS } from '../../sides';
import { relation } from './standing';

export const PAD = { r: 90, post: 26, posts: 3, beats: [34, 48] };
export const FAR = { r: 110, inner: 220, outer: 300, bearings: 12, radii: 3, edge: 0.7 };
const STEEP = 0.35;

const round = (p) => [+p[0].toFixed(2), +p[1].toFixed(2)];
const slopeAt = (height, [x, z]) => Math.max(Math.abs(height(x + 4, z) - height(x - 4, z)), Math.abs(height(x, z + 4) - height(x, z - 4))) / 8;
const inReach = (site, [x, z]) => !site.reach || Math.hypot(x, z) <= site.reach - 20;

// a spot near p that's dry ground (out along its own bearing from c, or
// round it), or null
function snap(site, kit, c, p) {
  const ok = (q) => inReach(site, q) && kit.standable(q);
  if (ok(p)) return round(p);
  const a0 = Math.atan2(p[1] - c[1], p[0] - c[0]);
  const r0 = Math.hypot(p[0] - c[0], p[1] - c[1]);
  for (const dr of [0, -6, 6, -12, 12])
    for (const da of [0.12, -0.12, 0.25, -0.25, 0.4, -0.4]) {
      const q = [c[0] + Math.cos(a0 + da) * (r0 + dr), c[1] + Math.sin(a0 + da) * (r0 + dr)];
      if (ok(q)) return round(q);
    }
  return null;
}

// the straight walk from a to b on dry ground all the way (a look every 4 m)
const LEG = 4;
const legDry = (kit, a, b) => {
  const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / LEG));
  for (let j = 1; j < n; j++) if (!kit.standable([a[0] + ((b[0] - a[0]) * j) / n, a[1] + ((b[1] - a[1]) * j) / n])) return false;
  return true;
};
// a beat that can be walked round: a corner whose leg from the last crosses water is left out, and so is
// the last while the way back round to the first does
export function walkable(kit, beat) {
  const out = [];
  for (const p of beat) if (!out.length || legDry(kit, out[out.length - 1], p)) out.push(p);
  while (out.length > 2 && !legDry(kit, out[out.length - 1], out[0])) out.pop();
  return out;
}
// a beat's square round c, each corner on dry ground or left out
const beatAt = (site, kit, c, dx, dz) =>
  walkable(
    kit,
    [
      [c[0] + dx, c[1] + dz],
      [c[0] - dz, c[1] + dx],
      [c[0] - dx, c[1] - dz],
      [c[0] + dz, c[1] - dx],
    ]
      .map((p) => snap(site, kit, c, p))
      .filter(Boolean),
  );

const sideOf = (holder, effects) => {
  if (holder === 'owner') return effects.owner;
  if (holder === 'other') {
    const w = WARS[effects.war];
    if (!w || effects.owner === 'hutt') return null;
    return effects.owner === w.liberator ? w.raider : w.liberator;
  }
  return holder;
};

export function padTurf(site, effects, kit) {
  const c = site.land.at;
  const posts = [];
  for (let i = 0; i < PAD.posts; i++) {
    const a = (i / PAD.posts) * Math.PI * 2 + 0.6;
    const p = snap(site, kit, c, [c[0] + Math.cos(a) * PAD.post, c[1] + Math.sin(a) * PAD.post]);
    if (p) posts.push(p);
  }
  const beats = [beatAt(site, kit, c, PAD.beats[0], 0), beatAt(site, kit, c, 0, PAD.beats[1])].filter((b) => b.length >= 2);
  return { id: 'pad', at: c, r: PAD.r, holder: 'owner', side: sideOf('owner', effects), war: effects.war, posts, beats };
}

export function farTurf(site, pad, effects, kit) {
  const c = site.land.at;
  const postBearings = pad.posts.map((p) => Math.atan2(p[1] - c[1], p[0] - c[0]));
  const gap = (a) => Math.min(Math.PI, ...postBearings.map((b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))));
  let best = null;
  for (let i = 0; i < FAR.bearings; i++) {
    const a = (i / FAR.bearings) * Math.PI * 2;
    for (let j = 0; j < FAR.radii; j++) {
      const rad = FAR.inner + ((FAR.outer - FAR.inner) * j) / (FAR.radii - 1);
      const at = round([c[0] + Math.cos(a) * rad, c[1] + Math.sin(a) * rad]);
      if (!inReach(site, at) || !kit.standable(at)) continue;
      const slope = kit.height ? slopeAt(kit.height, at) : 0;
      if (slope > STEEP) continue;
      // three posts on its near edge, facing the pad
      const back = Math.atan2(c[1] - at[1], c[0] - at[0]);
      const posts = [-0.45, 0, 0.45].map((da) => snap(site, kit, at, [at[0] + Math.cos(back + da) * FAR.r * FAR.edge, at[1] + Math.sin(back + da) * FAR.r * FAR.edge]));
      if (posts.some((p) => !p)) continue;
      const score = gap(a) - slope * 4;
      if (!best || score > best.score) best = { score, at, posts };
    }
  }
  if (!best) return null;
  const beats = [beatAt(site, kit, best.at, 40, 0), beatAt(site, kit, best.at, 0, 60)].filter((b) => b.length >= 2);
  return { id: 'far', at: best.at, r: FAR.r, holder: 'other', side: sideOf('other', effects), war: effects.war, posts: best.posts, beats };
}

export const holderSide = (turf, effects) => turf.side ?? sideOf(turf.holder, effects);

export function strengthOf(turf, effects) {
  const control = effects?.control ?? 1;
  if (turf.holder === 'owner') return control;
  if (turf.holder === 'other') return 1 - control;
  return 1;
}

export function turfAt(turfs, x, z) {
  let best = null;
  let bestD = Infinity;
  for (const t of turfs) {
    const d = Math.hypot(x - t.at[0], z - t.at[1]);
    if (d <= t.r && d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best;
}

export function frontBetween(a, b, war = a.war ?? b.war) {
  if (relation(a.side, b.side, war) !== 'enemy') return null;
  const dx = b.at[0] - a.at[0];
  const dz = b.at[1] - a.at[1];
  const d = Math.hypot(dx, dz) || 1;
  const dir = [dx / d, dz / d];
  // halfway across the ground between the two discs' edges
  const m = (a.r + (d - b.r)) / 2;
  return { at: round([a.at[0] + dir[0] * m, a.at[1] + dir[1] * m]), dir };
}

// the beat's point nearest the front moved onto it
export function bendBeat(beat, front) {
  let k = 0;
  let bestD = Infinity;
  beat.forEach((p, i) => {
    const d = Math.hypot(p[0] - front.at[0], p[1] - front.at[1]);
    if (d < bestD) {
      bestD = d;
      k = i;
    }
  });
  return beat.map((p, i) => (i === k ? [...front.at] : p));
}

// (bent to the front only where every leg of it can still be walked)
const bentOrNot = (kit, b, front) => {
  const bent = bendBeat(b, front);
  return walkable(kit, bent).length === bent.length ? bent : b;
};

export function turfsOf(site, effects, kit) {
  if (!effects || !site?.land?.at) return [];
  const pad = padTurf(site, effects, kit);
  const out = [pad];
  for (const t of site.turf ?? []) out.push({ ...t, side: t.side ?? sideOf(t.holder, effects), war: effects.war });
  if ((effects.front || effects.attack) && effects.owner !== 'hutt' && sideOf('other', effects)) {
    const far = farTurf(site, pad, effects, kit);
    if (far) {
      const front = frontBetween(pad, far);
      // (bent only where the front is ground a patrol can stand on)
      if (front && kit.standable(front.at) && inReach(site, front.at)) {
        far.front = { at: front.at, dir: [-front.dir[0], -front.dir[1]] };
        far.beats = far.beats.map((b, i) => (i === 0 ? bentOrNot(kit, b, front) : b));
        pad.front = front;
        pad.beats = pad.beats.map((b, i) => (i === 0 ? bentOrNot(kit, b, front) : b));
      } else if (front) far.front = { at: front.at, dir: [-front.dir[0], -front.dir[1]] };
      out.push(far);
    }
  }
  return out;
}
