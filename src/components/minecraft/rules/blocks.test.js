import { describe, expect, it } from 'vitest';
import { seeded } from '../../../lib/seeded';
import { AIR, BLOCKS, EXTRA_TEXTURES, TEXTURES, TINTS, block, byName } from './blocks';

const FACES = ['top', 'bottom', 'north', 'south', 'east', 'west'];
const pick = (tier) => ({ type: 'pickaxe', tier });
const id = (name) => byName.get(name).id;

describe('the block registry', () => {
  it('air is 0 and has no faces', () => {
    expect(AIR).toBe(0);
    expect(BLOCKS[0].name).toBe('air');
    expect(BLOCKS[0].faces).toBeNull();
    expect(BLOCKS[0].shape).toBe('none');
  });

  it('every block has six faces, a shape, a hardness and a sound', () => {
    for (const b of BLOCKS.slice(1)) {
      expect(Object.keys(b.faces).sort(), b.name).toEqual([...FACES].sort());
      for (const f of FACES) expect(typeof b.faces[f], `${b.name} ${f}`).toBe('string');
      expect(b.shape, b.name).toMatch(/^(cube|cutout|cross|liquid|torch|ladder|slab|stairs|door|fence|none)$/);
      expect(typeof b.hardness, b.name).toBe('number');
      expect(b.sound, b.name).toMatch(/^(grass|stone|wood|sand|gravel|cloth|glass|snow)$/);
    }
  });

  it('ids are their index, names are unique', () => {
    BLOCKS.forEach((b, i) => expect(b.id).toBe(i));
    expect(byName.size).toBe(BLOCKS.length);
    expect(block(id('stone')).name).toBe('stone');
    expect(BLOCKS.length).toBeLessThan(256); // a chunk keeps ids in a byte
  });

  it('every face texture id is in TEXTURES exactly once', () => {
    expect(new Set(TEXTURES).size).toBe(TEXTURES.length);
    expect([...TEXTURES].sort()).toEqual(TEXTURES);
    for (const b of BLOCKS.slice(1)) for (const f of FACES) expect(TEXTURES).toContain(b.faces[f]);
    // (and nothing else, but for the tiles a block shows by its state or the cursor draws)
    const used = new Set([...BLOCKS.slice(1).flatMap((b) => FACES.map((f) => b.faces[f])), ...EXTRA_TEXTURES]);
    for (const t of TEXTURES) expect(used.has(t), t).toBe(true);
    for (let i = 0; i < 10; i++) expect(TEXTURES).toContain(`destroy_stage_${i}`);
  });

  it('has every block the spec lists for the first version', () => {
    const names = ['stone', 'cobblestone', 'dirt', 'grass_block', 'sand', 'sandstone', 'gravel', 'clay', 'bedrock', 'water', 'lava', 'oak_log', 'birch_log', 'spruce_log', 'jungle_log', 'acacia_log', 'oak_planks', 'birch_planks', 'spruce_planks', 'jungle_planks', 'acacia_planks', 'oak_leaves', 'birch_leaves', 'spruce_leaves', 'jungle_leaves', 'acacia_leaves', 'coal_ore', 'iron_ore', 'gold_ore', 'redstone_ore', 'lapis_ore', 'diamond_ore', 'iron_block', 'gold_block', 'diamond_block', 'glass', 'bricks', 'stone_bricks', 'mossy_cobblestone', 'obsidian', 'snow', 'snow_block', 'ice', 'bookshelf', 'glowstone', 'torch', 'crafting_table', 'furnace', 'chest', 'ladder', 'oak_door', 'oak_fence', 'oak_slab', 'oak_stairs', 'white_wool', 'black_wool', 'short_grass', 'fern', 'dead_bush', 'dandelion', 'poppy', 'oak_sapling', 'birch_sapling', 'spruce_sapling', 'jungle_sapling', 'acacia_sapling', 'cactus', 'sugar_cane', 'pumpkin', 'jack_o_lantern', 'melon', 'wheat', 'farmland', 'tnt', 'netherrack', 'red_bed', 'podzol'];
    for (const n of names) expect(byName.has(n), n).toBe(true);
    expect(BLOCKS.filter((b) => b.name.endsWith('_wool'))).toHaveLength(16);
  });

  it('stone drops cobblestone with any pickaxe and nothing by hand', () => {
    const stone = byName.get('stone');
    expect(stone.drops(0, null)).toEqual([]);
    expect(stone.drops(0, pick(0))).toEqual([{ item: 'cobblestone', count: 1 }]);
    expect(stone.drops(0, pick(3))).toEqual([{ item: 'cobblestone', count: 1 }]);
  });

  it('diamond ore drops nothing with a stone pickaxe and a diamond with an iron one', () => {
    const ore = byName.get('diamond_ore');
    expect(ore.drops(0, pick(1))).toEqual([]);
    expect(ore.drops(0, pick(2))).toEqual([{ item: 'diamond', count: 1 }]);
  });

  it('iron and gold ore drop the ore block; coal ore drops coal', () => {
    expect(byName.get('iron_ore').drops(0, pick(1))).toEqual([{ item: 'iron_ore', count: 1 }]);
    expect(byName.get('gold_ore').drops(0, pick(2))).toEqual([{ item: 'gold_ore', count: 1 }]);
    expect(byName.get('coal_ore').drops(0, pick(0))).toEqual([{ item: 'coal', count: 1 }]);
  });

  it('grass block drops dirt', () => {
    expect(byName.get('grass_block').drops(0, null)).toEqual([{ item: 'dirt', count: 1 }]);
  });

  it('glass and ice drop nothing', () => {
    expect(byName.get('glass').drops(0, null)).toEqual([]);
    expect(byName.get('ice').drops(0, pick(3))).toEqual([]);
  });

  it('oak leaves drop a sapling about 1 in 20 over 2000 tries with a seeded random', () => {
    const leaves = byName.get('oak_leaves');
    const rand = seeded(7);
    let saplings = 0;
    for (let i = 0; i < 2000; i++) for (const d of leaves.drops(0, null, rand)) if (d.item === 'oak_sapling') saplings += d.count;
    expect(saplings).toBeGreaterThan(70);
    expect(saplings).toBeLessThan(130);
  });

  it('bedrock is unbreakable', () => {
    expect(byName.get('bedrock').hardness).toBe(Infinity);
  });

  it('has the game’s hardness', () => {
    const h = (n) => byName.get(n).hardness;
    expect([h('dirt'), h('grass_block'), h('sand'), h('gravel'), h('stone'), h('cobblestone'), h('diamond_ore'), h('obsidian'), h('oak_log'), h('oak_planks'), h('oak_leaves'), h('glass'), h('torch')]).toEqual([0.5, 0.6, 0.5, 0.6, 1.5, 2, 3, 50, 2, 2, 0.2, 0.3, 0]);
    expect(h('water')).toBe(Infinity);
    expect(h('lava')).toBe(Infinity);
  });

  it('torch gives 14, glowstone 15, lava 15', () => {
    expect(byName.get('torch').light).toBe(14);
    expect(byName.get('glowstone').light).toBe(15);
    expect(byName.get('lava').light).toBe(15);
    expect(byName.get('stone').light).toBe(0);
  });

  it('sand and gravel fall; dirt does not', () => {
    expect(byName.get('sand').gravity).toBe(true);
    expect(byName.get('gravel').gravity).toBe(true);
    expect(byName.get('dirt').gravity).toBe(false);
  });

  it('water and glass are not opaque; oak leaves are not; stone is', () => {
    expect(byName.get('water').opaque).toBe(false);
    expect(byName.get('glass').opaque).toBe(false);
    expect(byName.get('oak_leaves').opaque).toBe(false);
    expect(byName.get('stone').opaque).toBe(true);
  });

  it('only what stops a body is solid', () => {
    expect(byName.get('stone').solid).toBe(true);
    expect(byName.get('water').solid).toBe(false);
    expect(byName.get('short_grass').solid).toBe(false);
    expect(byName.get('torch').solid).toBe(false);
    expect(byName.get('oak_leaves').solid).toBe(true);
    expect(BLOCKS[AIR].solid).toBe(false);
  });

  it('the grass block’s top is grass-tinted and leaves foliage-tinted', () => {
    expect(byName.get('grass_block').tint).toBe('grass');
    expect(byName.get('oak_leaves').tint).toBe('foliage');
    expect(byName.get('birch_leaves').tint).toBe('birch');
    expect(byName.get('spruce_leaves').tint).toBe('spruce');
    expect(byName.get('water').tint).toBe('water');
    expect(byName.get('stone').tint).toBeNull();
    expect(byName.get('grass_block').tintTopOnly).toBe(true);
    expect(byName.get('short_grass').tintTopOnly).toBe(false);
    // the tint's number in a vertex: three bits
    expect(TINTS).toEqual([null, 'grass', 'foliage', 'water', 'birch', 'spruce']);
  });
});
