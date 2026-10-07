// Minecraft, the biome tints: grass and leaves take their colour from the
// pack's colormaps (colormap/grass.png, foliage.png: 256 × 256), read at a
// biome's temperature and rainfall the way the game reads them, so a pack
// that paints its own colormap (Pixel Perfection does) is drawn in its own
// greens. Each biome's climate is the game's.

export const BIOME_CLIMATE = {
  plains: [0.8, 0.4],
  forest: [0.7, 0.8],
  birch_forest: [0.6, 0.6],
  taiga: [0.25, 0.8],
  mountains: [0.2, 0.3],
  desert: [2, 0],
  snowy: [0, 0.5],
  ocean: [0.5, 0.5],
  beach: [0.8, 0.4],
};

const clamp = (v) => Math.max(0, Math.min(1, v));

// the colour at a climate, as [r, g, b] bytes
export function colormapAt(map, temperature, downfall) {
  const t = clamp(temperature);
  const d = clamp(downfall) * t;
  const x = Math.round((1 - t) * 255);
  const y = Math.round((1 - d) * 255);
  const i = (Math.min(map.height - 1, y) * map.width + Math.min(map.width - 1, x)) * 4;
  return [map.data[i], map.data[i + 1], map.data[i + 2]];
}
