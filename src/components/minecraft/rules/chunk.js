// Minecraft, a chunk: a column of 16 × 16 blocks, 256 high, as Java kept
// them from 1.2 to 1.17. Three bytes a cell in flat typed arrays (the block's
// id, its light, its state), so a chunk crosses to and from the worker as
// transferables without a copy. x runs fastest, then z, then y, so a
// 16-high section is one contiguous slice of 4096 cells.
//
// Light is a byte: sky light (0–15) in the high nibble, block light in the
// low. `state` is what a block's id doesn't say: a door's half and swing, a
// stair's facing, a liquid's level, the wheat's age.
//
// What the player changes is logged (`edits`), so a save is the edits alone,
// run-length packed, never the generated terrain.

export const W = 16;
export const H = 256;
const CELLS = W * W * H;

export const index = (x, y, z) => (y * W + z) * W + x;

export function makeChunk(cx, cz) {
  return {
    cx,
    cz,
    ids: new Uint8Array(CELLS),
    light: new Uint8Array(CELLS),
    state: new Uint8Array(CELLS),
    edits: new Map(),
    dirty: new Set(),
    generated: false,
    lit: false,
  };
}

const inside = (y) => y >= 0 && y < H;

export const get = (c, x, y, z) => (inside(y) ? c.ids[index(x, y, z)] : 0);
export const getState = (c, x, y, z) => (inside(y) ? c.state[index(x, y, z)] : 0);

// A cell on a section's floor or ceiling shows a face of the section next to
// it, so both are re-meshed.
function touch(c, y) {
  const s = y >> 4;
  c.dirty.add(s);
  const r = y & 15;
  if (r === 0 && s > 0) c.dirty.add(s - 1);
  if (r === 15 && s < 15) c.dirty.add(s + 1);
}

export function set(c, x, y, z, id, state = 0, { log = true } = {}) {
  if (!inside(y)) return;
  const i = index(x, y, z);
  c.ids[i] = id;
  c.state[i] = state;
  touch(c, y);
  if (log) c.edits.set(i, [id, state]);
}

export const skyLight = (c, x, y, z) => (inside(y) ? c.light[index(x, y, z)] >> 4 : 15);
export const blockLight = (c, x, y, z) => (inside(y) ? c.light[index(x, y, z)] & 15 : 0);
export function setLight(c, x, y, z, sky, blockL) {
  if (inside(y)) c.light[index(x, y, z)] = (sky << 4) | blockL;
}

// The edits as [index, id, state, run, …]: `run` consecutive cells from
// `index` all set to the same id and state. A wall or a floor packs small.
export function packEdits(c) {
  const at = [...c.edits.keys()].sort((a, b) => a - b);
  const out = [];
  for (let k = 0; k < at.length; ) {
    const start = at[k];
    const [id, state] = c.edits.get(start);
    let run = 1;
    while (k + run < at.length && at[k + run] === start + run) {
      const [i2, s2] = c.edits.get(at[k + run]);
      if (i2 !== id || s2 !== state) break;
      run++;
    }
    out.push(start, id, state, run);
    k += run;
  }
  return out;
}

export function applyEdits(c, packed) {
  for (let k = 0; k + 3 < packed.length; k += 4) {
    const [start, id, state, run] = [packed[k], packed[k + 1], packed[k + 2], packed[k + 3]];
    for (let i = start; i < start + run; i++) {
      c.ids[i] = id;
      c.state[i] = state;
      c.edits.set(i, [id, state]);
      touch(c, i >> 8);
    }
  }
}

export const key = (cx, cz) => `${cx},${cz}`;
export const chunkOf = (x) => Math.floor(x / W);
export const local = (x) => x - W * Math.floor(x / W);
