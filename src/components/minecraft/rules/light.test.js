import { describe, expect, it } from 'vitest';
import { byName } from './blocks';
import { index, makeChunk, set } from './chunk';
import { OPACITY, lightRegion } from './light';

const id = (n) => byName.get(n).id;
const SIDES = ['nx', 'px', 'nz', 'pz', 'nxnz', 'pxnz', 'nxpz', 'pxpz'];
const OFFSET = { nx: [-1, 0], px: [1, 0], nz: [0, -1], pz: [0, 1], nxnz: [-1, -1], pxnz: [1, -1], nxpz: [-1, 1], pxpz: [1, 1] };

// a 3 × 3 of flat chunks, stone to y, and a way to set a block by world coordinates
function region(floor = 63) {
  const all = { c: makeChunk(0, 0) };
  for (const s of SIDES) all[s] = makeChunk(...OFFSET[s]);
  for (const c of Object.values(all)) for (let y = 0; y <= floor; y++) for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) c.ids[index(x, y, z)] = id('stone');
  const put = (x, y, z, name) => {
    const cx = Math.floor(x / 16);
    const cz = Math.floor(z / 16);
    const c = Object.values(all).find((k) => k.cx === cx && k.cz === cz);
    set(c, x - cx * 16, y, z - cz * 16, id(name));
  };
  const light = () => {
    const around = {};
    for (const s of SIDES) around[s] = all[s];
    const out = lightRegion(all.c, around);
    return { sky: (x, y, z) => out.centre[index(x, y, z)] >> 4, block: (x, y, z) => out.centre[index(x, y, z)] & 15, out };
  };
  return { all, put, light };
}

describe('light', () => {
  it('knows how much each block lets through', () => {
    expect(OPACITY[id('stone')]).toBe(15);
    expect(OPACITY[0]).toBe(0);
    expect(OPACITY[id('glass')]).toBe(0);
    expect(OPACITY[id('oak_leaves')]).toBe(1);
    expect(OPACITY[id('water')]).toBe(1);
    expect(OPACITY[id('torch')]).toBe(0);
  });

  it('15 under the open sky', () => {
    const { light } = region();
    const l = light();
    expect(l.sky(5, 64, 5)).toBe(15);
    expect(l.sky(5, 200, 5)).toBe(15);
    expect(l.sky(5, 63, 5)).toBe(0);
  });

  it('0 under a solid roof, and the light creeps in from its sides', () => {
    const { put, light } = region();
    for (let x = -10; x <= 20; x++) for (let z = -10; z <= 20; z++) put(x, 70, z, 'stone');
    const l = light();
    // right under the middle of a roof 15 wide each way, no way in that's under 15 steps
    expect(l.sky(5, 69, 5)).toBe(0);
    // under the edge the light comes in from the side, one less a step
    expect(l.sky(15, 69, 5)).toBe(15 - 6);
    expect(l.out.around.px[index(0, 69, 5)] >> 4).toBe(15 - 5);
  });

  it('14 beside a torch, 13 one block on', () => {
    const { put, light } = region();
    put(5, 64, 5, 'torch');
    const l = light();
    expect(l.block(5, 64, 5)).toBe(14);
    expect(l.block(6, 64, 5)).toBe(13);
    expect(l.block(7, 64, 5)).toBe(12);
    expect(l.block(5, 65, 6)).toBe(12);
  });

  it('a torch’s light crosses into the next chunk, and a torch next door lights this one', () => {
    const { put, light } = region();
    put(-1, 64, 5, 'glowstone');
    const l = light();
    expect(l.block(0, 64, 5)).toBe(14);
    expect(l.block(3, 64, 5)).toBe(11);
  });

  it('a torch under a roof lights to 14, and without it returns to 0', () => {
    const { put, light } = region();
    for (let x = -14; x <= 30; x++) for (let z = -14; z <= 30; z++) put(x, 66, z, 'stone');
    put(5, 64, 5, 'torch');
    let l = light();
    expect(l.block(5, 64, 5)).toBe(14);
    expect(l.block(5, 65, 5)).toBe(13);
    expect(l.sky(5, 64, 5)).toBe(0);
    put(5, 64, 5, 'air');
    l = light();
    expect(l.block(5, 64, 5)).toBe(0);
  });

  it('placing a roof darkens below and removing it lights again', () => {
    const { put, light } = region();
    for (let x = -14; x <= 30; x++) for (let z = -14; z <= 30; z++) put(x, 66, z, 'stone');
    expect(light().sky(5, 65, 5)).toBe(0);
    for (let x = -14; x <= 30; x++) for (let z = -14; z <= 30; z++) put(x, 66, z, 'air');
    expect(light().sky(5, 65, 5)).toBe(15);
  });

  it('no light through bedrock', () => {
    const { put, light } = region();
    put(5, 64, 5, 'glowstone');
    put(5, 63, 5, 'bedrock');
    put(5, 62, 5, 'air');
    const l = light();
    expect(l.block(5, 62, 5)).toBe(0);
    expect(l.sky(5, 62, 5)).toBe(0);
  });

  it('sky light falls by 1 through leaves, and keeps falling a level a block under them', () => {
    const { put, light } = region();
    put(5, 70, 5, 'oak_leaves');
    put(5, 69, 5, 'oak_leaves');
    const l = light();
    expect(l.sky(5, 71, 5)).toBe(15);
    expect(l.sky(5, 70, 5)).toBe(14);
    // (the second leaf takes 14 from the open air beside it, as the game's does: more than its 13 from above)
    expect(l.sky(5, 69, 5)).toBe(14);
    // under the leaves the open sky beside wins: 15 one step to the side, so 14
    expect(l.sky(5, 68, 5)).toBe(14);
  });

  it('a pit is lit from above at full strength all the way down', () => {
    const { put, light } = region();
    for (let y = 50; y <= 63; y++) put(5, y, 5, 'air');
    const l = light();
    expect(l.sky(5, 50, 5)).toBe(15);
    expect(l.sky(5, 49, 5)).toBe(0);
  });
});
