import { describe, expect, it } from 'vitest';
import { seeded } from '../../../lib/seeded';
import { byName } from './blocks';
import { get, makeChunk } from './chunk';
import { placeTree } from './trees';
import { SEA, makeGenerator } from './worldgen';

const id = (n) => byName.get(n).id;
const gen = makeGenerator(1);
const made = new Map();
function chunk(cx, cz, g = gen) {
  const k = `${cx},${cz}`;
  if (g === gen && made.has(k)) return made.get(k);
  const c = makeChunk(cx, cz);
  g.generate(c);
  if (g === gen) made.set(k, c);
  return c;
}
// the top block that isn't air, water, a plant or a tree
const OVER = new Set(['air', 'water', 'short_grass', 'fern', 'dandelion', 'poppy', 'oak_leaves', 'birch_leaves', 'spruce_leaves', 'oak_log', 'birch_log', 'spruce_log'].map(id));
function surface(c, x, z) {
  for (let y = 255; y >= 0; y--) if (!OVER.has(get(c, x, y, z))) return y;
  return -1;
}

describe('the world’s generation', () => {
  it('sea level is 63', () => expect(SEA).toBe(63));

  it('the same chunk generated twice is byte-identical', () => {
    const a = makeChunk(3, -2);
    const b = makeChunk(3, -2);
    makeGenerator(1).generate(a);
    makeGenerator(1).generate(b);
    expect(a.ids).toEqual(b.ids);
    expect(a.state).toEqual(b.state);
    expect(a.generated).toBe(true);
    expect(a.edits.size).toBe(0);
  });

  it('a different seed makes a different chunk', () => {
    const a = makeChunk(0, 0);
    makeGenerator(2).generate(a);
    expect(a.ids).not.toEqual(chunk(0, 0).ids);
  });

  it('bedrock at y 0 everywhere, none above y 4', () => {
    for (const [cx, cz] of [[0, 0], [5, -7], [-3, 2]]) {
      const c = chunk(cx, cz);
      for (let z = 0; z < 16; z++)
        for (let x = 0; x < 16; x++) {
          expect(get(c, x, 0, z)).toBe(id('bedrock'));
          for (let y = 5; y < 256; y++) if (get(c, x, y, z) === id('bedrock')) throw new Error(`bedrock at ${y}`);
        }
    }
  });

  it('a column on land has a grass block on dirt on stone', () => {
    let found = false;
    for (let cx = 0; cx < 20 && !found; cx++) {
      const c = chunk(cx, 0);
      for (let x = 0; x < 16 && !found; x++) {
        const y = surface(c, x, 8);
        if (get(c, x, y, 8) !== id('grass_block')) continue;
        expect([get(c, x, y - 1, 8), get(c, x, y - 2, 8), get(c, x, y - 3, 8)]).toEqual([id('dirt'), id('dirt'), id('dirt')]);
        expect(get(c, x, y - 4, 8)).toBe(id('stone'));
        expect(y).toBeGreaterThanOrEqual(SEA);
        found = true;
      }
    }
    expect(found).toBe(true);
  });

  it('a column in the ocean has water from its floor to 63 and air above', () => {
    let found = false;
    for (let cx = -40; cx < 40 && !found; cx++) {
      for (let cz = -40; cz < 40 && !found; cz += 4) {
        const h = gen.height(cx * 16, cz * 16);
        if (h > 55) continue;
        const c = chunk(cx, cz);
        expect(gen.biome(cx * 16, cz * 16)).toBe('ocean');
        for (let y = h + 1; y <= SEA; y++) expect(get(c, 0, y, 0)).toBe(id('water'));
        expect(get(c, 0, SEA + 1, 0)).toBe(0);
        expect(get(c, 0, h, 0)).not.toBe(id('water'));
        found = true;
      }
    }
    expect(found).toBe(true);
  });

  it('the chunk at (1000, 1000) with seed 1 has the same height as height(16000, 16000) says', () => {
    const c = chunk(1000, 1000);
    expect(surface(c, 0, 0)).toBe(gen.height(16000, 16000));
  });

  it('height stays within 40..160 over 1000 samples, with sea, plains and hills among them', () => {
    const rand = seeded(11);
    const hs = [];
    for (let i = 0; i < 1000; i++) {
      const h = gen.height(Math.floor((rand() - 0.5) * 40000), Math.floor((rand() - 0.5) * 40000));
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(40);
      expect(h).toBeLessThanOrEqual(160);
      hs.push(h);
    }
    const share = (f) => hs.filter(f).length / hs.length;
    expect(share((h) => h < SEA)).toBeGreaterThan(0.1);
    expect(share((h) => h >= 64 && h <= 72)).toBeGreaterThan(0.2);
    expect(share((h) => h > 85)).toBeGreaterThan(0.03);
  });

  it('the beach is sand by the sea and the desert sand on sandstone', () => {
    let beach = 0;
    let desert = 0;
    for (let i = 0; i < 4000 && (!beach || !desert); i++) {
      const x = (i % 200) * 37 - 3700;
      const z = Math.floor(i / 200) * 211 - 2000;
      const b = gen.biome(x, z);
      if (b !== 'beach' && b !== 'desert') continue;
      const c = makeChunk(Math.floor(x / 16), Math.floor(z / 16));
      gen.generate(c);
      const lx = x - c.cx * 16;
      const lz = z - c.cz * 16;
      const y = surface(c, lx, lz);
      expect(get(c, lx, y, lz), `${b} at ${x},${z}`).toBe(id('sand'));
      if (b === 'desert') {
        expect(get(c, lx, y - 3, lz)).toBe(id('sand'));
        expect(get(c, lx, y - 4, lz)).toBe(id('sandstone'));
        desert++;
      } else beach++;
    }
    expect(beach).toBeGreaterThan(0);
    expect(desert).toBeGreaterThan(0);
  });

  it('no leaf block without a log within 3 blocks (no floating trees), across chunk edges', () => {
    let leaves = 0;
    const gets = (x, y, z) => get(chunk(Math.floor(x / 16), Math.floor(z / 16)), ((x % 16) + 16) % 16, y, ((z % 16) + 16) % 16);
    const isLeaf = (b) => [id('oak_leaves'), id('birch_leaves'), id('spruce_leaves')].includes(b);
    const isLog = (b) => [id('oak_log'), id('birch_log'), id('spruce_log')].includes(b);
    for (const [cx, cz] of [[0, 0], [4, 4], [-6, 3], [10, -10]]) {
      const c = chunk(cx, cz);
      for (let y = 60; y < 200; y++)
        for (let z = 0; z < 16; z++)
          for (let x = 0; x < 16; x++) {
            if (!isLeaf(get(c, x, y, z))) continue;
            leaves++;
            let near = false;
            for (let dy = -3; dy <= 3 && !near; dy++) for (let dz = -3; dz <= 3 && !near; dz++) for (let dx = -3; dx <= 3 && !near; dx++) near = isLog(gets(cx * 16 + x + dx, y + dy, cz * 16 + z + dz));
            expect(near, `leaf at ${cx * 16 + x},${y},${cz * 16 + z}`).toBe(true);
          }
    }
    expect(leaves).toBeGreaterThan(0);
  });

  it('a tree that crosses a chunk edge is whole on both sides', () => {
    // find a log at a chunk's edge column and check its leaves reach the neighbour
    let checked = 0;
    for (let cx = 0; cx < 30 && checked < 3; cx++) {
      const c = chunk(cx, 2);
      for (let z = 0; z < 16; z++) {
        const x = 15;
        const y = surface(c, x, z);
        const log = get(c, x, y + 1, z);
        if (![id('oak_log'), id('birch_log')].includes(log)) continue;
        // a log's top is crowned: leaves beside it, in the next chunk east
        const next = chunk(cx + 1, 2);
        let found = false;
        for (let yy = y + 2; yy < y + 10; yy++) if ([id('oak_leaves'), id('birch_leaves')].includes(get(next, 0, yy, z))) found = true;
        expect(found).toBe(true);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('nothing is placed in a column’s air but trees and plants', () => {
    const c = chunk(2, 2);
    const allowed = new Set(['air', 'water', 'oak_log', 'birch_log', 'spruce_log', 'oak_leaves', 'birch_leaves', 'spruce_leaves', 'short_grass', 'dandelion', 'poppy', 'fern']);
    for (let z = 0; z < 16; z++)
      for (let x = 0; x < 16; x++) {
        const s = surface(c, x, z);
        for (let y = s + 1; y < 256; y++) {
          const b = get(c, x, y, z);
          expect(allowed.has([...byName.values()][b].name), `${[...byName.values()][b].name} at ${y}`).toBe(true);
        }
      }
  });
});

describe('trees', () => {
  const grow = (kind, seed) => {
    const cells = new Map();
    placeTree(kind, 0, 64, 0, (x, y, z, b) => cells.set(`${x},${y},${z}`, b), seeded(seed));
    return cells;
  };
  it('an oak is a trunk of 4 to 6 under its leaves', () => {
    for (let s = 0; s < 20; s++) {
      const t = grow('oak', s);
      let trunk = 0;
      while (t.get(`0,${64 + trunk},0`) === id('oak_log')) trunk++;
      expect(trunk).toBeGreaterThanOrEqual(4);
      expect(trunk).toBeLessThanOrEqual(6);
      expect(t.get(`0,${64 + trunk},0`)).toBe(id('oak_leaves'));
      // the two wide layers reach two out
      expect(t.get(`2,${64 + trunk - 3},0`)).toBe(id('oak_leaves'));
      expect(t.has(`3,${64 + trunk - 3},0`)).toBe(false);
    }
  });
  it('a birch is 5 to 7', () => {
    for (let s = 0; s < 20; s++) {
      const t = grow('birch', s);
      let trunk = 0;
      while (t.get(`0,${64 + trunk},0`) === id('birch_log')) trunk++;
      expect(trunk).toBeGreaterThanOrEqual(5);
      expect(trunk).toBeLessThanOrEqual(7);
    }
  });
  it('a spruce is a cone: wider low down than at the top', () => {
    const t = grow('spruce', 3);
    const width = (y) => [...t.keys()].filter((k) => k.split(',')[1] === String(y) && t.get(k) === id('spruce_leaves')).length;
    const ys = [...t.keys()].map((k) => Number(k.split(',')[1]));
    const top = Math.max(...ys);
    expect(width(top)).toBeLessThanOrEqual(5);
    expect(Math.max(...ys.map(width))).toBeGreaterThan(width(top));
  });
});
