// The sums behind the first Death Star’s shafts, kept apart from the
// drawing so they can be tested in Node: which of the story’s flags a
// frame carries, how a moving part eases to its mark, where the layers of
// haze go that darken a shaft with depth, which edges of a ledge drop
// into the void (each gets a lit lip and a cut face), how the chasm’s
// bridge telescopes out of its ledge, and how the TIE bay’s racks hold
// their fighters. Pure.
//
//   flagOn(ctx, name) → bool   ctx: a room’s update ctx (ctx.flags, or the game’s ctx.g.flags; a Set or a list)
//   approach(v, target, dt, rate) → v moved towards target by at most rate × dt
//   hazeLayers({ near, far, n, keep }) → { ys, opacity }   n black layers from near to far (down a shaft or
//     up it), crowded towards the near end; together they let `keep` of what lies past them through
//   openEdges(room) → [{ floor, side, a: { x, z }, b: { x, z }, y }]   the stretches of each floor’s edges
//     with nothing beside them: no wall, no floor within a step (a floor that comes and goes, like the
//     bridge, doesn’t count); floor is its index in room.floors
//   bridgePlan(room, props) → { axis, face, dir, span, mid, width, y } | null   the floor tagged 'bridge':
//     it runs `dir` along `axis` from the face of the ledge whose control (the prop tagged
//     'bridge-control') stands on it; mid and width across it
//   bridgeSpans(plan, out, { n, overlap }) → [{ a, b }]   its n lengths along the axis, out 0 (in its
//     ledge) to 1 (across)
//   rackSlots(rack, ties) → [{ x, z, tie }]   the cradles along a tie-rack prop, evenly spaced as its
//     fighters are; tie: the index in ties of the one it holds, or null where it is empty
//   vaderOf(ties, door) → index of the fighter nearest the launch doors, or −1

const EPS = 1e-6;
const STEP = 0.41; // a body’s step (walker.js): a floor nearer than this in height is walked onto

export function flagOn(ctx, name) {
  const flags = ctx?.flags ?? ctx?.g?.flags;
  if (flags instanceof Set) return flags.has(name);
  return Array.isArray(flags) ? flags.includes(name) : false;
}

export function approach(v, target, dt, rate) {
  const step = Math.max(0, rate * dt);
  if (Math.abs(target - v) <= step) return target;
  return v + Math.sign(target - v) * step;
}

// (crowded towards the near end by a power, so the first metres under a
// ledge already go dim while the last layers, far down, are seldom looked through)
export function hazeLayers({ near, far, n, keep }) {
  const ys = Array.from({ length: n }, (_, i) => near + (far - near) * ((i + 0.5) / n) ** 1.5);
  return { ys, opacity: 1 - keep ** (1 / n) };
}

// a floor that comes and goes (the bridge): its neighbours keep their lips; water stays where it is
const fleeting = (f) => Boolean(f.tag) && f.tag !== 'water';

// an interval less the ones over it, as what is left
function less([a, b], cuts) {
  let left = [[a, b]];
  for (const [c, d] of cuts) left = left.flatMap(([p, q]) => (d <= p + EPS || c >= q - EPS ? [[p, q]] : [...(c > p + EPS ? [[p, c]] : []), ...(d < q - EPS ? [[d, q]] : [])]));
  return left.filter(([p, q]) => q - p > 0.05);
}

