import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bake, part } from '../../../universe/trafficKit';
import { SCATTER } from './forest';

// a kit that only bakes (no canvas, no scans): what the builders need of one
const kit = { geometry: (list) => bake(list, 1), mats: new Proxy({}, { get: (_, name) => ({ name }) }) };
const byMat = (kind, opts) => Object.fromEntries(SCATTER[kind](kit, opts).parts.map((p) => [p.material.name, p.geometry]));
const tris = (g) => g.attributes.position.count / 3;

describe('a part shaded where its vertices end up', () => {
  it('multiplies each vertex’s colour by the shade at its place', () => {
    const g = bake([part(new THREE.PlaneGeometry(2, 2), { at: [0, 5, 0], color: '#ffffff', shade: (x, y) => y / 10 })], 1);
    const pos = g.attributes.position;
    const col = g.attributes.color;
    for (let i = 0; i < pos.count; i++) expect(col.getX(i)).toBeCloseTo(pos.getY(i) / 10, 5);
  });

  it('leaves a part without one its own colour', () => {
    const g = bake([part(new THREE.PlaneGeometry(1, 1), { color: '#808080' })], 1);
    const c = new THREE.Color('#808080');
    for (let i = 0; i < g.attributes.color.count; i++) expect(g.attributes.color.getX(i)).toBeCloseTo(c.r, 5);
  });
});

describe('the crowns, as Bruno Simon builds his bushes', () => {
  it('builds a jungle tree’s crowns from leaf cards on smooth solid cores', () => {
    const m = byMat('jungletree', { seed: 1 });
    expect(m.foliage).toBeTruthy();
    expect(m.crown).toBeTruthy();
    // (no leaf card bigger than 3 m and a bit: more of them, not bigger ones)
    const pos = m.foliage.attributes.position;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    for (let i = 0; i < pos.count; i += 3) {
      a.fromBufferAttribute(pos, i);
      b.fromBufferAttribute(pos, i + 1);
      expect(a.distanceTo(b)).toBeLessThan(3.6 * Math.SQRT2 + 1e-6);
    }
  });

  it('points every leaf card’s normal up and out of the tree, not every which way', () => {
    const g = byMat('jungletree', { seed: 1 }).foliage;
    const pos = g.attributes.position;
    const nrm = g.attributes.normal;
    const n = new THREE.Vector3();
    let out = 0;
    for (let i = 0; i < pos.count; i++) {
      n.fromBufferAttribute(nrm, i);
      expect(n.length()).toBeCloseTo(1, 4);
      // (out from the trunk, or up: the clump's outside)
      if (n.x * pos.getX(i) + n.z * pos.getZ(i) > 0 || n.y > 0.3) out++;
    }
    expect(out / pos.count).toBeGreaterThan(0.8);
  });

  it('shades a crown darker in its middle than at its skin', () => {
    const g = byMat('jungletree', { seed: 1 }).crown;
    const col = g.attributes.color;
    let lo = 1;
    let hi = 0;
    for (let i = 0; i < col.count; i++) {
      lo = Math.min(lo, col.getY(i));
      hi = Math.max(hi, col.getY(i));
    }
    expect(lo).toBeLessThan(hi * 0.8);
  });

  it('thins a far tree’s leaves, behind the fog', () => {
    expect(tris(byMat('jungletree', { seed: 3, lo: true }).foliage)).toBeLessThan(tris(byMat('jungletree', { seed: 3 }).foliage) * 0.5);
  });

  it('cuts ferns’ and plants’ leaves from cards (fronds, broad leaves), lit as the ground is', () => {
    const fern = byMat('fern', { seed: 3 }).fronds;
    const plant = byMat('plant', { seed: 9 }).broadleaf;
    for (const g of [fern, plant]) {
      const nrm = g.attributes.normal;
      let up = 0;
      for (let i = 0; i < nrm.count; i++) up += Math.abs(nrm.getY(i));
      expect(up / nrm.count).toBeGreaterThan(0.5);
    }
  });
});
