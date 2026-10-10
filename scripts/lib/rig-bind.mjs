// Binding a rigid model to the game's own skeleton for it. The drop has the
// AT-ST only as one rigid composite (atst_static_donotuse_mesh: hull, legs
// and feet merged, no skin), while its 69 clips are on the cinematics'
// skeleton (ATST_Ske01), whose rest is the pose the composite was modelled
// in. So the composite is skinned to that skeleton at import, each vertex
// wholly to one bone: a machine's parts are rigid, and a weight shared
// between two would bend a plate. Which bone: the one whose segment (the
// bone to each of its children) the vertex is nearest; then each connected
// piece of the mesh (an island: a plate, a piston, a toe) goes wholly to the
// bone most of its vertices chose, when most of them agree, so no plate is
// torn along a joint. A piece that straddles two bones evenly (a skin across
// a joint) keeps its vertices' own choices.
//
// bonesOf(nodes) → [{ name, at: [x, y, z], ends: [[x, y, z]…] }]: the rest
//   pose's bones in the model's frame, from { name, at, children } rows
// nearestBone(p, bones) → index
// islands(index, count) → Int32Array (each vertex's piece)
// bindVertices(positions, index, bones, { agree }) → Uint16Array (a bone per vertex)

// the game's helpers, which nothing is skinned to
export const HELPERS = /^(Reference|AITrajectory|Trajectory|TrajectoryEnd|CameraBase|CameraJoint|Connect|ConnectEnd|.*FootFuture|.*FutureFoot)$/;

export function bonesOf(nodes) {
  const byName = new Map(nodes.map((n) => [n.name, n]));
  return nodes
    .filter((n) => !HELPERS.test(n.name))
    .map((n) => ({
      name: n.name,
      at: n.at,
      ends: (n.children ?? [])
        .map((c) => byName.get(c))
        .filter((c) => c && !HELPERS.test(c.name))
        .map((c) => c.at),
    }));
}

const segDist2 = (p, a, b) => {
  const v = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const l = v[0] * v[0] + v[1] * v[1] + v[2] * v[2];
  const t = l ? Math.max(0, Math.min(1, ((p[0] - a[0]) * v[0] + (p[1] - a[1]) * v[1] + (p[2] - a[2]) * v[2]) / l)) : 0;
  const d = [p[0] - a[0] - v[0] * t, p[1] - a[1] - v[1] * t, p[2] - a[2] - v[2] * t];
  return d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
};

export function nearestBone(p, bones) {
  let best = 0;
  let bestD = Infinity;
  bones.forEach((b, i) => {
    const ends = b.ends.length ? b.ends : [b.at];
    for (const e of ends) {
      const d = segDist2(p, b.at, e);
      if (d < bestD) [best, bestD] = [i, d];
    }
  });
  return best;
}

// the mesh's connected pieces, by its triangles (union–find over the index)
export function islands(index, count) {
  const parent = Int32Array.from({ length: count }, (_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i]];
    return i;
  };
  for (let t = 0; t + 2 < index.length; t += 3) {
    const a = find(index[t]);
    for (const k of [index[t + 1], index[t + 2]]) {
      const b = find(k);
      if (a !== b) parent[b] = a;
    }
  }
  const out = new Int32Array(count);
  for (let i = 0; i < count; i++) out[i] = find(i);
  return out;
}

export function bindVertices(positions, index, bones, { agree = 0.6 } = {}) {
  const count = positions.length / 3;
  const own = new Uint16Array(count);
  for (let v = 0; v < count; v++) own[v] = nearestBone([positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]], bones);
  const piece = islands(index, count);
  const votes = new Map();
  for (let v = 0; v < count; v++) {
    let m = votes.get(piece[v]);
    if (!m) votes.set(piece[v], (m = new Map()));
    m.set(own[v], (m.get(own[v]) ?? 0) + 1);
  }
  const winner = new Map();
  for (const [p, m] of votes) {
    let total = 0;
    let best = -1;
    let n = 0;
    for (const [b, c] of m) {
      total += c;
      if (c > n) [best, n] = [b, c];
    }
    if (n / total >= agree) winner.set(p, best);
  }
  const out = new Uint16Array(count);
  for (let v = 0; v < count; v++) out[v] = winner.get(piece[v]) ?? own[v];
  return out;
}
