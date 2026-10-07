import { describe, expect, it } from 'vitest';
import { Document } from '@gltf-transform/core';
import { kmeans, nearestOf, flattenPrimitive, posterize } from './flatten-glb.mjs';

describe('a model’s colours, gathered into a few', () => {
  it('finds the clusters in a set of colours, the same each time', () => {
    const reds = Array.from({ length: 20 }, (_, i) => [0.8 + (i % 3) * 0.01, 0.1, 0.1]);
    const blues = Array.from({ length: 30 }, (_, i) => [0.1, 0.1, 0.7 + (i % 4) * 0.01]);
    const { centres, label } = kmeans([...reds, ...blues], 2, { seed: 3 });
    expect(centres).toHaveLength(2);
    // (each lot in a cluster of its own)
    expect(new Set(label.slice(0, 20)).size).toBe(1);
    expect(new Set(label.slice(20)).size).toBe(1);
    expect(label[0]).not.toBe(label[20]);
    const red = centres[label[0]];
    expect(red[0]).toBeGreaterThan(0.75);
    expect(kmeans([...reds, ...blues], 2, { seed: 3 })).toEqual({ centres, label });
  });

  it('never asks for more clusters than there are colours', () => {
    const { centres } = kmeans([[0.1, 0.2, 0.3]], 5);
    expect(centres).toHaveLength(1);
  });

  it('pulls a colour toward the nearest of a palette, by as much as asked', () => {
    const palette = [
      [1, 0, 0],
      [0, 0, 1],
    ];
    expect(nearestOf([0.9, 0.1, 0.2], palette)).toEqual([1, 0, 0]);
    expect(nearestOf([0.1, 0.1, 0.8], palette)).toEqual([0, 0, 1]);
  });
});

describe('a primitive repainted in flat colours', () => {
  // a 2x2 texture: red on the left, blue on the right (sRGB bytes)
  const pixels = { width: 2, height: 2, data: Uint8Array.from([255, 0, 0, 255, 0, 0, 255, 255, 255, 0, 0, 255, 0, 0, 255, 255]) };

  const primitive = () => {
    const doc = new Document();
    const buf = doc.createBuffer();
    const uv = doc.createAccessor().setType('VEC2').setArray(new Float32Array([0.1, 0.5, 0.9, 0.5, 0.1, 0.9])).setBuffer(buf);
    const pos = doc.createAccessor().setType('VEC3').setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0])).setBuffer(buf);
    const tex = doc.createTexture('atlas');
    const mat = doc.createMaterial('m').setBaseColorTexture(tex).setRoughnessFactor(0.4).setMetallicFactor(0.6);
    const prim = doc.createPrimitive().setAttribute('POSITION', pos).setAttribute('TEXCOORD_0', uv).setMaterial(mat);
    doc.createMesh().addPrimitive(prim);
    return { doc, prim, mat };
  };

  it('writes each vertex its texel’s colour, clustered, and drops the atlas', () => {
    const { doc, prim, mat } = primitive();
    const out = flattenPrimitive(doc, prim, pixels, { colours: 2 });
    const col = prim.getAttribute('COLOR_0');
    expect(col).toBeTruthy();
    expect(col.getCount()).toBe(3);
    // (the left two vertices red, the right one blue, in linear light)
    expect(col.getElement(0, [])[0]).toBeGreaterThan(0.9);
    expect(col.getElement(1, [])[2]).toBeGreaterThan(0.9);
    expect(col.getElement(2, [])[0]).toBeGreaterThan(0.9);
    expect(mat.getBaseColorTexture()).toBe(null);
    // (flat and matte: the look shades it, not a texture)
    expect(mat.getRoughnessFactor()).toBe(0.85);
    expect(mat.getMetallicFactor()).toBe(0);
    expect(out.colours).toHaveLength(2);
  });

  it('snaps the clusters onto a palette when given one', () => {
    const { doc, prim } = primitive();
    flattenPrimitive(doc, prim, pixels, { colours: 2, palette: ['#00ff00', '#ffff00'], pull: 1 });
    const c0 = prim.getAttribute('COLOR_0').getElement(0, []);
    // (red's nearest of green and yellow is yellow)
    expect(c0[0]).toBeGreaterThan(0.9);
    expect(c0[1]).toBeGreaterThan(0.9);
  });

  it('leaves a primitive with no atlas or no UVs alone', () => {
    const doc = new Document();
    const prim = doc.createPrimitive().setMaterial(doc.createMaterial('plain'));
    expect(flattenPrimitive(doc, prim, pixels)).toBe(null);
  });
});

describe('an atlas posterised into flat colours', () => {
  // four texels: two near-reds and two near-blues (RGBA bytes)
  const px = () => ({ width: 2, height: 2, data: Uint8Array.from([250, 10, 10, 255, 240, 20, 5, 255, 10, 10, 250, 128, 5, 20, 240, 255]) });

  it('sets each texel to its cluster’s colour, keeping alpha', () => {
    const out = posterize(px(), { colours: 2 });
    const d = out.pixels.data;
    // (the two reds the same red, the two blues the same blue)
    expect([d[0], d[1], d[2]]).toEqual([d[4], d[5], d[6]]);
    expect([d[8], d[9], d[10]]).toEqual([d[12], d[13], d[14]]);
    expect(d[0]).toBeGreaterThan(200);
    expect(d[10]).toBeGreaterThan(200);
    expect(d[11]).toBe(128);
    expect(out.colours).toHaveLength(2);
  });

  it('pulls the clusters onto a palette', () => {
    const out = posterize(px(), { colours: 2, palette: ['#ff8800', '#0088ff'], pull: 1 });
    const d = out.pixels.data;
    expect([d[0], d[1], d[2]]).toEqual([255, 136, 0]);
    expect([d[8], d[9], d[10]]).toEqual([0, 136, 255]);
  });
});
