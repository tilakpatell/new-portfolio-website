// Minecraft, how long a block takes to break: the game's sum, a tick at a
// time. Each tick holding the button takes speed ÷ hardness ÷ 30 of the
// block (÷ 100 when it needs a tool of a tier you don't hold, so it drops
// nothing), where the speed is 1 by hand or with the wrong tool and the
// tool's own (wood 2, stone 4, iron 6, diamond 8, gold 12) with the right
// one; a fifth as much in water or off the ground. A block goes when the
// sum reaches one, so the time is whole ticks: stone with a wooden pickaxe
// is 23 ticks, 1.15 s. More than one in a tick breaks it at once.

import { ITEMS } from './items.js';

const toolOf = (name) => (name ? ITEMS[name]?.tool ?? null : null);

// the speed a held item works a block at
function speedFor(block, name) {
  const tool = toolOf(name);
  if (!tool) return 1;
  if (tool.type === 'shears') return block.name.endsWith('_leaves') ? 15 : block.name.endsWith('_wool') ? 5 : 1;
  return tool.type === block.tool ? tool.speed : 1;
}

// whether breaking it with this in hand drops anything
export function canHarvest(block, name) {
  if (!block.needs) return true;
  const tool = toolOf(name);
  return Boolean(tool) && tool.type === block.tool && tool.tier >= block.tier;
}

export function breakTicks(block, name, { onGround = true, inWater = false } = {}) {
  if (block.hardness === Infinity) return Infinity;
  if (block.hardness === 0) return 0;
  let damage = speedFor(block, name) / block.hardness / (canHarvest(block, name) ? 30 : 100);
  if (inWater) damage /= 5;
  if (!onGround) damage /= 5;
  if (damage >= 1) return 0;
  return Math.ceil(1 / damage - 1e-9);
}

export const breakTime = (block, name, at) => {
  const t = breakTicks(block, name, at);
  return t === Infinity ? Infinity : Math.round(t * 5) / 100;
};
