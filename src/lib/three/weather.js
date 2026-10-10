// The weather and the hour, after Bruno Simon's folio-2025 (Weather.js,
// Cycles/DayCycles.js, Cycles/YearCycles.js; his numbers are quoted in
// docs/research/2026-10-08-folio-2025-physics-terrain-streaming.md part 2
// §6 and docs/research/2026-10-08-folio-2025-assets-foliage-and-quaternius-
// packs.md §2, and were read again from his source). No sky, no rain drawn
// here: one pure clock that any world wanting a day can read, so the wind,
// the leaves and, later, the rain and the snow all agree about what it's
// doing.
//
// His weather is sines, not a noise picture: his noise(x) = sin(x)·
// sin(1.678x)·sin(2.345x), read on a clock counted in days (t = seconds /
// day; a day is four minutes). Temperature is the season's plus the hour's
// plus 7.5 of noise(0.4t); humidity the season's plus 0.2 of noise(0.36t);
// the electric field the hour's times noise(0.53t); clouds noise(0.44t);
// wind half of noise(t) plus a half. Rain is wet air under cloud, snow is
// that rain when it's freezing (and below nought, the thaw). They are
// worked out in that order, each taking any override before the next one
// reads it, so holding rain at 1 brings snow with it on a cold night. The
// hour is his keyframes (day, dusk, night, dawn), smoothstepped between
// stops; the season his year of winter, spring, summer and fall, 365 days
// on the same clock.
//
//   createWeather({ day = 240, seed = 0, year = 365 days }) → {
//     at(nowSeconds, out?) → { temperature, humidity, electric, clouds, wind,
//       rain, snow, dayProgress, lightColour, lightIntensity, shadowColour,
//       fogA, fogB, fogNear, fogFar, leaves },
//     override(values, { duration = 5, now }), release({ duration = 5, now }) }
//   windOf(weather) → { strength }   for lib/three/wind's createWind set()
//   leavesOf(weather) → { ratio }    his leaf count over his most: a share of a world's budget
//   noise(x), remapClamp(v, inLow, inHigh, outLow, outHigh)   his, as he wrote them
//   RANGES { key: [low, high] }      where each output stays, untouched by an override
//
// `nowSeconds` is any clock in seconds; Date.now() / 1000 is his, so every
// visitor has the same hour and the same weather. at() fills `out` when
// given one (its colour arrays too), for a frame that would rather not make
// a new object. `seed` moves only the weather, never the hour: it shifts
// the sines' clock by seed × 1000 days, so two worlds on the same hour can
// have different skies. Keep it a small integer (0, 1, 2 …): a large one
// pushes t so far out that it steps at a double's precision and the sines
// stutter. Colours are linear [r, g, b] (his sRGB hex made
// linear, as THREE.Color does, and mixed there, as lerpColors does): new
// THREE.Color().fromArray(c) takes one. `electric` is his electricField;
// `fogNear`/`fogFar` his fog ratios.
//
// The ranges are where the sums can go, not clamps (his min and max were a
// debug panel's): temperature −10 to 37.5 °C, humidity 0.3 to 1, electric
// and clouds −1 to 1, snow −1 (thawing) to 1. An override is his: values
// for any outputs, held at full after `duration` seconds and eased out
// (power1.out) from wherever the hold stood, on the clock at() was last
// read at unless `now` is given (asked for before at() was ever read, on
// the next one); release() lets go the same way, from wherever the hold has
// got to, over 5 s unless told, as his end(duration = 5) does, however long
// the override took. A new override replaces the old one's values at once,
// as his did.
//
// galaxy/surface/weather.js also exports a createWeather (the particles in
// the air); a file that needs both imports this one as another name.

const DAY = 240; // seconds: his four-minute day
const YEAR = 365 * 24 * 60 * 60; // seconds: his year is the calendar's
const SEED_SHIFT = 1000; // days the weather's clock moves for each unit of seed

