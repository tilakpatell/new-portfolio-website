// Minecraft, the world's generation: what any chunk holds, from the seed
// alone, so a chunk is the same whoever asks for it and whenever (the worker
// makes it; a save keeps only what the player changed since).
//
// The first pass (Phase 1): the height field from three broad noises the way
// 1.18 thinks of terrain (continentalness, land against sea; erosion, flat
// against rough; peaks, the ridges), the biome from temperature and
// humidity, the surface it lays (grass on three dirt; sand, then sandstone,
// in the desert and on the beach), water up to sea level, bedrock at the
// floor, and trees and plants scattered from each chunk's own random stream.
// Caves, ores and lava come in Phase 4; the full biome set in Phase 6.
//
// A tree near a chunk's edge reaches into its neighbour. Rather than hand
// the neighbour a list (and lose it if that chunk is made first, unloaded or
// made again), every chunk grows the trees of the nine chunks round it,
// keeping only what lands inside it: where a chunk's trees stand is decided
// from the height function and that chunk's stream alone, so both sides agree.

import { byName } from './blocks.js';
import { index } from './chunk.js';
import { chunkRandom, hashSeed, makeNoise, octaves } from './noise.js';
import { placeTree } from './trees.js';

export const SEA = 63;
const ID = (n) => byName.get(n).id;
const B = {
  air: 0,
  stone: ID('stone'),
  dirt: ID('dirt'),
  grass: ID('grass_block'),
  sand: ID('sand'),
  sandstone: ID('sandstone'),
  gravel: ID('gravel'),
  bedrock: ID('bedrock'),
  water: ID('water'),
  snow: ID('snow_block'),
  leaves: new Set(['oak_leaves', 'birch_leaves', 'spruce_leaves'].map(ID)),
  shortGrass: ID('short_grass'),
  fern: ID('fern'),
  dandelion: ID('dandelion'),
  poppy: ID('poppy'),
};

// a tree is one in this many grass columns of the biome, as the plan has it
const TREES = {
  forest: { kind: 'oak', every: 24, birch: 5 },
  plains: { kind: 'oak', every: 200 },
  birch_forest: { kind: 'birch', every: 24 },
  taiga: { kind: 'spruce', every: 24 },
  snowy: { kind: 'spruce', every: 90 },
  mountains: { kind: 'spruce', every: 120 },
};
// plants on grass: tall grass and its flowers
const PLANTS = {
  plains: { grass: 5, flower: 60 },
  forest: { grass: 14, flower: 90 },
  birch_forest: { grass: 12, flower: 80 },
  taiga: { grass: 10, fern: 14 },
  snowy: {},
  mountains: { grass: 30 },
};

