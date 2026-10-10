// What the galaxy's effects do, apart from drawing them: which look an
// impact on each surface takes (the game's mark, its chunks, its colour),
// what a blast by each vehicle class throws, how many of anything a tier
// draws, the fire's colour along the game's black-body ramp, and a thrown
// chunk's fall. Pure; ./marks.js, ./debris.js and ./gameFx.js draw it.
//
// countFor(n, level) → n at high and ultra, half at mid, a quarter at low
// surfaceOf(site, ground) → 'metal' | 'stone' | 'snow' | 'sand' (the fallback)
// familySurface(family) → the surface for a material family the game's grid
//   named (PR #821's impactLook: snow | metal | sand | rock | wood), or null
// impactPlan(surface, level) → { mark: { sheet, frames, tint, size }, debris: { set, n, speed, size }, puff }
// blastPlan(cls, level) → { size, life, ring, debris: { set, n, speed, size }, then }
// rampColour(ramp, k) → [r, g, b]: k 0 cold to 1 white-hot, along the ramp's samples
// stepChunk(c, dt, groundAt) → c: { p, v, spin, r, rest } fallen one step,
//   bounced off the ground where groundAt(x, z) puts it, at rest once slow

export const SURFACES = ['metal', 'stone', 'snow', 'sand', 'wood'];
const G = 9.8;

export function countFor(n, level = 'high') {
  if (!(n > 0)) return 0;
  const k = level === 'low' ? 0.25 : level === 'mid' ? 0.5 : 1;
  return Math.max(1, Math.round(n * k));
}

// what the game's material grid said the bolt struck (lane P4's family, on
// the bolt's `solid` event) wins; the world's ground below is the fallback
const FAMILY = { snow: 'snow', metal: 'metal', sand: 'sand', rock: 'stone', wood: 'wood' };
export const familySurface = (family) => FAMILY[family] ?? null;

// the world's ground: what its footsteps say (site.sound.ground), else its
// terrain's detail (snow; sand, a beach or red soil as sand); grass, mud,
// leaves and the rest scorch as stone does. A wall is metal where the
// floor is (a station, a ship), else stone
const SANDY = new Set(['sand', 'beach', 'redsoil']);
export function surfaceOf(site, ground) {
  const g = site?.sound?.ground ?? site?.ground?.detail;
  if (g === 'metal') return 'metal';
  if (!ground) return 'stone';
  if (g === 'snow') return 'snow';
  return SANDY.has(g) ? 'sand' : 'stone';
}

// the mark: the game's sheet (`impact`'s red the scorch; the metal scorch's
// four), tinted (soot on stone and sand, a grey melt on snow); the chunks:
// the game's, thrown up and out, snow and sand most
export const IMPACTS = {
  metal: { mark: { sheet: 'scorch.metal', frames: 4, tint: [1, 1, 1], size: 0.7 }, debris: { set: 'debris.metal', n: 3, speed: 3, size: 0.16 }, puff: null },
  stone: { mark: { sheet: 'impact', frames: 1, tint: [0.06, 0.05, 0.045], size: 0.9 }, debris: { set: 'debris.rock', n: 3, speed: 3.5, size: 0.2 }, puff: '#8a8076' },
  snow: { mark: { sheet: 'impact', frames: 1, tint: [0.25, 0.28, 0.33], size: 1.1 }, debris: { set: 'debris.snow', n: 6, speed: 4.5, size: 0.22 }, puff: '#eef3f8' },
  sand: { mark: { sheet: 'impact', frames: 1, tint: [0.16, 0.12, 0.08], size: 1 }, debris: { set: 'debris.sand', n: 5, speed: 4, size: 0.22 }, puff: '#d8c49a' },
  wood: { mark: { sheet: 'impact', frames: 1, tint: [0.05, 0.035, 0.025], size: 0.7 }, debris: { set: 'debris.wood', n: 3, speed: 3, size: 0.2 }, puff: '#6b5a48' },
};

export function impactPlan(surface, level = 'high') {
  const p = IMPACTS[surface] ?? IMPACTS.stone;
  return { ...p, debris: { ...p.debris, n: countFor(p.debris.n, level) } };
}

// a blast by what went up: its size across (m), its life (s), a ring
// running out over the ground, the class's own wreck thrown
export const BLASTS = {
  grenade: { size: 3, life: 1.1, ring: true, debris: { set: 'debris.rock', n: 8, speed: 6, size: 0.4 } },
  speeder: { size: 5, life: 1.4, ring: true, debris: { set: 'debris.metal', n: 12, speed: 8, size: 0.6 } },
  fighter: { size: 7, life: 1.5, ring: false, debris: { set: 'debris.fighter', n: 10, speed: 10, size: 1.4 } },
  walker: { size: 9, life: 1.8, ring: true, debris: { set: 'debris.walker', n: 12, speed: 7, size: 1.6 } },
};

export function blastPlan(cls, level = 'high') {
  const b = BLASTS[cls] ?? BLASTS.grenade;
  return { ...b, debris: { ...b.debris, n: Math.min(32, countFor(b.debris.n, level)) } };
}

export function rampColour(ramp, k) {
  const x = Math.min(1, Math.max(0, k)) * (ramp.length - 1);
  const i = Math.min(ramp.length - 2, Math.floor(x));
  const f = x - i;
  return [0, 1, 2].map((c) => ramp[i][c] + (ramp[i + 1][c] - ramp[i][c]) * f);
}

export function stepChunk(c, dt, groundAt) {
  if (c.rest) return c;
  c.v[1] -= G * dt;
  for (let k = 0; k < 3; k++) {
    c.p[k] += c.v[k] * dt;
    c.r[k] += c.spin[k] * dt;
  }
  const g = groundAt(c.p[0], c.p[2]);
  if (c.p[1] <= g) {
    c.p[1] = g;
    // a bounce: a third of its fall back, half its slide kept, its spin slowed
    c.v[1] = Math.abs(c.v[1]) * 0.33;
    c.v[0] *= 0.5;
    c.v[2] *= 0.5;
    for (let k = 0; k < 3; k++) c.spin[k] *= 0.5;
    if (Math.hypot(c.v[0], c.v[1], c.v[2]) < 0.4) {
      c.v[0] = c.v[1] = c.v[2] = 0;
      c.rest = true;
    }
  }
  return c;
}
