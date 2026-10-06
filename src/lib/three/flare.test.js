import { describe, expect, it } from 'vitest';
import { flareWeight, occluded } from './flare';

describe('the sun in the lens', () => {
  it('is full in the frame, gone past the edge', () => {
    expect(flareWeight({ ndc: [0, 0] })).toBe(1);
    expect(flareWeight({ ndc: [1.15, 0] })).toBe(0);
    expect(flareWeight({ ndc: [1.0, 0] })).toBeGreaterThan(0);
    expect(flareWeight({ ndc: [1.0, 0] })).toBeLessThan(1);
    expect(flareWeight({ ndc: [0, -1.3] })).toBe(0);
  });

  it('is cut by occlusion', () => {
    expect(flareWeight({ ndc: [0, 0], occluded: 1 })).toBe(0);
    expect(flareWeight({ ndc: [0, 0], occluded: 0.5 })).toBeCloseTo(0.5);
  });

  it('a planet across the ray hides the star, softly at its limb', () => {
    const solids = [{ at: [0, 0, 5], r: 1 }];
    expect(occluded({ from: [0, 0, 0], to: [0, 0, 10], solids })).toBe(1);
    expect(occluded({ from: [0, 0, 0], to: [0, 3, 10], solids })).toBe(0);
    const limb = occluded({ from: [0, 0, 0], to: [0, 1.04 * 2, 10], solids }); // passes 1.02 r from the centre: inside the soft band
    expect(limb).toBeGreaterThan(0);
    expect(limb).toBeLessThan(1);
    expect(occluded({ from: [0, 0, 0], to: [0, 0, 10], solids: [] })).toBe(0);
  });

  it('only counts what’s between the eye and the star, not behind either', () => {
    expect(occluded({ from: [0, 0, 0], to: [0, 0, 10], solids: [{ at: [0, 0, 14], r: 1 }] })).toBe(0);
    expect(occluded({ from: [0, 0, 0], to: [0, 0, 10], solids: [{ at: [0, 0, -4], r: 1 }] })).toBe(0);
  });
});

describe('the flare’s sprites', () => {
  it('sit on the star even with the frame shifted for a panel', async () => {
    const THREE = await import('three');
    const { createFlare } = await import('./flare');
    // (canvases that take every call and draw nothing)
    const g = { addColorStop() {} };
    const canvas = { width: 0, height: 0, getContext: () => new Proxy({}, { get: (_, k) => (k === 'canvas' ? canvas : () => g), set: () => true }) };
    canvas.getContext = () => new Proxy({}, { get: (_, k) => (k === 'canvas' ? canvas : () => g), set: () => true });
    globalThis.document = { createElement: () => ({ ...canvas, getContext: canvas.getContext }) };
    const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.5, 1000);
    camera.setViewOffset(1600, 900, 200, 0, 1280, 900); // (the picture shifted, as the overview leaves room for its panel)
    camera.updateMatrixWorld();
    const star = new THREE.Vector3(30, 12, -200);
    const ndc = star.clone().project(camera);
    const f = createFlare();
    camera.add(f.group);
    f.set({ ndc: [ndc.x, ndc.y], weight: 1, camera });
    // (one mesh: one draw for the whole flare)
    expect(f.group.children.length).toBe(1);
    const back = f.centres[0].clone().applyMatrix4(camera.matrixWorld).project(camera); // (the halo, along 1: on the star itself)
    expect(back.x).toBeCloseTo(ndc.x, 5);
    expect(back.y).toBeCloseTo(ndc.y, 5);
    delete globalThis.document;
  });
});
