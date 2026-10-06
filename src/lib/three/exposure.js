// An exposure that eases, as an eye or a camera's does: stopped down when a
// sun fills the frame, opened up out in the dark, so turning from the sun
// to deep space the Milky Way lifts over a second or so instead of staying
// dim. It eases up slowly (0.6 a second) and down quickly (2 a second), at
// a steady rate rather than a lerp, so it never creeps; under reduced
// motion it's where it's going at once.
//
// exposureFor({ sunShare, darkShare, last, dt, reduced }) → the next exposure
//   (a multiplier on the scene before the tone map, 0.85…1.25): sunShare,
//   how much of the frame a sun and its glare cover; darkShare, how much is
//   dark sky; last, this frame's; dt, seconds since
// sunShareOf({ ndc, size }) → that share for a sun at `ndc` on the canvas
//   whose disc is `size` half-heights across: its disc and glare (2.5 times
//   the disc) over the frame's area, fading as it goes off the edge

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function exposureFor({ sunShare = 0, darkShare = 0.5, last = 1, dt = 1 / 60, reduced = false } = {}) {
  const target = clamp(1 + 0.25 * darkShare - 0.6 * sunShare, 0.85, 1.25);
  if (reduced) return target;
  const step = (target > last ? 0.6 : 2) * Math.max(0, dt);
  return target > last ? Math.min(target, last + step) : Math.max(target, last - step);
}

export function sunShareOf({ ndc, size }) {
  const edge = Math.max(Math.abs(ndc[0]), Math.abs(ndc[1]));
  const r = size * 2.5;
  // (gone once the whole glare's off the frame)
  const t = clamp((edge - 1) / Math.max(r, 1e-6), 0, 1);
  const k = edge <= 1 ? 1 : 1 - t * t * (3 - 2 * t);
  return clamp(((Math.PI * r * r) / 4) * k, 0, 1);
}
