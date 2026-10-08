// Every planet map's file at every detail level, pinned as a table: what
// mapFile, loadTextures, mapsOf and nearSet give for every name and every
// planet. The table was recorded from the hand list planetMaps.js had before
// the bake manifest (public/textures/universe/index.json) took its place, so
// a line that changes here is a map whose files changed on purpose. (Changed
// so far: Cybertron's glow, one map on the ladder in place of a lone
// 'transformers-glow-sm'; and the maps by need, Task 4.3: up front every
// level asks for the low column, the smallest file, but for the LATER maps,
// which it stands in for; the old mid near row is now STEP1, the standard set
// every level wears within twelve radii, with the LATER maps in it; and
// ultra's near row gained the -hq copies it wore from the start before.)
//
// FILES[name]: the file at low, mid, high, ultra (the -xl where there is one)
// and ultra without its -xl (what loadTextures asked for there before the
// maps by need; the -xl's fallback near now), and '(data)' for a map loaded
// as data rather than colour. LATER: the maps not fetched before the first
// frame (their smallest files come right after it: nearSet's `later`).
// STEP1[id]: a planet's standard set, the same on every level; NEAR[id]: its
// near set at high and ultra (`name: file | fallback`, sorted; none on low or
// mid). OF[id]: its maps, sorted. NONE: the places with no maps at all.

import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import MANIFEST from '../../../public/textures/universe/index.json';
import { fileOf } from '../../../scripts/planets/manifest.mjs';
import { FIRST_FRAME_MAPS_MB } from '../../lib/budgets';

const asked = [];
const failing = new Set(); // (files the fake loader can't have)
vi.mock('../../lib/three/textures', async (importOriginal) => ({
  ...(await importOriginal()),
  loadTexture: (url, { color }) => {
    asked.push([url, color]);
    if (failing.has(url)) return Promise.reject(new Error(`no ${url}`));
    return Promise.resolve({ url });
  },
}));
const { LATER, MAP_NAMES, isStandIn, loadMap, loadTextures, mapFile, mapsOf, nearSet } = await import('./planetMaps');

