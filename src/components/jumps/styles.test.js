import { describe, expect, it } from 'vitest';
import { JUMP_STYLES, jumpEvent, jumpStyle } from './styles';

describe('the jump styles', () => {
  it('fall back to the site’s own jump', () => {
    expect(jumpStyle('portal')).toBe('portal');
    expect(jumpStyle('bluesky')).toBe('bluesky');
    expect(jumpStyle('hyper')).toBe('hyper');
    expect(jumpStyle(undefined)).toBe('hyper');
    expect(jumpStyle('warp')).toBe('hyper');
    expect(JUMP_STYLES[0]).toBe('hyper');
  });

  it('make the event App listens for, with the style in it', () => {
    const e = jumpEvent('portal');
    expect(e.type).toBe('tp:hyperspace');
    expect(e.detail.style).toBe('portal');
    expect(jumpEvent().detail.style).toBe('hyper');
    expect(jumpEvent('nope').detail.style).toBe('hyper');
  });

  it('carries what to do once the jump has the screen dark, when asked', () => {
    const onPeak = () => {};
    expect(jumpEvent('hyper', { onPeak }).detail.onPeak).toBe(onPeak);
    expect(jumpEvent('portal', { onPeak }).detail.style).toBe('portal');
    expect(jumpEvent('hyper').detail).not.toHaveProperty('onPeak');
  });
});
