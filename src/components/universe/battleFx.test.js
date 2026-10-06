import { describe, expect, it } from 'vitest';
import { MARK, fitPx } from './battleFx';

describe('the objective markers', () => {
  it('shrink a name to fit the card, never past the smallest that reads', () => {
    expect(fitPx(200, 244)).toBe(20); // (fits as it is)
    expect(fitPx(300, 244)).toBe(16); // ('Destroy: Shield generator' at 20px is about 300 wide)
    expect(fitPx(1000, 244)).toBe(12);
  });

  it('are wide enough for the longest name at its full size', () => {
    // (a monospace 20px is about 12px a letter)
    expect(MARK.w - 2 * MARK.pad).toBeGreaterThanOrEqual('Destroy: Shield generator'.length * 12);
  });
});
