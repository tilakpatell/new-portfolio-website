import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createKit } from './kit';

// (canvases that take every call and draw nothing: the kit paints its stand-ins)
beforeAll(() => {
  const g = { addColorStop() {} };
  const canvas = { width: 0, height: 0 };
  canvas.getContext = () => new Proxy({}, { get: (_, k) => (k === 'canvas' ? canvas : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : () => g), set: () => true });
  globalThis.document = { createElement: () => ({ ...canvas, getContext: canvas.getContext }) };
});
afterAll(() => delete globalThis.document);

describe('the kit', () => {
  it('blows its plants and cloth in the world’s wind, and not its stone', () => {
    const kit = createKit({ seed: 1, scans: false, wind: { angle: Math.PI / 2 } });
    for (const name of ['fronds', 'foliage', 'cloth', 'strands']) {
      const u = kit.mats[name].userData.wind;
      expect(u, name).toBeTruthy();
      expect(typeof kit.mats[name].onBeforeCompile, name).toBe('function');
      expect(u.uWindDir.value.x, name).toBeCloseTo(0, 5);
      expect(u.uWindDir.value.y, name).toBeCloseTo(1, 5);
    }
    expect(kit.mats.stone.userData.wind).toBeUndefined();
    kit.dispose();
  });
});
