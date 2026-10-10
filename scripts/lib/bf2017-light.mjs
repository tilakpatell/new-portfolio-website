// The game's light records, read for the site. Pure: the CLI
// (scripts/bf2017-light.mjs) fetches, these read.
//
// A level's map names its VisualEnvironment records in sky[]; the map's
// extras.json carries each one's components already flattened
// ({ OutdoorLightComponentData: [ {…} ], … }). The level's light is in its
// VE_Sky_ and VE_PV_ records (the main sky and the weathers or zones the
// game blends over it); the high-end switch, spot meters, death screens and
// the like are not, and are skipped.

const base = (name) => String(name).split('/').pop();
// (a moment of a match, an intro or an objective's, is not the level's light)
const isLight = (n) => /^VE_(Sky|PV)_/.test(base(n)) && !/_(intro\w*|outro\w*|obj\d+)(_|$)/i.test(base(n));

// The weather a record is for: a word of its name, else its folder under
// Levels/Lighting/<World>/ ('Sunny_01' → 'sunny'); a room's (interior,
// caves, a hangar) is 'interior'. null when neither says.
const WEATHERS = ['night', 'sunset', 'dusk', 'dawn', 'foggy', 'cloudy', 'overcast', 'stormy', 'blizzard', 'sunny'];
export function weatherKey(name) {
  const words = base(name).toLowerCase().split('_');
  if (words.some((w) => /^(interiors?|caves|hangar)$/.test(w))) return 'interior';
  const named = WEATHERS.find((w) => words.includes(w));
  if (named) return named;
  const parts = String(name).split('/');
  const i = parts.findIndex((p) => p.toLowerCase() === 'lighting');
  if (i < 0 || parts.length < i + 4) return null;
  return parts[i + 2].toLowerCase().replace(/_\d+$/, '');
}

