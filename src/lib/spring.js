// Springs for secondary motion (docs/superpowers/specs/2026-10-08-game-feel-
// design.md §1): a lean, a landing’s squash, an antenna, the bank of a ride.
// A sine or a first-order lag only follows; a spring overshoots and rings
// back, which is what reads as weight. Pure: a scene steps it and puts its x
// on a mesh.
//
// The step is semi-implicit Euler (the velocity first, then the place with
// the new velocity): stable from 1/120 s to 1/30 s for k up to 300 at the
// dampings the site uses, where the explicit step gains energy and blows up.
//
//   springStep(x, v, target, k, c, dt) → [x, v]
//   createSpring({ k = 120, c = 8, max = Infinity, dims = 1, x = 0 })
//     → { x (settable), v (numbers, or arrays of `dims`), kick(dv), target(t),
//         step(dt) → x, reset(), set({ k, c, max }), values() }
//   springGroups(spring, name) → the ?debug panel’s groups (lib/debugPanel)

export function springStep(x, v, target, k, c, dt) {
  const nv = v + (-k * (x - target) - c * v) * dt;
  return [x + nv * dt, nv];
}

const fin = (v) => Number.isFinite(v);

export function createSpring({ k = 120, c = 8, max = Infinity, dims = 1, x = 0 } = {}) {
  const o = { k, c, max };
  const n = Math.max(1, dims | 0);
  const x0 = Array.from({ length: n }, (_, i) => (Array.isArray(x) ? x[i] ?? 0 : x));
  const xs = [...x0];
  const vs = new Array(n).fill(0);
  const to = new Array(n).fill(0);
  // a number for one dimension, the array for more (a fresh one each read)
  const out = (a) => (n === 1 ? a[0] : [...a]);
  // one number for every dimension, or one each
  const each = (val, fn) => {
    for (let i = 0; i < n; i++) {
      const d = Array.isArray(val) ? val[i] : val;
      if (fin(d)) fn(i, d);
    }
  };
  return {
    get x() {
      return out(xs);
    },
    // set at once (a landing’s squash): it rings back from there
    set x(val) {
      each(val, (i, d) => (xs[i] = d));
    },
    get v() {
      return out(vs);
    },
    kick(dv) {
      each(dv, (i, d) => (vs[i] += d));
    },
    target(t) {
      each(t, (i, d) => (to[i] = d));
    },
    step(dt) {
      const h = fin(dt) && dt > 0 ? dt : 0;
      for (let i = 0; i < n && h > 0; i++) {
        const [nx, nv] = springStep(xs[i], vs[i], to[i], o.k, o.c, h);
        xs[i] = Math.max(-o.max, Math.min(o.max, nx));
        vs[i] = nv;
      }
      return out(xs);
    },
    reset() {
      for (let i = 0; i < n; i++) {
        xs[i] = x0[i];
        vs[i] = 0;
        to[i] = 0;
      }
    },
    set(next = {}) {
      for (const key of Object.keys(o)) if (typeof next[key] === 'number' && !Number.isNaN(next[key])) o[key] = next[key];
    },
    values: () => ({ ...o }),
  };
}

export function springGroups(spring, name) {
  const item = (key, label, min, max, step) => ({ key, label, type: 'range', min, max, step, get: () => spring.values()[key], set: (v) => spring.set({ [key]: v }) });
  const items = [item('k', 'stiffness', 0, 400, 1), item('c', 'damping', 0, 40, 0.1)];
  // (an unclamped spring has no max to slide)
  if (fin(spring.values().max)) items.push(item('max', 'max', 0, 2, 0.01));
  return [{ name, items }];
}
