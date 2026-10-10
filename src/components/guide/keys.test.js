import { describe, expect, it } from 'vitest';
import { keyTokens } from './keys';

describe('a control’s keys, as the guide writes them', () => {
  it('makes each key a key', () => {
    expect(keyTokens('W A S D')).toEqual([
      { key: 'W' },
      { key: 'A' },
      { key: 'S' },
      { key: 'D' },
    ]);
  });

  it('leaves the little words between them as words', () => {
    expect(keyTokens('hold F')).toEqual([{ word: 'hold' }, { key: 'F' }]);
    expect(keyTokens('W A S D or ← ↑ ↓ →').map((t) => t.word ?? t.key)).toEqual(['W', 'A', 'S', 'D', 'or', '←', '↑', '↓', '→']);
    expect(keyTokens('Q then E')[1]).toEqual({ word: 'then' });
  });

  it('keeps named keys and pointer gestures whole', () => {
    expect(keyTokens('Shift Space Esc Tab Enter')).toEqual(['Shift', 'Space', 'Esc', 'Tab', 'Enter'].map((key) => ({ key })));
    expect(keyTokens('Drag')).toEqual([{ key: 'Drag', pointer: true }]);
    expect(keyTokens('Click / Tap')).toEqual([{ key: 'Click', pointer: true }, { word: 'or' }, { key: 'Tap', pointer: true }]);
    expect(keyTokens('Scroll')[0].pointer).toBe(true);
  });

  it('reads a slash as “or” and a plus as a chord', () => {
    expect(keyTokens('E / Enter')).toEqual([{ key: 'E' }, { word: 'or' }, { key: 'Enter' }]);
    expect(keyTokens('Ctrl+K')).toEqual([{ key: 'Ctrl+K' }]);
  });

  it('keeps a slash that starts or ends the keys as the / key (the galaxy map’s find)', () => {
    expect(keyTokens('/')).toEqual([{ key: '/' }]);
    expect(keyTokens('/ then Enter')).toEqual([{ key: '/' }, { word: 'then' }, { key: 'Enter' }]);
    expect(keyTokens('Shift /')).toEqual([{ key: 'Shift' }, { key: '/' }]);
  });

  it('copes with nothing', () => {
    expect(keyTokens('')).toEqual([]);
    expect(keyTokens(undefined)).toEqual([]);
  });
});
