// How many scene queries a frame may ask, by kind, so a crowd of brains
// never turns a frame into a thousand rays: each kind has a cap; `take`
// spends one and says whether it was granted; `frame` starts the next
// frame's spend (the refused count is kept one frame for `stats`, the
// debug panel's counter). A caller refused keeps its last answer (the
// spec's rule: a frame over budget degrades to a stale belief, never to a
// figure that sees through a wall). Pure.
//
//   createBudget({ rays = 24, sweeps = 8, overlaps = 4 }) → { take(kind) → bool, frame(),
//     stats() → { [kind]: { used, refused, cap } } }

export function createBudget({ rays = 24, sweeps = 8, overlaps = 4 } = {}) {
  const caps = { rays, sweeps, overlaps };
  const used = { rays: 0, sweeps: 0, overlaps: 0 };
  const refused = { rays: 0, sweeps: 0, overlaps: 0 };
  const last = { rays: 0, sweeps: 0, overlaps: 0 }; // (the frame before's refusals, for stats)
  return {
    take(kind) {
      if (!(kind in caps)) return false;
      if (used[kind] < caps[kind]) {
        used[kind]++;
        return true;
      }
      refused[kind]++;
      return false;
    },
    frame() {
      for (const k in caps) {
        used[k] = 0;
        last[k] = refused[k];
        refused[k] = 0;
      }
    },
    stats() {
      const out = {};
      for (const k in caps) out[k] = { used: used[k], refused: refused[k] || last[k], cap: caps[k] };
      return out;
    },
  };
}
