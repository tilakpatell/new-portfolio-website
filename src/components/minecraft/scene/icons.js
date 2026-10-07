// Minecraft, the inventory's pictures, 32 × 32, as the game draws them: a
// block is a little isometric cube of its own three faces (the top in full
// light, the south face at 0.8, the east at 0.6, tinted as the world tints
// them), a plant, torch or ladder its face drawn flat, and anything else its
// item tile, every texel kept square. Made once per item, as a data URL the
// page's HUD can put in an <img>.
//
// createIcons({ blocks, blockLayers, items, itemLayers, tints }) → { url(name) }
// where blocks and items are the strips' pixels ({ width, height, data }).

import { BLOCKS, TINTS } from '../rules/blocks.js';
import { ITEMS } from '../rules/items.js';

const S = 32;

// one 16 × 16 tile out of a strip, shaded and tinted, on its own canvas
function tile(strip, layer, shade = 1, tint = null) {
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d');
  const img = g.createImageData(16, 16);
  const src = strip.data.subarray(layer * 1024, layer * 1024 + 1024);
  for (let i = 0; i < 1024; i += 4) {
    img.data[i] = src[i] * shade * (tint ? tint[0] / 255 : 1);
    img.data[i + 1] = src[i + 1] * shade * (tint ? tint[1] / 255 : 1);
    img.data[i + 2] = src[i + 2] * shade * (tint ? tint[2] / 255 : 1);
    img.data[i + 3] = src[i + 3];
  }
  g.putImageData(img, 0, 0);
  return c;
}

export function createIcons({ blocks, blockLayers, items, itemLayers, tints }) {
  const cache = new Map();
  const tintOf = (b, face) => {
    const name = TINTS[Math.max(0, TINTS.indexOf(b.tint))];
    if (!name || (b.tintTopOnly && face !== 'top')) return null;
    return tints[name] ?? null;
  };
  function draw(name) {
    const it = ITEMS[name];
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    if (!it) return c;
    if (it.icon === 'item') {
      const layer = itemLayers.get(it.texture);
      if (layer != null && items) g.drawImage(tile(items, layer), 0, 0, S, S);
      return c;
    }
    const b = BLOCKS[it.block];
    if (it.icon === 'flat') {
      g.drawImage(tile(blocks, blockLayers.get(b.faces.north) ?? 0, 1, tintOf(b, 'north')), 0, 0, S, S);
      return c;
    }
    // the cube: each face's 16 × 16 laid onto its rhombus by an affine map
    const face = (f, shade, [a, bb, cc, d, e, ff]) => {
      g.setTransform(a, bb, cc, d, e, ff);
      g.drawImage(tile(blocks, blockLayers.get(b.faces[f]) ?? 0, shade, tintOf(b, f)), 0, 0);
    };
    const k = 15 / 16;
    face('top', 1, [k, 7.5 / 16, -k, 7.5 / 16, 16, 1]);
    face('south', 0.8, [k, 7.5 / 16, 0, 15.5 / 16, 1, 8.5]);
    face('east', 0.6, [k, -7.5 / 16, 0, 15.5 / 16, 16, 16]);
    g.setTransform(1, 0, 0, 1, 0, 0);
    return c;
  }
  return {
    url(name) {
      if (!cache.has(name)) cache.set(name, draw(name).toDataURL());
      return cache.get(name);
    },
  };
}
