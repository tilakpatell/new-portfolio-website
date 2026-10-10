import { describe, expect, it } from 'vitest';
import { frameAt, frameUv, gridFromName } from './flipbook';

describe('gridFromName', () => {
  it('reads a columns-by-rows grid from the name', () => {
    expect(gridFromName('T_Wisties_5x1_01')).toEqual([5, 1]);
    expect(gridFromName('T_Decal_ScorchMark_Metal_2x4_D')).toEqual([2, 4]);
    expect(gridFromName('T_NAB_Leaf_2x2_1024_N')).toEqual([2, 2]);
  });

  it('a name with no grid is one frame', () => {
    expect(gridFromName('T_Spark_01')).toEqual([1, 1]);
    expect(gridFromName('')).toEqual([1, 1]);
    expect(gridFromName(undefined)).toEqual([1, 1]);
  });

  it('reads the game’s count form: columns by frames, or a grid of so many', () => {
    // 8 across, 64 frames: 8 rows
    expect(gridFromName('T_FireGround_Wind_01_8x64_D')).toEqual([8, 8]);
    expect(gridFromName('T_ThinPuff_Gnomon_4x32_NoAtlas_01_D')).toEqual([4, 8]);
    // 8 by 4, 32 of them
    expect(gridFromName('T_Fire_Anim8x4o32_Loop_NoAtlas_01_D')).toEqual([8, 4]);
  });

  it('takes the path’s last part only, any case', () => {
    expect(gridFromName('FX/Textures/Fire/t_fireground01_8x64_da')).toEqual([8, 8]);
    expect(gridFromName('fx/sheets_3x3/t_glow_01')).toEqual([1, 1]);
  });
});

describe('frameUv', () => {
  it('one frame is the whole sheet', () => {
    expect(frameUv([1, 1], 0)).toEqual({ offset: [0, 0], repeat: [1, 1] });
  });

  it('counts frames left to right from the top row down', () => {
    // a 2 by 2 sheet: frame 0 top left, 1 top right, 2 bottom left (uv's y is up)
    expect(frameUv([2, 2], 0)).toEqual({ offset: [0, 0.5], repeat: [0.5, 0.5] });
    expect(frameUv([2, 2], 1)).toEqual({ offset: [0.5, 0.5], repeat: [0.5, 0.5] });
    expect(frameUv([2, 2], 2)).toEqual({ offset: [0, 0], repeat: [0.5, 0.5] });
    expect(frameUv([5, 1], 3)).toEqual({ offset: [0.6, 0], repeat: [0.2, 1] });
  });

  it('wraps past the last frame and takes whole frames only', () => {
    expect(frameUv([2, 2], 4)).toEqual(frameUv([2, 2], 0));
    expect(frameUv([2, 2], -1)).toEqual(frameUv([2, 2], 3));
    expect(frameUv([2, 2], 1.7)).toEqual(frameUv([2, 2], 1));
  });
});

describe('frameAt', () => {
  it('runs a sheet through its frames over a life', () => {
    expect(frameAt(0, 16)).toBe(0);
    expect(frameAt(0.5, 16)).toBe(8);
    expect(frameAt(0.999, 16)).toBe(15);
    // held on the last once it's done, never past it
    expect(frameAt(1, 16)).toBe(15);
    expect(frameAt(3, 16)).toBe(15);
    expect(frameAt(-1, 16)).toBe(0);
  });

  it('a looping sheet goes round', () => {
    expect(frameAt(1.25, 4, { loop: true })).toBe(1);
  });
});
