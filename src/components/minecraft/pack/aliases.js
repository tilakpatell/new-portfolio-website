// Minecraft, where a pack keeps each tile. The code names textures by the
// game's modern ids (1.13 on, `oak_log`); a 1.12-era pack (Pixel
// Perfection's own first release, an old jar) names the same pixels
// differently (`log_oak`), and a few tiles are no file at all but a cut of
// an entity's sheet (the chest and the bed, which the game draws as models).
// The atlas tries the modern name first, then these, in order.
//
// An alias is a file name in the same folder (`log_oak`), a path under
// textures/ (`entity/chest/normal`), or a cut: { from, parts: [{ x, y, w, h,
// dx, dy, flipY, rot }] }, each part copied from the sheet into a blank 16 ×
// 16 at (dx, dy), turned a quarter clockwise when `rot` and flipped when
// `flipY`.

const WOODS = ['oak', 'birch', 'spruce', 'jungle', 'acacia'];
const COLOURS = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'];
// 1.12 called the colours by their old dye names
const OLD_COLOUR = { light_gray: 'silver' };

// The chest, 14 blocks-sixteenths wide and 14 tall: its sheet since 1.15
// has the model turned over, so the outside of the lid is the second square
// and the front strips (the ones with the latch's notch) read upside down.
const chest = (lid, base) => ({
  from: 'entity/chest/normal',
  parts: [
    { ...base, dx: 1, dy: 6, flipY: true },
    { ...lid, dx: 1, dy: 2, flipY: true },
  ],
});

export const ALIASES = {
  grass_block_top: ['grass_top'],
  grass_block_side: ['grass_side'],
  podzol_top: ['dirt_podzol_top'],
  podzol_side: ['dirt_podzol_side'],
  sandstone: ['sandstone_normal'],
  ...Object.fromEntries(WOODS.flatMap((w) => [
    [`${w}_log`, [`log_${w}`]],
    [`${w}_log_top`, [`log_${w}_top`]],
    [`${w}_planks`, [`planks_${w}`]],
    [`${w}_leaves`, [`leaves_${w}`]],
    [`${w}_sapling`, [`sapling_${w}`]],
  ])),
  bricks: ['brick'],
  stone_bricks: ['stonebrick'],
  mossy_cobblestone: ['cobblestone_mossy'],
  torch: ['torch_on'],
  furnace_front: ['furnace_front_off'],
  oak_door_bottom: ['door_wood_lower'],
  oak_door_top: ['door_wood_upper'],
  ...Object.fromEntries(COLOURS.map((c) => [`${c}_wool`, [`wool_colored_${OLD_COLOUR[c] ?? c}`]])),
  // 'grass' from 1.13 to 1.20.2, 'tallgrass' before
  short_grass: ['grass', 'tallgrass'],
  dead_bush: ['deadbush'],
  dandelion: ['flower_dandelion'],
  poppy: ['flower_rose'],
  sugar_cane: ['reeds'],
  jack_o_lantern: ['pumpkin_face_on'],
  // Pixel Perfection Legacy's ripe wheat
  wheat_stage7: ['wheat_stage_full_7', 'wheat_stage_7'],
  ...Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((i) => [`wheat_stage${i}`, [`wheat_stage_${i}`]])),
  farmland: ['farmland_dry'],
  farmland_moist: ['farmland_wet'],
  // the items' 1.12 names (the same table serves the item folder)
  ...Object.fromEntries(['pickaxe', 'axe', 'shovel', 'sword', 'hoe'].flatMap((t) => [
    [`wooden_${t}`, [`wood_${t}`]],
    [`golden_${t}`, [`gold_${t}`]],
  ])),
  ...Object.fromEntries(['porkchop', 'beef', 'chicken', 'mutton'].flatMap((m) => [
    [m, [`${m}_raw`]],
    [`cooked_${m}`, [`${m}_cooked`]],
  ])),
  wheat_seeds: ['seeds_wheat'],
  lapis_lazuli: ['dye_powder_blue'],
  melon_slice: ['melon'],
  oak_door: ['door_wood'],
    chest_top: [{ from: 'entity/chest/normal', parts: [{ x: 28, y: 0, w: 14, h: 14, dx: 1, dy: 1 }] }],
  chest_front: [
    {
      from: 'entity/chest/normal',
      parts: [...chest({ x: 42, y: 14, w: 14, h: 5 }, { x: 42, y: 33, w: 14, h: 10 }).parts, { x: 1, y: 1, w: 2, h: 4, dx: 7, dy: 5 }],
    },
  ],
  chest_side: [chest({ x: 0, y: 14, w: 14, h: 5 }, { x: 0, y: 33, w: 14, h: 10 })],
  // the bed lies 9 high: its blanket from the sheet's foot square, its side
  // the mattress's edge turned to lie flat over the legs' three
  red_bed_top: [{ from: 'entity/bed/red', parts: [{ x: 6, y: 28, w: 16, h: 16, dx: 0, dy: 0 }] }],
  red_bed_head_top: [{ from: 'entity/bed/red', parts: [{ x: 6, y: 6, w: 16, h: 16, dx: 0, dy: 0 }] }],
  red_bed_side: [{ from: 'entity/bed/red', parts: [{ x: 22, y: 28, w: 6, h: 16, dx: 0, dy: 7, rot: true }] }],
};