export const RANGES = Object.freeze({
  temperature: [-10, 37.5],
  humidity: [0.3, 1],
  electric: [-1, 1],
  clouds: [-1, 1],
  wind: [0, 1],
  rain: [0, 1],
  snow: [-1, 1],
  dayProgress: [0, 1],
  lightIntensity: [1.2, 3.8],
  fogNear: [-0.85, 0.315],
  fogFar: [1, 1.25],
  leaves: [0, 1],
});

const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));
const remap = (v, inLow, inHigh, outLow, outHigh) => ((v - inLow) * (outHigh - outLow)) / (inHigh - inLow) + outLow;
const lerp = (a, b, k) => (1 - k) * a + k * b;
const smoothstep = (v, min, max) => {
  const x = clamp((v - min) / (max - min), 0, 1);
  return x * x * (3 - 2 * x);
};
const mod1 = (x) => ((x % 1) + 1) % 1;

export const noise = (x) => Math.sin(x) * Math.sin(x * 1.678) * Math.sin(x * 2.345);

export function remapClamp(v, inLow, inHigh, outLow, outHigh) {
  return clamp(remap(v, inLow, inHigh, outLow, outHigh), Math.min(outLow, outHigh), Math.max(outLow, outHigh));
}

// his sRGB hex, made linear as THREE.Color makes it (ColorManagement's SRGBToLinear)
const linear = (hex) =>
  [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map((c) => {
    const v = c / 255;
    return v < 0.04045 ? v * 0.0773993808 : Math.pow(v * 0.9478672986 + 0.0521327014, 2.4);
  });

// his DayCycles presets (reveal colours left behind: there's no reveal here)
const hour = (light, lightIntensity, shadow, fogA, fogB, fogNear, fogFar, temperature, electric) => ({
  lightColour: linear(light),
  lightIntensity,
  shadowColour: linear(shadow),
  fogA: linear(fogA),
  fogB: linear(fogB),
  fogNear,
  fogFar,
  temperature,
  electric,
});
const DAYTIME = hour(0xffd2c2, 1.2, 0x6d3fff, 0x00ffff, 0x9b89ff, 0.315, 1.25, 5, 0);
const DUSK = hour(0xff8181, 1.2, 0x4e009c, 0x3e53ff, 0xff4ce4, 0, 1.25, 0, 0.25);
const NIGHT = hour(0x3240ff, 3.8, 0x2f00db, 0x10266f, 0x490a42, -0.85, 1, -7.5, 1);
const DAWN = hour(0xffa882, 1.2, 0xdb004f, 0xf885ff, 0xff7d24, 0.3, 1.25, 0, 0.25);
// his stops, with the step his Cycles adds to close the loop
const DAY_STEPS = [
  [0, DAYTIME],
  [0.15, DAYTIME],
  [0.25, DUSK],
  [0.35, NIGHT],
  [0.6, NIGHT],
  [0.8, DAWN],
  [0.9, DAYTIME],
  [1, DAYTIME],
];
const COLOURS = ['lightColour', 'shadowColour', 'fogA', 'fogB'];
const NUMBERS = ['lightIntensity', 'fogNear', 'fogFar'];

// his YearCycles presets, a season's middle an eighth in, wrapped both ways
const WINTER = { leaves: 0.25, temperature: 5, humidity: 0.8 };
const SPRING = { leaves: 0, temperature: 15, humidity: 0.65 };
const SUMMER = { leaves: 0.25, temperature: 25, humidity: 0.5 };
const FALL = { leaves: 1, temperature: 15, humidity: 0.65 };
const YEAR_STEPS = [
  [-0.125, FALL],
  [0.125, WINTER],
  [0.375, SPRING],
  [0.625, SUMMER],
  [0.875, FALL],
  [1.125, WINTER],
];

// the two steps either side of `p`, and how far between them (smoothstepped)
function between(steps, p) {
  let i = 0;
  while (i < steps.length - 2 && steps[i + 1][0] <= p) i++;
  const [s0, a] = steps[i];
  const [s1, b] = steps[i + 1];
  return [a, b, smoothstep(p, s0, s1)];
}

const mixInto = (a, b, k, into) => {
  for (let c = 0; c < 3; c++) into[c] = lerp(a[c], b[c], k);
  return into;
};

export function createWeather({ day = DAY, seed = 0, year = YEAR } = {}) {
  let last; // the clock at() was last read at
  let held = {}; // the override's values
  let ramp = { from: 0, to: 0, t0: 0, duration: 0 }; // its strength over time

  // gsap's default ease, power1.out, from wherever it stood. A ramp asked
  // for before the clock was read starts on the next at(), from wherever
  // the one before it has got to by then.
  const strengthOf = (r, now) => {
    if (r.t0 == null) {
      r.t0 = now;
      if (r.before) r.from = strengthOf(r.before, now);
      r.before = null;
    }
    const p = r.duration > 0 ? clamp((now - r.t0) / r.duration, 0, 1) : 1;
    return p >= 1 ? r.to : r.from + (r.to - r.from) * (1 - (1 - p) * (1 - p));
  };
  const strength = (now) => strengthOf(ramp, now);
  const towards = (to, duration, now) => {
    ramp = now == null ? { before: ramp, from: 0, to, t0: null, duration } : { from: strength(now), to, t0: now, duration };
  };

  return {
    at(now, out = {}) {
      last = now;
      const s = strength(now);
      const pick = (key, v) => {
        const o = s > 0 ? held[key] : null;
        if (o == null) return v; // (null, as his, is "not overridden")
        return Array.isArray(v) ? mixInto(v, o, s, v) : lerp(v, o, s);
      };

      // the hour
      out.dayProgress = pick('dayProgress', mod1(now / day));
      const [a, b, k] = between(DAY_STEPS, out.dayProgress);
      for (const key of COLOURS) {
        const into = Array.isArray(out[key]) ? out[key] : (out[key] = [0, 0, 0]);
        out[key] = pick(key, mixInto(a[key], b[key], k, into));
      }
      for (const key of NUMBERS) out[key] = pick(key, lerp(a[key], b[key], k));

      // the season
      const [ya, yb, yk] = between(YEAR_STEPS, mod1(now / year));
      out.leaves = pick('leaves', lerp(ya.leaves, yb.leaves, yk));

      // the weather, in his order, on his clock (in days) moved by the seed
      const t = now / day + seed * SEED_SHIFT;
      const warmth = lerp(ya.temperature, yb.temperature, yk) + lerp(a.temperature, b.temperature, k);
      out.temperature = pick('temperature', warmth + noise(t * 0.4) * 7.5);
      out.humidity = pick('humidity', lerp(ya.humidity, yb.humidity, yk) + noise(t * 0.36) * 0.2);
      out.electric = pick('electric', lerp(a.electric, b.electric, k) * noise(t * 0.53));
      out.clouds = pick('clouds', noise(t * 0.44));
      out.wind = pick('wind', noise(t) * 0.5 + 0.5);
      out.rain = pick('rain', remapClamp(out.humidity, 0.65, 1, 0, 1) * remapClamp(out.clouds, 0, 1, 0, 1));
      const rainRatio = remapClamp(out.rain, 0.05, 0.3, 0, 1);
      const freeze = remapClamp(out.temperature, 0, -5, 0, 1);
      const melt = remapClamp(out.temperature, 0, 10, 0, -1);
      out.snow = pick('snow', rainRatio * freeze + melt);
      return out;
    },
    override(values = {}, { duration = 5, now = last } = {}) {
      held = { ...values };
      towards(1, duration, now);
    },
    release({ duration = 5, now = last } = {}) {
      towards(0, duration, now);
    },
  };
}

// his Wind.js: a calm still breathes at a tenth
export function windOf(weather) {
  return { strength: remapClamp(weather.wind, 0, 1, 0.1, 1) };
}

// his Leaves.js count, 2^round(remap(leaves, 0.25, 1, 7, 11)), over his most
// (2048): a share of a world's `leaves` budget, never more than all of it
export function leavesOf(weather) {
  return { ratio: Math.min(1, 2 ** (Math.round(remap(weather.leaves, 0.25, 1, 7, 11)) - 11)) };
}