// The main sky and the rest: a VE_Sky_ out of doors (a day's first), else
// the first weather that is a day (sunny, then cloudy, overcast, foggy,
// stormy), else the first out of doors; the others over it, one a weather (the first of
// each; a night's room after a day's).
const DAY = ['sunny', 'cloudy', 'overcast', 'foggy', 'stormy', 'blizzard'];
export function pickEntries(skyNames) {
  const names = (Array.isArray(skyNames) ? skyNames : []).filter(isLight);
  const outdoor = names.filter((n) => weatherKey(n) !== 'interior');
  const sky = outdoor.filter((n) => base(n).startsWith('VE_Sky_'));
  const main =
    DAY.map((w) => sky.find((n) => weatherKey(n) === w)).find(Boolean) ??
    sky[0] ??
    DAY.map((w) => outdoor.find((n) => weatherKey(n) === w)).find(Boolean) ??
    outdoor[0] ??
    null;
  const seen = new Set([main && weatherKey(main)]);
  const night = (n) => /_night_/i.test(`_${base(n)}_`);
  const overrides = [...names.filter((n) => !night(n)), ...names.filter(night)].filter((n) => {
    if (n === main) return false;
    const k = weatherKey(n);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { main, overrides: names.filter((n) => overrides.includes(n)) };
}

// A component's field, only when the record sets it: the rest are the
// class's defaults (zeros, often), which would read as a black sky.
function setter(o) {
  const own = Array.isArray(o?.PropertyOverrides) ? new Set(o.PropertyOverrides) : null;
  return (k) => (o && (!own || own.has(k)) && o[k] !== undefined ? o[k] : undefined);
}
const one = (rec, type) => rec?.[type]?.[0];
const scalar3 = (v) => (Array.isArray(v) ? v[0] : v);

// Drop the unset fields, and any group left empty, so a merge only lays
// over what a record says.
function prune(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return o;
  const out = {};
  for (const [k, v] of Object.entries(o)) {
    const p = prune(v);
    if (p === undefined) continue;
    if (p && typeof p === 'object' && !Array.isArray(p) && !Object.keys(p).length) continue;
    out[k] = p;
  }
  return out;
}

// readVE(record) → { sun, sky, fog, tonemap, grading, wind }, every field
// optional. Angles in degrees as the game keeps them; colours linear.
export function readVE(rec) {
  const ol = setter(one(rec, 'OutdoorLightComponentData'));
  const sk = setter(one(rec, 'SkyComponentData'));
  const fg = setter(one(rec, 'FogComponentData'));
  const tm = setter(one(rec, 'TonemapComponentData'));
  const cc = setter(one(rec, 'ColorCorrectionComponentData'));
  const wd = setter(one(rec, 'WindComponentData'));
  const en = setter(one(rec, 'EnlightenComponentData'));
  return prune({
    sun: { color: ol('SunColor'), lux: ol('SunIntensity'), az: ol('SunRotationX'), el: ol('SunRotationY'), sky: ol('SkyColor'), ground: ol('GroundColor') },
    sky: { rayleigh: sk('RayleighScatteringCoefficient'), luminance: sk('LuminanceScale'), sunSize: sk('SunSize'), panorama: sk('PanoramicTexture'), gradient: sk('SkyGradientTexture') },
    fog: {
      color: fg('FogColorEnable') ? fg('FogColor') : undefined,
      start: fg('Start'),
      end: fg('End'),
      curve: fg('Curve'),
      height: fg('HeightFogEnable') === false ? undefined : fg('HeightFogAltitude'),
      heightDepth: fg('HeightFogDepth'),
      heightRange: fg('HeightFogVisibilityRange'),
      // the light scattered toward the sun: the haze's colour round it
      scatter: fg('ForwardLightScatteringColor'),
    },
    tonemap: { ev: tm('EV'), compensation: tm('ExposureCompensation'), minEV: tm('MinEV'), maxEV: tm('MaxEV'), auto: tm('AutomaticExposure'), bloom: scalar3(tm('BloomScale')) },
    grading: { brightness: scalar3(cc('Brightness')), contrast: scalar3(cc('Contrast')), saturation: scalar3(cc('Saturation')), lut: cc('ColorGradingEnable') === false ? undefined : cc('HdrColorGradingLut') },
    wind: { dir: wd('WindDirection'), strength: wd('WindStrength') },
    // the bounce the game works out at run time: the sky's colour and the
    // ground's, as Enlighten is told them
    enlighten: { sky: en('SkyBoxSkyColor'), ground: en('SkyBoxGroundColor'), terrain: en('TerrainColor') },
  });
}

// A raw record (data/<name>.json.gz: { objects: [{ $type, … }] }) in the
// shape readVE takes, its {x, y, z} vectors as arrays, as the map's
// extras.json keeps them.
// (and an asset's reference as its name)
const vec = (v) => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return v;
  if ('$asset' in v) return v.$asset;
  return 'x' in v ? ['x', 'y', 'z', 'w'].filter((k) => k in v).map((k) => v[k]) : v;
};
export function toComponents(raw) {
  const out = {};
  for (const o of raw?.objects ?? []) {
    const t = o?.$type;
    if (!t || !t.endsWith('ComponentData')) continue;
    const flat = {};
    for (const [k, v] of Object.entries(o)) flat[k] = vec(v);
    (out[t] ??= []).push(flat);
  }
  return out;
}

// One read laid over another, field by field: a weather's VE_PV_ over the
// level's main sky, as the game blends them.
export function mergeVE(under, over) {
  if (!over) return under;
  if (!under) return over;
  const out = { ...under };
  for (const [k, v] of Object.entries(over)) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && under[k] && typeof under[k] === 'object' ? mergeVE(under[k], v) : v;
  }
  return out;
}

