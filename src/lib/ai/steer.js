// Context steering (Andrew Fray, F1 2011): instead of each behaviour
// returning a velocity and the sum cancelling ("chase A" and "don't hit
// the rock in front of A" add to nothing), each writes what it feels about
// every heading into two rings of slots round the agent, an interest map
// and a danger map, with a falloff over the neighbouring slots; the maps
// combine by max; then every slot whose danger is above the least danger
// is masked out, the best interest left wins, and the heading is
// interpolated between its neighbours so a few slots give a smooth turn.
// Blending with last frame's map is hysteresis for free. Behaviours stay
// small and stateless. Level (the x–z plane): the ships' close-in avoidance
// and the walkers both live there. Pure.
//
//   createContext(slots = 16) → ctx; clear(ctx)
//   interest(ctx, dir, weight, falloff), danger(ctx, dir, weight, falloff)
//   seek(ctx, from, to, weight), flee(ctx, from, threat, weight, range)
//   avoid(ctx, from, vel, { at, r }, margin, lookahead), separate(ctx, from, others, spacing)
//   follow(ctx, from, path: [{ x, z }…], lookahead)
//   resolve(ctx, { blend }) → { dir: { x, y: 0, z }, strength }

export function createContext(slots = 16) {
  return { slots, interest: new Float32Array(slots), danger: new Float32Array(slots), last: new Float32Array(slots), blended: false };
}

export function clear(ctx) {
  ctx.interest.fill(0);
  ctx.danger.fill(0);
}

const TAU = Math.PI * 2;
const slotOf = (ctx, dir) => {
  const a = Math.atan2(dir.x, dir.z);
  return (((a / TAU) * ctx.slots) % ctx.slots + ctx.slots) % ctx.slots;
};
const headingOf = (ctx, slot) => {
  const a = (slot / ctx.slots) * TAU;
  return { x: Math.sin(a), y: 0, z: Math.cos(a) };
};
function write(map, ctx, dir, weight, falloff) {
  if (weight <= 0) return;
  const c = slotOf(ctx, dir);
  for (let i = 0; i < ctx.slots; i++) {
    let away = Math.abs(i - c);
    away = Math.min(away, ctx.slots - away);
    const v = weight * Math.max(0, 1 - away / Math.max(1e-6, falloff));
    if (v > map[i]) map[i] = v;
  }
}
export const interest = (ctx, dir, weight = 1, falloff = 2) => write(ctx.interest, ctx, dir, weight, falloff);
export const danger = (ctx, dir, weight = 1, falloff = 1) => write(ctx.danger, ctx, dir, weight, falloff);

export function seek(ctx, from, to, weight = 1, falloff = 3) {
  const d = { x: to.x - from.x, y: 0, z: to.z - from.z };
  if (Math.hypot(d.x, d.z) < 1e-6) return;
  interest(ctx, d, weight, falloff);
}
export function flee(ctx, from, threat, weight = 1, range = Infinity) {
  const d = { x: from.x - threat.x, y: 0, z: from.z - threat.z };
  const l = Math.hypot(d.x, d.z);
  if (l < 1e-6 || l > range) return;
  interest(ctx, d, weight * (range === Infinity ? 1 : 1 - l / range), 3);
}
// an obstacle (a circle) within reach: danger on the headings into it, more
// the nearer, and a skirt either side so it's passed with room to spare
export function avoid(ctx, from, vel, o, margin = 0.5, lookahead = 6) {
  const dx = o.at.x - from.x;
  const dz = o.at.z - from.z;
  const d = Math.hypot(dx, dz);
  const R = o.r + margin;
  const reach = R + lookahead + (vel ? Math.hypot(vel.x, vel.z) * 0.5 : 0);
  if (d - R > reach) return;
  const k = d <= R ? 1 : 1 - (d - R) / Math.max(1e-6, reach - R);
  // the headings that cut the circle: the half-angle it subtends
  const half = d > R ? Math.asin(Math.min(1, R / d)) : Math.PI / 2;
  const skirt = (half / TAU) * ctx.slots + 1;
  danger(ctx, { x: dx, y: 0, z: dz }, k, skirt);
}
export function separate(ctx, from, others, spacing) {
  for (const o of others) {
    const at = o.at ?? o;
    const dx = at.x - from.x;
    const dz = at.z - from.z;
    const d = Math.hypot(dx, dz);
    if (d < 1e-6 || d >= spacing) continue;
    danger(ctx, { x: dx, y: 0, z: dz }, 1 - d / spacing, 2);
  }
}
export function follow(ctx, from, path, lookahead = 4) {
  if (!path?.length) return;
  // the nearest point of the path, then one `lookahead` on from it
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i < path.length; i++) {
    const d = Math.hypot(path[i].x - from.x, path[i].z - from.z);
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  let i = best;
  let left = lookahead;
  while (i < path.length - 1 && left > 0) {
    left -= Math.hypot(path[i + 1].x - path[i].x, path[i + 1].z - path[i].z);
    i++;
  }
  seek(ctx, from, path[i], 1, 3);
}

export function resolve(ctx, { blend = 0.3 } = {}) {
  const n = ctx.slots;
  let least = Infinity;
  for (let i = 0; i < n; i++) if (ctx.danger[i] < least) least = ctx.danger[i];
  const masked = new Float32Array(n);
  for (let i = 0; i < n; i++) masked[i] = ctx.danger[i] > least + 1e-6 ? 0 : ctx.interest[i];
  // hysteresis: this frame's view blended with the last
  if (ctx.blended) for (let i = 0; i < n; i++) masked[i] = masked[i] * (1 - blend) + ctx.last[i] * blend;
  ctx.last.set(masked);
  ctx.blended = true;
  let best = 0;
  for (let i = 1; i < n; i++) if (masked[i] > masked[best]) best = i;
  const strength = masked[best];
  if (strength <= 1e-6) return { dir: { x: 0, y: 0, z: 0 }, strength: 0 };
  // between the neighbours: a virtual slot where the gradients meet
  const l = masked[(best - 1 + n) % n];
  const r = masked[(best + 1) % n];
  const off = (r - l) / (2 * Math.max(1e-6, 2 * strength - l - r));
  const dir = headingOf(ctx, best + Math.max(-0.5, Math.min(0.5, off)));
  return { dir, strength };
}
