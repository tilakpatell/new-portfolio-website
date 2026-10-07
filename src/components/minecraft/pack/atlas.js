// Minecraft, the atlas builder: a resource pack in, what the world draws
// out. A pack is any source laid out as Java's (assets/minecraft/textures/
// block/*.png, item/*.png, entity/**/*.png): Pixel Perfection on disk for
// scripts/mc-atlas.mjs, or the visitor's own .zip or .jar in the page
// (Phase 6). Both hand this the same two functions, `read(path) → bytes |
// null` and `decode(bytes) → { width, height, data }`, so the one builder
// serves both and the pixels are the same either way.
//
// Blocks and items come out as stacks of 16 × 16 RGBA tiles in the order
// asked for (that order is the texture array's layers, which the mesher
// writes into every vertex); skins keep their own size. A tile the pack
// doesn't have is the game's magenta-and-black checker, so it's seen, never
// thrown. A strip of animation frames (water, lava) gives its first in its
// place and the rest after every tile, in its .mcmeta's order, and the
// manifest's `anim` says where they are and how fast they turn over.

import { ALIASES } from './aliases.js';

const ROOT = 'assets/minecraft/textures/';
const T = 16;

// the missing tile's two colours, in 8 × 8 squares as the game draws it
export const CHECKER = [
  [248, 0, 248, 255],
  [0, 0, 0, 255],
];

// Where a texture may be, best first: its own name in its folder, then its
// aliases (a name in the same folder, a path under textures/, or a cut).
export function pathsFor(kind, id, aliases = ALIASES) {
  const out = [`${kind}/${id}`];
  for (const a of aliases[id] ?? []) out.push(typeof a === 'string' ? (a.includes('/') ? a : `${kind}/${a}`) : a);
  return out;
}

const fileOf = (path) => `${ROOT}${path}.png`;

// the frame showing at a tick for one `anim` entry: layer a, the next (b),
// and how far from a to b (an interpolated strip's blend; the shader mirrors this)
export function frameAt({ layer, extra, frames, time, interpolate }, ticks) {
  const at = (n) => (n === 0 ? layer : extra + n - 1);
  const f = Math.floor(ticks / time) % frames;
  return { a: at(f), b: at((f + 1) % frames), blend: interpolate ? (ticks % time) / time : 0 };
}

// the block array's layers: every tile, then the animations' other frames
export const layerCount = (manifest) => manifest.blocks.length + Object.values(manifest.anim ?? {}).reduce((n, a) => n + a.frames - 1, 0);

function checker() {
  const data = new Uint8ClampedArray(T * T * 4);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) data.set(CHECKER[((x >> 3) + (y >> 3)) & 1], (y * T + x) * 4);
  return data;
}

// A square image brought to 16 × 16: kept as it is, or each 16th averaged
// (a 32× pack's detail blends rather than being dropped at random).
function toTile(img, size) {
  if (size === T) {
    const out = new Uint8ClampedArray(T * T * 4);
    for (let y = 0; y < T; y++) out.set(img.data.subarray(y * img.width * 4, (y * img.width + T) * 4), y * T * 4);
    return out;
  }
  const out = new Uint8ClampedArray(T * T * 4);
  const s = size / T;
  for (let y = 0; y < T; y++)
    for (let x = 0; x < T; x++) {
      const sum = [0, 0, 0, 0];
      let n = 0;
      for (let v = Math.floor(y * s); v < Math.floor((y + 1) * s); v++)
        for (let u = Math.floor(x * s); u < Math.floor((x + 1) * s); u++) {
          const i = (v * img.width + u) * 4;
          for (let c = 0; c < 4; c++) sum[c] += img.data[i + c];
          n++;
        }
      for (let c = 0; c < 4; c++) out[(y * T + x) * 4 + c] = Math.round(sum[c] / n);
    }
  return out;
}

// A cut: parts of a sheet laid into a blank tile.
function cut(img, parts) {
  const out = new Uint8ClampedArray(T * T * 4);
  for (const p of parts) {
    const ow = p.rot ? p.h : p.w;
    const oh = p.rot ? p.w : p.h;
    for (let j = 0; j < oh; j++)
      for (let i = 0; i < ow; i++) {
        // a quarter turn clockwise: the output's column is the source's row from the bottom
        let sx = p.rot ? j : i;
        let sy = p.rot ? p.h - 1 - i : j;
        if (p.flipY) sy = p.h - 1 - sy;
        const dx = p.dx + i;
        const dy = p.dy + j;
        if (dx < 0 || dy < 0 || dx >= T || dy >= T) continue;
        const from = ((p.y + sy) * img.width + p.x + sx) * 4;
        out.set(img.data.subarray(from, from + 4), (dy * T + dx) * 4);
      }
  }
  return out;
}

