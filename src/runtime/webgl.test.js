import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { BLOOM } from '../lib/three/bloom';

// the classic renderer needs a browser; a stand-in records what it was made with
const made = [];
vi.mock('../lib/three/renderer', () => ({
  createRenderer: (canvas, options) => {
    made.push(options);
    return { renderer: { capabilities: { maxTextureSize: 4096 } }, lost: false, dispose: vi.fn() };
  },
  fitRatio: () => 1,
  maxSide: () => 4096,
  precompile: vi.fn(),
  precompilePasses: vi.fn(),
  uploadTextures: vi.fn(),
}));

const { buildComposer, createWebGL } = await import('./webgl');

// enough of a renderer for an EffectComposer to be made on it
const stub = () => ({ getSize: (v) => v.set(64, 64), getPixelRatio: () => 1, setRenderTarget() {}, render() {} });

describe('the WebGL backend’s defaults', () => {
  it('tone-maps the house’s way unless a world asks otherwise', () => {
    createWebGL({}, {});
    expect(made.at(-1).toneMapping).toBe(THREE.NeutralToneMapping);
    createWebGL({}, { toneMapping: THREE.NoToneMapping });
    expect(made.at(-1).toneMapping).toBe(THREE.NoToneMapping);
  });

  it('blooms by the house’s numbers when a pass gives none of its own', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const { passes } = buildComposer(stub(), [{ kind: 'render', scene, camera }, { kind: 'bloom' }], { w: 64, h: 64 });
    expect([passes[1].threshold, passes[1].strength, passes[1].radius]).toEqual([BLOOM.threshold, BLOOM.strength, BLOOM.radius]);
    const own = buildComposer(stub(), [{ kind: 'render', scene, camera }, { kind: 'bloom', threshold: 2.2, strength: 0.6 }], { w: 64, h: 64 }).passes[1];
    expect([own.threshold, own.strength, own.radius]).toEqual([2.2, 0.6, BLOOM.radius]);
  });
});

describe('the game light’s passes', () => {
  it('are refused by name: they need the node renderer', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    for (const kind of ['ssgi', 'ao', 'ssr', 'godrays', 'lensflare', 'lut', 'traa', 'smaa', 'denoise']) {
      expect(() => buildComposer(stub(), [{ kind: 'render', scene, camera }, { kind }], { w: 64, h: 64 })).toThrow(`a ${kind} pass needs the node renderer`);
    }
    expect(() => buildComposer(stub(), [{ kind: 'vignette' }], { w: 64, h: 64 })).toThrow('unknown pass vignette');
  });
});