// The mob skins, each the first file found; Phase 5 draws them on the box
// models. 1.21.5 gave the farm animals climate variants and kept the classic
// look as `temperate_`.
export const SKINS = {
  player: ['entity/player/wide/steve', 'entity/steve'],
  zombie: ['entity/zombie/zombie'],
  skeleton: ['entity/skeleton/skeleton'],
  creeper: ['entity/creeper/creeper'],
  spider: ['entity/spider/spider'],
  enderman: ['entity/enderman/enderman'],
  pig: ['entity/pig/pig', 'entity/pig/temperate_pig'],
  cow: ['entity/cow/cow', 'entity/cow/temperate_cow'],
  sheep: ['entity/sheep/sheep'],
  sheep_wool: ['entity/sheep/sheep_fur', 'entity/sheep/sheep_wool'],
  chicken: ['entity/chicken', 'entity/chicken/chicken', 'entity/chicken/temperate_chicken'],
  villager: ['entity/villager/villager'],
};

// The sky's and the HUD's pictures, each kept at its own size: the sun and
// the moon's eight phases, the cloud map (a texel a 12-block cell), the
// hotbar, its selection frame, the crosshair, the hearts, hunger and air,
// and the grass and foliage colormaps.
export const SPRITES = {
  sun: ['environment/celestial/sun', 'environment/sun'],
  moon_phases: ['environment/celestial/moon_phases', 'environment/moon_phases'],
  clouds: ['environment/clouds'],
  hotbar: ['gui/sprites/hud/hotbar'],
  hotbar_selection: ['gui/sprites/hud/hotbar_selection'],
  crosshair: ['gui/sprites/hud/crosshair'],
  heart_full: ['gui/sprites/hud/heart/full'],
  heart_half: ['gui/sprites/hud/heart/half'],
  heart_container: ['gui/sprites/hud/heart/container'],
  food_full: ['gui/sprites/hud/food_full'],
  food_half: ['gui/sprites/hud/food_half'],
  food_empty: ['gui/sprites/hud/food_empty'],
  air: ['gui/sprites/hud/air'],
  // the biome tints, read by temperature and rainfall as the game reads them
  colormap_grass: ['colormap/grass'],
  colormap_foliage: ['colormap/foliage'],
  // the empty experience bar (nothing earns any yet; the game shows it all the same)
  experience_bar_background: ['gui/sprites/hud/experience_bar_background'],
  // the screens: the inventory's, the crafting table's, the furnace's (its flame and
  // arrow apart) and the chest's panels
  inventory: ['gui/container/inventory'],
  crafting_table: ['gui/container/crafting_table'],
  furnace: ['gui/container/furnace'],
  lit_progress: ['gui/sprites/container/furnace/lit_progress'],
  burn_progress: ['gui/sprites/container/furnace/burn_progress'],
  chest: ['gui/container/generic_54'],
};