const FILES = {
  'breakingbad': 'breakingbad-sm.webp breakingbad-sm.webp breakingbad.webp breakingbad-xl.ktx2 breakingbad-hq.webp',
  'breakingbad-clouds': 'breakingbad-clouds-sm.webp breakingbad-clouds-sm.webp breakingbad-clouds.webp breakingbad-clouds.webp breakingbad-clouds.webp (data)',
  'breakingbad-night': 'breakingbad-night-sm.webp breakingbad-night-sm.webp breakingbad-night.webp breakingbad-night.webp breakingbad-night.webp',
  'breakingbad-normal': 'breakingbad-normal-sm.webp breakingbad-normal-sm.webp breakingbad-normal.webp breakingbad-normal-hq.webp breakingbad-normal-hq.webp (data)',
  'breakingbad-rough': 'breakingbad-rough.webp breakingbad-rough.webp breakingbad-rough.webp breakingbad-rough.webp breakingbad-rough.webp (data)',
  'caribbean': 'caribbean-sm.webp caribbean-sm.webp caribbean.webp caribbean-xl.ktx2 caribbean-hq.webp',
  'caribbean-clouds': 'caribbean-clouds-sm.webp caribbean-clouds-sm.webp caribbean-clouds.webp caribbean-clouds-hq.webp caribbean-clouds-hq.webp (data)',
  'caribbean-night': 'caribbean-night.webp caribbean-night.webp caribbean-night.webp caribbean-night.webp caribbean-night.webp',
  'caribbean-normal': 'caribbean-normal.webp caribbean-normal.webp caribbean-normal.webp caribbean-normal-hq.webp caribbean-normal-hq.webp (data)',
  'caribbean-rough': 'caribbean-rough.webp caribbean-rough.webp caribbean-rough.webp caribbean-rough.webp caribbean-rough.webp (data)',
  'earth': 'earth-sm.webp earth-sm.webp earth.webp earth-hq.webp earth-hq.webp',
  'earth-clouds': 'earth-clouds-sm.webp earth-clouds-sm.webp earth-clouds.webp earth-clouds-hq.webp earth-clouds-hq.webp (data)',
  'earth-night': 'earth-night-sm.webp earth-night-sm.webp earth-night.webp earth-night-hq.webp earth-night-hq.webp',
  'earth-rough': 'earth-rough.webp earth-rough.webp earth-rough.webp earth-rough.webp earth-rough.webp (data)',
  'hull': 'hull.webp hull.webp hull.webp hull.webp hull.webp',
  'hull-normal': 'hull-normal.webp hull-normal.webp hull-normal.webp hull-normal.webp hull-normal.webp (data)',
  'hull-rough': 'hull-rough.webp hull-rough.webp hull-rough.webp hull-rough.webp hull-rough.webp (data)',
  'invincible': 'invincible-sm.webp invincible-sm.webp invincible.webp invincible.webp invincible.webp',
  'invincible-clouds': 'invincible-clouds-sm.webp invincible-clouds-sm.webp invincible-clouds.webp invincible-clouds.webp invincible-clouds.webp (data)',
  'invincible-glow': 'invincible-glow.webp invincible-glow.webp invincible-glow.webp invincible-glow.webp invincible-glow.webp',
  'invincible-night': 'invincible-night-sm.webp invincible-night-sm.webp invincible-night.webp invincible-night.webp invincible-night.webp',
  'invincible-normal': 'invincible-normal.webp invincible-normal.webp invincible-normal.webp invincible-normal-hq.webp invincible-normal-hq.webp (data)',
  'invincible-rough': 'invincible-rough.webp invincible-rough.webp invincible-rough.webp invincible-rough.webp invincible-rough.webp (data)',
  'marvel': 'marvel-sm.webp marvel-sm.webp marvel.webp marvel-xl.ktx2 marvel-hq.webp',
  'middleearth': 'middleearth-sm.webp middleearth-sm.webp middleearth.webp middleearth-xl.ktx2 middleearth-hq.webp',
  'middleearth-clouds': 'middleearth-clouds-sm.webp middleearth-clouds-sm.webp middleearth-clouds.webp middleearth-clouds-hq.webp middleearth-clouds-hq.webp',
  'middleearth-glow': 'middleearth-glow.webp middleearth-glow.webp middleearth-glow.webp middleearth-glow.webp middleearth-glow.webp',
  'middleearth-night': 'middleearth-night-sm.webp middleearth-night-sm.webp middleearth-night.webp middleearth-night.webp middleearth-night.webp',
  'middleearth-normal': 'middleearth-normal-sm.webp middleearth-normal-sm.webp middleearth-normal.webp middleearth-normal-hq.webp middleearth-normal-hq.webp (data)',
  'middleearth-rough': 'middleearth-rough.webp middleearth-rough.webp middleearth-rough.webp middleearth-rough.webp middleearth-rough.webp (data)',
  'music': 'music-sm.webp music-sm.webp music.webp music-xl.ktx2 music-hq.webp',
  'office': 'office-sm.webp office-sm.webp office.webp office-xl.ktx2 office-hq.webp',
  'office-normal': 'office-normal-sm.webp office-normal-sm.webp office-normal.webp office-normal-hq.webp office-normal-hq.webp (data)',
  'office-rough': 'office-rough.webp office-rough.webp office-rough.webp office-rough.webp office-rough.webp (data)',
  'paper-normal': 'paper-normal.webp paper-normal.webp paper-normal.webp paper-normal.webp paper-normal.webp (data)',
  'plates': 'plates.webp plates.webp plates.webp plates.webp plates.webp',
  'plates-normal': 'plates-normal.webp plates-normal.webp plates-normal.webp plates-normal.webp plates-normal.webp (data)',
  'plates-rough': 'plates-rough.webp plates-rough.webp plates-rough.webp plates-rough.webp plates-rough.webp (data)',
  'rickmorty': 'rickmorty-sm.webp rickmorty-sm.webp rickmorty.webp rickmorty-xl.ktx2 rickmorty-hq.webp',
  'rickmorty-clouds': 'rickmorty-clouds-sm.webp rickmorty-clouds-sm.webp rickmorty-clouds.webp rickmorty-clouds-hq.webp rickmorty-clouds-hq.webp',
  'rickmorty-glow': 'rickmorty-glow.webp rickmorty-glow.webp rickmorty-glow.webp rickmorty-glow.webp rickmorty-glow.webp',
  'rickmorty-rough': 'rickmorty-rough.webp rickmorty-rough.webp rickmorty-rough.webp rickmorty-rough.webp rickmorty-rough.webp (data)',
  'sky-glow': 'sky-glow-sm.webp sky-glow-sm.webp sky-glow.webp sky-glow.webp sky-glow.webp',
  'sun': 'sun-sm.webp sun-sm.webp sun.webp sun-hq.webp sun-hq.webp',
  'transformers': 'transformers-sm.webp transformers-sm.webp transformers.webp transformers.webp transformers.webp',
  // (on the ladder since the manifest: the universe's glow is the 2048 the Cybertron page wears, its -sm a 512)
  'transformers-glow': 'transformers-glow-sm.webp transformers-glow-sm.webp transformers-glow.webp transformers-glow.webp transformers-glow.webp (data)',
  'transformers-normal': 'transformers-normal-sm.webp transformers-normal-sm.webp transformers-normal.webp transformers-normal.webp transformers-normal.webp (data)',
};
// (a planet's relief, roughness and glow, and the sky's glow: a far planet
// doesn't show them; the stations' and the ships' tiling plates, whatever
// their kind, aren't among them)
const LATER_NAMES = 'breakingbad-normal breakingbad-rough caribbean-normal caribbean-rough earth-rough invincible-glow invincible-normal invincible-rough middleearth-glow middleearth-normal middleearth-rough office-normal office-rough paper-normal rickmorty-glow rickmorty-rough sky-glow transformers-glow transformers-normal';
const STEP1 = {
  breakingbad: ['breakingbad-clouds: breakingbad-clouds.webp (data)', 'breakingbad-night: breakingbad-night.webp', 'breakingbad-normal: breakingbad-normal.webp (data)', 'breakingbad-rough: breakingbad-rough.webp (data)', 'breakingbad: breakingbad.webp'],
  caribbean: ['caribbean-clouds: caribbean-clouds.webp (data)', 'caribbean-normal: caribbean-normal.webp (data)', 'caribbean-rough: caribbean-rough.webp (data)', 'caribbean: caribbean.webp'],
  earth: ['earth-clouds: earth-clouds.webp (data)', 'earth-night: earth-night.webp', 'earth-rough: earth-rough.webp (data)', 'earth: earth.webp'],
  hull: [],
  invincible: ['invincible-clouds: invincible-clouds.webp (data)', 'invincible-glow: invincible-glow.webp', 'invincible-night: invincible-night.webp', 'invincible-normal: invincible-normal.webp (data)', 'invincible-rough: invincible-rough.webp (data)', 'invincible: invincible.webp'],
  marvel: ['marvel: marvel.webp'],
  middleearth: ['middleearth-clouds: middleearth-clouds.webp', 'middleearth-glow: middleearth-glow.webp', 'middleearth-night: middleearth-night.webp', 'middleearth-normal: middleearth-normal.webp (data)', 'middleearth-rough: middleearth-rough.webp (data)', 'middleearth: middleearth.webp'],
  music: ['music: music.webp'],
  office: ['office-normal: office-normal.webp (data)', 'office-rough: office-rough.webp (data)', 'office: office.webp'],
  paper: ['paper-normal: paper-normal.webp (data)'],
  plates: [],
  rickmorty: ['rickmorty-clouds: rickmorty-clouds.webp', 'rickmorty-glow: rickmorty-glow.webp', 'rickmorty-rough: rickmorty-rough.webp (data)', 'rickmorty: rickmorty.webp'],
  sky: ['sky-glow: sky-glow.webp'],
  sun: ['sun: sun.webp'],
  transformers: ['transformers-glow: transformers-glow.webp (data)', 'transformers-normal: transformers-normal.webp (data)', 'transformers: transformers.webp'],
  travel: ['earth-clouds: earth-clouds.webp (data)', 'earth-night: earth-night.webp', 'earth-rough: earth-rough.webp (data)', 'earth: earth.webp'],
};
const NEAR = {
  breakingbad: {
    high: ['breakingbad-normal: breakingbad-normal-hq.webp (data)', 'breakingbad: breakingbad-hq.webp'],
    ultra: ['breakingbad-normal: breakingbad-normal-hq.webp (data)', 'breakingbad: breakingbad-xl.ktx2 | breakingbad-hq.webp'],
  },
  caribbean: {
    high: ['caribbean-clouds: caribbean-clouds-hq.webp (data)', 'caribbean-normal: caribbean-normal-hq.webp (data)', 'caribbean: caribbean-hq.webp'],
    ultra: ['caribbean-clouds: caribbean-clouds-hq.webp (data)', 'caribbean-normal: caribbean-normal-hq.webp (data)', 'caribbean: caribbean-xl.ktx2 | caribbean-hq.webp'],
  },
  earth: {
    high: ['earth-clouds: earth-clouds-hq.webp (data)', 'earth-night: earth-night-hq.webp', 'earth: earth-hq.webp'],
    ultra: ['earth-clouds: earth-clouds-hq.webp (data)', 'earth-night: earth-night-hq.webp', 'earth: earth-hq.webp'],
  },
  hull: { high: [], ultra: [] },
  invincible: {
    high: ['invincible-normal: invincible-normal-hq.webp (data)'],
    ultra: ['invincible-normal: invincible-normal-hq.webp (data)'],
  },
  marvel: {
    high: ['marvel: marvel-hq.webp'],
    ultra: ['marvel: marvel-xl.ktx2 | marvel-hq.webp'],
  },
  middleearth: {
    high: ['middleearth-clouds: middleearth-clouds-hq.webp', 'middleearth-normal: middleearth-normal-hq.webp (data)', 'middleearth: middleearth-hq.webp'],
    ultra: ['middleearth-clouds: middleearth-clouds-hq.webp', 'middleearth-normal: middleearth-normal-hq.webp (data)', 'middleearth: middleearth-xl.ktx2 | middleearth-hq.webp'],
  },
  music: {
    high: ['music: music-hq.webp'],
    ultra: ['music: music-xl.ktx2 | music-hq.webp'],
  },
  office: {
    high: ['office-normal: office-normal-hq.webp (data)', 'office: office-hq.webp'],
    ultra: ['office-normal: office-normal-hq.webp (data)', 'office: office-xl.ktx2 | office-hq.webp'],
  },
  paper: { high: [], ultra: [] },
  plates: { high: [], ultra: [] },
  rickmorty: {
    high: ['rickmorty-clouds: rickmorty-clouds-hq.webp', 'rickmorty: rickmorty-hq.webp'],
    ultra: ['rickmorty-clouds: rickmorty-clouds-hq.webp', 'rickmorty: rickmorty-xl.ktx2 | rickmorty-hq.webp'],
  },
  sky: { high: [], ultra: [] },
  sun: {
    high: ['sun: sun-hq.webp'],
    ultra: ['sun: sun-hq.webp'],
  },
  transformers: { high: [], ultra: [] },
  travel: {
    high: ['earth-clouds: earth-clouds-hq.webp (data)', 'earth-night: earth-night-hq.webp', 'earth: earth-hq.webp'],
    ultra: ['earth-clouds: earth-clouds-hq.webp (data)', 'earth-night: earth-night-hq.webp', 'earth: earth-hq.webp'],
  },
};
const NONE = ['birdworld', 'contact', 'cronenberg', 'experience', 'gaming', 'gazorpazorp', 'gearworld', 'home', 'nuptia', 'pluto', 'projects', 'purge', 'resort', 'resume', 'snakeplanet', 'squanch', 'starwars', 'terminal'];
const OF = {
  breakingbad: 'breakingbad breakingbad-clouds breakingbad-night breakingbad-normal breakingbad-rough',
  caribbean: 'caribbean caribbean-clouds caribbean-night caribbean-normal caribbean-rough',
  earth: 'earth earth-clouds earth-night earth-rough',
  hull: 'hull hull-normal hull-rough',
  invincible: 'invincible invincible-clouds invincible-glow invincible-night invincible-normal invincible-rough',
  marvel: 'marvel',
  middleearth: 'middleearth middleearth-clouds middleearth-glow middleearth-night middleearth-normal middleearth-rough',
  music: 'music',
  office: 'office office-normal office-rough',
  paper: 'paper-normal',
  plates: 'plates plates-normal plates-rough',
  rickmorty: 'rickmorty rickmorty-clouds rickmorty-glow rickmorty-rough',
  sky: 'sky-glow',
  sun: 'sun',
  transformers: 'transformers transformers-glow transformers-normal',
  travel: 'earth earth-clouds earth-night earth-rough',
};

