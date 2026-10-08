// The universe map's planet maps: which there are (the bake's manifest,
// public/textures/universe/index.json), the file for each at a detail level,
// the small set every planet wears from the start, the sets it wears as it
// comes near (nearMaps.js), swapped in place.
//
// Maps by need, three steps. Up front every map at its smallest file (the
// -sm where it has one), on every device: about two thirds of a megabyte
// before the first frame, where the standard set was five. A planet within
// twelve of its radii wears its standard set (step 1); within six, its finer
// set over that (step 2: the -hq, the -xl at ultra). The maps a far planet
// doesn't show, its relief, roughness and glow (LATER), aren't fetched up
// front at all: each is stood in for (flat, matte, dark: standIn) so the
// planet is built with the same materials and shaders it always was, and its
// own come at step 1. The sky's glow (what metal reflects) comes after the
// first frame (scene.js), and the Office's paper is only its normal map's
// fallback, which a stand-in now fills. The stations' and the ships' tiling
// plates come up front whatever their kind: each repeat of one is its own
// clone (kit.js's tiled()), which a swap can't find.
//
//   mapFile(name, level) → the file for a planet map at lib/detail's level
//   LATER → the maps not fetched up front
//   loadTextures({ small }) → the textures (any that fail are just missing; a LATER one a stand-in)
//   loadMap(name) → a LATER map at its smallest file (the sky's glow, after the first frame)
//   mapsOf(id), nearSet(id, level) → a planet's maps, and { std, near }: what it wears at steps 1 and 2
//   mapSwapper(group, T, names) → swap(T2 | null)

import * as THREE from 'three';
import { MAP_SLOTS, loadTexture, sharpen } from '../../lib/three/textures';
import K8_BAKED from '../../../public/textures/universe/k8.json';
import MANIFEST from '../../../public/textures/universe/index.json';

const BASE = '/textures/universe/';
// Each map, from the bake's manifest (index.json: scripts/planets/bake.mjs
// writes it, scripts/planets/manifest.mjs says its shape): whether it's a
// colour (sRGB) or data (normals, roughness, a cloud's alpha), and which
// sizes it comes in, on one ladder: `sm` 512, for a phone or a weak device;
// `std` 1024 (2048 for Earth's and Cybertron's, by the manifest's flag), a
// desktop's; `hq` 2048, for a strong graphics card (lib/detail's 'ultra'),
// so a planet filling the screen and the Milky Way behind it stay sharp as
// the camera comes in; `xl` 4096 as KTX2, worn near at ultra. The fandoms'
// maps are baked by scripts/planets/; Earth's, the sun's and the stations'
// plates by scripts/build-universe-textures.py (--hq for the -hq set) and
// recorded as they are. The universe map's own sky is 'sky-glow', the Milky
// Way's light only, baked from the 8K sky by scripts/bake-universe-sky.mjs
// (skyShader.js draws its stars); the Earth page's sky, with its stars, is
// in /textures/earth.
const MAPS = MANIFEST;

// every map the manifest lists
export const MAP_NAMES = Object.keys(MAPS);

// The file for a map at a detail level (lib/detail), from the sizes the
// manifest lists for it: on a strong card the `-xl` (4096, KTX2: a quarter
// of the memory raw would take) where there is one, else the `-hq` copy
// where there is one; the standard file on a desktop; the `-sm` on a phone
// or a weak device where there is one. `xl: false` passes over the -xl (its
// fallback near at ultra). So low's file is a map's smallest, worn up front
// everywhere, and high's its standard one, worn within twelve radii.
// (A name the manifest doesn't know is taken to have an -sm and nothing finer.)
export function mapFile(name, level = 'high', { xl: big = true } = {}) {
  const sizes = MAPS[name]?.sizes;
  const sm = sizes ? Boolean(sizes.sm) : true;
  const hq = Boolean(sizes?.hq);
  const xl = Boolean(sizes?.xl);
  if (level === 'ultra' && xl && big) return `${name}-xl.ktx2`;
  const suffix = level === 'ultra' ? (hq ? '-hq' : '') : level === 'high' ? '' : sm ? '-sm' : '';
  return `${name}${suffix}.webp`;
}

// The colour maps baked at 8192 too (scripts/planets/bake.mjs
// --ultra writes `<name>-8k.ktx2` and lists it in k8.json): worn near at
// ultra only, over the -xl. Too big to keep in the repository (about 20 MB
// each): the list is empty until they're baked on the owner's machine and
// published with the site, and nothing asks for one that isn't listed.
export const K8 = new Set(K8_BAKED);

