// The owners table: for every object in the Battlefront II (2017) drop that
// no site file uses yet, the lane that has said it will (the fifth design,
// docs/superpowers/specs/2026-10-10-bf2017-every-asset-design.md §3 and its
// table “What the running lanes own”). It is the designs’ commitment, read
// by the coverage ledger (scripts/bf2017-coverage.mjs): a row it names is
// `owned`, a row it does not is `unowned`, and the gate fails on either an
// `unowned` row or an `owned` row whose lane has merged.
//
// OWNERS: [{ match?, part?, lane }], first match wins, so the narrow
// entries come before the wide ones (anims last). `part` alone takes the
// whole part; `match` is a string (the lowercase name or a file starts with
// it) or a RegExp (tested on the lowercase name and files), limited to
// `part` when both are given.
// LANES: [{ lane, design, merged? }]: the design PR that planned the lane
// and, once it lands, the PR that merged it.

export const LANES = [
  // the fifth design (#848): this lane, the level factory, the library, space, the front end, the clips
  { lane: 'Z', design: 848 },
  { lane: 'E', design: 848 },
  { lane: 'O', design: 848 },
  { lane: 'Q', design: 848 },
  { lane: 'M', design: 848 },
  { lane: 'A', design: 848 },
  // the cast left (#839): the desktop's gaps, the beasts, Yoda and Grievous, the inside's crew, the atlas, the wrecks
  { lane: 'D', design: 839 },
  { lane: 'B', design: 839 },
  { lane: 'Y', design: 839 },
  { lane: 'I', design: 839 },
  { lane: 'T', design: 839 },
  { lane: 'W', design: 839 },
  // the fidelity design (#836): effects, scatter, upscaling, far shadow, cameras, volumetrics
  { lane: 'X', design: 836 },
  { lane: 'N', design: 836 },
  { lane: 'U', design: 836 },
  { lane: 'S', design: 836 },
  { lane: 'C', design: 836 },
  { lane: 'V', design: 836 },
  // the game design (#812): modes, bots, HUD and world
  ...['1', '2', '3', '4', '5', '6', '7'].map((lane) => ({ lane, design: 812, ...(lane === '1' ? { merged: 815 } : lane === '2' ? { merged: 832 } : {}) })),
  // the physics design (#817) and the engine decision (#819)
  { lane: 'P3', design: 817 },
  { lane: 'M-engine', design: 819 },
  // lanes already merged: what they owned is used or has passed to a lane above
  { lane: 'K', design: 810, merged: 825 },
  { lane: 'L', design: 810, merged: 831 },
  { lane: 'G', design: 810, merged: 833 },
  { lane: 'V-vehicles', design: 802, merged: 828 },
  { lane: 'F', design: 802, merged: 829 },
  { lane: 'P0', design: 817, merged: 834 },
  { lane: 'P1', design: 817, merged: 822 },
  { lane: 'P2', design: 817, merged: 820 },
  { lane: 'P4', design: 817, merged: 821 },
  { lane: 'R', design: 810, merged: 827 },
  { lane: '0', design: 812, merged: 824 },
  { lane: 'X-sabers', design: 810, merged: 816 },
  { lane: 'H', design: 839 },
];

const BEASTS = ['dewback', 'bantha', 'eopie', 'ronto', 'jawa', 'aiwha'];

export const OWNERS = [
  // #839's cast left: the six beasts (and their clips), Yoda and Grievous, the walkers' wrecks
  { match: new RegExp(`^characters/npc/creatures/(${BEASTS.join('|')})`), lane: 'B' },
  { match: new RegExp(`^anims(_additive)?/(${BEASTS.join('|')})[^/]*/`), lane: 'B' },
  { match: /^characters\/hero\/(yoda|generalgrievous)\//, lane: 'Y' },
  { match: /^anims(_additive)?\/(yoda_01_ske|generalgrievous_01_ske)\//, lane: 'Y' },
  { match: /^anims(_additive)?\/atat_destruction_/, lane: 'W' },
  // #839's lane D: the sound
  { match: 'sound/', part: 'data', lane: 'D' },
  // #836: the effect spawns (lane X) and the terrain scatter (lane N)
  { part: 'maps.effects', lane: 'X' },
  { part: 'scatter', lane: 'N' },
  // lane Q: the space levels, their set pieces and the asteroids' tracks
  { match: 'levels/space/', lane: 'Q' },
  { match: 'cinematics/spacebattles', lane: 'Q' },
  { match: 'objects/props/_battlebeyond', lane: 'Q' },
  { match: /asteroid/, part: 'animtracks', lane: 'Q' },
  // lane M: the films, fonts, icons, strings and the UI's bitmaps
  { part: 'movies', lane: 'M' },
  { part: 'fonts', lane: 'M' },
  { part: 'svg', lane: 'M' },
  { part: 'strings', lane: 'M' },
  { match: 'ui/', part: 'textures', lane: 'M' },
  // lane E: the maps and everything a pack carries (before O: an object's
  // collision mesh and Havok shapes are the level's solids, not the library's)
  { part: 'maps', lane: 'E' },
  { part: 'maps.lights', lane: 'E' },
  { part: 'maps.decals', lane: 'E' },
  { part: 'maps.actors', lane: 'E' },
  { part: 'maps.vehicles', lane: 'E' },
  { part: 'terrain', lane: 'E' },
  { part: 'physics', lane: 'E' },
  { part: 'collision', lane: 'E' },
  { part: 'animtracks', lane: 'E' },
  // lane O: every placeable object
  { match: 'objects/', lane: 'O' },
  // lane A: every clip the lanes above do not name
  { part: 'anims', lane: 'A' },
];
