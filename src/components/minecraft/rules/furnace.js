// Minecraft, the furnace, as the game's (TileEntityFurnace): three slots, what
// cooks, its fuel, what's made. Something cooks in 200 ticks while fuel
// burns; a fuel is only lit when there's something it can cook and room for
// what that makes, and it burns out whatever happens after. With nothing
// burning a half-cooked item cools two ticks a tick. Fuel in ticks is the
// game's: coal and charcoal 1600 (eight items), wood 300, a wooden tool 200,
// a slab 150, a stick or sapling 100. (A lava bucket's 20000 waits for buckets.)
//
// A furnace is { slots: [input, fuel, output], burn, burnMax, cook }; the
// world keeps them by cell (`g.furnaces`), the lit block shows while `burn`.

import { ITEMS, stackOf } from './items.js';

export const COOK_TICKS = 200;

const WOODS = ['oak', 'birch', 'spruce', 'jungle', 'acacia'];
const raw = {
  iron_ore: 'iron_ingot',
  gold_ore: 'gold_ingot',
  diamond_ore: 'diamond',
  coal_ore: 'coal',
  lapis_ore: 'lapis_lazuli',
  redstone_ore: 'redstone',
  sand: 'glass',
  cobblestone: 'stone',
  clay_ball: 'brick',
  netherrack: 'nether_brick',
  cactus: 'green_dye',
  porkchop: 'cooked_porkchop',
  beef: 'cooked_beef',
  chicken: 'cooked_chicken',
  mutton: 'cooked_mutton',
  ...Object.fromEntries(WOODS.map((w) => [`${w}_log`, 'charcoal'])),
};
// only what this world has, both sides
export const SMELTING = Object.freeze(Object.fromEntries(Object.entries(raw).filter(([a, b]) => ITEMS[a] && ITEMS[b])));

const fuel = {
  coal: 1600,
  charcoal: 1600,
  stick: 100,
  crafting_table: 300,
  chest: 300,
  bookshelf: 300,
  ladder: 300,
  oak_fence: 300,
  oak_stairs: 300,
  oak_slab: 150,
};
for (const w of WOODS) Object.assign(fuel, { [`${w}_log`]: 300, [`${w}_planks`]: 300, [`${w}_sapling`]: 100 });
for (const t of ['pickaxe', 'axe', 'shovel', 'sword', 'hoe']) fuel[`wooden_${t}`] = 200;
export const FURNACE_FUEL = Object.freeze(Object.fromEntries(Object.entries(fuel).filter(([a]) => ITEMS[a])));

export const makeFurnace = () => ({ slots: [null, null, null], burn: 0, burnMax: 0, cook: 0 });

// there's something to cook, and room for what it makes
function canSmelt(f) {
  const [input, , output] = f.slots;
  const made = input && SMELTING[input.item];
  if (!made) return false;
  return !output || (output.item === made && output.count + 1 <= stackOf(made));
}

// One tick. Says whether it's lit (for the block to show it).
export function stepFurnace(f) {
  if (f.burn > 0) f.burn--;
  const [input, fuelSlot] = f.slots;
  if (f.burn > 0 || (fuelSlot && input)) {
    if (f.burn <= 0 && canSmelt(f) && FURNACE_FUEL[fuelSlot?.item]) {
      f.burn = f.burnMax = FURNACE_FUEL[fuelSlot.item];
      fuelSlot.count--;
      if (!fuelSlot.count) f.slots[1] = null;
    }
    if (f.burn > 0 && canSmelt(f)) {
      if (++f.cook >= COOK_TICKS) {
        f.cook = 0;
        const made = SMELTING[f.slots[0].item];
        if (f.slots[2]) f.slots[2].count++;
        else f.slots[2] = { item: made, count: 1, damage: 0 };
        if (!--f.slots[0].count) f.slots[0] = null;
      }
    } else f.cook = 0;
  } else if (f.cook > 0) f.cook = Math.max(0, f.cook - 2);
  return f.burn > 0;
}