// A planet's own maps: those named for it ('middleearth', 'middleearth-normal'…;
// Earth's world is 'travel', its maps 'earth').
const MAP_PREFIX = { travel: 'earth' };
export function mapsOf(id) {
  const pre = MAP_PREFIX[id] ?? id;
  return MAP_NAMES.filter((n) => n === pre || n.startsWith(`${pre}-`));
}

// The maps not fetched up front (the kinds a far planet doesn't show), but
// the tiling plates
const TILES = new Set(['hull', 'plates']);
export const LATER = new Set(MAP_NAMES.filter((name) => ['normal', 'rough', 'glow'].includes(MAPS[name].kind) && !TILES.has(name.split('-')[0])));
// what each map is worn at up front (its smallest file) and at step 1
const first = (name) => mapFile(name, 'low');
const standard = (name) => mapFile(name, 'high');

// What a planet wears as it comes near (nearMaps.js), at a detail level:
// `std` within twelve radii, on every level: the standard file of each of
// its maps that it doesn't wear already (the loader's cache would hand back
// that very texture), and of each LATER one; `near` within six, over it: the
// finer copy of each map that has one, the -hq on a desktop, the -xl on a
// strong card (its -hq the fallback) and the -hq of the rest; nothing on low
// or mid (mid's finer set is its standard one, worn at step 1). At ultra a
// map baked at 8192 (`k8`) is asked for first, its -xl the fallback.
export function nearSet(id, level, { k8 = K8 } = {}) {
  const std = mapsOf(id)
    .filter((name) => LATER.has(name) || standard(name) !== first(name))
    .map((name) => ({ name, file: standard(name), colour: MAPS[name].srgb }));
  const near = finerSet(id, level);
  if (level !== 'ultra') return { std, near };
  const big = (name) => `${name}-8k.ktx2`;
  // (a map with nothing finer than its standard file, Cybertron's, has its -8k alone)
  const more = mapsOf(id).filter((name) => k8.has(name) && !near.some((m) => m.name === name)).map((name) => ({ name, file: big(name), colour: MAPS[name].srgb }));
  return { std, near: [...near.map((m) => (k8.has(m.name) ? { name: m.name, file: big(m.name), fallback: m.file, colour: m.colour } : m)), ...more] };
}
function finerSet(id, level) {
  if (level !== 'high' && level !== 'ultra') return [];
  const files = (name) => (level === 'ultra' ? [mapFile(name, 'ultra'), mapFile(name, 'ultra', { xl: false })] : [mapFile(name, 'ultra', { xl: false })]);
  return mapsOf(id)
    .map((name) => ({ name, colour: MAPS[name].srgb, files: [...new Set(files(name))].filter((f) => f !== standard(name)) }))
    .filter((m) => m.files.length)
    .map(({ name, colour, files: [file, fallback] }) => ({ name, file, ...(fallback ? { fallback } : {}), colour }));
}

// A LATER map's stand-in, until its own comes: a texel of what having none
// looks like (a flat normal, roughness as the material has it, no glow), in
// the colour space and with the sharpening its own will have, since a swap
// hands the one it replaces' settings on (mapSwapper)
const BLANK = { normal: [128, 128, 255, 255], rough: [255, 255, 255, 255], glow: [0, 0, 0, 255] };
function standIn(name) {
  const { kind, srgb } = MAPS[name];
  const t = new THREE.DataTexture(new Uint8Array(BLANK[kind]), 1, 1);
  t.name = name;
  return sharpen(t, { color: srgb });
}

// Up front: every map but the LATER ones at its smallest file, the same on
// every device; `small` (a phone, or anything below a desktop) only tells
// the builders, which make their spheres coarser.
export async function loadTextures({ small = false } = {}) {
  const T = { small };
  await Promise.all(
    MAP_NAMES.map(async (name) => {
      if (LATER.has(name)) {
        T[name] = standIn(name);
        return;
      }
      try {
        // (decoded off the main thread, as sharp as the device's tier allows,
        // and shared with any other scene that wants the same map)
        T[name] = await loadTexture(BASE + first(name), { color: MAPS[name].srgb });
      } catch {
        // (missing: whoever wanted it does without)
      }
    }),
  );
  return T;
}

// A map at its smallest file, on its own (rejects if it can't be had)
export const loadMap = (name) => loadTexture(BASE + first(name), { color: MAPS[name]?.srgb ?? true });

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
