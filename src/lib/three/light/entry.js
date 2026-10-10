// One weather's light, read into the plain numbers this folder draws with.
//
// The input is lane G's entry for a level and weather. Its derived shape is
// `siteLightFrom(entry)` in src/lib/three/gameLight.js (the bf2017 levels
// design): { sky: { zenith, horizon, haze, hazeColor, suns: [{ az, el,
// color }] }, light: { sun, second, sky, ground, ambient }, fog: { color,
// density }, exposure, bloom, wind }. Beside it the entry may carry the
// VisualEnvironment record's own fields under `record` (OutdoorLight, Sky,
// Fog, Tonemap, ColorCorrection, DynamicAO), named as the game names them;
// where it does, they win, since they are what the derived shape was made
// from. Anything missing falls back to a named default, so a world with no
// record still lights.
//
// siteLightFrom is not on main yet (lane G waits on the bucket's keys), so
// this reader takes either shape and pins both in its test.
//
// readEntry(entry) → { sun, ambient, sky, fog, shadow, exposure, bloom, ao, grade }
// lerpEntry(a, b, t) → the same shape, a weather crossfade at t in 0…1

// Earth's sea-level scattering, per metre: the Rayleigh coefficients for
// 680, 550 and 440 nm, and a clear day's Mie (the record's own replace them)
export const RAYLEIGH = [5.8e-6, 13.5e-6, 33.1e-6];
export const MIE = 21e-6;
export const MIE_G = 0.76; // the forward lobe of a hazy sky
export const SUN = { dir: [0.4, 0.75, 0.3], color: [1, 0.96, 0.9], intensity: 3 };
export const AMBIENT = { sky: [0.55, 0.65, 0.8], ground: [0.3, 0.27, 0.24], intensity: 0.6 };
export const FOG = { color: [0.7, 0.75, 0.82], density: 0.0012, heightBase: 0, heightFalloff: 0 };
// GTAO's own defaults stand in for HBAO's when a record has none
export const AO = { radius: 0.25, bias: 0, power: 1 };

const rgb = (c, fallback) => {
  if (Array.isArray(c) && c.length >= 3) return [c[0], c[1], c[2]].map(Number);
  if (c && typeof c === 'object' && 'r' in c) return [c.r, c.g, c.b].map(Number);
  if (c && typeof c === 'object' && 'x' in c) return [c.x, c.y, c.z].map(Number);
  if (typeof c === 'number' && Number.isFinite(c)) return [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
  if (typeof c === 'string' && /^#?[0-9a-f]{6}$/i.test(c)) return rgb(parseInt(c.replace('#', ''), 16));
  return fallback.slice();
};
const num = (v, fallback) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : fallback);
const unit = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return v.map((c) => c / l);
};

// a sun's azimuth and elevation (degrees; azimuth from +Z toward +X) as the
// direction toward it
export function sunDir(az, el) {
  const a = (az * Math.PI) / 180;
  const e = (el * Math.PI) / 180;
  return [Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)];
}

