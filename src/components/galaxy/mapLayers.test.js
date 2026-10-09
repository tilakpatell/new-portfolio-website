import { describe, expect, it } from 'vitest';
import { DEFAULT_LAYERS, LAYERS, readLayers, warForEra } from './mapLayers';

describe('mapLayers', () => {
  it('reads saved layers, defaulting anything odd', () => {
    expect(readLayers(null)).toEqual(DEFAULT_LAYERS);
    expect(readLayers({ grid: true, lanes: 'no', bogus: true })).toEqual({ ...DEFAULT_LAYERS, grid: true });
    expect(Object.keys(readLayers({}))).toEqual(LAYERS);
  });
  it('shows the war of the era picked, or your own', () => {
    expect(warForEra('republic', 'gcw')).toBe('clone');
    expect(warForEra('empire', 'clone')).toBe('gcw');
    expect(warForEra('newrepublic', 'gcw')).not.toBe('gcw');
    expect(warForEra('all', 'clone')).toBe('clone');
  });
});
