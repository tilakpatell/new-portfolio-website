// The showroom's sums (showroom.js draws; these are tested in Node): how far
// back the camera stands for the canvas's shape, the hardpoint's pulse, and
// how far a drag turns the ship.

export const FPS = 30; // (the yard's a still life: no need to draw faster)
const MARGIN = 1.8; // (room round the ship, so a wing or a booster isn't cut as it turns)
const PULSE = 1.2; // seconds a pulse takes, up and back
const TURN = 0.012; // radians a pixel of drag turns it

// The distance at which a ship `length` long fits a canvas of this aspect
// (width / height) under a vertical field of view of `fov` degrees: a tall
// canvas fits it on its width, so the camera backs off.
export function fitDistance(aspect, length, fov) {
  const half = Math.tan(((fov / 2) * Math.PI) / 180);
  return (length * MARGIN) / (2 * half * Math.min(1, aspect));
}

// The pulse on a hardpoint pointed at: 0 at rest, up to 1 and back, 0…1.
export const pulseAt = (t) => 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / PULSE);

export const yawFromDrag = (dx) => dx * TURN;

// A copy of a part's material for the pulse to light: three's clone leaves
// out the livery's shader hook (livery.js paints in onBeforeCompile), which
// would show the part in the factory's colours while it's pointed at.
export function glowCopy(material) {
  const c = material.clone();
  c.onBeforeCompile = material.onBeforeCompile;
  c.customProgramCacheKey = material.customProgramCacheKey;
  return c;
}

// The real ship to put over the stand-in, as the map and the galaxy do: an
// iconic ship's own model (shipModels.js's SHIP_MODELS, given as `models`),
// the cruiser's own build, or nothing for a garage build (whole as it is).
export function heroOf(kind, build, models) {
  if (build) return null;
  if (models[kind]) return { glb: models[kind] };
  return kind === 'cruiser' ? { cruiser: true } : null;
}

// The fling (the game-feel design's one item for the showroom): a drag let
// go while it's moving keeps the ship turning, slowing as a turntable on a
// bearing would, and a new grab stops it. The drag's speed is eased over its
// last few moves, so one jittery event doesn't throw it; a drag held still
// before it's let go (FLING.still) stays put. Radians a second.
//
//   createFling() → { track(dYaw, dt), release(since) → v, coast(dt) → dYaw,
//     grab(), moving }
export const FLING = { decay: 2.5, min: 0.05, max: 6, still: 0.08, ease: 20 };

export function createFling() {
  let seen = 0; // the drag's speed, eased
  let v = 0; // the coast's
  return {
    track(dYaw, dt) {
      if (!(dt > 0) || !Number.isFinite(dYaw)) return;
      seen += (dYaw / dt - seen) * (1 - Math.exp(-FLING.ease * dt));
    },
    release(since = 0) {
      const at = since > FLING.still ? 0 : Math.max(-FLING.max, Math.min(FLING.max, seen));
      seen = 0;
      v = Math.abs(at) < FLING.min ? 0 : at;
      return v;
    },
    coast(dt) {
      if (!v || !(dt > 0)) return 0;
      const d = v * dt;
      v *= Math.exp(-FLING.decay * dt);
      if (Math.abs(v) < FLING.min) v = 0;
      return d;
    },
    grab() {
      seen = 0;
      v = 0;
    },
    get moving() {
      return v !== 0;
    },
  };
}
