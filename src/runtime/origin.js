// A floating origin: the positions handed to the renderer are relative to
// it, so they stay small and precise however far the player goes. When
// the player strays more than a cell from it on x or z, it moves by whole
// cells (the nearest, per axis), never on y, and every listener hears the
// shift in the same frame so the world can re-anchor everything at once.
// A position is { x, y, z } or [x, y, z]; `out` takes either, and without
// one a new array comes back. `at` is a copy, so changing it moves nothing.
//
// createOrigin({ cell }) → { at, cell, check(worldPos) → [sx, 0, sz] or
//   null, toLocal(worldPos, out?), toWorld(localPos, out?), on(fn) → undo,
//   reset() }

export const ORIGIN_CELL = 50000;

const read = (p) => (Array.isArray(p) ? p : [p.x, p.y, p.z]);

function write(x, y, z, out) {
  if (!out) return [x, y, z];
  if (Array.isArray(out)) {
    out[0] = x;
    out[1] = y;
    out[2] = z;
  } else {
    out.x = x;
    out.y = y;
    out.z = z;
  }
  return out;
}

export function createOrigin({ cell = ORIGIN_CELL } = {}) {
  const at = [0, 0, 0];
  const listeners = new Set();

  return {
    get at() {
      return at.slice();
    },
    cell,
    check(worldPos) {
      const [x, , z] = read(worldPos);
      const dx = x - at[0];
      const dz = z - at[2];
      if (Math.abs(dx) <= cell && Math.abs(dz) <= cell) return null;
      // + 0 turns a -0 from Math.round(-0.4) into 0.
      const shift = [Math.round(dx / cell) * cell + 0, 0, Math.round(dz / cell) * cell + 0];
      at[0] += shift[0];
      at[2] += shift[2];
      for (const fn of listeners) fn(shift);
      return shift;
    },
    toLocal(worldPos, out) {
      const [x, y, z] = read(worldPos);
      return write(x - at[0], y - at[1], z - at[2], out);
    },
    toWorld(localPos, out) {
      const [x, y, z] = read(localPos);
      return write(x + at[0], y + at[1], z + at[2], out);
    },
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    reset() {
      at[0] = 0;
      at[1] = 0;
      at[2] = 0;
    },
  };
}
