// Minecraft, the day: 24000 ticks (20 minutes), sunrise at 0, noon at 6000,
// sunset at 12000, midnight at 18000, by the game's own sums (World and
// EntityRenderer in 1.12):
//
// - celestial(t): how far round the sky has turned, 0 at noon; the game
//   eases it, so the sun lingers a little at the top and the bottom.
// - skyDarken(t): how many of the sky's 15 light levels the hour takes away,
//   0 by day to 11 at night (the night floor is 4); daylight(t) the share
//   left, which the shader multiplies every cell's sky light by.
// - skyColours(t, biome sky, render distance): the sky and the fog's colour
//   (the game's pale blue drawn toward the sky by the render distance), both
//   dimmed by the hour; sunrise(t) the orange glow low toward the sun at the
//   two ends of the day; starBrightness(t); moonPhase(t), 0 full to 7.

export const DAY = 24000;

export function celestial(t) {
  let f = (((t % DAY) + DAY) % DAY) / DAY - 0.25;
  if (f < 0) f += 1;
  if (f > 1) f -= 1;
  const eased = 1 - (Math.cos(f * Math.PI) + 1) / 2;
  return f + (eased - f) / 3;
}

const clamp = (v) => Math.max(0, Math.min(1, v));
const sunHeight = (t) => Math.cos(celestial(t) * Math.PI * 2);

export const skyDarken = (t) => Math.floor(clamp(1 - (sunHeight(t) * 2 + 0.5)) * 11);
export const daylight = (t) => (15 - skyDarken(t)) / 15;
export const moonPhase = (t) => ((Math.floor(t / DAY) % 8) + 8) % 8;
export const sunAngle = (t) => celestial(t) * Math.PI * 2;

export function skyColours(t, sky, distance = 10) {
  const f = clamp(sunHeight(t) * 2 + 0.5);
  const s = sky.map((c) => c * f);
  const base = [0.7529412 * (f * 0.94 + 0.06), 0.84705883 * (f * 0.94 + 0.06), 1 * (f * 0.91 + 0.09)];
  const k = 1 - Math.pow(0.25 + (0.75 * distance) / 32, 0.25);
  return { sky: s, fog: base.map((c, i) => c + (s[i] - c) * k) };
}

export function starBrightness(t) {
  const f = clamp(1 - (sunHeight(t) * 2 + 0.25));
  return f * f * 0.5;
}

// [r, g, b, strength] while the sun is within the band round the horizon, else null
export function sunrise(t) {
  const h = sunHeight(t);
  if (h < -0.4 || h > 0.4) return null;
  const f = (h / 0.4) * 0.5 + 0.5;
  let a = 1 - (1 - Math.sin(f * Math.PI)) * 0.99;
  a *= a;
  return [f * 0.3 + 0.7, f * f * 0.7 + 0.2, 0.2, a];
}

// The sun's brightness as the light uses it: 1 by day, the game's 0.2 at night.
export function sunBrightness(t) {
  const f = clamp(1 - (sunHeight(t) * 2 + 0.2));
  return (1 - f) * 0.8 + 0.2;
}

// The game's lightmap (EntityRenderer.updateLightmap, 1.12): the colour a
// cell's sky and block light give it. The sky's is its brightness curve
// times the sun, blue-grey as the sun goes; the block's is warm (a torch's
// yellow), and the two are added, not the larger taken, then clamped and
// lifted a little off black. The shader does the same sum.
const curve = (l) => {
  const b = l / 15;
  return b / (4 - 3 * b);
};
export function lightmap(sky, block, sun) {
  const f = sun * 0.95 + 0.05;
  const s = curve(sky) * f;
  const bl = curve(block) * 1.5;
  const rgb = [s * (f * 0.65 + 0.35) + bl, s * (f * 0.65 + 0.35) + bl * ((bl * 0.6 + 0.4) * 0.6 + 0.4), s + bl * (bl * bl * 0.6 + 0.4)];
  return rgb.map((c) => Math.round((Math.min(1, c) * 0.96 + 0.03) * 1e6) / 1e6);
}
