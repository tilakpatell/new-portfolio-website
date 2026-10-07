// The universe map's planet maps: which there are, the file for each at a
// detail level, loading them all (the set every planet wears from the start)
// and the finer set a planet wears near (nearMaps.js), swapped in place.
//
//   mapFile(name, level) → the file for a planet map at lib/detail's level
//   loadTextures({ small, level }) → the textures (any that fail are just missing)
//   mapsOf(id), nearSet(id, level) → a planet's maps, and the finer ones it wears near
//   mapSwapper(group, T, names) → swap(T2 | null)

import { MAP_SLOTS, loadTexture } from '../../lib/three/textures';
import { detailLevel } from '../../lib/detail';

const BASE = '/textures/universe/';
// Each map: whether it's a colour (sRGB) or data (normals, roughness, a
// cloud's alpha), and which sizes it comes in: `sm`, a half-size copy for a
// phone or a weak device; `hq`, a copy at twice the texels for a strong
// graphics card (lib/detail's 'ultra'), so a planet filling the screen and
// the Milky Way behind it stay sharp as the camera comes in. The fandoms'
// own maps are baked by scripts/build-fandom-planets.mjs (Middle-earth,
// Breaking Bad, the Caribbean, C-137, the Office, Music, Marvel) at all
// three sizes; Earth's, the sun's and the sky's by
// scripts/build-universe-textures.py (--hq for the -hq set); Cybertron's and
// Invincible's by their own scripts (Invincible's relief with an -hq;
// Cybertron's is 2048 on high and up, 1024 below).
// The universe map's own sky is 'sky-glow', the Milky Way's light only,
// baked from the 8K sky by scripts/bake-universe-sky.mjs (skyShader.js
// draws its stars); 'sky' itself, with its stars, is the Earth's.
const map = (names, opts) => names.map((n) => [n, opts]);
const MAPS = Object.fromEntries([
  ...map(['music', 'middleearth', 'middleearth-clouds', 'marvel', 'breakingbad', 'caribbean', 'office', 'rickmorty', 'rickmorty-clouds', 'earth', 'earth-night', 'sun'], { sm: true, hq: true, colour: true }),
  ...map(['middleearth-normal', 'office-normal', 'breakingbad-normal', 'caribbean-clouds', 'earth-clouds'], { sm: true, hq: true, colour: false }),
  ...map(['caribbean-normal', 'invincible-normal'], { sm: false, hq: true, colour: false }),
  ...map(['transformers-normal'], { sm: true, hq: false, colour: false }),
  ...map(['middleearth-night', 'breakingbad-night', 'transformers', 'invincible', 'invincible-night', 'sky-glow'], { sm: true, hq: false, colour: true }),
  ...map(['breakingbad-clouds', 'invincible-clouds'], { sm: true, hq: false, colour: false }),
  ...map(['middleearth-glow', 'caribbean-night', 'rickmorty-glow', 'invincible-glow', 'plates', 'hull'], { sm: false, hq: false, colour: true }),
  ...map(['plates-normal', 'plates-rough', 'hull-normal', 'hull-rough', 'paper-normal', 'transformers-glow-sm', 'middleearth-rough', 'office-rough', 'breakingbad-rough', 'caribbean-rough', 'earth-rough', 'rickmorty-rough', 'invincible-rough'], { sm: false, hq: false, colour: false }),
]);

export const MAP_NAMES = Object.keys(MAPS);

// The file for a map at a detail level (lib/detail): the `-hq` copy on a
// strong card where there is one, the standard file on a desktop, the
// `-sm` half on a phone or a weak device where there is one.
export function mapFile(name, level = 'high') {
  const { sm = true, hq = false } = MAPS[name] ?? {};
  const suffix = level === 'ultra' ? (hq ? '-hq' : '') : level === 'high' ? '' : sm ? '-sm' : '';
  return `${name}${suffix}.webp`;
}

// A planet's own maps: those named for it ('middleearth', 'middleearth-normal'…;
// Earth's world is 'travel', its maps 'earth').
const MAP_PREFIX = { travel: 'earth' };
export function mapsOf(id) {
  const pre = MAP_PREFIX[id] ?? id;
  return MAP_NAMES.filter((n) => n === pre || n.startsWith(`${pre}-`));
}

// What a planet wears near (nearMaps.js), at a detail level: the finer copy
// of each of its maps that has one, never the file it already wears (the
// loader's cache would hand back that very texture). A desktop's near set
// is the -hq copies; a weak card's desktop, the standard ones over its -sm.
// Nothing on low.
export function nearSet(id, level) {
  if (level === 'low') return [];
  const up = level === 'mid' ? 'high' : 'ultra';
  return mapsOf(id)
    .map((name) => ({ name, file: mapFile(name, up), far: mapFile(name, level), colour: MAPS[name].colour }))
    .filter((m) => m.file !== m.far)
    .map(({ name, file, colour }) => ({ name, file, colour }));
}

export async function loadTextures({ small = false, level = small ? 'mid' : detailLevel() } = {}) {
  const T = { small }; // (and whether this is a phone, for the builders)
  const get = async (name, file, colour, fallback = null) => {
    try {
      // (decoded off the main thread, as sharp as the device's tier allows,
      // and shared with any other scene that wants the same map)
      T[name] = await loadTexture(BASE + file, { color: colour });
    } catch {
      // missing: the standard file where a sharper set was asked for, else whoever wanted it does without
      if (fallback) await get(name, fallback, colour);
    }
  };
  await Promise.all(
    Object.entries(MAPS).map(([name, { colour }]) => {
      const file = mapFile(name, level);
      const standard = mapFile(name, 'high');
      return get(name, file, colour, file !== standard ? standard : null);
    }),
  );
  return T;
}

// A planet's maps swapped in place for its near ones, wherever they're
// worn: a material's slots and the uniforms its hooks read (the night side,
// the clouds' shadows), each taking the old one's wrapping, repeat, offset,
// colour space and anisotropy. mapSwapper(group, T, names) → swap(T2 | null);
// null puts its own back.
export function mapSwapper(group, T, names) {
  const own = names.filter((n) => T[n]);
  let swapped = [];
  return (T2) => {
    for (const [holder, key, old] of swapped) holder[key] = old;
    swapped = [];
    if (!T2) return;
    const by = new Map(own.filter((n) => T2[n]).map((n) => [T[n], T2[n]]));
    const put = (holder, key) => {
      const old = holder?.[key];
      const t = old && by.get(old);
      if (!t) return;
      t.wrapS = old.wrapS;
      t.wrapT = old.wrapT;
      t.repeat.copy(old.repeat);
      t.offset.copy(old.offset);
      t.colorSpace = old.colorSpace;
      t.anisotropy = old.anisotropy;
      holder[key] = t;
      swapped.push([holder, key, old]);
    };
    const seen = new Set();
    group.traverse((o) => {
      for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
        if (seen.has(m)) continue;
        seen.add(m);
        for (const slot of MAP_SLOTS) put(m, slot);
        for (const set of [m.uniforms, ...Object.values(m.userData ?? {})]) if (set && typeof set === 'object') for (const v of Object.values(set)) if (v && typeof v === 'object' && 'value' in v) put(v, 'value');
      }
    });
  };
}
