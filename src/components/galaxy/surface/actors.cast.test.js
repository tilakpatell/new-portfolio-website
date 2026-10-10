import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createKit } from './kit';

// (no files in a test: every model is a miss)
vi.mock('./placer', async () => ({ ...(await vi.importActual('./placer')), loadGlb: async () => null }));
vi.mock('./crew', async () => ({ ...(await vi.importActual('./crew')), crewFigure: async () => null }));
const { anyFigure } = await import('./actors');

// (canvases that take every call and draw nothing: the kit paints its stand-ins)
beforeAll(() => {
  const g = { addColorStop() {} };
  const canvas = { width: 0, height: 0 };
  canvas.getContext = () => new Proxy({}, { get: (_, k) => (k === 'canvas' ? canvas : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : () => g), set: () => true });
  globalThis.document = { createElement: () => ({ ...canvas, getContext: canvas.getContext }) };
});
afterAll(() => delete globalThis.document);

describe('anyFigure and the models-only cast', () => {
  it('a prop that walks is marked built, as a built figure is', async () => {
    const kit = createKit({ seed: 1, scans: false });
    const fig = await anyFigure('vader', { model: false }, kit, 0);
    expect(fig.model).toBeInstanceOf(THREE.Object3D);
    expect(fig.model.userData.built).toBe(true);
  });
  it('without a file, a world that takes models only gets nothing, not a build', async () => {
    const kit = createKit({ seed: 1, scans: false });
    expect(await anyFigure('droid', {}, kit, 0, undefined, { only: true })).toBeNull();
    expect(await anyFigure('vader', { model: false }, kit, 0, undefined, { only: true })).toBeNull();
    expect((await anyFigure('droid', {}, kit, 0)).model.userData.built).toBe(true);
  });
});
