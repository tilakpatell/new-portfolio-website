// The bookkeeping for the flight's quadtree leaves, as chunkGrid.js keeps it
// for square cells: which leaves to ask for (in the Map's order, coarse to
// fine, up to `inFlight` at once), which to cancel (flying, no longer
// wanted), which to drop, and a generation so a late answer is refused.
//
// What it adds: a leaf no longer wanted is never dropped while a wanted leaf
// over the same ground is still on its way, and a wanted leaf is not shown
// while a stale one still covers its ground. So when a leaf splits the parent
// stays drawn until all four children are in and they swap in one frame (no
// hole), and the two never draw the same ground at once (no double, the
// depth fight the spec's decision 2 refuses). A stale leaf over no wanted
// ground goes after `keep` updates. A leaf that keeps failing is `block`ed:
// never asked again until a reset, and since it never comes in, the coarser
// leaf over its ground stays drawn instead of a hole.
//
// Pure: keys are quadtree.js's 'd:ix:iz'; the caller makes and frees meshes.
//
//   createLeafStream({ inFlight, keep }) → { update(leaves: Map) → { ask,
//     drop, cancel }, began(key, gen), done(key, gen) → boolean,
//     failed(key, gen), block(key), shows(key) → boolean, reset() → { drop,
//     cancel }, loaded: Set, flying: Map<key, gen>, blocked: Set, gen }

const parse = (key) => key.split(':').map(Number);

// two leaves' squares share ground when the finer one's ancestor at the
// coarser depth is the coarser one
const overlaps = ([d1, x1, z1], [d2, x2, z2]) => {
  if (d1 > d2) return overlaps([d2, x2, z2], [d1, x1, z1]);
  const f = 2 ** (d2 - d1);
  return Math.floor(x2 / f) === x1 && Math.floor(z2 / f) === z1;
};

export function createLeafStream({ inFlight = 6, keep = 2 } = {}) {
  let wanted = new Map();
  const misses = new Map(); // a stale leaf over no wanted ground → updates so
  const cells = new Map(); // key → parsed, for the keys it has seen
  const cell = (key) => {
    let c = cells.get(key);
    if (!c) cells.set(key, (c = parse(key)));
    return c;
  };
  // the loaded leaves no longer wanted, as of the last update (done only
  // ever loads a wanted one, so it holds until the next)
  let stale = [];

  const s = {
    loaded: new Set(),
    flying: new Map(),
    blocked: new Set(),
    gen: 0,

    update(leaves) {
      wanted = leaves;
      const cancel = [];
      for (const key of s.flying.keys()) if (!wanted.has(key)) cancel.push(key);
      for (const key of cancel) s.flying.delete(key);

      const drop = [];
      for (const key of [...s.loaded].filter((k) => !wanted.has(k))) {
        const c = cell(key);
        let over = 0;
        let waiting = false;
        for (const w of wanted.keys()) {
          if (!overlaps(c, cell(w))) continue;
          over++;
          if (!s.loaded.has(w)) {
            waiting = true;
            break;
          }
        }
        if (waiting) {
          misses.delete(key);
          continue;
        }
        const n = over ? keep : (misses.get(key) ?? 0) + 1;
        if (n >= keep) {
          drop.push(key);
          misses.delete(key);
          s.loaded.delete(key);
        } else misses.set(key, n);
      }

      stale = [...s.loaded].filter((k) => !wanted.has(k));
      const ask = [];
      const room = Math.max(0, inFlight - s.flying.size);
      if (room > 0) {
        for (const key of wanted.keys()) {
          if (s.loaded.has(key) || s.flying.has(key) || s.blocked.has(key)) continue;
          ask.push(key);
          if (ask.length >= room) break;
        }
      }
      // keys of leaves long gone needn't stay parsed
      if (cells.size > 4096) cells.clear();
      return { ask, drop, cancel };
    },

    began(key, gen = s.gen) {
      s.flying.set(key, gen);
    },

    done(key, gen) {
      const ours = s.flying.get(key) === gen;
      if (ours) s.flying.delete(key);
      if (!ours || gen !== s.gen || !wanted.has(key)) return false;
      s.loaded.add(key);
      return true;
    },

    failed(key, gen) {
      if (gen === undefined || s.flying.get(key) === gen) s.flying.delete(key);
    },

    block(key) {
      s.blocked.add(key);
      s.flying.delete(key);
    },

    // a loaded leaf is drawn unless it is wanted and a stale leaf still
    // covers its ground (that one is drawn until this one's siblings are in)
    shows(key) {
      if (!s.loaded.has(key)) return false;
      if (!wanted.has(key)) return true;
      const c = cell(key);
      for (const k of stale) if (overlaps(c, cell(k))) return false;
      return true;
    },

    reset() {
      const drop = [...s.loaded];
      const cancel = [...s.flying.keys()];
      s.loaded.clear();
      s.flying.clear();
      misses.clear();
      s.blocked.clear();
      stale = [];
      s.gen++;
      return { drop, cancel };
    },
  };
  return s;
}