// Radiance HDR (flat or run-length scanlines) to floats: the probes' faces.
export function readHdr(buf) {
  let p = 0;
  const line = () => {
    const e = buf.indexOf(10, p);
    const l = buf.toString('latin1', p, e);
    p = e + 1;
    return l;
  };
  while (line() !== '');
  const dims = line().split(' ');
  const h = Number(dims[1]);
  const w = Number(dims[3]);
  const px = new Float32Array(w * h * 3);
  const scan = new Uint8Array(w * 4);
  for (let y = 0; y < h; y++) {
    if (buf[p] === 2 && buf[p + 1] === 2 && ((buf[p + 2] << 8) | buf[p + 3]) === w) {
      p += 4;
      for (let c = 0; c < 4; c++) {
        for (let x = 0; x < w; ) {
          let n = buf[p++];
          if (n > 128) {
            n -= 128;
            const v = buf[p++];
            while (n--) scan[x++ * 4 + c] = v;
          } else while (n--) scan[x++ * 4 + c] = buf[p++];
        }
      }
    } else for (let i = 0; i < w * 4; i++) scan[i] = buf[p++];
    for (let x = 0; x < w; x++) {
      const e = scan[x * 4 + 3];
      const f = e ? 2 ** (e - 136) : 0;
      for (let c = 0; c < 3; c++) px[(y * w + x) * 3 + c] = scan[x * 4 + c] * f;
    }
  }
  return { w, h, px };
}

const lum = (r, g, b) => r * 0.2126 + g * 0.7152 + b * 0.0722;

// What a probe says of its sky: the mean colour straight up (the +y face's
// middle), along the horizon (the side faces' middle rows), and below (the
// -y face), as linear RGB in the probe's own units, and how much of the +y
// face is open sky (its brightness against the horizon's): an indoor probe
// looks at a ceiling. faces: { px…nz: Float32Array RGB }, size.
export function probeStats(faces, size) {
  // the middle half by brightness, so the sun's disc and a lamp's glint
  // don't stand in for the sky's colour
  const mean = (f, x0, x1, y0, y1, lo = 0.25, hi = 0.75) => {
    const px = [];
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * size + x) * 3;
        px.push([f[i], f[i + 1], f[i + 2]]);
      }
    }
    px.sort((a, b) => lum(...a) - lum(...b));
    const a = Math.floor(px.length * lo);
    const mid = px.slice(a, Math.max(a + 1, Math.ceil(px.length * hi)));
    return [0, 1, 2].map((c) => mid.reduce((a, v) => a + v[c], 0) / mid.length);
  };
  const q = Math.round(size / 4);
  const zenith = mean(faces.py, q, size - q, q, size - q);
  const ground = mean(faces.ny, 0, size, 0, size);
  // the band just above the horizon: the side faces' rows a little over the
  // middle, its brighter half (walls and ridges stand in front of the sky)
  const band = Math.max(1, Math.round(size / 16));
  const mid = Math.floor(size / 2);
  const sides = ['px', 'nx', 'pz', 'nz'].map((k) => mean(faces[k], 0, size, mid - band * 2, mid - band, 0.5, 0.9));
  const horizon = [0, 1, 2].map((c) => sides.reduce((a, s) => a + s[c], 0) / sides.length);
  const open = lum(...zenith) / Math.max(1e-6, lum(...horizon));
  return { zenith, horizon, ground, open };
}

// Which probe folders light which weather. A level's reflection volumes sit
// in folders named for the light layer they were baked under (Hoth:
// Cloudy_VFX, Sunset_VFX, Prefabs/…; Tatooine's town has some at the
// top, folder ''): a weather takes the outdoor folders that name it; the
// main weather, when none names it, every outdoor folder no other weather
// names; an interior none (its probe is picked by hand, --indoor). Indoor,
// prefab and building folders are never out of doors. The caller takes the
// probe in them that sees the most sky.
const INDOOR = /prefab|(^|[/_])pf_|indoor|interior|hangar|cantina|house|dome|bay|cave|core/i;
export function pickVariants(variants, weathers, main) {
  const out = {};
  const outdoor = variants.filter((v) => !INDOOR.test(v));
  for (const w of weathers) {
    const hit = outdoor.filter((v) => v.toLowerCase().includes(w));
    if (hit.length) out[w] = hit;
  }
  if (main && !out[main]) {
    const taken = new Set(Object.values(out).flat());
    const free = outdoor.filter((v) => !taken.has(v) && !weathers.some((w) => w !== main && v.toLowerCase().includes(w)) && !/night/i.test(v));
    if (free.length) out[main] = free;
  }
  return out;
}

