// What on a landing can be knocked about, and as what: pure data and the
// shape that goes with it, tested in Node (./physics.js puts them in
// Rapier; furnish.js says which things and scatter are them).
//
// A body is { shape: 'box' | 'cylinder' | 'ball', mass (kg), fixed? }:
// its size comes from the thing itself (its own box, in metres, at the
// size the landing stands it), so a kind's entry needn't know it, and a
// model gets one by naming it on its spec (landings.js's models: { url,
// tall, body }). The masses are the inventory's (docs/research of the
// landings): light things a shot sends flying, heavy ones a shove moves.
//
// A model that was made with its physics (physical nodes: lib/three/
// colliders.js reads them, docs/assets/colliders.md says how) is its own
// body before anything named for it: { shape: 'model', bodies } (its
// physical nodes' bodies, made one, as the thing is one).
//
//   BODIES       body by kind, for the planets' own builders' things and scatter
//   bodyOf(kind, spec?, model? (collidersOf's bodies)) → body | null (a
//     model's own nodes first, then its spec's, then the kind's)
//   shapeFor(body, box ({ min, max }, metres, the thing's own frame), s = 1)
//     → { type, colliders, mass } | null, for lib/physics's add()

export const BODIES = {
  // things
  barrel: { shape: 'cylinder', mass: 2 },
  bucket: { shape: 'cylinder', mass: 0.4 },
  mailbox: { shape: 'box', mass: 1.5 },
  beehive: { shape: 'cylinder', mass: 1 },
  hayBale: { shape: 'box', mass: 3 },
  chest: { shape: 'box', mass: 5 },
  // scatter
  tumbleweed: { shape: 'ball', mass: 0.3 },
  stones: { shape: 'box', mass: 0.2 },
  rubble: { shape: 'box', mass: 0.8 },
  bone: { shape: 'box', mass: 0.3 },
  shard: { shape: 'box', mass: 0.3 },
  bolt: { shape: 'cylinder', mass: 0.2 },
  plumbus: { shape: 'cylinder', mass: 0.2 },
  smallcog: { shape: 'cylinder', mass: 3 },
  reams: { shape: 'box', mass: 1 },
  diyas: { shape: 'cylinder', mass: 0.1 },
};

import { colliderIn } from '../../../lib/physics/fromModel';

const SHAPES = new Set(['box', 'cylinder', 'ball']);
const THIN = 0.02; // (no half-size under 2 cm: thinner tunnels through the ground)

export const bodyOf = (kind, spec = null, model = null) => (model?.length ? { shape: 'model', bodies: model } : (spec?.body ?? BODIES[kind] ?? null));

// every length in a collider at scale s: its size, its points, its offset
function scaled(c, s) {
  const args = c.shape === 'hull' || c.shape === 'trimesh' ? [c.args[0].map((v) => v * s), ...c.args.slice(1)] : c.args.map((v) => v * s);
  return { ...c, args, position: c.position.map((v) => v * s) };
}

// a model's bodies as one: the first's type, every one's colliders, their masses summed
function modelShape(bodies, s) {
  const [first] = bodies;
  const colliders = bodies.flatMap(({ desc }) => desc.colliders.map((c) => scaled(colliderIn(desc, c), s)));
  if (first.desc.type !== 'dynamic') return { type: 'fixed', colliders };
  return { type: 'dynamic', colliders, mass: bodies.reduce((m, b) => m + (b.desc.mass ?? 0), 0) * s * s * s };
}

export function shapeFor(body, box, s = 1) {
  if (body?.shape === 'model' && body.bodies?.length) return modelShape(body.bodies, s);
  if (!body || !SHAPES.has(body.shape)) return null;
  const { min, max } = box;
  const size = [0, 1, 2].map((i) => (max[i] - min[i]) * s);
  const mid = [0, 1, 2].map((i) => ((max[i] + min[i]) / 2) * s);
  if (![...size, ...mid].every(Number.isFinite) || size.some((d) => d < 0)) return null;
  const half = size.map((d) => Math.max(THIN, d / 2));
  let collider;
  if (body.shape === 'box') collider = { shape: 'cuboid', args: half, position: mid };
  else if (body.shape === 'cylinder') collider = { shape: 'cylinder', args: [half[1], Math.max(half[0], half[2])], position: mid };
  else {
    // (as big as its biggest way, but its foot on the thing's: a wide one
    // doesn't reach down into the ground under it)
    const r = Math.max(...half);
    collider = { shape: 'ball', args: [r], position: [mid[0], min[1] * s + r, mid[2]] };
  }
  return body.fixed ? { type: 'fixed', colliders: [collider] } : { type: 'dynamic', colliders: [collider], mass: body.mass * s * s * s };
}
