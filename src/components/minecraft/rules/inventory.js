// Minecraft, the player's inventory: 36 slots, the first nine the hotbar
// (the number keys and the wheel pick one), each empty or a stack
// { item, count, damage } of up to the item's own stack size. What's
// picked up fills the stacks already there first, then the first empty
// slot, hotbar first, as the game fills them.

import { stackOf } from './items.js';

export const SLOTS = 36;
export const HOTBAR = 9;

export const makeInventory = () => ({ slots: new Array(SLOTS).fill(null), selected: 0 });
export const held = (inv) => inv.slots[inv.selected];
const stack = (item, count, damage = 0) => ({ item, count, damage });

// Puts count of an item in; says how many didn't fit.
export function give(inv, item, count, damage = 0) {
  const max = stackOf(item);
  let left = count;
  if (max > 1)
    for (let i = 0; i < SLOTS && left > 0; i++) {
      const s = inv.slots[i];
      if (!s || s.item !== item || s.count >= max) continue;
      const n = Math.min(left, max - s.count);
      s.count += n;
      left -= n;
    }
  for (let i = 0; i < SLOTS && left > 0; i++) {
    if (inv.slots[i]) continue;
    const n = Math.min(left, max);
    inv.slots[i] = stack(item, n, damage);
    left -= n;
  }
  return left;
}

export const count = (inv, item) => inv.slots.reduce((n, s) => n + (s?.item === item ? s.count : 0), 0);

// Takes up to count from a slot; the stack taken, or null.
export function take(inv, slot, n = 1) {
  const s = inv.slots[slot];
  if (!s) return null;
  const k = Math.min(n, s.count);
  s.count -= k;
  if (!s.count) inv.slots[slot] = null;
  return stack(s.item, k, s.damage);
}

// One slot onto another: like stacks merge as far as they go, unlike swap.
export function move(inv, from, to) {
  const a = inv.slots[from];
  const b = inv.slots[to];
  if (!a || from === to) return;
  if (b && b.item === a.item && stackOf(a.item) > 1) {
    const n = Math.min(a.count, stackOf(a.item) - b.count);
    b.count += n;
    a.count -= n;
    if (!a.count) inv.slots[from] = null;
    return;
  }
  inv.slots[from] = b;
  inv.slots[to] = a;
}

// Half a stack picked up, the larger half, as a right-click takes it.
export function split(inv, slot) {
  const s = inv.slots[slot];
  if (!s) return null;
  return take(inv, slot, Math.ceil(s.count / 2));
}

// A stack moved into slots lo to hi (a shift-click's way): onto like stacks
// first, then the first empty; what's moved leaves s, which says what's left.
export function fill(slots, lo, hi, s) {
  const max = stackOf(s.item);
  if (max > 1)
    for (let i = lo; i < hi && s.count; i++) {
      const t = slots[i];
      if (!t || t.item !== s.item || t.count >= max) continue;
      const n = Math.min(s.count, max - t.count);
      t.count += n;
      s.count -= n;
    }
  for (let i = lo; i < hi && s.count; i++) {
    if (slots[i]) continue;
    slots[i] = { ...s };
    s.count = 0;
  }
  return s.count;
}

// A shift-click: from the hotbar into the rest, from the rest into the hotbar.
export function quickMove(inv, slot) {
  const s = inv.slots[slot];
  if (!s) return;
  const [lo, hi] = slot < HOTBAR ? [HOTBAR, SLOTS] : [0, HOTBAR];
  if (!fill(inv.slots, lo, hi, s)) inv.slots[slot] = null;
}
