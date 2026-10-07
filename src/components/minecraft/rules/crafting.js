// Minecraft, the crafting grid: what a 2 × 2 (the inventory's) or a 3 × 3
// (the crafting table's) makes. A shaped recipe matches the grid's filled
// cells cut to their bounding box, as it is or mirrored left to right, so it
// goes anywhere in the grid; a shapeless one, the same things in any cells.

import { RECIPES } from './recipes.js';

const fits = (want, have) => (Array.isArray(want) ? want.includes(have) : want === have);

// the grid's filled part: its box and the cells in it
function trim(grid, size) {
  let x0 = size;
  let y0 = size;
  let x1 = -1;
  let y1 = -1;
  grid.forEach((c, i) => {
    if (!c) return;
    const x = i % size;
    const y = Math.floor(i / size);
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  });
  if (x1 < 0) return null;
  return { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

function shapedMatch(r, grid, size, box) {
  const h = r.shape.length;
  const w = Math.max(...r.shape.map((s) => s.length));
  if (w !== box.w || h !== box.h) return false;
  for (const mirror of [false, true]) {
    let ok = true;
    for (let y = 0; y < h && ok; y++)
      for (let x = 0; x < w && ok; x++) {
        const c = r.shape[y][mirror ? w - 1 - x : x] ?? ' ';
        const have = grid[(box.y0 + y) * size + box.x0 + x];
        ok = c === ' ' ? !have : Boolean(have) && fits(r.key[c], have);
      }
    if (ok) return true;
  }
  return false;
}

function shapelessMatch(r, grid) {
  const have = grid.filter(Boolean);
  if (have.length !== r.items.length) return false;
  const left = [...r.items];
  for (const h of have) {
    const i = left.findIndex((want) => fits(want, h));
    if (i < 0) return false;
    left.splice(i, 1);
  }
  return true;
}

// grid: size × size item names (or null), row by row
export function match(grid, size) {
  const box = trim(grid, size);
  if (!box) return null;
  for (const r of RECIPES) {
    if (r.shape ? shapedMatch(r, grid, size, box) : shapelessMatch(r, grid)) {
      const consume = grid.map((c, i) => (c ? i : -1)).filter((i) => i >= 0);
      return { result: { ...r.result }, consume };
    }
  }
  return null;
}
