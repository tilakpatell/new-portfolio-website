// Minecraft, the items: everything a slot can hold. Every block a player
// can hold is an item of its own name (stacks of 64); the rest are the
// game's materials, food and tools, with its numbers. A tool's tier is what
// it mines (wood 0, stone 1, iron 2, diamond 3; gold mines as wood but
// fastest of all), its speed how many times faster than a hand it breaks a
// block it's made for, its durability how many uses it has.
//
// `texture` names the item's own tile (item/<texture>.png in the pack);
// a block without one is drawn as its block (`icon: 'cube'`) or flat from
// its face (`icon: 'flat'`: plants, torches, ladders).

import { BLOCKS } from './blocks.js';

const TIERS = {
  wooden: { tier: 0, speed: 2, durability: 59 },
  stone: { tier: 1, speed: 4, durability: 131 },
  iron: { tier: 2, speed: 6, durability: 250 },
  golden: { tier: 0, speed: 12, durability: 32 },
  diamond: { tier: 3, speed: 8, durability: 1561 },
};
const TOOLS = ['pickaxe', 'axe', 'shovel', 'sword', 'hoe'];

// the game's food: hunger points and saturation
const FOOD = {
  apple: [4, 2.4],
  bread: [5, 6],
  porkchop: [3, 1.8],
  cooked_porkchop: [8, 12.8],
  beef: [3, 1.8],
  cooked_beef: [8, 12.8],
  chicken: [2, 1.2],
  cooked_chicken: [6, 7.2],
  mutton: [2, 1.2],
  cooked_mutton: [6, 9.6],
  melon_slice: [2, 1.2],
  rotten_flesh: [4, 0.8],
};
const MATERIALS = ['stick', 'coal', 'charcoal', 'diamond', 'iron_ingot', 'gold_ingot', 'redstone', 'lapis_lazuli', 'flint', 'clay_ball', 'brick', 'snowball', 'book', 'glowstone_dust', 'wheat', 'wheat_seeds', 'string', 'feather', 'gunpowder', 'leather', 'bone', 'arrow', 'ender_pearl', 'egg'];
const SIXTEEN = new Set(['egg', 'snowball', 'ender_pearl']);
// blocks a player never holds as themselves: liquids (buckets come later), the crop, farmland
const NOT_ITEMS = new Set(['air', 'water', 'lava', 'wheat', 'farmland']);
// blocks whose item has a tile of its own in the item folder
const OWN_TILE = { oak_door: 'oak_door', sugar_cane: 'sugar_cane' };

const items = {};
for (const b of BLOCKS) {
  if (NOT_ITEMS.has(b.name)) continue;
  const flat = ['cross', 'torch', 'ladder'].includes(b.shape);
  items[b.name] = { name: b.name, kind: 'block', block: b.id, stack: 64, texture: OWN_TILE[b.name] ?? null, icon: OWN_TILE[b.name] ? 'item' : flat ? 'flat' : 'cube' };
}
for (const m of MATERIALS) items[m] = { name: m, kind: 'material', stack: SIXTEEN.has(m) ? 16 : 64, texture: m, icon: 'item' };
for (const [name, [hunger, saturation]] of Object.entries(FOOD)) items[name] = { name, kind: 'food', food: { hunger, saturation }, stack: 64, texture: name, icon: 'item' };
for (const [material, t] of Object.entries(TIERS))
  for (const type of TOOLS) {
    const name = `${material}_${type}`;
    items[name] = { name, kind: 'tool', tool: { type, ...t }, stack: 1, texture: name, icon: 'item' };
  }
items.shears = { name: 'shears', kind: 'tool', tool: { type: 'shears', tier: 0, speed: 1.5, durability: 238 }, stack: 1, texture: 'shears', icon: 'item' };

export const ITEMS = Object.freeze(items);
export const item = (name) => {
  const it = ITEMS[name];
  if (!it) throw new Error(`no item ${name}`);
  return it;
};
export const stackOf = (name) => item(name).stack;

// Every item tile, once, sorted: its index is its layer in public/mc/items.webp.
export const ITEM_TEXTURES = [...new Set(Object.values(ITEMS).map((i) => i.texture).filter(Boolean))].sort();