const LEVELS = ['low', 'mid', 'high', 'ultra'];
const row = (name) => FILES[name].replace(' (data)', '').split(' ');

describe('every map’s file at every level', () => {
  it('names the same maps as the table', () => {
    expect([...MAP_NAMES].sort()).toEqual(Object.keys(FILES));
  });
  it('gives each map its file at each level, the -xl only where ultra wears it near', () => {
    for (const name of MAP_NAMES) {
      const got = [...LEVELS.map((level) => mapFile(name, level)), mapFile(name, 'ultra', { xl: false })];
      expect(got, name).toEqual(row(name));
    }
  });
  it('loads every map up front at its smallest file, the same on every device, colour or data, but the later ones', async () => {
    expect([...LATER].sort()).toEqual(LATER_NAMES.split(' '));
    for (const small of [false, true]) {
      asked.length = 0;
      const T = await loadTextures({ small });
      const want = MAP_NAMES.filter((name) => !LATER.has(name)).map((name) => [`/textures/universe/${row(name)[0]}`, !FILES[name].endsWith('(data)')]);
      expect(asked.sort(), `small ${small}`).toEqual(want.sort());
      expect(Object.keys(T).filter((k) => k !== 'small').sort()).toEqual(Object.keys(FILES));
      expect(T.small).toBe(small);
    }
  });
  it('stands in for each later map: flat, matte, dark, in its colour space', async () => {
    const T = await loadTextures();
    const px = (name) => [...T[name].image.data];
    for (const name of LATER) {
      const { kind, srgb } = MANIFEST[name];
      expect(T[name].isDataTexture, name).toBe(true);
      expect([T[name].image.width, T[name].image.height], name).toEqual([1, 1]);
      expect(px(name), name).toEqual({ normal: [128, 128, 255, 255], rough: [255, 255, 255, 255], glow: [0, 0, 0, 255] }[kind]);
      expect(T[name].colorSpace, name).toBe(srgb ? 'srgb' : '');
      expect(isStandIn(T[name]), name).toBe(true);
    }
    expect(isStandIn(T.caribbean)).toBe(false);
    // (each its own: a planet's swap finds its maps by which texture they are)
    expect(new Set([...LATER].map((n) => T[n])).size).toBe(LATER.size);
  });
  it('asks for the standard file when the smallest won’t load, so one bad fetch doesn’t lose a map for the visit', async () => {
    asked.length = 0;
    failing.add('/textures/universe/caribbean-sm.webp');
    failing.add('/textures/universe/hull.webp'); // (no smaller file: nothing else to try)
    try {
      const T = await loadTextures();
      expect(T.caribbean.url).toBe('/textures/universe/caribbean.webp');
      expect(asked.filter(([u]) => u.includes('/caribbean')).map(([u]) => u)).toEqual(expect.arrayContaining(['/textures/universe/caribbean-sm.webp', '/textures/universe/caribbean.webp']));
      expect(T.hull).toBeUndefined();
      expect(asked.filter(([u]) => u === '/textures/universe/hull.webp')).toHaveLength(1);
    } finally {
      failing.clear();
    }
  });
  it('on a phone, retries no wider than 1024: a 2048 standard map whose smallest fails goes without', async () => {
    failing.add('/textures/universe/earth-sm.webp');
    failing.add('/textures/universe/caribbean-sm.webp');
    try {
      asked.length = 0;
      const phone = await loadTextures({ small: true });
      expect(phone.earth).toBeUndefined();
      expect(asked.map(([u]) => u)).not.toContain('/textures/universe/earth.webp');
      expect(phone.caribbean.url).toBe('/textures/universe/caribbean.webp'); // (a 1024: still tried)
      asked.length = 0;
      const desk = await loadTextures({ small: false });
      expect(desk.earth.url).toBe('/textures/universe/earth.webp');
    } finally {
      failing.clear();
    }
  });
  it('keeps what it fetches before the first frame on high within the budget (lib/budgets)', async () => {
    asked.length = 0;
    await loadTextures({ small: false });
    const files = asked.map(([u]) => u.replace('/textures/universe/', ''));
    const bytes = files.reduce((sum, f) => sum + statSync(resolve('public/textures/universe', f)).size, 0);
    // (673,308 bytes in 28 files when this was written: Task 4.3's measure in Chromium)
    expect(files).toHaveLength(28);
    expect(bytes / 1e6).toBeLessThanOrEqual(FIRST_FRAME_MAPS_MB);
  });
  it('loads one later map on its own at its smallest file: the sky’s glow, after the first frame', async () => {
    asked.length = 0;
    await loadMap('sky-glow');
    expect(asked).toEqual([['/textures/universe/sky-glow-sm.webp', true]]);
  });
});

