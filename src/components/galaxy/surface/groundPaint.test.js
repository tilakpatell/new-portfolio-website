import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { groundPainter } from './groundPaint';

const flat = (h = 5, n = [0, 1, 0]) => ({ heightAt: () => h, normalAt: () => n });
const palette = { low: '#804020', high: '#20a040', rock: '#808080', deep: '#102030', hLow: 0, hHigh: 10, rockAt: 0.42, accentCover: 0, grain: 0 };
const site = (over = {}) => ({ ground: { seed: 3, palette }, land: { at: [0, 0] }, places: [], grass: { cover: 1 }, ...over });
const lin = (hex) => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};
const paintAt = (p, x, z) => {
  const out = [0, 0, 0];
  const grass = p.paint(x, z, out);
  return { out, grass };
};
const near = (a, b, eps = 0.02) => a.every((v, i) => Math.abs(v - b[i]) < eps);

describe('the ground painted as one function', () => {
  it('is the low colour under hLow, the high over hHigh, and a mix between', () => {
    expect(near(paintAt(groundPainter(site(), flat(-5)), 300, 300).out, lin(palette.low))).toBe(true);
    expect(near(paintAt(groundPainter(site(), flat(15)), 300, 300).out, lin(palette.high))).toBe(true);
    const mid = paintAt(groundPainter(site(), flat(5)), 300, 300).out;
    const lo = lin(palette.low);
    const hi = lin(palette.high);
    for (let i = 0; i < 3; i++) expect(mid[i]).toBeGreaterThanOrEqual(Math.min(lo[i], hi[i]) - 0.02);
    for (let i = 0; i < 3; i++) expect(mid[i]).toBeLessThanOrEqual(Math.max(lo[i], hi[i]) + 0.02);
    expect(near(mid, lo, 0.05) || near(mid, hi, 0.05)).toBe(false);
  });

  it('is rock on a slope past rockAt', () => {
    const { out } = paintAt(groundPainter(site(), flat(5, [0.75, 0.5, 0.43])), 300, 300);
    expect(near(out, lin(palette.rock), 0.12)).toBe(true);
  });

  it('is the deep colour under the water, with no grass', () => {
    const { out, grass } = paintAt(groundPainter(site({ water: { level: 0 } }), flat(-3)), 300, 300);
    expect(near(out, lin(palette.deep), 0.05)).toBe(true);
    expect(grass).toBe(0);
  });

  it('grows no grass on the landing flat or a place’s flat', () => {
    const p = groundPainter(site({ places: [{ at: [200, -200], flat: { r: 40 } }] }), flat(5));
    expect(paintAt(p, 0, 0).grass).toBe(0);
    expect(paintAt(p, 200, -200).grass).toBe(0);
    let grown = 0;
    for (let z = -500; z <= 500; z += 100) for (let x = -500; x <= 500; x += 100) if (Math.hypot(x, z) > 60 && Math.hypot(x - 200, z + 200) > 60) grown += paintAt(p, x, z).grass > 0.5 ? 1 : 0;
    expect(grown).toBeGreaterThan(60);
  });

  it('darkens the colour and thins the grass under a tree’s crown', () => {
    const open = groundPainter(site(), flat(5));
    const shaded = groundPainter(site(), flat(5), { shade: [{ at: [300, 300], r: 20 }] });
    const a = paintAt(open, 300, 300);
    const b = paintAt(shaded, 300, 300);
    for (let i = 0; i < 3; i++) expect(b.out[i]).toBeCloseTo(a.out[i] * 0.75, 2);
    expect(b.grass).toBeCloseTo(a.grass * 0.4, 2);
    expect(paintAt(shaded, 400, 400).grass).toBeCloseTo(paintAt(open, 400, 400).grass, 5);
  });

  it('paints colour and no grass on a world without grass', () => {
    const p = groundPainter(site({ grass: undefined }), flat(5));
    const { out, grass } = paintAt(p, 300, 300);
    expect(grass).toBe(0);
    expect(out.some((v) => v > 0)).toBe(true);
  });

  it('reads the height from the grid', () => {
    expect(groundPainter(site(), flat(7)).height(1, 2)).toBe(7);
  });
});
