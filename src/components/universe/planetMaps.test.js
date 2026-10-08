// Every planet map's file at every detail level, pinned as a table: what
// mapFile, loadTextures, mapsOf and nearSet give for every name and every
// planet. The table was recorded from the hand list planetMaps.js had before
// the bake manifest (public/textures/universe/index.json) took its place, so
// a line that changes here is a map whose files changed on purpose.
//
// FILES[name]: the file at low, mid, high, ultra (the -xl where there is one)
// and ultra's start (what loadTextures asks for there), and '(data)' for a map
// loaded as data rather than colour. NEAR[id]: a planet's near set by level
// (`name: file | fallback`, sorted; none on low). OF[id]: its maps, sorted.
// NONE: the places with no maps at all.

import { describe, expect, it, vi } from 'vitest';

const asked = [];
vi.mock('../../lib/three/textures', async (importOriginal) => ({
  ...(await importOriginal()),
  loadTexture: (url, { color }) => {
    asked.push([url, color]);
    return Promise.resolve({ url });
  },
}));
const { MAP_NAMES, loadTextures, mapFile, mapsOf, nearSet } = await import('./planetMaps');

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
  'transformers-glow-sm': 'transformers-glow-sm.webp transformers-glow-sm.webp transformers-glow-sm.webp transformers-glow-sm.webp transformers-glow-sm.webp (data)',
  'transformers-normal': 'transformers-normal-sm.webp transformers-normal-sm.webp transformers-normal.webp transformers-normal.webp transformers-normal.webp (data)',
};
const NEAR = {
  breakingbad: {
    mid: ['breakingbad-clouds: breakingbad-clouds.webp (data)', 'breakingbad-night: breakingbad-night.webp', 'breakingbad-normal: breakingbad-normal.webp (data)', 'breakingbad: breakingbad.webp'],
    high: ['breakingbad-normal: breakingbad-normal-hq.webp (data)', 'breakingbad: breakingbad-hq.webp'],
    ultra: ['breakingbad: breakingbad-xl.ktx2'],
  },
  caribbean: {
    mid: ['caribbean-clouds: caribbean-clouds.webp (data)', 'caribbean: caribbean.webp'],
    high: ['caribbean-clouds: caribbean-clouds-hq.webp (data)', 'caribbean-normal: caribbean-normal-hq.webp (data)', 'caribbean: caribbean-hq.webp'],
    ultra: ['caribbean: caribbean-xl.ktx2'],
  },
  earth: {
    mid: ['earth-clouds: earth-clouds.webp (data)', 'earth-night: earth-night.webp', 'earth: earth.webp'],
    high: ['earth-clouds: earth-clouds-hq.webp (data)', 'earth-night: earth-night-hq.webp', 'earth: earth-hq.webp'],
    ultra: [],
  },
  hull: {
    mid: [],
    high: [],
    ultra: [],
  },
  invincible: {
    mid: ['invincible-clouds: invincible-clouds.webp (data)', 'invincible-night: invincible-night.webp', 'invincible: invincible.webp'],
    high: ['invincible-normal: invincible-normal-hq.webp (data)'],
    ultra: [],
  },
  marvel: {
    mid: ['marvel: marvel.webp'],
    high: ['marvel: marvel-hq.webp'],
    ultra: ['marvel: marvel-xl.ktx2'],
  },
  middleearth: {
    mid: ['middleearth-clouds: middleearth-clouds.webp', 'middleearth-night: middleearth-night.webp', 'middleearth-normal: middleearth-normal.webp (data)', 'middleearth: middleearth.webp'],
    high: ['middleearth-clouds: middleearth-clouds-hq.webp', 'middleearth-normal: middleearth-normal-hq.webp (data)', 'middleearth: middleearth-hq.webp'],
    ultra: ['middleearth: middleearth-xl.ktx2'],
  },
  music: {
    mid: ['music: music.webp'],
    high: ['music: music-hq.webp'],
    ultra: ['music: music-xl.ktx2'],
  },
  office: {
    mid: ['office-normal: office-normal.webp (data)', 'office: office.webp'],
    high: ['office-normal: office-normal-hq.webp (data)', 'office: office-hq.webp'],
    ultra: ['office: office-xl.ktx2'],
  },
  paper: {
    mid: [],
    high: [],
    ultra: [],
  },
  plates: {
    mid: [],
    high: [],
    ultra: [],
  },
  rickmorty: {
    mid: ['rickmorty-clouds: rickmorty-clouds.webp', 'rickmorty: rickmorty.webp'],
    high: ['rickmorty-clouds: rickmorty-clouds-hq.webp', 'rickmorty: rickmorty-hq.webp'],
    ultra: ['rickmorty: rickmorty-xl.ktx2'],
  },
  sky: {
    mid: ['sky-glow: sky-glow.webp'],
    high: [],
    ultra: [],
  },
  sun: {
    mid: ['sun: sun.webp'],
    high: ['sun: sun-hq.webp'],
    ultra: [],
  },
  transformers: {
    mid: ['transformers-normal: transformers-normal.webp (data)', 'transformers: transformers.webp'],
    high: [],
    ultra: [],
  },
  travel: {
    mid: ['earth-clouds: earth-clouds.webp (data)', 'earth-night: earth-night.webp', 'earth: earth.webp'],
    high: ['earth-clouds: earth-clouds-hq.webp (data)', 'earth-night: earth-night-hq.webp', 'earth: earth-hq.webp'],
    ultra: [],
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
  transformers: 'transformers transformers-glow-sm transformers-normal',
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
  it('loads each map at each level as the table says, colour or data', async () => {
    for (const [i, level] of LEVELS.entries()) {
      asked.length = 0;
      const T = await loadTextures({ level });
      const want = MAP_NAMES.map((name) => [`/textures/universe/${row(name)[i === 3 ? 4 : i]}`, !FILES[name].endsWith('(data)')]);
      expect(asked.sort(), level).toEqual(want.sort());
      expect(Object.keys(T).filter((k) => k !== 'small').sort()).toEqual(Object.keys(FILES));
    }
  });
});

describe('a planet’s maps, and what it wears near', () => {
  it('knows its own maps by name', () => {
    for (const [id, names] of Object.entries(OF)) expect([...mapsOf(id)].sort(), id).toEqual(names.split(' '));
    for (const id of NONE) expect(mapsOf(id), id).toEqual([]);
  });
  it('wears the finer set near at each level, nothing on low', () => {
    const show = (e) => `${e.name}: ${e.file}${e.fallback ? ` | ${e.fallback}` : ''}${e.colour ? '' : ' (data)'}`;
    for (const [id, by] of Object.entries(NEAR)) {
      expect(nearSet(id, 'low'), id).toEqual([]);
      for (const [level, set] of Object.entries(by)) expect(nearSet(id, level).map(show).sort(), `${id} ${level}`).toEqual(set);
    }
    for (const id of NONE) for (const level of LEVELS) expect(nearSet(id, level), id).toEqual([]);
  });
});
