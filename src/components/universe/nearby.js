// What the universe map fetches only once it's near: a planet's own models
// (Optimus and Megatron round Cybertron, the Star Destroyers by the Star
// Wars place, the cruiser round C-137…) and the landings on foot
// (footScene.js). From the home system the fandoms' planets are a few
// pixels across and their models a pixel or two, so they wait until you're
// close to one, or one's in view and big enough on screen that they'd show.
// The front door downloads megabytes less before its first frame, and
// nothing that shows comes later than it's seen.
//
// wanted({ dist, r, inView, focal }) → bool: a place `r` in radius, `dist`
// from the camera, in its frustum or not, through a lens `focal` pixels long.
// focalPx(height, fovDegrees) → that length, for a frame `height` pixels tall.
// createLazy(load, drop) → { want() → Promise<value | null>, value, dispose() }:
// a module (or anything) fetched the first time it's wanted, and once.
// standIn(lazy, { props, methods }) → what answers for it until it's here
// (the scene calls the landing's methods every frame, landed or not): the
// properties `props` names, methods that do nothing (null) unless
// `methods` has its own, and once it's here, it.

export const NEAR = {
  reach: 8, // radii: this close, wanted whichever way the camera's looking
  px: 24, // pixels: a disc this big on screen (its radius), wanted while it's in view
};

export const focalPx = (height, fov) => height / 2 / Math.tan((fov * Math.PI) / 360);

export function wanted({ dist, r, inView, focal }, near = NEAR) {
  if (dist <= r * near.reach) return true;
  return Boolean(inView) && (r / Math.max(dist, 1e-6)) * focal >= near.px;
}

// `drop`: for what arrives after it's been let go (a model to free)
export function createLazy(load, drop = null) {
  let value = null;
  let pending = null;
  let dead = false;
  return {
    want() {
      if (value) return Promise.resolve(value);
      // (asked for now, not a tick later; a throw is a failed fetch too)
      pending ??= new Promise((res) => res(load())).then(
        (v) => {
          if (dead) {
            drop?.(v);
            return null;
          }
          value = v;
          return v;
        },
        () => {
          pending = null; // a dropped connection: try again next time
          return null;
        },
      );
      return pending;
    },
    get value() {
      return value;
    },
    dispose() {
      dead = true;
      value = null;
    },
  };
}

export function standIn(lazy, { props = {}, methods = {} } = {}) {
  const nothing = () => null;
  return new Proxy(
    {},
    {
      get(_, key) {
        const real = lazy.value;
        if (real) {
          const v = real[key];
          return typeof v === 'function' ? v.bind(real) : v;
        }
        if (key in props) return props[key];
        return methods[key] ?? nothing;
      },
    },
  );
}