describe('the maps the manifest lists', () => {
  it('picks a file from the manifest’s sizes', () => {
    expect(mapFile('music', 'ultra')).toBe('music-xl.ktx2');
    expect(mapFile('earth-clouds', 'low')).toBe('earth-clouds-sm.webp');
    // (Cybertron's standard is 2048, by the manifest's flag)
    expect(mapFile('transformers', 'high')).toBe('transformers.webp');
    expect(MANIFEST.transformers).toMatchObject({ sizes: { sm: [512, 256], std: [2048, 1024] }, std2048: true });
  });
  it('has a file for every size it lists', () => {
    const missing = [];
    for (const [name, { sizes }] of Object.entries(MANIFEST)) for (const rung of Object.keys(sizes)) if (!existsSync(resolve('public/textures/universe', fileOf(name, rung)))) missing.push(fileOf(name, rung));
    expect(missing).toEqual([]);
  });
});

describe('a planet’s maps, and what it wears near', () => {
  it('knows its own maps by name', () => {
    for (const [id, names] of Object.entries(OF)) expect([...mapsOf(id)].sort(), id).toEqual(names.split(' '));
    for (const id of NONE) expect(mapsOf(id), id).toEqual([]);
  });
  it('wears its standard set within twelve radii on every level, the finer set within six on high and ultra, none on low or mid', () => {
    const show = (e) => `${e.name}: ${e.file}${e.fallback ? ` | ${e.fallback}` : ''}${e.colour ? '' : ' (data)'}`;
    expect(Object.keys(STEP1)).toEqual(Object.keys(NEAR));
    for (const [id, by] of Object.entries(NEAR)) {
      for (const level of ['mid', 'high', 'ultra']) expect(nearSet(id, level).std.map(show).sort(), `${id} ${level}`).toEqual(STEP1[id]);
      expect(nearSet(id, 'low').near, id).toEqual([]);
      expect(nearSet(id, 'mid').near, id).toEqual([]);
      for (const [level, set] of Object.entries(by)) expect(nearSet(id, level).near.map(show).sort(), `${id} ${level}`).toEqual(set);
    }
    for (const id of NONE) for (const level of LEVELS) expect(nearSet(id, level), id).toEqual({ later: [], std: [], near: [] });
  });
  it('never goes past 1024 wide at step 1 on low or a phone: a 2048 standard map keeps its smallest there', () => {
    const show = (e) => `${e.name}: ${e.file}${e.colour ? '' : ' (data)'}`;
    // (the standard 2048s, Earth's and Cybertron's, by the manifest's flag, and the sky's glow, 4096)
    const WIDE = ['earth', 'earth-night', 'sky-glow', 'transformers', 'transformers-glow', 'transformers-normal'];
    expect(MAP_NAMES.filter((n) => MANIFEST[n].sizes.std[0] > 1024).sort()).toEqual(WIDE);
    const narrow = (id) => STEP1[id].filter((line) => !WIDE.includes(line.split(':')[0]));
    for (const id of Object.keys(STEP1)) {
      expect(nearSet(id, 'low').std.map(show).sort(), `${id} low`).toEqual(narrow(id));
      for (const level of ['mid', 'high', 'ultra']) expect(nearSet(id, level, { small: true }).std.map(show).sort(), `${id} ${level} small`).toEqual(narrow(id));
    }
    expect(nearSet('transformers', 'low').std).toEqual([]);
    expect(nearSet('travel', 'low').std.map((m) => m.file).sort()).toEqual(['earth-clouds.webp', 'earth-rough.webp']);
    // (mid keeps its standard set from twelve radii: every 1024)
    expect(nearSet('middleearth', 'mid').std.map(show).sort()).toEqual(STEP1.middleearth);
  });
  it('fetches its later maps’ smallest files right after the first frame, on every level', () => {
    const show = (e) => `${e.name}: ${e.file}${e.colour ? '' : ' (data)'}`;
    for (const id of Object.keys(NEAR)) {
      const want = mapsOf(id).filter((n) => LATER.has(n)).map((n) => `${n}: ${row(n)[0]}${FILES[n].endsWith('(data)') ? ' (data)' : ''}`).sort();
      for (const level of LEVELS) expect(nearSet(id, level).later.map(show).sort(), `${id} ${level}`).toEqual(want);
    }
    expect(nearSet('transformers', 'high').later.map(show).sort()).toEqual(['transformers-glow: transformers-glow-sm.webp (data)', 'transformers-normal: transformers-normal-sm.webp (data)']);
  });
});
