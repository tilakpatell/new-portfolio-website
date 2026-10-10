// Minecraft, the mover: a box through a world of blocks, as the game moves
// every entity. The box (feet at y, x and z its middle, w across, h tall) is
// moved along y, then x, then z, each step cut short by any solid block's
// box it would enter, so it slides along walls and lands on floors. A body
// on the ground that walks into a ledge no higher than its step (0.6) is
// lifted onto it, when that gets it further than walking into the ledge did.
//
// The world answers `solid(x, y, z)` for a cell and, for a block that isn't
// a whole cube (a slab, Phase 4), `boxes(x, y, z)`: its boxes within the
// cell, as [x0, y0, z0, x1, y1, z1]. `get(x, y, z)` is the block's id.

import { byName } from './blocks.js';

const WATER = byName.get('water').id;
const LADDER = byName.get('ladder').id;
const CUBE = [[0, 0, 0, 1, 1, 1]];

const bounds = (b) => ({ x0: b.x - b.w / 2, x1: b.x + b.w / 2, y0: b.y, y1: b.y + b.h, z0: b.z - b.w / 2, z1: b.z + b.w / 2 });

// every solid box in the cells a region touches
function solids(world, r) {
  const out = [];
  for (let y = Math.floor(r.y0); y < Math.ceil(r.y1); y++)
    for (let z = Math.floor(r.z0); z < Math.ceil(r.z1); z++)
      for (let x = Math.floor(r.x0); x < Math.ceil(r.x1); x++) {
        if (!world.solid(x, y, z)) continue;
        for (const [a, b, c, d, e, f] of world.boxes?.(x, y, z) ?? CUBE) out.push({ x0: x + a, y0: y + b, z0: z + c, x1: x + d, y1: y + e, z1: z + f });
      }
  return out;
}

const overlapX = (a, b) => a.x1 > b.x0 && a.x0 < b.x1;
const overlapY = (a, b) => a.y1 > b.y0 && a.y0 < b.y1;
const overlapZ = (a, b) => a.z1 > b.z0 && a.z0 < b.z1;

// how far along one axis a box may go before it meets one of the solids
function clip(boxes, a, axis, d) {
  const [lo, hi, o1, o2] = axis === 'y' ? ['y0', 'y1', overlapX, overlapZ] : axis === 'x' ? ['x0', 'x1', overlapY, overlapZ] : ['z0', 'z1', overlapX, overlapY];
  for (const b of boxes) {
    if (!o1(a, b) || !o2(a, b)) continue;
    if (d > 0 && a[hi] <= b[lo]) d = Math.min(d, b[lo] - a[hi]);
    else if (d < 0 && a[lo] >= b[hi]) d = Math.max(d, b[hi] - a[lo]);
  }
  return d;
}

const shift = (a, axis, d) => ({ ...a, [`${axis}0`]: a[`${axis}0`] + d, [`${axis}1`]: a[`${axis}1`] + d });

function slide(boxes, start, dx, dy, dz) {
  let a = start;
  const my = clip(boxes, a, 'y', dy);
  a = shift(a, 'y', my);
  const mx = clip(boxes, a, 'x', dx);
  a = shift(a, 'x', mx);
  const mz = clip(boxes, a, 'z', dz);
  a = shift(a, 'z', mz);
  return { a, mx, my, mz };
}

// is any solid box inside this one?
export const blocked = (world, r) => solids(world, r).some((b) => overlapX(r, b) && overlapY(r, b) && overlapZ(r, b));

export function moveBox(world, box, vel, { step = 0.6, onGround = false, sneak = false } = {}) {
  let { x: dx, y: dy, z: dz } = vel;
  const start = bounds(box);
  // sneaking on the ground: give up whatever part of the move would leave no floor within a step below
  if (sneak && onGround) {
    const floored = (ox, oz) => blocked(world, shift(shift(shift(start, 'x', ox), 'z', oz), 'y', -step));
    const toward = (v) => (v < 0.05 && v >= -0.05 ? 0 : v > 0 ? v - 0.05 : v + 0.05);
    while (dx !== 0 && !floored(dx, 0)) dx = toward(dx);
    while (dz !== 0 && !floored(0, dz)) dz = toward(dz);
    while (dx !== 0 && dz !== 0 && !floored(dx, dz)) {
      dx = toward(dx);
      dz = toward(dz);
    }
  }
  const reach = { x0: start.x0 + Math.min(0, dx) - step, x1: start.x1 + Math.max(0, dx) + step, y0: start.y0 + Math.min(0, dy) - step, y1: start.y1 + Math.max(0, dy) + step, z0: start.z0 + Math.min(0, dz) - step, z1: start.z1 + Math.max(0, dz) + step };
  const boxes = solids(world, reach);
  let r = slide(boxes, start, dx, dy, dz);
  const landed = r.my !== dy && dy < 0;
  // the step up: lift, walk, set down; kept if it went further
  if ((onGround || landed) && step > 0 && (r.mx !== dx || r.mz !== dz)) {
    let a = start;
    const up = clip(boxes, a, 'y', step);
    a = shift(a, 'y', up);
    const sx = clip(boxes, a, 'x', dx);
    a = shift(a, 'x', sx);
    const sz = clip(boxes, a, 'z', dz);
    a = shift(a, 'z', sz);
    const down = clip(boxes, a, 'y', -up + Math.min(0, dy));
    a = shift(a, 'y', down);
    if (sx * sx + sz * sz > r.mx * r.mx + r.mz * r.mz + 1e-12) r = { a, mx: sx, my: up + down, mz: sz, stepped: true };
  }
  const a = r.a;
  return {
    x: (a.x0 + a.x1) / 2,
    y: a.y0,
    z: (a.z0 + a.z1) / 2,
    onGround: Boolean(r.stepped) || (dy < 0 && r.my > dy),
    hitX: r.mx !== dx,
    hitZ: r.mz !== dz,
    hitHead: dy > 0 && r.my < dy,
    dx: r.mx,
    dy: r.my,
    dz: r.mz,
  };
}

// The cells a box covers, with what's in them.
function cells(world, box, inset = 0.001) {
  const r = bounds(box);
  const out = [];
  for (let y = Math.floor(r.y0 + inset); y <= Math.floor(r.y1 - inset); y++)
    for (let z = Math.floor(r.z0 + inset); z <= Math.floor(r.z1 - inset); z++) for (let x = Math.floor(r.x0 + inset); x <= Math.floor(r.x1 - inset); x++) out.push(world.get(x, y, z));
  return out;
}

// in water, as the game asks it: the box less 0.4 at the top and bottom
export const inWater = (world, box) => cells(world, { ...box, y: box.y + 0.4, h: box.h - 0.8 }).includes(WATER);
// is the eye under water?
export const eyeInWater = (world, x, y, z) => world.get(Math.floor(x), Math.floor(y), Math.floor(z)) === WATER;
// on a ladder: the cell at the feet
export const onLadder = (world, box) => world.get(Math.floor(box.x), Math.floor(box.y), Math.floor(box.z)) === LADDER;
