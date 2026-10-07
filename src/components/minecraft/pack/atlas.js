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
// thrown; a strip of animation frames gives its first and says how many.

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
        if (img.height > size) frames[id] = Math.floor(img.height / size);
        return toTile(img, size);
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
    manifest: { blocks: [...blocks], items: [...items], skins: Object.keys(skinOut), sprites: Object.keys(spriteOut), frames, source },
  };
}
