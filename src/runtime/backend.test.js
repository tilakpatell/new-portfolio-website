import { describe, expect, it } from 'vitest';
import { pickBackend, readOverride } from './backend';

describe('pickBackend', () => {
  it('a glsl module always gets the classic renderer', () => {
    expect(pickBackend({ gpu: true, shading: 'glsl' })).toBe('webgl');
    expect(pickBackend({ gpu: true })).toBe('webgl'); // glsl is the default
    expect(pickBackend({ gpu: true, shading: 'glsl', override: 'webgpu' })).toBe('webgl'); // it can’t run there
    expect(pickBackend({ gpu: false, shading: 'glsl', lost: true })).toBe('webgl');
  });

  it('a nodes module gets webgpu with a gpu, nodes-webgl everywhere else', () => {
    expect(pickBackend({ gpu: true, shading: 'nodes' })).toBe('webgpu');
    expect(pickBackend({ gpu: false, shading: 'nodes' })).toBe('nodes-webgl');
    expect(pickBackend({ gpu: true, shading: 'nodes', lost: true })).toBe('nodes-webgl');
    expect(pickBackend({ gpu: true, shading: 'nodes', override: 'webgl' })).toBe('nodes-webgl');
    expect(pickBackend({ gpu: true, shading: 'nodes', override: 'webgpu', lost: true })).toBe('nodes-webgl');
    expect(pickBackend({ gpu: false, shading: 'nodes', override: 'webgpu' })).toBe('nodes-webgl'); // no gpu to force
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

  it('never names the runtime’s own kind', () => {
    expect(readOverride('?gpu=nodes-webgl', '', null)).toBe(null);
    expect(readOverride('', '', 'nodes-webgl')).toBe(null);
  });
});