const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function makeGenerator(seed) {
  const s = hashSeed(seed);
  const n = (k) => makeNoise(s + k * 7919);
  const cont = octaves(n(1).noise2, { octaves: 5 });
  const eros = octaves(n(2).noise2, { octaves: 4 });
  const peak = octaves(n(3).noise2, { octaves: 5 });
  const detail = octaves(n(4).noise2, { octaves: 3 });
  const temp = octaves(n(5).noise2, { octaves: 3 });
  const humid = octaves(n(6).noise2, { octaves: 3 });
  const bedrockNoise = n(7);

  // continentalness, stretched so the sea and the land each get their share
  const continental = (x, z) => Math.max(-1, Math.min(1, cont(x / 700, z / 700) * 2.4 + 0.15));

  // The surface's height: 63 + 12 × continentalness + erosion × peaks × 40,
  // where erosion is 0 on the flats and 1 in rough country and the peaks
  // ridge up to 2 (so the mountains reach 140 and more); the sea floor falls
  // away below continentalness −0.25 to 40.
  function heightAt(x, z) {
    const c = continental(x, z);
    const e = smooth(0.05, 0.55, eros(x / 500, z / 500) * 1.6);
    const ridge = 1 - Math.abs(peak(x / 260, z / 260) * 1.8);
    const p = 2 * Math.max(0, ridge) ** 2;
    let h = SEA + 12 * c + e * p * 40 * smooth(-0.1, 0.25, c) + detail(x / 40, z / 40) * 3;
    if (c < -0.25) h -= (-0.25 - c) * 34;
    return Math.max(40, Math.min(160, Math.floor(h)));
  }

  function biomeAt(x, z, h = heightAt(x, z)) {
    if (h < SEA) return 'ocean';
    if (h <= SEA + 2 && continental(x, z) < 0.12) return 'beach';
    if (h > 100) return 'mountains';
    const t = temp(x / 420, z / 420) * 1.8;
    const w = humid(x / 380, z / 380) * 1.8;
    if (t < -0.5) return 'snowy';
    if (t < -0.2) return 'taiga';
    if (t > 0.4 && w < 0) return 'desert';
    if (w > 0.3) return t > 0.1 ? 'birch_forest' : 'forest';
    if (w > 0.05) return 'forest';
    return 'plains';
  }

  // Where a chunk's trees stand: from its own stream, one draw per column
  // and one seed per tree, so the list is the same from any chunk that asks.
  function treesOf(cx, cz) {
    const rand = chunkRandom(s, cx, cz);
    const out = [];
    for (let z = 0; z < 16; z++)
      for (let x = 0; x < 16; x++) {
        const roll = rand();
        const treeSeed = Math.floor(rand() * 2 ** 31);
        const wx = cx * 16 + x;
        const wz = cz * 16 + z;
        const h = heightAt(wx, wz);
        const biome = biomeAt(wx, wz, h);
        const t = TREES[biome];
        // (only from grass: not the mountains' bare stone and snow)
        if (!t || roll >= 1 / t.every || h < SEA || h > 230 || (biome === 'mountains' && h > 108)) continue;
        // a forest's oaks are now and then a birch, as the game mixes them
        const kind = t.birch && treeSeed % t.birch === 0 ? 'birch' : t.kind;
        out.push({ kind, x: wx, y: h + 1, z: wz, seed: treeSeed });
      }
    return out;
  }

  function generate(chunk) {
    const { ids } = chunk;
    const ox = chunk.cx * 16;
    const oz = chunk.cz * 16;
    const heights = new Int16Array(256);
    const biomes = new Array(256);
    const rand = chunkRandom(s ^ 0x5eed, chunk.cx, chunk.cz);
    for (let z = 0; z < 16; z++)
      for (let x = 0; x < 16; x++) {
        const wx = ox + x;
        const wz = oz + z;
        const h = heightAt(wx, wz);
        const biome = biomeAt(wx, wz, h);
        heights[z * 16 + x] = h;
        biomes[z * 16 + x] = biome;
        // the floor: bedrock at 0, and mixed into the stone up to 4 as the game scatters it
        ids[index(x, 0, z)] = B.bedrock;
        for (let y = 1; y <= h; y++) ids[index(x, y, z)] = B.stone;
        for (let y = 1; y <= 4; y++) if (bedrockNoise.noise3(wx * 0.9, y * 3.1, wz * 0.9) * 2.5 + 2 > y) ids[index(x, y, z)] = B.bedrock;
        // the surface the biome lays
        let top = B.grass;
        let under = B.dirt;
        let deep = B.stone;
        if (biome === 'desert' || biome === 'beach') [top, under, deep] = [B.sand, B.sand, B.sandstone];
        else if (biome === 'ocean') [top, under] = h >= SEA - 6 ? [B.sand, B.sand] : [B.gravel, B.gravel];
        else if (biome === 'mountains' && h > 108) [top, under] = h > 128 ? [B.snow, B.stone] : [B.stone, B.stone];
        ids[index(x, h, z)] = top;
        for (let y = h - 1; y >= h - 3 && y > 4; y--) ids[index(x, y, z)] = under;
        if (deep !== B.stone) for (let y = h - 4; y >= h - 6 && y > 4; y--) ids[index(x, y, z)] = deep;
        for (let y = h + 1; y <= SEA; y++) ids[index(x, y, z)] = B.water;
      }

    // the trees of this chunk and its eight neighbours, kept to this chunk
    const put = (x, y, z, id) => {
      const lx = x - ox;
      const lz = z - oz;
      if (lx < 0 || lx > 15 || lz < 0 || lz > 15 || y < 0 || y > 255) return;
      const i = index(lx, y, lz);
      const was = ids[i];
      if (B.leaves.has(id) ? was === B.air : was === B.air || B.leaves.has(was)) ids[i] = id;
    };
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++)
        for (const t of treesOf(chunk.cx + dx, chunk.cz + dz)) {
          // the grass under a trunk turns to dirt, as the game leaves it
          if (dx === 0 && dz === 0) ids[index(t.x - ox, t.y - 1, t.z - oz)] = B.dirt;
          placeTree(t.kind, t.x, t.y, t.z, put, chunkRandom(t.seed, 0, 0));
        }

    // plants on the grass that's left open to the sky
    for (let z = 0; z < 16; z++)
      for (let x = 0; x < 16; x++) {
        const h = heights[z * 16 + x];
        const p = PLANTS[biomes[z * 16 + x]];
        const roll = rand();
        const which = rand();
        if (!p || ids[index(x, h, z)] !== B.grass || ids[index(x, h + 1, z)] !== B.air) continue;
        let plant = 0;
        if (p.flower && roll < 1 / p.flower) plant = which < 0.5 ? B.dandelion : B.poppy;
        else if (p.fern && roll < 1 / p.fern) plant = B.fern;
        else if (p.grass && roll < 1 / p.grass) plant = B.shortGrass;
        if (plant) ids[index(x, h + 1, z)] = plant;
      }

    chunk.generated = true;
    return { features: [] };
  }

  return { height: heightAt, biome: biomeAt, generate, seed: s };
}
