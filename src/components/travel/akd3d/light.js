// The light in a photo, measured once on a small copy of it, so one photo
// can be graded toward another's time of day. Everything is in linear light
// (the light itself, not the sRGB bytes) and in logs of it, where a change of
// exposure or white balance is a plain shift:
//   mean     the average log colour, per channel
//   lum      the average log brightness
//   spread   how far brightness strays from that (contrast)
//   cdf      for each brightness (as a 0-255 code, Y^(1/2.2)), the share of
//            the photo that is darker: it orders the dissolve so the switch
//            moves through roughly equal areas in equal time
// No three.js here, so it can be tested on its own.

export const EPS = 0.01; // keeps log() finite in the blacks (the shader uses the same)
const CLIP = 4; // the steepest the cdf may get, in multiples of an even spread
const LUMA = [0.2126, 0.7152, 0.0722];
const LIN = Float32Array.from({ length: 256 }, (_, i) => {
  const c = i / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
});

// RGBA bytes (as from getImageData) → { mean, lum, spread, cdf }
export function measure(rgba) {
  const mean = [0, 0, 0];
  const hist = new Uint32Array(256);
  let sum = 0;
  let sq = 0;
  let n = 0;
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    const r = LIN[rgba[i]];
    const g = LIN[rgba[i + 1]];
    const b = LIN[rgba[i + 2]];
    mean[0] += Math.log(r + EPS);
    mean[1] += Math.log(g + EPS);
    mean[2] += Math.log(b + EPS);
    const y = LUMA[0] * r + LUMA[1] * g + LUMA[2] * b;
    const ly = Math.log(y + EPS);
    sum += ly;
    sq += ly * ly;
    hist[Math.min(255, Math.round(255 * y ** (1 / 2.2)))] += 1;
    n += 1;
  }
  if (!n) return { mean: [0, 0, 0], lum: 0, spread: 1, cdf: Uint8Array.from({ length: 256 }, (_, i) => i) };
  const lum = sum / n;
  // Contrast-limited, as in CLAHE: no brightness may own much more than its
  // even share of the switch, so a big flat area (a night sky) can't turn a
  // one-code difference (a compression block) into a big jump in when it
  // switches. What's cut off is spread evenly over every brightness.
  const cap = (n / 256) * CLIP;
  const h = Float64Array.from(hist, (v) => Math.min(v, cap));
  const extra = (n - h.reduce((t, v) => t + v, 0)) / 256;
  // the middle of each bin, so the darkest pixels start just after 0 and the
  // brightest finish just before 1
  const cdf = new Uint8Array(256);
  let below = 0;
  for (let k = 0; k < 256; k++) {
    const v = h[k] + extra;
    cdf[k] = Math.round((255 * (below + v / 2)) / n);
    below += v;
  }
  return { mean: mean.map((m) => m / n), lum, spread: Math.sqrt(Math.max(0, sq / n - lum * lum)), cdf };
}

const STOP = Math.LN2; // one photographic stop, in natural-log units
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// How to grade photo a toward photo b's light: an exposure shift, a contrast
// change about a's own middle brightness, and a white-balance tint, each held
// to a believable range so a night photo pushed toward noon doesn't blow out
// and a noon photo pushed toward night keeps some shape
export function toneBetween(a, b) {
  const exposure = clamp(b.lum - a.lum, -3 * STOP, 1.5 * STOP);
  const tint = [0, 1, 2].map((c) => clamp(b.mean[c] - b.lum - (a.mean[c] - a.lum), -0.5 * STOP, 0.5 * STOP));
  const contrast = clamp(b.spread / Math.max(a.spread, 1e-3), 0.7, 1.4);
  return { exposure, pivot: a.lum, contrast, tint };
}

// Statistics part way from a to b (for a frame frozen in the middle of a cut)
export function lerpStats(a, b, t) {
  const m = (x, y) => x + (y - x) * t;
  return { mean: a.mean.map((v, i) => m(v, b.mean[i])), lum: m(a.lum, b.lum), spread: m(a.spread, b.spread) };
}
