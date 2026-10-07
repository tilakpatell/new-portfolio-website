import { describe, expect, it } from 'vitest';
import { stageRatio } from './stage3d';

describe('the stage’s pixel ratio', () => {
  // (no window under test: the screen's ratio is 1)
  it('supersamples a high-tier desktop, as lib/device budgets it', () => {
    expect(stageRatio({ tier: 'high' })).toBe(1.25);
    expect(stageRatio({ tier: 'ultra' })).toBe(1.5);
  });

  it('keeps a phone, a weak device and software rendering at the screen’s pixels', () => {
    expect(stageRatio({ tier: 'mid' })).toBe(1);
    expect(stageRatio({ tier: 'low' })).toBe(1);
    expect(stageRatio({ soft: true, tier: 'ultra' })).toBe(1);
  });
});
