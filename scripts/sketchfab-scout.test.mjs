import { describe, expect, it } from 'vitest';
import { usable } from './sketchfab-scout.mjs';

const model = (over = {}) => ({ isDownloadable: true, license: { slug: 'by' }, name: 'Moisture vaporator', description: 'Made in Blender.', tags: [{ name: 'starwars' }], ...over });

describe('which Sketchfab models the site can use', () => {
  it('takes a downloadable model under a CC-BY licence, or CC0', () => {
    expect(usable(model())).toBe(true);
    expect(usable(model({ license: { slug: 'by-nc-sa' } }))).toBe(true);
    expect(usable(model({ license: { slug: 'cc0' } }))).toBe(true);
  });
  it('leaves out one under any other licence, or that can’t be downloaded', () => {
    expect(usable(model({ license: { slug: 'st' } }))).toBe(false);
    expect(usable(model({ license: null }))).toBe(false);
    expect(usable(model({ isDownloadable: false }))).toBe(false);
  });
  it('leaves out one that says it was ripped or extracted from a game', () => {
    expect(usable(model({ description: 'Ripped from Battlefront II.' }))).toBe(false);
    expect(usable(model({ name: 'AT-AT (extracted from the game)' }))).toBe(false);
    expect(usable(model({ tags: [{ name: 'gamerip' }] }))).toBe(false);
  });
});