export function readEntry(entry = {}) {
  const e = entry ?? {};
  const r = e.record ?? {};
  const outdoor = r.OutdoorLight ?? {};
  const skyRec = r.Sky ?? {};
  const fogRec = r.Fog ?? {};
  const tone = r.Tonemap ?? {};
  const grade = r.ColorCorrection ?? {};
  const aoRec = r.DynamicAO ?? {};

  const s0 = e.sky?.suns?.[0];
  const sunLight = e.light?.sun;
  const sun = {
    dir: unit(outdoor.SunDirection ? rgb(outdoor.SunDirection, SUN.dir) : s0 ? sunDir(num(s0.az, 0), num(s0.el, 45)) : SUN.dir),
    color: rgb(outdoor.SunColor ?? sunLight?.color ?? s0?.color, SUN.color),
    intensity: num(typeof sunLight === 'number' ? sunLight : sunLight?.intensity, SUN.intensity),
  };
  const lightSky = e.light?.sky;
  const lightGround = e.light?.ground;
  const ambient = {
    sky: rgb(outdoor.SkyColor ?? lightSky?.color ?? lightSky, AMBIENT.sky),
    ground: rgb(outdoor.GroundColor ?? lightGround?.color ?? lightGround, AMBIENT.ground),
    intensity: num(typeof e.light?.ambient === 'number' ? e.light.ambient : e.light?.ambient?.intensity, AMBIENT.intensity),
  };
  const sky = {
    rayleigh: rgb(skyRec.RayleighCoefficient, RAYLEIGH),
    mie: num(skyRec.MieCoefficient, MIE),
    mieG: num(skyRec.MieScatteringG ?? skyRec.MieG, MIE_G),
    zenith: rgb(e.sky?.zenith, [0.24, 0.42, 0.78]),
    horizon: rgb(e.sky?.horizon, [0.7, 0.78, 0.88]),
    cloud: rgb(skyRec.CloudLayer1Color ?? e.sky?.hazeColor, [1, 1, 1]),
    cover: num(skyRec.CloudLayerCover ?? e.sky?.haze, 0),
    ground: ambient.ground.slice(),
  };
  // (the record's curve is [[distance m, 0…1], …]; the derived shape has a
  // density only, which is exponential fog)
  const curve = Array.isArray(fogRec.Curve) && fogRec.Curve.length >= 2 ? fogRec.Curve.map(([d, f]) => [Number(d), Number(f)]) : null;
  const fog = {
    color: rgb(fogRec.FogColor ?? e.fog?.color, FOG.color),
    start: num(fogRec.FogStart ?? e.fog?.start, null),
    end: num(fogRec.FogEnd ?? e.fog?.end, null),
    density: num(e.fog?.density, FOG.density),
    curve,
    heightBase: num(fogRec.HeightFogBase ?? e.fog?.heightBase, FOG.heightBase),
    heightFalloff: num(fogRec.HeightFogFalloff ?? e.fog?.heightFalloff, FOG.heightFalloff),
  };
  const shadow = {
    mapSize: num(outdoor.ShadowMapResolution ?? e.shadow?.mapSize, 2048),
    bias: num(outdoor.ShadowDepthBias ?? e.shadow?.bias, -0.0004),
    normalBias: num(outdoor.ShadowNormalBias ?? e.shadow?.normalBias, 0.02),
    far: num(outdoor.ShadowDistance ?? e.shadow?.far, null),
  };
  return {
    sun,
    ambient,
    sky,
    fog,
    shadow,
    exposure: num(e.exposure ?? (tone.ExposureCompensation != null ? 2 ** tone.ExposureCompensation : null), 1),
    bloom: { scale: num(tone.BloomScale ?? (typeof e.bloom === 'number' ? e.bloom : e.bloom?.scale), 1) },
    ao: {
      radius: num(aoRec.HbaoRadius, AO.radius),
      bias: num(aoRec.HbaoAngleBias, AO.bias),
      power: num(aoRec.HbaoPowerExponent, AO.power),
    },
    grade: { maxHdr: num(grade.ColorGradingMaxHdrValue, 1), lut: e.lut ?? null },
    gameToSite: num(e.gameToSite, 1),
  };
}

const mix = (a, b, t) => a + (b - a) * t;
const mixArr = (a, b, t) => a.map((v, i) => mix(v, b[i], t));

// Every number eased from a to b; what cannot be blended (the fog's curve,
// the LUT) is b's from the start of the crossfade, a's before it.
export function lerpEntry(a, b, t) {
  const k = Math.min(1, Math.max(0, t));
  const walk = (x, y) => {
    if (Array.isArray(x) && Array.isArray(y) && x.length === y.length && x.every((v) => typeof v === 'number')) return mixArr(x, y, k);
    if (typeof x === 'number' && typeof y === 'number') return mix(x, y, k);
    if (x && y && typeof x === 'object' && typeof y === 'object' && !Array.isArray(x) && !x.isTexture) {
      const out = {};
      for (const key of Object.keys(y)) out[key] = walk(x[key], y[key]);
      return out;
    }
    return k > 0 ? y : x;
  };
  const out = walk(a, b);
  out.sun.dir = unit(out.sun.dir);
  return out;
}
