import { describe, expect, it } from 'vitest';
import { pickBackend, readOverride } from './backend';

describe('pickBackend', () => {
  it('picks webgpu only for a nodes module with a gpu', () => {
    expect(pickBackend({ gpu: true, shading: 'nodes' })).toBe('webgpu');
    expect(pickBackend({ gpu: true, shading: 'glsl' })).toBe('webgl');
    expect(pickBackend({ gpu: false, shading: 'nodes' })).toBe('webgl');
    expect(pickBackend({ gpu: true })).toBe('webgl'); // glsl is the default
  });

  it('an override wins, a loss never goes back', () => {
    expect(pickBackend({ gpu: true, shading: 'glsl', override: 'webgpu' })).toBe('webgpu');
    expect(pickBackend({ gpu: true, shading: 'nodes', override: 'webgl' })).toBe('webgl');
    expect(pickBackend({ gpu: true, shading: 'nodes', lost: true })).toBe('webgl');
    expect(pickBackend({ gpu: true, shading: 'nodes', override: 'webgpu', lost: true })).toBe('webgl');
    expect(pickBackend({ gpu: false, shading: 'nodes', override: 'webgpu' })).toBe('webgl'); // no gpu to force
  });
});

describe('readOverride', () => {
  it('reads the override from the address, the hash or storage', () => {
    expect(readOverride('?gpu=webgl', '', null)).toBe('webgl');
    expect(readOverride('', '#/earth?gpu=webgpu', null)).toBe('webgpu');
    expect(readOverride('', '', 'webgl')).toBe('webgl');
    expect(readOverride('?gpu=nope', '', 'x')).toBe(null);
    expect(readOverride('', '', null)).toBe(null);
  });
});
