// Minecraft, the blocks: every block the world knows, by number, with the
// game's own numbers. A chunk keeps a block as a byte, its index here; the
// mesher reads a block's faces and shape, the light its opacity and glow,
// breaking its hardness, tool and tier, and the sim its drops.
//
// A face names a texture by the game's modern id (`grass_block_top`), never
// a file: the atlas (pack/atlas.js) finds the file in whatever pack it's
// given, through pack/aliases.js for the old names, and TEXTURES' order is
// the texture array's layers. Hardness is the game's (stone 1.5, obsidian 50,
// bedrock never); `tier` is the pickaxe tier a block needs to drop anything
// when `needs` is set (0 wood, 1 stone, 2 iron, 3 diamond).
//
// Rules only: no three.js, no DOM. This runs in the worker and in vitest.

export const AIR = 0;

// The tints a face can take, by the number a vertex carries (three bits).
// Grass and foliage follow the biome; birch and spruce leaves keep the game's
// fixed colours; water has its own.
export const TINTS = [null, 'grass', 'foliage', 'water', 'birch', 'spruce'];

const one = (item) => [{ item, count: 1 }];
const none = () => [];
// how many of something, from lo to hi inclusive
const some = (rand, lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));

function make(name, faces, o = {}) {
  const shape = o.shape ?? 'cube';
  const full = shape === 'cube';
  return {
    name,
    faces,
    shape,
    opaque: o.opaque ?? full,
    light: o.light ?? 0,
    hardness: o.hardness ?? 1,
    tool: o.tool ?? null,
    needs: o.needs ?? false,
    tier: o.tier ?? 0,
    sound: o.sound ?? 'stone',
    tint: o.tint ?? null,
    tintTopOnly: o.tintTopOnly ?? false,
    solid: o.solid ?? !['cross', 'liquid', 'torch', 'none'].includes(shape),
    gravity: o.gravity ?? false,
    // a cutout block hides its faces against its own kind (glass) or not (leaves)
    cullSelf: o.cullSelf ?? true,
    dropSelf: o.drops ?? null,
  };
}

const all = (t) => ({ top: t, bottom: t, north: t, south: t, east: t, west: t });
const column = (side, top, bottom = top) => ({ top, bottom, north: side, south: side, east: side, west: side });
// a block with a front: the front faces north until Phase 2's placing turns it
const fronted = (front, side, top, bottom = top) => ({ top, bottom, north: front, south: side, east: side, west: side });

const cube = (name, tex, o) => make(name, all(tex), o);

const WOODS = ['oak', 'birch', 'spruce', 'jungle', 'acacia'];
const COLOURS = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'];

const pickaxe = (tier = 0) => ({ tool: 'pickaxe', needs: true, tier });
const axe = { tool: 'axe', sound: 'wood' };
const shovel = { tool: 'shovel' };
const plant = { shape: 'cross', hardness: 0, sound: 'grass' };

// The leaves' drops: a sapling 1 in 20 (1 in 40 for jungle), and from oak an
// apple 1 in 200, as the game rolls them; shears take the leaves themselves.
const leafDrops = (wood) => (state, tool, rand = Math.random) => {
  if (tool?.type === 'shears') return one(`${wood}_leaves`);
  const out = [];
  if (rand() < (wood === 'jungle' ? 1 / 40 : 1 / 20)) out.push({ item: `${wood}_sapling`, count: 1 });
  if (wood === 'oak' && rand() < 1 / 200) out.push({ item: 'apple', count: 1 });
  return out;
};

