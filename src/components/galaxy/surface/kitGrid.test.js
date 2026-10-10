import { describe, expect, it } from 'vitest';
import { GRID, pieceName, sizeFromName, snap } from './kitGrid';

describe('the game’s modular pieces, on their grid', () => {
  it('reads a piece’s size from its name: width, height, depth in centimetres', () => {
    expect(sizeFromName('hangarsystemfloorenddoor_01_2048x768x1024_01_mesh')).toEqual([20.48, 7.68, 10.24]);
    expect(sizeFromName('corridor_01_s_256x512x512_a_mesh')).toEqual([2.56, 5.12, 5.12]);
  });

  it('reads the hangar’s two-number names as depth by width, its height not named', () => {
    // (hangarlargewall_01_3072x2048 runs 30.72 m deep and 20.48 m across, 30.72 m up)
    expect(sizeFromName('hangarlargewall_01_3072x2048_mesh')).toEqual([20.48, null, 30.72]);
    expect(sizeFromName('hangarmediumfloor_01_768x1024')).toEqual([10.24, null, 7.68]);
  });

  it('has no size for a piece whose name gives none', () => {
    expect(sizeFromName('fuelsilo_huge_01_mesh')).toBeNull();
    expect(sizeFromName('wall_01_tubes_01_mesh')).toBeNull();
  });

  it('snaps a position to the 2.56 m grid the pieces are cut on', () => {
    expect(GRID).toBe(2.56);
    expect(snap(5.0)).toBeCloseTo(5.12);
    expect(snap(-1.2)).toBeCloseTo(-0); // (rounds to the nearest line)
    expect(snap([3.9, 0.2, -7.6])).toEqual([5.12, 0, -7.68].map((v) => expect.closeTo(v, 6)));
    expect(snap(7.0, 5.12)).toBeCloseTo(5.12);
  });

  it('names a piece as the kit file keeps it: the manifest name’s last part, without _mesh', () => {
    expect(pieceName('objects/architecture/hoth/hangarsystem_01/new/hangarlargewall_01_3072x2048_mesh')).toBe('hangarlargewall_01_3072x2048');
    expect(pieceName('wall_01_s_256x256')).toBe('wall_01_s_256x256');
  });
});
