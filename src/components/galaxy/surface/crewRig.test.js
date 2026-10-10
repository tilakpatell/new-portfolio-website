import { describe, expect, it } from 'vitest';
import { figureLoaderFor } from './crewList';

describe('which loader a crew row goes through', () => {
  it('sends a 2017 figure to the game-skeleton loader, before anything else', () => {
    expect(figureLoaderFor({ rig: 'walrus' })).toBe('walrus');
    expect(figureLoaderFor({ rig: 'walrus' }, true)).toBe('walrus');
  });

  it('keeps the wardrobe’s people dressed and everyone else a shared copy', () => {
    expect(figureLoaderFor({}, true)).toBe('party');
    expect(figureLoaderFor({ url: '/x.glb' })).toBe('shared');
  });
});
