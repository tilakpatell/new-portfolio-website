// Holding a level to its budget row (lane L): the rows do not move, so the
// pack drops what it must. A window is the cells a visitor can have drawn at
// once (the cells within `radius` of one cell); while the heaviest window is
// over its share of the row's triangles or draw calls, the lightest mesh in
// it (instances × bounding volume over the whole arena: snow debris, cables,
// small clutter) is dropped everywhere for that tier. One mesh at a time, so
// the big pieces (the hangar, the ridges) are the last to go.
//
//   fitTo(cells, row, { share = 0.7, radius = 1, cost }) → { kept: Map<key, draws>, dropped: [{ mesh, count, tris }] }
//   windowCost(cells, key, { radius, cost, skip }) → { tris, calls }
//
// cells: Map<'cx,cz', { draws: [{ mesh, count, weight, tris, mirrored }] }>;
// cost(draw, ring) → { tris (a piece), cut } | null (not drawn at that ring;
// by default the draw's own `tris` at one cut). A call is one distinct mesh,
// cut and side in the window: the scene draws one InstancedMesh for each.

const plainCost = (d) => ({ tris: d.tris, cut: '' });

const parse = (key) => key.split(',').map(Number);

export function windowCost(cells, key, { radius = 1, cost = plainCost, skip = null } = {}) {
  const [cx, cz] = parse(key);
  let tris = 0;
  const calls = new Set();
  for (let dz = -radius; dz <= radius; dz++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const c = cells.get(`${cx + dx},${cz + dz}`);
      if (!c) continue;
      const ring = Math.max(Math.abs(dx), Math.abs(dz));
      for (const d of c.draws) {
        if (skip?.has(d.mesh)) continue;
        const k = cost(d, ring);
        if (!k) continue;
        tris += k.tris * d.count;
        calls.add(`${d.mesh}|${k.cut}|${d.mirrored ? 1 : 0}`);
      }
    }
  }
  return { tris, calls: calls.size };
}

export function fitTo(cells, row, { share = 0.7, radius = 1, cost = plainCost } = {}) {
  const maxTris = row.tris * share;
  const maxCalls = row.calls * share;
  const weight = new Map();
  for (const c of cells.values()) for (const d of c.draws) weight.set(d.mesh, (weight.get(d.mesh) ?? 0) + d.weight);
  const skip = new Set();
  const over = (w) => w.tris > maxTris || w.calls > maxCalls;
  for (;;) {
    // the heaviest window still over the row (by how far over, either way)
    let worst = null;
    let by = 0;
    for (const key of cells.keys()) {
      const w = windowCost(cells, key, { radius, cost, skip });
      if (!over(w)) continue;
      const how = Math.max(w.tris / maxTris, w.calls / maxCalls);
      if (how > by) [worst, by] = [key, how];
    }
    if (!worst) break;
    // its lightest mesh, whose drop would change the window
    let pick = null;
    const [cx, cz] = parse(worst);
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const c = cells.get(`${cx + dx},${cz + dz}`);
        if (!c) continue;
        const ring = Math.max(Math.abs(dx), Math.abs(dz));
        for (const d of c.draws) {
          if (skip.has(d.mesh) || !cost(d, ring)) continue;
          if (pick === null || weight.get(d.mesh) < weight.get(pick) || (weight.get(d.mesh) === weight.get(pick) && d.mesh < pick)) pick = d.mesh;
        }
      }
    }
    if (pick === null) break;
    skip.add(pick);
  }
  const kept = new Map();
  const lost = new Map();
  for (const [key, c] of cells) {
    kept.set(key, c.draws.filter((d) => !skip.has(d.mesh)));
    for (const d of c.draws) {
      if (!skip.has(d.mesh)) continue;
      const k = cost(d, 0) ?? { tris: 0 };
      const l = lost.get(d.mesh) ?? { mesh: d.mesh, count: 0, tris: 0 };
      l.count += d.count;
      l.tris += k.tris * d.count;
      lost.set(d.mesh, l);
    }
  }
  // (in the order they went)
  return { kept, dropped: [...skip].map((m) => lost.get(m)) };
}
