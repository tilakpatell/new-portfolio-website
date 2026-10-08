// The bookkeeping for a world built in square cells around the player: which
// cells to ask for next (nearest first, ties toward where the player is
// heading), how many may be in flight at once, which loaded cells have gone
// far enough to let go of (a band of hysteresis past the radius, so walking
// along an edge doesn't load and drop the same row over and over), and a
// generation, so a cell that arrives after a reset or after the player has
// moved away is refused rather than loaded. Pure: the caller builds and
// frees the cells, this only says which.
//
// createChunkGrid({ size, radius, inFlight, hysteresis }) → { cellOf(x, z),
//   cells(x, z, { radius, heading }), update({ x, z, heading, radius }),
//   began(key, gen), done(key, gen), failed(key, gen), unload(key),
//   reset(gen), loaded, flying, gen, radius, size }

const keyOf = (cx, cz) => `${cx},${cz}`;

const parse = (key) => {
  const i = key.indexOf(',');
  return [Number(key.slice(0, i)), Number(key.slice(i + 1))];
};

// the cell offsets within r, nearest first, then most along the heading,
// then by angle
const ordering = (r, heading) => {
  const [hx, hz] = heading || [0, 0];
  const list = [];
  for (let dz = -r; dz <= r; dz++) {
    for (let dx = -r; dx <= r; dx++) {
      const d2 = dx * dx + dz * dz;
      const align = !heading ? 0 : d2 === 0 ? Infinity : (dx * hx + dz * hz) / Math.hypot(dx, dz);
      list.push([dx, dz, d2, align]);
    }
  }
  list.sort((a, b) => a[2] - b[2] || b[3] - a[3] || Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]));
  return list;
};

export function createChunkGrid({ size, radius, inFlight = 8, hysteresis = 1 }) {
  const cache = new Map(); // 'cx,cz,r,hx,hz' → Key[]
  let centre = null; // [cx, cz] of the last update

  const within = (key, r) => {
    if (!centre) return false;
    const [x, z] = parse(key);
    return Math.max(Math.abs(x - centre[0]), Math.abs(z - centre[1])) <= r;
  };

  const grid = {
    loaded: new Set(),
    flying: new Map(), // key → gen
    gen: 0,
    radius,
    size,

    cellOf(x, z) {
      return [Math.floor(x / grid.size), Math.floor(z / grid.size)];
    },

    cells(x, z, { radius: r = grid.radius, heading = null } = {}) {
      const [cx, cz] = grid.cellOf(x, z);
      const id = `${cx},${cz},${r},${heading ? `${heading[0]},${heading[1]}` : '-'}`;
      let keys = cache.get(id);
      if (keys) return keys;
      keys = ordering(r, heading).map(([dx, dz]) => keyOf(cx + dx, cz + dz));
      if (cache.size >= 64) cache.clear();
      cache.set(id, keys);
      return keys;
    },

    update({ x, z, heading = null, radius: r }) {
      if (r !== undefined) grid.radius = r;
      centre = grid.cellOf(x, z);
      const cancel = [];
      for (const key of grid.flying.keys()) {
        if (!within(key, grid.radius)) cancel.push(key);
      }
      for (const key of cancel) grid.flying.delete(key);
      const drop = [];
      for (const key of grid.loaded) {
        if (!within(key, grid.radius + hysteresis)) drop.push(key);
      }
      for (const key of drop) grid.loaded.delete(key);
      const ask = [];
      const room = Math.max(0, inFlight - grid.flying.size);
      if (room > 0) {
        for (const key of grid.cells(x, z, { heading })) {
          if (grid.loaded.has(key) || grid.flying.has(key)) continue;
          ask.push(key);
          if (ask.length >= room) break;
        }
      }
      return { ask, drop, cancel };
    },

    began(key, gen = grid.gen) {
      grid.flying.set(key, gen);
    },

    done(key, gen) {
      const ours = grid.flying.get(key) === gen;
      if (ours && gen === grid.gen && within(key, grid.radius)) {
        grid.flying.delete(key);
        grid.loaded.add(key);
        return true;
      }
      if (ours) grid.flying.delete(key);
      return false;
    },

    failed(key, gen) {
      if (gen === undefined || grid.flying.get(key) === gen) grid.flying.delete(key);
    },

    unload(key) {
      grid.loaded.delete(key);
    },

    reset(gen = grid.gen + 1) {
      const drop = [...grid.loaded];
      const cancel = [...grid.flying.keys()];
      grid.loaded.clear();
      grid.flying.clear();
      grid.gen = gen;
      return { drop, cancel };
    },
  };
  return grid;
}
