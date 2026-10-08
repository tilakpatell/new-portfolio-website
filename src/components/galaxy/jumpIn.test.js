import { describe, expect, it } from 'vitest';
import { letsJumpGo } from './jumpIn';

describe('the jump handed to the galaxy', () => {
  it('is let go once the galaxy has drawn, or while the page is frozen', () => {
    expect(letsJumpGo({ drawn: true, meant: true, frozen: false, making: false })).toBe(true);
    expect(letsJumpGo({ drawn: false, meant: true, frozen: true, making: true })).toBe(true);
  });

  it('is held while the galaxy is on its way', () => {
    expect(letsJumpGo({ drawn: false, meant: true, frozen: false, making: true })).toBe(false);
  });

  it('is let go as soon as the galaxy will not draw: failed, lost, or 3D off', () => {
    expect(letsJumpGo({ drawn: false, meant: false, frozen: false, making: false })).toBe(true);
  });

  it("is held through an earlier world's failure seen at the page's first render, while the galaxy is being made", () => {
    // (the page's status starts as the runtime's, still 'failed' from that
    // world, in the same commit as the mount that has just made it 'loading')
    expect(letsJumpGo({ drawn: false, meant: false, frozen: false, making: true })).toBe(false);
  });
});
