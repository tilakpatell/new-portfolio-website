// The flora of a land: which of the nature kit's models a land type grows,
// how thick, on what ground, how they clump and how much shade each casts.
// makeCell (cell.js) places them per cell from this table and writes each
// model's name into the cell's props, so a cell is a complete placement list
// that the world hands to the kit's pools (spec 2026-10-08-kit-worlds §4).
//
// Pure: no three.js, no DOM, and no manifest. The names are a static table
// of public/kit/naturemega/index.json's models; flora.test.js reads the
// manifest and checks every name is there, and of its row's kind. The leaf
// maps aren't all green (Birch's are orange, TallThick's blue-violet,
// TwistedTree's and Bush_Common's crimson), so a green land takes the green
// families, Birch an autumn tenth of its trees at most; the crimson and the
// bare go to the volcanic. There are no palms and no snowy rocks in the kit:
// the ocean grows CommonTree and bushes above its sand, and the ice plain
// rocks.
//
//   floraFor(type) → { species, cover } (temperate for a type it doesn't
//     know; a fresh copy each call), each a list of rows:
//     { kind, names, weight, perCell, clump, slope: [min, max], on, shade,
//       grass? }
//     kind     the manifest's kind (tree, bush, rock, plant, flower, grass,
//              mushroom, pebble, path), or 'crate'
//     names    the models a placement picks among, evenly (a model is in
//              one row of a land at most, so its name says its row)
//     weight   the row's share of its list (a list's weights sum to 1)
//     perCell  the most a cell holds: weight × the list's count, rounded
//     clump    metres his clumping moves a placement by (perlin(xz × 0.02)
//              × clump; his is 15), 0 for none
//     slope    the ground's rise over run it stands on, [min, max]
//     on       'grass' (the mask's G at least `grass`, 0.5 unless the row
//              says), 'bank' (within 6 m of a river's or a lake's edge, or
//              on the beach under the grass), 'any' (any dry ground)
//     shade    metres of crown whose shade is painted into the ground mask:
//              a leafy tree 6, a bush 2; a bare tree and the rest none
//   The crate is no flora but the physics toy, kept on every land as it was:
//   no name, weight 0, three a cell, on thick grass (0.9).

const range = (stem, n) => Array.from({ length: n }, (_, i) => `${stem}_${i + 1}`);

// the families
const BIRCH = range('Birch', 5);
const COMMON = range('CommonTree', 5);
const PINE = range('Pine', 5);
const GIANT = range('GiantPine', 5);
const TWISTED = range('TwistedTree', 5);
const DEAD = range('DeadTree', 5);
// (the green-leaved: Bush_Common's leaves are crimson; Bush_Long_2 is 5,393 triangles)
const BUSHES = ['Bush_Large', 'Bush_Large_Flowers', 'Bush_Long_1', 'Bush_Common_Flowers'];
const ROCKS = range('Rock_Medium', 4);
const BIG_ROCKS = range('Rock_Big', 2);
const FERNS = ['Fern_1', 'Fern_2'];
const CLOVER = ['Clover_1', 'Clover_2'];
const PLANTS = ['Plant_1', 'Plant_2', 'Plant_3', 'Plant_5', 'Plant_6', 'Plant_7'];
const FLOWERS = ['Flower_1_Group', 'Flower_2_Group', 'Flower_3_Group', 'Flower_4_Group', 'Flower_7_Group'];
const TUFTS = ['Grass_Common_Short', 'Grass_Common_Tall', 'Grass_Wide_Short', 'Grass_Wispy_Short', 'Grass_Wispy_Tall'];
// (Laetiporus left out: 3,216 triangles for a mushroom)
const MUSHROOMS = ['Mushroom_Common', 'Mushroom_Oyster', 'Mushroom_RedCap'];
const ROUND_PEBBLES = range('Pebble_Round', 5);
const SQUARE_PEBBLES = range('Pebble_Square', 6);
const STEPPING_STONES = [...range('RockPath_Round_Small', 3), ...range('RockPath_Square_Small', 3)];

const CLUMP = 15; // his
const SHADE = { tree: 6, bush: 2 };
const GENTLE = [0, 0.45]; // where a tree's roots hold (the grass gives out by 0.55)
const STEEP = [0.25, 4]; // a hillside's rocks
const ANY = [0, 4];

// a row by weight: on grass, gentle, clumped and shaded by its kind unless it says
const row = (kind, names, weight, { on = 'grass', slope = GENTLE, clump = CLUMP, shade = SHADE[kind] ?? 0 } = {}) => ({ kind, names, weight, clump, slope, on, shade });
const CRATE = { kind: 'crate', names: [], weight: 0, perCell: 3, clump: 0, slope: ANY, on: 'grass', grass: 0.9, shade: 0 };