export async function buildAtlas(read, { blocks = [], items = [], skins = {}, sprites = {}, decode, aliases = ALIASES, source = '' }) {
  const missing = [];
  const frames = {};
  const strips = new Map(); // id → { tiles: the frames after the first, time, interpolate }
  const cache = new Map();
  const load = async (path) => {
    if (!cache.has(path)) {
      cache.set(
        path,
        (async () => {
          const bytes = await read(fileOf(path));
          return bytes ? decode(bytes) : null;
        })(),
      );
    }
    return cache.get(path);
  };

  async function tileFor(kind, id) {
    for (const where of pathsFor(kind, id, aliases)) {
      if (typeof where === 'string') {
        const img = await load(where);
        if (!img) continue;
        const size = img.width;
        if (img.height <= size) return toTile(img, size);
        const n = Math.floor(img.height / size);
        frames[id] = n;
        // a flowing liquid's frame is drawn twice the size and the game shows its
        // middle half on a block (BlockFluidRenderer's 4 to 12 of 16): that, at full size
        const half = /_flow$/.test(id) && size >= 2 * T ? size / 2 : 0;
        const frame = (k) => {
          const f = { width: size, data: img.data.subarray(k * size * size * 4) };
          if (!half) return toTile(f, size);
          const mid = new Uint8ClampedArray(half * half * 4);
          for (let y = 0; y < half; y++) mid.set(f.data.subarray(((y + half / 2) * size + half / 2) * 4, ((y + half / 2) * size + half / 2 + half) * 4), y * half * 4);
          return toTile({ width: half, data: mid }, half);
        };
        if (kind !== 'block') return frame(0);
        let meta = null;
        try {
          const bytes = await read(`${fileOf(where)}.mcmeta`);
          meta = bytes ? JSON.parse(new TextDecoder().decode(bytes)).animation : null;
        } catch {
          meta = null;
        }
        const order = (meta?.frames ?? [...Array(n).keys()]).map((f) => (typeof f === 'number' ? f : f.index)).filter((k) => k < n);
        strips.set(id, { tiles: order.slice(1).map(frame), time: meta?.frametime ?? 1, interpolate: !!meta?.interpolate });
        return frame(order[0] ?? 0);
      }
      const img = await load(where.from);
      if (img) return cut(img, where.parts);
    }
    missing.push(`${kind}/${id}`);
    return checker();
  }

  async function stack(kind, ids) {
    const data = new Uint8ClampedArray(ids.length * T * T * 4);
    for (let i = 0; i < ids.length; i++) data.set(await tileFor(kind, ids[i]), i * T * T * 4);
    return { width: T, height: T, layers: ids.length, data };
  }

  const blockStack = await stack('block', blocks);
  // the animations' other frames, after every tile
  const anim = {};
  let extra = blocks.length;
  const extras = [];
  blocks.forEach((id, i) => {
    const st = strips.get(id);
    if (!st || anim[id]) return;
    anim[id] = { layer: i, extra, frames: st.tiles.length + 1, time: st.time, interpolate: st.interpolate };
    extra += st.tiles.length;
    extras.push(...st.tiles);
  });
  if (extras.length) {
    const data = new Uint8ClampedArray((blocks.length + extras.length) * T * T * 4);
    data.set(blockStack.data);
    extras.forEach((t, i) => data.set(t, (blocks.length + i) * T * T * 4));
    Object.assign(blockStack, { layers: blocks.length + extras.length, data });
  }
  const itemStack = await stack('item', items);
  // pictures kept whole: the first file found for each
  async function whole(kind, list) {
    const out = {};
    for (const [name, paths] of Object.entries(list)) {
      let img = null;
      for (const p of paths) if ((img = await load(p))) break;
      if (img) out[name] = { width: img.width, height: img.height, data: img.data };
      else missing.push(`${kind}/${name}`);
    }
    return out;
  }
  const skinOut = await whole('skin', skins);
  const spriteOut = await whole('sprite', sprites);

  return {
    blocks: blockStack,
    items: itemStack,
    skins: skinOut,
    sprites: spriteOut,
    missing,
    manifest: { blocks: [...blocks], items: [...items], skins: Object.keys(skinOut), sprites: Object.keys(spriteOut), frames, anim, source },
  };
}
