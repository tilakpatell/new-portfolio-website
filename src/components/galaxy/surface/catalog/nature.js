// Quaternius's Stylized Nature MegaKit (CC0 1.0, quaternius.com), on the
// galaxy's green worlds: what scripts/quaternius-nature.mjs cuts down from
// the pack's glTF (`node scripts/quaternius-nature.mjs`), each written to
// public/models/galaxy/surface/<kind>.glb standing on y = 0, in metres, its
// x and z as the pack has them (a tree's trunk at the origin).
//   from    the pack's file (its glTF folder, without .gltf)
//   sway    how it moves in the wind (surface/nature.js): 'tree' (leaves
//           and branches together), 'shrub', 'grass', or still
//   shadow  false for what's too low to throw a shadow worth drawing
//   tris    a cut, for the few that are heavier than they look
//   tex     its pictures' size
// Their colours are set here too, by material: the pack paints its leaves
// and grass in its own shader, so here they're grey cut-outs given a
// colour, and a scatter's colour pair (its `tint`) goes over that.
export const NATURE_COLOURS = {
  Leaves_Birch: '#b8d468',
  Leaves_NormalTree: '#8cc05a',
  Leaves_Pine: '#4d7a44',
  Leaves_GiantPine: '#6f9a52',
  Leaves_TwistedTree: '#9cbc5c',
  Leaves_CherryBlossom: '#ffc8da',
  // (grass pale, for each world's own colour pair to make it its grass)
  Grass: '#e8ecd4',
};

const q = (from, as, metres, more = {}) => ({ cc0: 'quaternius', from, as, metres, tex: 512, ...more });
const tree = (from, as, metres) => q(from, as, metres, { sway: 'tree', lod: true });
const low = (from, as, metres, more = {}) => q(from, as, metres, { shadow: false, ...more });

export const MODELS = {
  // trees, each with a light copy for far off
  nkbirch1: tree('Birch_1', 'the birches', 13.7),
  nkbirch3: tree('Birch_3', 'the birches', 13.4),
  nkbirch5: tree('Birch_5', 'the birches', 13.7),
  nkcherry1: tree('CherryBlossom_1', 'the cherry trees', 13.4),
  nkcherry4: tree('CherryBlossom_4', 'the cherry trees', 13.4),
  nkcommon1: tree('CommonTree_1', 'the trees', 7.3),
  nkcommon3: tree('CommonTree_3', 'the trees', 9.4),
  nkpine2: tree('Pine_2', 'the pines', 7.4),
  nkpine5: tree('Pine_5', 'the pines', 8.7),
  nktwisted1: tree('TwistedTree_1', 'the twisted trees', 16.7),
  nktwisted3: tree('TwistedTree_3', 'the twisted trees', 16.1),
  nkdead1: tree('DeadTree_1', 'the dead trees', 9.5),
  nkdead3: tree('DeadTree_3', 'the dead trees', 13.3),
  // bushes
  nkbush: q('Bush_Common', 'the bushes', 1.6, { sway: 'shrub' }),
  nkbushflowers: q('Bush_Common_Flowers', 'the flowering bushes', 1.6, { sway: 'shrub', tris: 700 }),
  nkbushlarge: q('Bush_Large', 'the big bushes', 3.3, { sway: 'shrub' }),
  nkbushlong: q('Bush_Long_1', 'the tall bushes', 2.4, { sway: 'shrub' }),
  // ferns, plants and clover
  nkfern1: low('Fern_1', 'the ferns', 0.8, { sway: 'shrub' }),
  nkplant1big: low('Plant_1_Big', 'the big-leaved plants', 2.3, { sway: 'shrub' }),
  nkplant2: low('Plant_2', 'the plants', 1.6, { sway: 'shrub' }),
  nkplant3: low('Plant_3', 'the low plants', 0.7, { sway: 'shrub' }),
  nkplant7: low('Plant_7', 'the ground leaves', 0.3, { sway: 'shrub' }),
  nkclover1: low('Clover_1', 'the clover', 1.1, { sway: 'shrub' }),
  // flowers
  nkflowers2: low('Flower_2_Group', 'the flowers', 1.6, { sway: 'shrub', tris: 600 }),
  nkflowers3: low('Flower_3_Group', 'the flowers', 2.1, { sway: 'shrub', tris: 600 }),
  nkflower3: low('Flower_3_Single', 'the flowers', 2.1, { sway: 'shrub' }),
  nkflower6: low('Flower_6', 'the flowers', 0.2, { sway: 'shrub' }),
  nkflower7: low('Flower_7_Single', 'the flowers', 1.6, { sway: 'shrub' }),
  // grass in clumps
  nkgrass: low('Grass_Common_Tall', 'the grass', 1.9, { sway: 'grass', tex: 256 }),
  nkgrasswide: low('Grass_Wide_Short', 'the grass', 1.3, { sway: 'grass', tex: 256 }),
  nkgrasswispy: low('Grass_Wispy_Tall', 'the wispy grass', 1.7, { sway: 'grass', tex: 256 }),
  nkwheat: low('Grass_Wheat', 'the tall grass', 1.8, { sway: 'grass', tex: 256 }),
  // mushrooms
  nkredcap: low('Mushroom_RedCap', 'the red caps', 0.9),
  nkmushroom: low('Mushroom_Common', 'the toadstools', 0.5),
  nkoyster: low('Mushroom_Oyster', 'the bracket fungi', 1.8),
  // rocks, stepping stones, pebbles
  nkrock1: q('Rock_Medium_1', 'the rocks', 2.3),
  nkrock3: q('Rock_Medium_3', 'the rocks', 2.3),
  nkrockbig: q('Rock_Big_1', 'the boulders', 4.6),
  nkpath1: low('RockPath_Square_Small_2', 'the stepping stones', 0.1, { tris: 300 }),
  nkpath2: low('RockPath_Round_Small_3', 'the stepping stones', 0.1, { tris: 300 }),
  nkpebble: low('Pebble_Round_1', 'the pebbles', 0.1),
  nkpebblesq: low('Pebble_Square_3', 'the pebbles', 0.2),
};