// A grading LUT from its n slices (the game's: blue the slice, green the row
// counted from the top, red the column, 0…255 in a 16-bit file) to one strip
// n² wide and n high, slices side by side, the rows in green's order (row 0
// green 0), as src/lib/three/gameLut.js unpacks it.
export function lutStrip(slices, n) {
  const out = new Uint8Array(n * n * n * 3);
  for (let b = 0; b < n; b++) {
    for (let g = 0; g < n; g++) {
      for (let r = 0; r < n; r++) {
        const src = ((n - 1 - g) * n + r) * 3;
        const dst = (g * n * n + b * n + r) * 3;
        for (let c = 0; c < 3; c++) out[dst + c] = Math.min(255, slices[b][src + c]);
      }
    }
  }
  return out;
}

// The same strip from every other slice, row and column of an odd-sized
// cube (33 → 17): a grade is smooth, and the pass interpolates between.
export function halveLut(slices, n) {
  const pick = [];
  for (let i = 0; i < n; i += 2) pick.push(i);
  const m = pick.length;
  const sub = pick.map((b) => {
    const s = new Uint16Array(m * m * 3);
    pick.forEach((g, gi) =>
      pick.forEach((r, ri) => {
        for (let c = 0; c < 3; c++) s[(gi * m + ri) * 3 + c] = slices[b][(g * n + r) * 3 + c];
      }),
    );
    return s;
  });
  return lutStrip(sub, m);
}

// A face halved (or more) by averaging, for a smaller probe.
export function shrinkFace(px, size, to) {
  const k = size / to;
  const out = new Float32Array(to * to * 3);
  for (let y = 0; y < to; y++) {
    for (let x = 0; x < to; x++) {
      for (let c = 0; c < 3; c++) {
        let s = 0;
        for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) s += px[((y * k + j) * size + x * k + i) * 3 + c];
        out[(y * to + x) * 3 + c] = s / (k * k);
      }
    }
  }
  return out;
}

// Floats back to a Radiance HDR, flat scanlines (small faces: no gain in
// run-length coding them).
export function writeHdr({ w, h, px }) {
  const head = Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${h} +X ${w}\n`, 'latin1');
  const body = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const r = px[i * 3];
    const g = px[i * 3 + 1];
    const b = px[i * 3 + 2];
    const m = Math.max(r, g, b);
    if (m < 1e-32) continue;
    const e = Math.ceil(Math.log2(m * (1 + 1e-7)));
    const k = 256 / 2 ** e;
    body[i * 4] = Math.min(255, Math.floor(r * k));
    body[i * 4 + 1] = Math.min(255, Math.floor(g * k));
    body[i * 4 + 2] = Math.min(255, Math.floor(b * k));
    body[i * 4 + 3] = e + 128;
  }
  return Buffer.concat([head, body]);
}

// A probe's texels held under cap (luminance), each scaled whole so its hue
// holds: the sun's disc and the glare round it, in place. The sun's light is
// the scene's directional light; left in the probe, its reflection on
// anything shiny blooms over the whole frame.
export function clipFaces(faces, cap) {
  for (const f of Object.values(faces)) {
    for (let i = 0; i < f.length; i += 3) {
      const l = lum(f[i], f[i + 1], f[i + 2]);
      if (l <= cap) continue;
      const k = cap / l;
      f[i] *= k;
      f[i + 1] *= k;
      f[i + 2] *= k;
    }
  }
  return faces;
}
