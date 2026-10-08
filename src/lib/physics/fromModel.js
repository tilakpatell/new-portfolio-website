// Bodies from a model's node names, Bruno Simon's way (folio-2025: a prop's
// physics is modelled and exported, never coded): a node whose name has
// `physical` in it is a body, `dynamic` or `kinematic` in the name picks
// its type (else fixed), and its direct children named cuboid*, ball*,
// cylinder*, capsule*, hull* or trimesh* are its colliders, sized by their
// scale (so a modeller scales a unit cube, ball or cylinder to fit) and
// placed by their own position and rotation. A body with none gets one
// cuboid round its own box. docs/assets/colliders.md is the page a
// modeller reads. No three.js, no DOM: lib/three/colliders.js reads a
// loaded model into these nodes.
//
//   node: { name, position: [x, y, z], quaternion: [x, y, z, w], scale:
//     [x, y, z], children: node[], box?: { min, max } (its own frame),
//     points?: Float32Array (a hull's or a trimesh's, its own frame),
//     indices?: Uint32Array (a trimesh's), userData?: { mass, friction,
//     restitution } }
//   bodiesFromNodes(nodes, { mass = 0.1 }) → [{ name, desc, node }] (desc
//     for lib/physics/world.js's add(); `mass` a dynamic body's when its
//     node doesn't name one)
//   colliderIn(desc, collider) → the collider in the frame its body is in
//     (to make one body of several: a landing's prop is one thing)
//
// A body is placed in the frame the nodes are in: a physical node inside
// another (or inside any group) is its own body, its place through its
// parents'. A body's own scale goes into its colliders (Rapier's bodies
// have none); a scale along a turned axis is taken as if it weren't
// turned, which is right for the uniform scales a prop is made with.

const SHAPES = ['cuboid', 'ball', 'cylinder', 'capsule', 'hull', 'trimesh'];
const SAME = 1e-4; // (how far apart a ball's three scales may be)

const shapeOf = (name) => SHAPES.find((s) => name.toLowerCase().startsWith(s)) ?? null;

// a ⊗ b, quaternions as [x, y, z, w]
function mul(a, b) {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx, aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz];
}

// v turned by q
function turn(q, v) {
  const [x, y, z, w] = q;
  const [vx, vy, vz] = v;
  const tx = 2 * (y * vz - z * vy);
  const ty = 2 * (z * vx - x * vz);
  const tz = 2 * (x * vy - y * vx);
  return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)];
}

const times = (a, b) => a.map((v, i) => v * b[i]);

// a node's place in the frame of `parent` ({ position, quaternion, scale })
function compose(parent, node) {
  return {
    position: parent.position.map((p, i) => p + turn(parent.quaternion, times(parent.scale, node.position ?? [0, 0, 0]))[i]),
    quaternion: mul(parent.quaternion, node.quaternion ?? [0, 0, 0, 1]),
    scale: times(parent.scale, node.scale ?? [1, 1, 1]),
  };
}

const scaled = (points, s) => {
  const out = new Float32Array(points.length);
  for (let i = 0; i < points.length; i++) out[i] = points[i] * s[i % 3];
  return out;
};

// one collider child, in its body's frame; `own` the body's own scale
function colliderOf(body, child, own) {
  const shape = shapeOf(child.name ?? '');
  const s = times(own, child.scale ?? [1, 1, 1]);
  const at = { position: times(own, child.position ?? [0, 0, 0]), rotation: [...(child.quaternion ?? [0, 0, 0, 1])] };
  if (shape === 'cuboid') return { shape, args: s.map((v) => v / 2), ...at };
  if (shape === 'ball') {
    if (Math.max(...s) - Math.min(...s) > SAME) throw new Error(`${body}: a ball needs one scale`);
    return { shape, args: [s[1] / 2], ...at };
  }
  if (shape === 'cylinder') return { shape, args: [s[1] / 2, s[0] / 2], ...at };
  if (shape === 'capsule') return { shape, args: [Math.max(0, s[1] / 2 - s[0] / 2), s[0] / 2], ...at };
  // a hull or a trimesh: its own points, or nothing to make it of
  if (!child.points?.length) return null;
  const points = scaled(child.points, s);
  return { shape, args: shape === 'trimesh' ? [points, child.indices ?? new Uint32Array(Array.from({ length: points.length / 3 }, (_, i) => i))] : [points], ...at };
}

// one cuboid round the body's own box, when it has no collider children
function boxCollider(box, own) {
  if (!box) return null;
  const min = times(own, box.min);
  const max = times(own, box.max);
  const half = min.map((v, i) => Math.abs(max[i] - v) / 2);
  if (![...half, ...min, ...max].every(Number.isFinite) || half.every((v) => v === 0)) return null;
  return { shape: 'cuboid', args: half, position: min.map((v, i) => (v + max[i]) / 2), rotation: [0, 0, 0, 1] };
}

function descOf(node, place, mass) {
  const name = node.name ?? '';
  const type = /dynamic/i.test(name) ? 'dynamic' : /kinematic/i.test(name) ? 'kinematicPositionBased' : 'fixed';
  const children = (node.children ?? []).filter((c) => shapeOf(c.name ?? ''));
  const colliders = children.length ? children.map((c) => colliderOf(name, c, place.scale)).filter(Boolean) : [boxCollider(node.box, place.scale)].filter(Boolean);
  if (!colliders.length) return null;
  const desc = { type, position: place.position, rotation: place.quaternion, colliders };
  const u = node.userData ?? {};
  if (type === 'dynamic') {
    desc.mass = Number.isFinite(u.mass) ? u.mass : mass;
    desc.sleeping = true;
  }
  if (Number.isFinite(u.friction)) desc.friction = u.friction;
  if (Number.isFinite(u.restitution)) desc.restitution = u.restitution;
  return desc;
}

export function colliderIn(desc, c) {
  const q = desc.rotation ?? [0, 0, 0, 1];
  const at = turn(q, c.position ?? [0, 0, 0]);
  return { ...c, position: (desc.position ?? [0, 0, 0]).map((p, i) => p + at[i]), rotation: mul(q, c.rotation ?? [0, 0, 0, 1]) };
}

export function bodiesFromNodes(nodes, { mass = 0.1 } = {}) {
  const out = [];
  const walk = (list, parent) => {
    for (const node of list ?? []) {
      const place = compose(parent, node);
      if (/physical/i.test(node.name ?? '')) {
        const desc = descOf(node, place, mass);
        if (desc) out.push({ name: node.name, desc, node });
        // (a collider child is the body's, not a place to look for more)
        walk((node.children ?? []).filter((c) => !shapeOf(c.name ?? '')), place);
      } else walk(node.children, place);
    }
  };
  walk(nodes, { position: [0, 0, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1] });
  return out;
}