export function openEdges(room) {
  const b = room.box;
  const out = [];
  room.floors.forEach((f, i) => {
    if (fleeting(f)) return;
    const others = room.floors.filter((g, j) => j !== i && !fleeting(g) && Math.abs(g.y - f.y) <= STEP);
    const sides = [
      { side: 'north', line: 'z', at: f.z0, wall: b.z0, span: [f.x0, f.x1] },
      { side: 'south', line: 'z', at: f.z1, wall: b.z1, span: [f.x0, f.x1] },
      { side: 'west', line: 'x', at: f.x0, wall: b.x0, span: [f.z0, f.z1] },
      { side: 'east', line: 'x', at: f.x1, wall: b.x1, span: [f.z0, f.z1] },
    ];
    for (const s of sides) {
      if (Math.abs(s.at - s.wall) < EPS) continue;
      const cuts = others
        .filter((g) => (s.line === 'z' ? g.z0 - EPS <= s.at && s.at <= g.z1 + EPS : g.x0 - EPS <= s.at && s.at <= g.x1 + EPS))
        .map((g) => (s.line === 'z' ? [g.x0, g.x1] : [g.z0, g.z1]));
      for (const [p, q] of less(s.span, cuts)) {
        const [a, c] = s.line === 'z' ? [{ x: p, z: s.at }, { x: q, z: s.at }] : [{ x: s.at, z: p }, { x: s.at, z: q }];
        out.push({ floor: i, side: s.side, a, b: c, y: f.y });
      }
    }
  });
  return out;
}

export function bridgePlan(room, props = []) {
  const f = room.floors.find((g) => g.tag === 'bridge');
  if (!f) return null;
  const axis = f.x1 - f.x0 >= f.z1 - f.z0 ? 'x' : 'z';
  const [lo, hi] = axis === 'x' ? [f.x0, f.x1] : [f.z0, f.z1];
  const control = props.find((p) => p.tag === 'bridge-control');
  const at = control ? (axis === 'x' ? control.x : control.z) : lo;
  const fromLo = Math.abs(at - lo) <= Math.abs(at - hi);
  return {
    axis,
    face: fromLo ? lo : hi,
    dir: fromLo ? 1 : -1,
    span: hi - lo,
    mid: axis === 'x' ? (f.z0 + f.z1) / 2 : (f.x0 + f.x1) / 2,
    width: axis === 'x' ? f.z1 - f.z0 : f.x1 - f.x0,
    y: f.y,
  };
}

// (in, each length stands in its ledge with its nose a hand’s breadth out
// of the slot; out, length k reaches k + 1 n-ths of the way, so the tip
// moves fastest, as a telescope does)
export function bridgeSpans(plan, out, { n = 4, overlap = 0.05 } = {}) {
  const len = plan.span / n + overlap;
  const nose = 0.05;
  return Array.from({ length: n }, (_, k) => {
    const far = nose + ((plan.span * (k + 1)) / n - nose) * Math.min(1, Math.max(0, out));
    const [p, q] = [plan.face + plan.dir * (far - len), plan.face + plan.dir * far];
    return { a: Math.min(p, q), b: Math.max(p, q) };
  });
}

export function rackSlots(rack, ties) {
  const across = { x: Math.cos(rack.yaw), z: Math.sin(rack.yaw) };
  const fwd = { x: Math.sin(rack.yaw), z: -Math.cos(rack.yaw) };
  const mine = ties
    .map((t, i) => ({ i, u: (t.x - rack.x) * across.x + (t.z - rack.z) * across.z, off: (t.x - rack.x) * fwd.x + (t.z - rack.z) * fwd.z }))
    .filter((t) => Math.abs(t.off) < rack.d / 2 + 0.5 && Math.abs(t.u) <= rack.w / 2 + EPS)
    .sort((p, q) => p.u - q.u);
  if (!mine.length) return [];
  const gaps = mine.slice(1).map((t, k) => t.u - mine[k].u);
  const step = gaps.length ? Math.min(...gaps) : 1;
  const count = gaps.length ? Math.round((mine.at(-1).u - mine[0].u) / step) : 0;
  return Array.from({ length: count + 1 }, (_, k) => {
    const u = mine[0].u + k * step;
    const held = mine.find((t) => Math.abs(t.u - u) < 0.1);
    return { x: rack.x + across.x * u, z: rack.z + across.z * u, tie: held ? held.i : null };
  });
}

export function vaderOf(ties, door) {
  let best = -1;
  ties.forEach((t, i) => {
    if (best < 0 || Math.hypot(t.x - door.x, t.z - door.z) < Math.hypot(ties[best].x - door.x, ties[best].z - door.z)) best = i;
  });
  return best;
}
