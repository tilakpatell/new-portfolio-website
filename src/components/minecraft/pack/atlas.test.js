import { describe, expect, it } from 'vitest';
import { TEXTURES } from '../rules/blocks';
import { ALIASES, SKINS } from './aliases';
import { CHECKER, buildAtlas, pathsFor } from './atlas';

// A fake pack: each path is an image whose every pixel is a colour made from
// the path, so a test can tell which file a layer came from.
function fakePack(files) {
  const read = async (path) => (path in files ? new TextEncoder().encode(path) : null);
  const decode = async (bytes) => {
    const path = new TextDecoder().decode(bytes);
    const { width, height, colour = [path.length % 256, 7, 9, 255] } = files[path];
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) data.set(colour, i * 4);
    // a strip's frames are told apart by the frame's own red
    if (height > width) for (let f = 0; f < height / width; f++) for (let i = 0; i < width * width; i++) data[(f * width * width + i) * 4] = f;
    return { width, height, data };
  };
  return { read, decode };
}
const block = (name) => `assets/minecraft/textures/block/${name}.png`;
const tile = { width: 16, height: 16 };
const layer = (atlas, i) => atlas.blocks.data.subarray(i * 1024, (i + 1) * 1024);

describe('the atlas builder', () => {
  it('every id in blocks gets a layer in order', async () => {
    const { read, decode } = fakePack({ [block('stone')]: { ...tile, colour: [1, 2, 3, 255] }, [block('dirt')]: { ...tile, colour: [4, 5, 6, 255] } });
    const atlas = await buildAtlas(read, { blocks: ['stone', 'dirt'], items: [], skins: {}, decode });
    expect(atlas.blocks).toMatchObject({ width: 16, height: 16, layers: 2 });
    expect(atlas.blocks.data.length).toBe(2 * 16 * 16 * 4);
    expect([...layer(atlas, 0).subarray(0, 4)]).toEqual([1, 2, 3, 255]);
    expect([...layer(atlas, 1).subarray(1020, 1024)]).toEqual([4, 5, 6, 255]);
    expect(atlas.manifest.blocks).toEqual(['stone', 'dirt']);
    expect(atlas.missing).toEqual([]);
  });

  it('an id found under its alias is used', async () => {
    const { read, decode } = fakePack({ [block('log_oak')]: { ...tile, colour: [9, 9, 9, 255] } });
    const atlas = await buildAtlas(read, { blocks: ['oak_log'], items: [], skins: {}, decode, aliases: { oak_log: ['log_oak'] } });
    expect([...layer(atlas, 0).subarray(0, 4)]).toEqual([9, 9, 9, 255]);
    expect(atlas.missing).toEqual([]);
  });

  it('prefers the modern name over an alias', async () => {
    const { read, decode } = fakePack({ [block('oak_log')]: { ...tile, colour: [1, 1, 1, 255] }, [block('log_oak')]: { ...tile, colour: [9, 9, 9, 255] } });
    const atlas = await buildAtlas(read, { blocks: ['oak_log'], items: [], skins: {}, decode, aliases: { oak_log: ['log_oak'] } });
    expect(layer(atlas, 0)[0]).toBe(1);
  });

  it('a missing id makes the checker and is listed in missing', async () => {
    const { read, decode } = fakePack({});
    const atlas = await buildAtlas(read, { blocks: ['nothing_here'], items: [], skins: {}, decode });
    expect(atlas.missing).toEqual(['block/nothing_here']);
    const px = (x, y) => [...layer(atlas, 0).subarray((y * 16 + x) * 4, (y * 16 + x) * 4 + 4)];
    expect(px(0, 0)).toEqual(CHECKER[0]);
    expect(px(8, 0)).toEqual(CHECKER[1]);
    expect(px(8, 8)).toEqual(CHECKER[0]);
  });

  it('a 16 × 512 strip takes its first frame and records 32 frames', async () => {
    const { read, decode } = fakePack({ [block('water_still')]: { width: 16, height: 512 } });
    const atlas = await buildAtlas(read, { blocks: ['water_still'], items: [], skins: {}, decode });
    expect(atlas.blocks.layers).toBe(1);
    expect(layer(atlas, 0)[0]).toBe(0); // frame 0's red
    expect(atlas.manifest.frames).toEqual({ water_still: 32 });
  });

  it('a tile drawn larger than 16 is brought down to 16', async () => {
    const { read, decode } = fakePack({ [block('stone')]: { width: 32, height: 32, colour: [50, 60, 70, 255] } });
    const atlas = await buildAtlas(read, { blocks: ['stone'], items: [], skins: {}, decode });
    expect(atlas.blocks.data.length).toBe(1024);
    expect([...layer(atlas, 0).subarray(0, 4)]).toEqual([50, 60, 70, 255]);
  });

  it('a tile can be cut from another texture (the chest’s from its entity sheet)', async () => {
    const files = { 'assets/minecraft/textures/entity/chest/normal.png': { width: 64, height: 64, colour: [200, 100, 50, 255] } };
    const { read, decode } = fakePack(files);
    const aliases = { chest_top: [{ from: 'entity/chest/normal', parts: [{ x: 14, y: 0, w: 14, h: 14, dx: 1, dy: 1 }] }] };
    const atlas = await buildAtlas(read, { blocks: ['chest_top'], items: [], skins: {}, decode, aliases });
    const px = (x, y) => [...layer(atlas, 0).subarray((y * 16 + x) * 4, (y * 16 + x) * 4 + 4)];
    expect(px(0, 0)).toEqual([0, 0, 0, 0]); // the border the 14-wide chest leaves
    expect(px(1, 1)).toEqual([200, 100, 50, 255]);
    expect(px(14, 14)).toEqual([200, 100, 50, 255]);
    expect(atlas.missing).toEqual([]);
  });

  it('skins keep their own size (64 × 64 and 64 × 32)', async () => {
    const files = { 'assets/minecraft/textures/entity/player/wide/steve.png': { width: 64, height: 64 }, 'assets/minecraft/textures/entity/pig/pig.png': { width: 64, height: 32 } };
    const { read, decode } = fakePack(files);
    const atlas = await buildAtlas(read, { blocks: [], items: [], skins: { player: ['entity/player/wide/steve'], pig: ['entity/pig/temperate_pig', 'entity/pig/pig'] }, decode });
    expect(atlas.skins.player).toMatchObject({ width: 64, height: 64 });
    expect(atlas.skins.pig).toMatchObject({ width: 64, height: 32 });
    expect(atlas.skins.pig.data.length).toBe(64 * 32 * 4);
    expect(atlas.manifest.skins).toEqual(['player', 'pig']);
  });

  it('items read from the item folder', async () => {
    const { read, decode } = fakePack({ 'assets/minecraft/textures/item/stick.png': { ...tile, colour: [3, 3, 3, 255] } });
    const atlas = await buildAtlas(read, { blocks: [], items: ['stick'], skins: {}, decode });
    expect(atlas.items.layers).toBe(1);
    expect(atlas.items.data[0]).toBe(3);
  });

  it('every block texture has a way to be found: its own name, or aliases', () => {
    for (const t of TEXTURES) expect(pathsFor('block', t, ALIASES).length, t).toBeGreaterThan(0);
    for (const v of Object.values(ALIASES)) expect(Array.isArray(v)).toBe(true);
    expect(Object.keys(SKINS)).toEqual(expect.arrayContaining(['player', 'zombie', 'skeleton', 'creeper', 'spider', 'enderman', 'pig', 'cow', 'sheep', 'chicken']));
  });
});