const LIST = [
  make('air', null, { shape: 'none', opaque: false, hardness: 0, solid: false }),
  cube('stone', 'stone', { hardness: 1.5, ...pickaxe(), drops: () => one('cobblestone') }),
  cube('cobblestone', 'cobblestone', { hardness: 2, ...pickaxe() }),
  cube('dirt', 'dirt', { hardness: 0.5, ...shovel, sound: 'gravel' }),
  make('grass_block', column('grass_block_side', 'grass_block_top', 'dirt'), { hardness: 0.6, ...shovel, sound: 'grass', tint: 'grass', tintTopOnly: true, drops: () => one('dirt') }),
  make('podzol', column('podzol_side', 'podzol_top', 'dirt'), { hardness: 0.5, ...shovel, sound: 'gravel', drops: () => one('dirt') }),
  cube('sand', 'sand', { hardness: 0.5, ...shovel, sound: 'sand', gravity: true }),
  make('sandstone', column('sandstone', 'sandstone_top', 'sandstone_bottom'), { hardness: 0.8, ...pickaxe() }),
  cube('gravel', 'gravel', { hardness: 0.6, ...shovel, sound: 'gravel', gravity: true, drops: (s, t, rand = Math.random) => one(rand() < 0.1 ? 'flint' : 'gravel') }),
  cube('clay', 'clay', { hardness: 0.6, ...shovel, sound: 'gravel', drops: () => [{ item: 'clay_ball', count: 4 }] }),
  cube('bedrock', 'bedrock', { hardness: Infinity, drops: none }),
  cube('water', 'water_still', { shape: 'liquid', opaque: false, hardness: Infinity, tint: 'water', drops: none }),
  cube('lava', 'lava_still', { shape: 'liquid', opaque: false, hardness: Infinity, light: 15, drops: none }),
  ...WOODS.map((w) => make(`${w}_log`, column(`${w}_log`, `${w}_log_top`), { hardness: 2, ...axe })),
  ...WOODS.map((w) => cube(`${w}_planks`, `${w}_planks`, { hardness: 2, ...axe })),
  ...WOODS.map((w) =>
    cube(`${w}_leaves`, `${w}_leaves`, {
      shape: 'cutout',
      cullSelf: false,
      hardness: 0.2,
      tool: 'shears',
      sound: 'grass',
      tint: w === 'birch' ? 'birch' : w === 'spruce' ? 'spruce' : 'foliage',
      drops: leafDrops(w),
    }),
  ),
  cube('coal_ore', 'coal_ore', { hardness: 3, ...pickaxe(0), drops: () => one('coal') }),
  cube('iron_ore', 'iron_ore', { hardness: 3, ...pickaxe(1) }),
  cube('gold_ore', 'gold_ore', { hardness: 3, ...pickaxe(2) }),
  cube('redstone_ore', 'redstone_ore', { hardness: 3, ...pickaxe(2), drops: (s, t, rand = Math.random) => [{ item: 'redstone', count: some(rand, 4, 5) }] }),
  cube('lapis_ore', 'lapis_ore', { hardness: 3, ...pickaxe(1), drops: (s, t, rand = Math.random) => [{ item: 'lapis_lazuli', count: some(rand, 4, 9) }] }),
  cube('diamond_ore', 'diamond_ore', { hardness: 3, ...pickaxe(2), drops: () => one('diamond') }),
  cube('iron_block', 'iron_block', { hardness: 5, ...pickaxe(1) }),
  cube('gold_block', 'gold_block', { hardness: 3, ...pickaxe(2) }),
  cube('diamond_block', 'diamond_block', { hardness: 5, ...pickaxe(2) }),
  cube('glass', 'glass', { shape: 'cutout', hardness: 0.3, sound: 'glass', drops: none }),
  cube('bricks', 'bricks', { hardness: 2, ...pickaxe() }),
  cube('stone_bricks', 'stone_bricks', { hardness: 1.5, ...pickaxe() }),
  cube('mossy_cobblestone', 'mossy_cobblestone', { hardness: 2, ...pickaxe() }),
  cube('obsidian', 'obsidian', { hardness: 50, ...pickaxe(3) }),
  // a snow layer is a slab-like sliver the game walks through at one layer
  cube('snow', 'snow', { shape: 'slab', solid: false, hardness: 0.1, tool: 'shovel', needs: true, sound: 'snow', drops: () => one('snowball') }),
  cube('snow_block', 'snow', { hardness: 0.2, tool: 'shovel', needs: true, sound: 'snow', drops: () => [{ item: 'snowball', count: 4 }] }),
  cube('ice', 'ice', { shape: 'cutout', hardness: 0.5, tool: 'pickaxe', sound: 'glass', drops: none }),
  make('bookshelf', column('bookshelf', 'oak_planks'), { hardness: 1.5, ...axe, drops: () => [{ item: 'book', count: 3 }] }),
  cube('glowstone', 'glowstone', { hardness: 0.3, light: 15, sound: 'glass', drops: (s, t, rand = Math.random) => [{ item: 'glowstone_dust', count: some(rand, 2, 4) }] }),
  cube('torch', 'torch', { shape: 'torch', hardness: 0, light: 14, sound: 'wood' }),
  make('crafting_table', { top: 'crafting_table_top', bottom: 'oak_planks', north: 'crafting_table_front', west: 'crafting_table_front', south: 'crafting_table_side', east: 'crafting_table_side' }, { hardness: 2.5, ...axe }),
  make('furnace', fronted('furnace_front', 'furnace_side', 'furnace_top'), { hardness: 3.5, ...pickaxe() }),
  make('chest', fronted('chest_front', 'chest_side', 'chest_top'), { opaque: false, hardness: 2.5, ...axe }),
  cube('ladder', 'ladder', { shape: 'ladder', solid: false, hardness: 0.4, ...axe }),
  make('oak_door', column('oak_door_bottom', 'oak_planks'), { shape: 'door', opaque: false, hardness: 3, ...axe }),
  cube('oak_fence', 'oak_planks', { shape: 'fence', opaque: false, hardness: 2, ...axe }),
  cube('oak_slab', 'oak_planks', { shape: 'slab', opaque: false, hardness: 2, ...axe }),
  cube('oak_stairs', 'oak_planks', { shape: 'stairs', opaque: false, hardness: 2, ...axe }),
  ...COLOURS.map((c) => cube(`${c}_wool`, `${c}_wool`, { hardness: 0.8, tool: 'shears', sound: 'cloth' })),
  cube('short_grass', 'short_grass', { ...plant, tint: 'grass', drops: (s, t, rand = Math.random) => (rand() < 1 / 8 ? one('wheat_seeds') : []) }),
  cube('fern', 'fern', { ...plant, tint: 'grass', drops: (s, t, rand = Math.random) => (rand() < 1 / 8 ? one('wheat_seeds') : []) }),
  cube('dead_bush', 'dead_bush', { ...plant, drops: (s, t, rand = Math.random) => [{ item: 'stick', count: some(rand, 0, 2) }].filter((d) => d.count) }),
  cube('dandelion', 'dandelion', plant),
  cube('poppy', 'poppy', plant),
  ...WOODS.map((w) => cube(`${w}_sapling`, `${w}_sapling`, plant)),
  make('cactus', column('cactus_side', 'cactus_top', 'cactus_bottom'), { shape: 'cutout', hardness: 0.4, sound: 'cloth' }),
  cube('sugar_cane', 'sugar_cane', plant),
  make('pumpkin', column('pumpkin_side', 'pumpkin_top'), { hardness: 1, ...axe }),
  make('jack_o_lantern', fronted('jack_o_lantern', 'pumpkin_side', 'pumpkin_top'), { hardness: 1, ...axe, light: 15 }),
  make('melon', column('melon_side', 'melon_top'), { hardness: 1, ...axe, drops: (s, t, rand = Math.random) => [{ item: 'melon_slice', count: some(rand, 3, 7) }] }),
  // wheat's state is its age, 0 to 7; ripe at 7
  cube('wheat', 'wheat_stage7', { ...plant, drops: (state, t, rand = Math.random) => (state >= 7 ? [{ item: 'wheat', count: 1 }, { item: 'wheat_seeds', count: some(rand, 1, 3) }] : one('wheat_seeds')) }),
  make('farmland', column('dirt', 'farmland', 'dirt'), { hardness: 0.6, ...shovel, sound: 'gravel', drops: () => one('dirt') }),
  make('tnt', column('tnt_side', 'tnt_top', 'tnt_bottom'), { hardness: 0, sound: 'grass' }),
  cube('netherrack', 'netherrack', { hardness: 0.4, ...pickaxe() }),
  make('red_bed', column('red_bed_side', 'red_bed_top', 'oak_planks'), { shape: 'slab', hardness: 0.2, sound: 'wood' }),
];