// each land: its lists' counts a cell [species, cover] and their rows
const TYPES = {
  temperate: {
    count: [36, 60],
    species: [
      row('tree', COMMON, 0.3),
      row('tree', PINE, 0.2),
      row('tree', GIANT, 0.06),
      row('tree', BIRCH, 0.06),
      row('bush', BUSHES, 0.18),
      row('rock', ROCKS, 0.16, { on: 'any', slope: ANY, clump: 0 }),
      row('rock', BIG_ROCKS, 0.04, { on: 'bank', slope: ANY, clump: 0 }),
    ],
    cover: [
      row('grass', TUFTS, 0.36, { slope: [0, 0.5] }),
      row('plant', FERNS, 0.12),
      row('plant', CLOVER, 0.08),
      row('flower', FLOWERS, 0.14),
      row('mushroom', MUSHROOMS, 0.06),
      row('pebble', ROUND_PEBBLES, 0.14, { on: 'any', slope: [0, 1], clump: 0 }),
      row('path', STEPPING_STONES, 0.1, { on: 'bank', slope: [0, 0.4], clump: 0 }),
    ],
  },
  desert: {
    count: [10, 24],
    species: [
      row('tree', DEAD, 0.25, { slope: [0, 0.4], shade: 0 }),
      row('rock', ROCKS, 0.45, { on: 'any', slope: [0.2, 4], clump: 0 }),
      row('rock', BIG_ROCKS, 0.3, { on: 'any', slope: ANY, clump: 0 }),
    ],
    cover: [
      row('pebble', ROUND_PEBBLES, 0.6, { on: 'any', slope: [0, 0.35] }),
      row('pebble', SQUARE_PEBBLES, 0.4, { on: 'any', slope: [0.2, 4], clump: 0 }),
    ],
  },
  ice: {
    count: [14, 20],
    species: [
      row('tree', PINE, 0.35),
      row('tree', GIANT, 0.15),
      row('rock', ROCKS, 0.3, { on: 'any', slope: ANY, clump: 0 }),
      row('rock', BIG_ROCKS, 0.2, { on: 'any', slope: ANY, clump: 0 }),
    ],
    cover: [
      row('pebble', ROUND_PEBBLES, 0.5, { on: 'any', slope: [0, 0.35] }),
      row('pebble', SQUARE_PEBBLES, 0.5, { on: 'any', slope: [0.2, 4], clump: 0 }),
    ],
  },
  ocean: {
    count: [20, 30],
    species: [
      row('tree', COMMON, 0.4),
      row('bush', BUSHES, 0.3),
      row('rock', ROCKS, 0.2, { on: 'any', slope: ANY, clump: 0 }),
      row('rock', BIG_ROCKS, 0.1, { on: 'bank', slope: ANY, clump: 0 }),
    ],
    cover: [
      row('pebble', [...ROUND_PEBBLES, ...SQUARE_PEBBLES], 0.5, { on: 'bank', slope: ANY, clump: 0 }),
      row('grass', TUFTS, 0.5, { slope: [0, 0.5] }),
    ],
  },
  volcanic: {
    count: [12, 16],
    species: [
      row('tree', TWISTED, 0.2),
      row('tree', DEAD, 0.25, { shade: 0 }),
      row('rock', BIG_ROCKS, 0.3, { on: 'any', slope: [0.15, 4], clump: 0 }),
      row('rock', ROCKS, 0.25, { on: 'any', slope: ANY, clump: 0 }),
    ],
    cover: [
      row('pebble', ROUND_PEBBLES, 0.5, { on: 'any', slope: [0, 0.35] }),
      row('pebble', SQUARE_PEBBLES, 0.5, { on: 'any', slope: [0.2, 4], clump: 0 }),
    ],
  },
  forest: {
    // (34 trees, bushes and rocks a cell, not 40: at 40 a whole world seen
    // from above drew more than high's 3M triangles; thicker still than
    // temperate in trees, 27 a cell to its 22)
    count: [34, 90],
    species: [
      row('tree', GIANT, 0.3),
      row('tree', PINE, 0.3),
      row('tree', COMMON, 0.16),
      row('tree', BIRCH, 0.06),
      row('bush', BUSHES, 0.12),
      row('rock', [...ROCKS, ...BIG_ROCKS], 0.06, { on: 'any', slope: STEEP, clump: 0 }),
    ],
    cover: [
      row('plant', FERNS, 0.3),
      row('mushroom', MUSHROOMS, 0.2),
      row('plant', PLANTS, 0.15),
      row('plant', CLOVER, 0.1),
      row('grass', TUFTS, 0.15, { slope: [0, 0.5] }),
      row('pebble', ROUND_PEBBLES, 0.1, { on: 'any', slope: [0, 1], clump: 0 }),
    ],
  },
};

const copy = (r, count) => ({ ...r, names: [...r.names], slope: [...r.slope], perCell: r.perCell ?? Math.round(r.weight * count) });

export function floraFor(type) {
  const t = TYPES[type] ?? TYPES.temperate;
  return {
    species: [...t.species.map((r) => copy(r, t.count[0])), copy(CRATE)],
    cover: t.cover.map((r) => copy(r, t.count[1])),
  };
}
