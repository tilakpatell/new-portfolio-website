// Things on the sea: a boat riding the swell (water.js's `height`, the same
// waves that are drawn), an aiwha's dive from its glide into the sea and out
// again, and the spray thrown up where a wave runs into one of Kamino's
// stilts. Pure: the scene and actors.js set the poses, water.js throws the
// spray.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const TAU = Math.PI * 2;

// Where a floating thing sits and how it leans: the water under its bow,
// stern and sides, less its draft. Pitch and roll as three.js takes them
// ('YXZ', the model facing +z): a negative pitch lifts the bow, a positive
// roll lifts the model's +x side. `height(x, z, t)` is the water's surface.
export function floatPose(height, x, z, yaw, t, { len = 8, beam = 4, draft = 0.5, maxTilt = 0.35 } = {}) {
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  // (the model's +x, in the world)
  const sx = Math.cos(yaw);
  const sz = -Math.sin(yaw);
  const hl = len / 2;
  const hb = beam / 2;
  const bow = height(x + fx * hl, z + fz * hl, t);
  const stern = height(x - fx * hl, z - fz * hl, t);
  const side = height(x + sx * hb, z + sz * hb, t);
  const other = height(x - sx * hb, z - sz * hb, t);
  return {
    y: (bow + stern + side + other) / 4 - draft,
    pitch: clamp(-Math.atan2(bow - stern, len), -maxTilt, maxTilt),
    roll: clamp(Math.atan2(side - other, beam), -maxTilt, maxTilt),
  };
}

// An aiwha's height over the water at time t: a long glide `high` up (a
// slow rise and fall in it), then once every `every` seconds a dive, down
// through the surface to `low` and back up, taking the `down` part of the
// cycle. `offset` (0–1) puts each on its own beat. Its pitch follows its
// climb (positive: the nose down), at `speed` m/s along its way.
export function diveAt(t, offset = 0, { high = 70, low = -3, every = 40, down = 0.22, speed = 9 } = {}) {
  const y = (p) => {
    if (p < down)
      return high + (low - high) * (0.5 - 0.5 * Math.cos((p / down) * TAU));
    return high + 1.5 * Math.sin((Math.PI * (p - down)) / (1 - down));
  };
  const phase = (t / every + offset) % 1;
  const h = 0.02 / every; // (a fiftieth of a second, in the cycle)
  const now = y(phase);
  const climb = (y((phase + h) % 1) - now) / 0.02;
  return { y: now, pitch: Math.atan2(-climb, speed) };
}

// How much spray (0–1) a wave throws off a leg: where the water there is
// running up the leg fast (from `before` to `now` in `dt`), and high on it.
export function sprayAt(now, before, dt, { level = 0, lift = 0.5, rise = 4 } = {}) {
  const rate = (now - before) / Math.max(dt, 1e-3);
  if (rate <= 0) return 0;
  return clamp((now - level - lift) / 1.5, 0, 1) * clamp(rate / rise, 0, 1);
}