// What a block drops, by the game's rule: nothing when it needs a tool of a
// tier the hand doesn't hold; otherwise its own drop, or itself.
function dropsFor(b) {
  const own = b.dropSelf ?? (() => one(b.name));
  return (state = 0, tool = null, rand = Math.random) => {
    if (b.needs && (tool?.type !== b.tool || (tool.tier ?? 0) < b.tier)) return [];
    return own(state, tool, rand);
  };
}

export const BLOCKS = LIST.map((b, id) => {
  const out = { id, ...b, drops: dropsFor(b) };
  delete out.dropSelf;
  return Object.freeze(out);
});

export const byName = new Map(BLOCKS.map((b) => [b.name, b]));
export const block = (id) => BLOCKS[id] ?? BLOCKS[AIR];

// Tiles no block shows by default: by its state (the door's top, the lit
// furnace, the wheat's ages, wet farmland), or drawn over one (the cracks).
export const EXTRA_TEXTURES = [
  'oak_door_top',
  'furnace_front_on',
  'farmland_moist',
  'water_flow',
  'lava_flow',
  ...[0, 1, 2, 3, 4, 5, 6].map((i) => `wheat_stage${i}`),
  ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => `destroy_stage_${i}`),
];

// Every tile any face names, once, sorted: its index is its texture layer.
export const TEXTURES = [...new Set([...BLOCKS.slice(1).flatMap((b) => Object.values(b.faces)), ...EXTRA_TEXTURES])].sort();
