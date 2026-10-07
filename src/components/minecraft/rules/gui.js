// Minecraft, the inventory screen's hands: what a click does on a slot, the
// crafting grid (the inventory's 2 × 2, a crafting table's 3 × 3) or the
// grid's result, as the game's containers do it. A left click picks a stack
// up, puts it down, merges like stacks and swaps unlike; a right click takes
// the larger half or puts one down; a shift-click moves a stack across (the
// hotbar and the rest of the inventory, the grid into the inventory) and on
// the result crafts as many as it can. Closing gives back what's in the grid
// and the cursor; what won't fit is returned to be dropped.
//
// A chest's screen and a furnace's work the same over their own slots: a
// shift-click moves a stack between them and the inventory (into a furnace,
// what cooks to its top, a fuel to its bottom, anything else hotbar to
// rest); a furnace's output only gives.

import { match } from './crafting.js';
import { FURNACE_FUEL, SMELTING } from './furnace.js';
import { fill, give, quickMove } from './inventory.js';
import { stackOf } from './items.js';

export const makeScreen = (size = 2) => ({ size, grid: new Array(size * size).fill(null), cursor: null });
export const makeChest = (slots) => ({ kind: 'chest', slots, cursor: null });
export const makeFurnaceScreen = (furnace) => ({ kind: 'furnace', furnace, cursor: null });

const names = (s) => s.grid.map((c) => c?.item ?? null);
export const result = (s) => match(names(s), s.size)?.result ?? null;

// one craft: one off each ingredient; the result made
function craft(s) {
  const m = match(names(s), s.size);
  if (!m) return null;
  for (const i of m.consume) {
    s.grid[i].count--;
    if (!s.grid[i].count) s.grid[i] = null;
  }
  return { item: m.result.item, count: m.result.count, damage: 0 };
}

function clickSlot(s, slots, i, button) {
  const here = slots[i];
  const held = s.cursor;
  if (button === 'right') {
    if (!held) {
      if (!here) return;
      const n = Math.ceil(here.count / 2);
      s.cursor = { ...here, count: n };
      here.count -= n;
      if (!here.count) slots[i] = null;
      return;
    }
    if (!here) slots[i] = { ...held, count: 1 };
    else if (here.item === held.item && here.count < stackOf(here.item) && stackOf(here.item) > 1) here.count++;
    else return;
    held.count--;
    if (!held.count) s.cursor = null;
    return;
  }
  if (!held) {
    s.cursor = here;
    slots[i] = null;
    return;
  }
  if (!here) {
    slots[i] = held;
    s.cursor = null;
    return;
  }
  if (here.item === held.item && stackOf(here.item) > 1) {
    const n = Math.min(held.count, stackOf(here.item) - here.count);
    here.count += n;
    held.count -= n;
    if (!held.count) s.cursor = null;
    return;
  }
  slots[i] = held;
  s.cursor = here;
}

// a chest's or a furnace's screen
function clickContainer(s, inv, { area, index, button, shift }) {
  const theirs = s.kind === 'chest' ? s.slots : s.furnace.slots;
  if (area === 'inv') {
    const st = inv.slots[index];
    if (!shift || !st) return clickSlot(s, inv.slots, index, button);
    let left;
    if (s.kind === 'chest') left = fill(theirs, 0, theirs.length, st);
    else if (SMELTING[st.item]) left = fill(theirs, 0, 1, st);
    else if (FURNACE_FUEL[st.item]) left = fill(theirs, 1, 2, st);
    else return quickMove(inv, index);
    if (!left) inv.slots[index] = null;
    return;
  }
  const here = theirs[index];
  if (shift) {
    if (!here) return;
    const left = give(inv, here.item, here.count, here.damage);
    theirs[index] = left ? { ...here, count: left } : null;
    return;
  }
  // the output: taken, or added to a like stack in the cursor, never filled
  if (s.kind === 'furnace' && index === 2) {
    if (!here) return;
    if (!s.cursor) return clickSlot(s, theirs, index, button);
    if (s.cursor.item === here.item && s.cursor.count + here.count <= stackOf(here.item)) {
      s.cursor.count += here.count;
      theirs[index] = null;
    }
    return;
  }
  clickSlot(s, theirs, index, button);
}

// where: { area: 'inv' | 'grid' | 'result' | 'chest' | 'furnace', index, button: 'left' | 'right', shift }
export function click(s, inv, { area, index, button = 'left', shift = false }) {
  if (s.kind) return clickContainer(s, inv, { area, index, button, shift });
  if (area === 'result') {
    if (shift) {
      for (let made = result(s); made; made = result(s)) {
        // only as many as the inventory takes whole
        const trial = { slots: inv.slots.map((x) => (x ? { ...x } : null)) };
        if (give(trial, made.item, made.count)) break;
        const out = craft(s);
        give(inv, out.item, out.count);
      }
      return;
    }
    const made = result(s);
    if (!made) return;
    const held = s.cursor;
    if (held && (held.item !== made.item || held.count + made.count > stackOf(made.item))) return;
    const out = craft(s);
    if (held) held.count += out.count;
    else s.cursor = out;
    return;
  }
  const slots = area === 'grid' ? s.grid : inv.slots;
  if (shift) {
    if (area === 'inv') quickMove(inv, index);
    else if (s.grid[index]) {
      const st = s.grid[index];
      const left = give(inv, st.item, st.count, st.damage);
      if (left) st.count = left;
      else s.grid[index] = null;
    }
    return;
  }
  clickSlot(s, slots, index, button);
}

// Leaving the screen: the grid and the cursor back into the inventory; what won't fit, to drop.
export function close(s, inv) {
  const spill = [];
  for (const st of [...(s.grid ?? []), s.cursor]) {
    if (!st) continue;
    const left = give(inv, st.item, st.count, st.damage);
    if (left) spill.push({ ...st, count: left });
  }
  s.grid?.fill(null);
  s.cursor = null;
  return spill;
}
