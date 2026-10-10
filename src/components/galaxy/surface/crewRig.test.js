import { describe, expect, it, vi } from 'vitest';

vi.mock('../../universe/footScene', () => ({ loadPartyFigure: async () => null, loadSharedFigure: async () => null }));
const { figureLoaderFor } = await import('./crew');

describe('which loader a crew row takes', () => {
  it('sends a row on the game’s skeleton to the walrus loader, whoever it is', () => {
    expect(figureLoaderFor({ rig: 'walrus' }, 'luke')).toBe('walrus');
    expect(figureLoaderFor({ rig: 'walrus' }, 'rick')).toBe('walrus');
  });
  it('keeps the wardrobe’s people on their own loader and everyone else on the shared one', () => {
    expect(figureLoaderFor({}, 'rick')).toBe('party');
    expect(figureLoaderFor({}, 'tusken')).toBe('shared');
  });
});
