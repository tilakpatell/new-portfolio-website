// Minecraft, the recipes: the game's own, for everything the registry has.
// A shaped recipe is rows of letters and what each letter may be (one item,
// or any of a list: any planks, coal or charcoal); it matches anywhere in
// the grid, and mirrored. A shapeless one is a list of what goes in.
// Smelting is the furnace's (Phase 4).

const WOODS = ['oak', 'birch', 'spruce', 'jungle', 'acacia'];
export const PLANKS = WOODS.map((w) => `${w}_planks`);
const COAL = ['coal', 'charcoal'];

const shaped = (shape, key, item, count = 1) => ({ shape, key, result: { item, count } });
const shapeless = (items, item, count = 1) => ({ items, result: { item, count } });
const square = (from, item, count = 1) => shaped(['##', '##'], { '#': from }, item, count);
const block = (from, item) => [shaped(['###', '###', '###'], { '#': from }, item), shapeless([item], from, 9)];

const TOOLS = [
  ['wooden', PLANKS],
  ['stone', 'cobblestone'],
  ['iron', 'iron_ingot'],
  ['golden', 'gold_ingot'],
  ['diamond', 'diamond'],
];

export const RECIPES = [
  ...WOODS.map((w) => shapeless([`${w}_log`], `${w}_planks`, 4)),
  shaped(['#', '#'], { '#': PLANKS }, 'stick', 4),
  square(PLANKS, 'crafting_table'),
  ...TOOLS.flatMap(([tier, m]) => [
    shaped(['XXX', ' # ', ' # '], { X: m, '#': 'stick' }, `${tier}_pickaxe`),
    shaped(['XX', 'X#', ' #'], { X: m, '#': 'stick' }, `${tier}_axe`),
    shaped(['X', '#', '#'], { X: m, '#': 'stick' }, `${tier}_shovel`),
    shaped(['X', 'X', '#'], { X: m, '#': 'stick' }, `${tier}_sword`),
    shaped(['XX', ' #', ' #'], { X: m, '#': 'stick' }, `${tier}_hoe`),
  ]),
  shaped([' #', '# '], { '#': 'iron_ingot' }, 'shears'),
  shaped(['X', '#'], { X: COAL, '#': 'stick' }, 'torch', 4),
  shaped(['###', '# #', '###'], { '#': 'cobblestone' }, 'furnace'),
  shaped(['###', '# #', '###'], { '#': PLANKS }, 'chest'),
  shaped(['# #', '###', '# #'], { '#': 'stick' }, 'ladder', 3),
  shaped(['##', '##', '##'], { '#': 'oak_planks' }, 'oak_door', 3),
  shaped(['W#W', 'W#W'], { W: 'oak_planks', '#': 'stick' }, 'oak_fence', 3),
  shaped(['###'], { '#': 'oak_planks' }, 'oak_slab', 6),
  shaped(['#  ', '## ', '###'], { '#': 'oak_planks' }, 'oak_stairs', 4),
  shaped(['###', 'XXX'], { '#': 'red_wool', X: PLANKS }, 'red_bed'),
  shapeless(['sugar_cane', 'sugar_cane', 'sugar_cane'], 'paper', 3),
  shapeless(['paper', 'paper', 'paper', 'leather'], 'book'),
  shaped(['###', 'XXX', '###'], { '#': PLANKS, X: 'book' }, 'bookshelf'),
  shaped(['X#X', '#X#', 'X#X'], { X: 'gunpowder', '#': 'sand' }, 'tnt'),
  shaped(['A', 'B'], { A: 'pumpkin', B: 'torch' }, 'jack_o_lantern'),
  square('glowstone_dust', 'glowstone'),
  square('brick', 'bricks'),
  square('stone', 'stone_bricks', 4),
  square('sand', 'sandstone'),
  square('snowball', 'snow_block'),
  square('clay_ball', 'clay'),
  square('string', 'white_wool'),
  ...block('iron_ingot', 'iron_block'),
  ...block('gold_ingot', 'gold_block'),
  ...block('diamond', 'diamond_block'),
  shaped(['###', '###', '###'], { '#': 'melon_slice' }, 'melon'),
  shaped(['###'], { '#': 'wheat' }, 'bread'),
  shaped(['X', '#', 'Y'], { X: 'flint', '#': 'stick', Y: 'feather' }, 'arrow', 4),
];
