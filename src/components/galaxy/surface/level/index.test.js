import { describe, expect, it } from 'vitest';
import { createLevel, levelGround, levelPlaced, partOf } from './index';

describe('the level’s entry', () => {
  it('leaves a ground without an image layer as it is (every world today)', async () => {
    const ground = { seed: 3, layers: [{ type: 'swell', scale: 600, height: 18 }] };
    expect(await levelGround(ground)).toBe(ground);
  });

  it('a pack that cannot be had leaves the image layer empty, not broken', async () => {
    const ground = { layers: [{ type: 'image', pack: 'nowhere' }], flats: [{ at: [0, 0], r: 26 }, { at: [90, 240], r: 32, game: true }] };
    const out = await levelGround(ground);
    expect(out.layers[0]).toEqual({ type: 'image', pack: 'nowhere' });
    // (the places' flats marked for the flight are left out on the game's ground)
    expect(out.flats).toEqual([{ at: [0, 0], r: 26 }]);
  });

  it('is nothing for a site with no level', () => {
    expect(createLevel({ scene: null, site: { id: 'tatooine' }, tier: 'high' })).toBe(null);
  });

  it('places nothing of a map for a site with no level, and a pack without the part gives the empty one', async () => {
    expect(await levelPlaced({ id: 'tatooine' })).toEqual({ life: [], rides: [], things: [] });
    expect(await levelPlaced({ id: 'x', level: 'nowhere' })).toEqual({ life: [], rides: [], things: [] });
    expect(await partOf('nowhere', 'decals.json', { decals: [] })).toEqual({ decals: [] });
  });
});
