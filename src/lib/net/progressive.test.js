import { describe, expect, it } from 'vitest';
import { firstCut, wantsUpgrade } from './progressive';

const all = { hasLod: true, hasFar: true, lowData: false };

describe('which cut of a figure to fetch first', () => {
  it('fetches the small cut first near by, the far cut past the middle distance', () => {
    expect(firstCut(20, 'high', all)).toBe('lod1');
    expect(firstCut(150, 'high', all)).toBe('lod1');
    expect(firstCut(300, 'high', all)).toBe('far');
    expect(firstCut(300, 'high', { ...all, hasFar: false })).toBe('lod1');
  });

  it('fetches the plain cut when there is no other, and at ultra, which keeps the full model at every distance', () => {
    expect(firstCut(20, 'high', { hasLod: false, hasFar: false, lowData: false })).toBe('plain');
    expect(firstCut(300, 'high', { hasLod: false, hasFar: true, lowData: false })).toBe('far');
    expect(firstCut(20, 'ultra', all)).toBe('plain');
    expect(firstCut(900, 'ultra', all)).toBe('plain');
  });

  it('swaps to the plain cut only within near, and never on a saver connection', () => {
    expect(wantsUpgrade(20, 'high', { lowData: false })).toBe(true);
    expect(wantsUpgrade(20, 'high', { lowData: true })).toBe(false);
    expect(wantsUpgrade(100, 'high', { lowData: false })).toBe(false);
    expect(wantsUpgrade(40, 'mid', { lowData: false })).toBe(true);
    expect(wantsUpgrade(50, 'mid', { lowData: false })).toBe(false);
  });

  it('on a saver connection, still the small cut first', () => {
    expect(firstCut(20, 'high', { ...all, lowData: true })).toBe('lod1');
    expect(firstCut(20, 'low', { ...all, lowData: true })).toBe('lod1');
  });
});
