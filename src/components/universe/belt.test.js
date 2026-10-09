import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { FAR_PX, beltRocks, createBelt, rockBands } from './belt';
import { pxDistance, pxOf } from './planetLod';
import { DEBRIS_DRIFT, debrisRocks } from './deepspace';
import { BELT, RIM } from './layout';

describe('beltRocks', () => {
  it('places as many rocks as the belt draws, fewer on a small screen', () => {
    expect(beltRocks()).toHaveLength(3200);
    expect(beltRocks({ small: true })).toHaveLength(1200);
    expect(beltRocks({ band: RIM, seed: 2049, scale: 14, count: 700 })).toHaveLength(700);
  });

  it('places the same rocks every time for a seed', () => {
    expect(beltRocks({ count: 50 })).toEqual(beltRocks({ count: 50 }));
    expect(beltRocks({ count: 50, seed: 7 })).not.toEqual(beltRocks({ count: 50 }));
  });

  it('keeps every rock inside its band', () => {
    for (const r of beltRocks()) {
      const d = Math.hypot(r.x, r.z);
      expect(d).toBeGreaterThanOrEqual(BELT.inner - 1e-6);
      expect(d).toBeLessThanOrEqual(BELT.outer + 1e-6);
      expect(Math.abs(r.y)).toBeLessThanOrEqual(BELT.height / 2 + 1e-6);
    }
  });

  it('gives each rock a collision radius a little inside its biggest side', () => {
    for (const r of beltRocks({ count: 200 })) {
      expect(r.r).toBeCloseTo(Math.max(r.sx, r.sy, r.sz) * 0.9, 9);
      expect([0, 1, 2, 3]).toContain(r.shape);
    }
  });
});

describe('the belt’s boulders', () => {
  it('one rock in forty is a boulder', () => {
    const rocks = beltRocks({ count: 400 });
    const boulders = rocks.filter((r) => r.shape === 3);
    expect(boulders.length).toBeGreaterThanOrEqual(8);
    expect(boulders.length).toBeLessThanOrEqual(12);
    // (twice its size, and the ship's collider knows it)
    for (const b of boulders) expect(b.r).toBeCloseTo(Math.max(b.sx, b.sy, b.sz) * 0.9, 9);
  });

  it('leaves every other rock where it always was', () => {
    const rocks = beltRocks({ count: 400 });
    const plain = rocks.filter((r) => r.shape !== 3);
    expect(plain.length).toBe(390);
    // (the first rock of the belt, drawn before any boulder was picked, is unchanged by the picking)
    expect(rocks.every((r) => Number.isFinite(r.x) && Math.hypot(r.x, r.z) > 0)).toBe(true);
  });
});

describe('debrisRocks', () => {
  it('places the two streams’ rocks, fewer on a small screen', () => {
    expect(debrisRocks()).toHaveLength(840);
    expect(debrisRocks({ small: true })).toHaveLength(320);
    expect(debrisRocks()).toEqual(debrisRocks());
  });

  it('drifts the streams the way the scene does', () => {
    const d = DEBRIS_DRIFT(0);
    expect(d.x).toBeCloseTo(0, 9);
    expect(d.y).toBeCloseTo(Math.sin(1) * 1.5, 9);
    expect(d.z).toBeCloseTo(5, 9);
  });
});

describe('the belt drawn for its rocks’ size on screen', () => {
  const VIEW = { fov: 50, height: 720 };
  const at = (x, y, z) => ({ x, y, z });

  it('a rock under three pixels tall takes the far shape, a bigger rock later, held a tenth past the edge', () => {
    expect(FAR_PX).toBe(3);
    const rocks = [
      { x: 0, y: 0, z: 0, sx: 1, sy: 0.8, sz: 0.9 },
      { x: 0, y: 0, z: 0, sx: 2, sy: 1.6, sz: 1.8 },
    ];
    const edge = pxDistance(1, FAR_PX, VIEW.fov, VIEW.height);
    const bands = new Int8Array(2).fill(-1);
    // (just past the small one's edge: it's under 3 px there, the big one isn't)
    expect(pxOf(1, edge * 1.02, VIEW.fov, VIEW.height)).toBeLessThan(FAR_PX);
    expect(rockBands(rocks, at(0, 0, edge * 1.02), { ...VIEW, bands })).toBe(2);
    expect([...bands]).toEqual([1, 0]);
    // held: a far one comes back only a little inside its edge, a near one goes only a little past it
    bands.set([1, 0]);
    expect(rockBands(rocks, at(0, 0, edge * 0.97), { ...VIEW, bands })).toBe(0);
    expect(bands[0]).toBe(1);
    rockBands(rocks, at(0, 0, edge * 0.9), { ...VIEW, bands });
    expect(bands[0]).toBe(0);
    rockBands(rocks, at(0, 0, edge * 1.03), { ...VIEW, bands });
    expect(bands[0]).toBe(0);
    rockBands(rocks, at(0, 0, edge * 1.1), { ...VIEW, bands });
    expect(bands[0]).toBe(1);
  });

  // (its size, from the matrix's columns: a matrix scaled to nothing doesn't decompose)
  const sizeOf = (mesh, k) => {
    const m = new THREE.Matrix4();
    mesh.getMatrixAt(k, m);
    const e = m.elements;
    return Math.hypot(Math.hypot(e[0], e[1], e[2]), Math.hypot(e[4], e[5], e[6]), Math.hypot(e[8], e[9], e[10]));
  };
  const scaleOf = (mesh, k) => {
    const m = new THREE.Matrix4();
    mesh.getMatrixAt(k, m);
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    m.decompose(p, q, s);
    return { p, q, s };
  };

  it('every rock in its own shape until it has been sorted, as before; from far off all in the one far shape', () => {
    const b = createBelt({ count: 200, tier: 'low' });
    expect(b.meshes).toHaveLength(5);
    const own = [0, 1, 2, 3].map((s) => b.rocks.filter((o) => o.shape === s).length);
    expect(b.meshes.slice(0, 4).map((m) => m.count)).toEqual(own);
    expect(b.meshes[4].count).toBe(0);
    expect(b.meshes[4].visible).toBe(false);
    b.update(0, at(0, 1e6, 0), { ...VIEW, dt: 0 });
    expect(b.meshes[4].count).toBe(200);
    expect(b.meshes[4].visible).toBe(true);
    for (const m of b.meshes.slice(0, 4)) {
      expect(m.count).toBe(0);
      expect(m.visible).toBe(false); // (an empty draw not made at all)
    }
    // up close to one rock: it's back in its own shape, the rest stay far
    const o = b.rocks[7];
    b.update(0, at(o.x + 1, o.y, o.z), { ...VIEW, dt: 1 });
    const [mesh] = b.slotOf(7);
    expect(mesh).toBe(b.meshes[o.shape]);
    const counts = b.meshes.map((m) => m.count);
    expect(counts.reduce((a, n) => a + n, 0)).toBe(200);
    expect(counts[o.shape]).toBeGreaterThan(0);
  });

  it('draws a far rock where its own shape was, the same size, turned the same way, in the same colour', () => {
    const b = createBelt({ count: 120, tier: 'low' });
    const near = b.rocks.map((o, i) => {
      const [mesh, k] = b.slotOf(i);
      const m = new THREE.Matrix4();
      mesh.getMatrixAt(k, m);
      mesh.geometry.computeBoundingBox();
      return { ...scaleOf(mesh, k), mid: mesh.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(m), colour: (() => { const c = new THREE.Color(); mesh.getColorAt(k, c); return c; })(), box: mesh.geometry.boundingBox.getSize(new THREE.Vector3()) };
    });
    b.update(0, at(0, 1e6, 0), { ...VIEW, dt: 0 });
    const far = b.meshes[4];
    far.geometry.computeBoundingBox();
    const farBox = far.geometry.boundingBox.getSize(new THREE.Vector3());
    b.rocks.forEach((o, i) => {
      const [mesh, k] = b.slotOf(i);
      expect(mesh).toBe(far);
      const f = scaleOf(far, k);
      // (its box's middle where its own shape's was)
      const fm = new THREE.Matrix4();
      far.getMatrixAt(k, fm);
      expect(far.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(fm).distanceTo(near[i].mid)).toBeLessThan(1e-4);
      expect(Math.abs(f.q.dot(near[i].q))).toBeCloseTo(1, 6);
      // (its extent on each axis its own shape's)
      expect(farBox.x * f.s.x).toBeCloseTo(near[i].box.x * near[i].s.x, 4);
      expect(farBox.y * f.s.y).toBeCloseTo(near[i].box.y * near[i].s.y, 4);
      expect(farBox.z * f.s.z).toBeCloseTo(near[i].box.z * near[i].s.z, 4);
      const c = new THREE.Color();
      far.getColorAt(k, c);
      expect(c.equals(near[i].colour)).toBe(true);
    });
    // and one shape, of fewer faces than any of its own
    const tris = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
    for (const m of b.meshes.slice(0, 4)) expect(tris(far.geometry)).toBeLessThan(tris(m.geometry));
  });

  it('a rock smashed stays gone across a re-sort into the other shape, and comes back in whichever it is in', () => {
    const b = createBelt({ count: 120, tier: 'low' });
    const view = { ...VIEW, dt: 0 };
    b.update(0, at(0, 1e6, 0), view);
    b.hide(5);
    let [mesh, k] = b.slotOf(5);
    expect(mesh).toBe(b.meshes[4]);
    expect(sizeOf(mesh, k)).toBe(0);
    const o = b.rocks[5];
    b.update(0, at(o.x + 1, o.y, o.z), { ...VIEW, dt: 1 });
    [mesh, k] = b.slotOf(5);
    expect(mesh).toBe(b.meshes[o.shape]);
    expect(sizeOf(mesh, k)).toBe(0);
    b.show(5);
    expect(sizeOf(mesh, k)).toBeCloseTo(Math.hypot(o.sx, o.sy, o.sz), 5);
    // and back out far, still there
    b.update(0, at(0, 1e6, 0), { ...VIEW, dt: 1 });
    [mesh, k] = b.slotOf(5);
    expect(mesh).toBe(b.meshes[4]);
    expect(sizeOf(mesh, k)).toBeGreaterThan(0);
  });

  it('re-sorts every half second, or at once once the camera has come 20 units', () => {
    const b = createBelt({ count: 120, tier: 'low' });
    const o = b.rocks[9];
    b.update(0, at(0, 1e6, 0), { ...VIEW, dt: 0 });
    // (a little way: not yet)
    b.update(0, at(0, 1e6 - 10, 0), { ...VIEW, dt: 0.1 });
    expect(b.slotOf(9)[0]).toBe(b.meshes[4]);
    // (right up to it, a long way: at once)
    b.update(0, at(o.x + 1, o.y, o.z), { ...VIEW, dt: 0.1 });
    expect(b.slotOf(9)[0]).toBe(b.meshes[o.shape]);
    // (a few units off, then time: on the half second)
    b.update(0, at(o.x + 1, o.y + 5, o.z), { ...VIEW, dt: 0.1 });
    b.update(0, at(o.x + 1, o.y + 5, o.z), { ...VIEW, dt: 0.5 });
    expect(b.slotOf(9)[0]).toBe(b.meshes[o.shape]);
  });

  it('turns about the sun, the camera taken into its own turn', () => {
    const b = createBelt({ count: 120, tier: 'low', spin: 0.5 });
    const o = b.rocks[3];
    // where rock 3 is at t = 2, in the belt's parent's space
    const there = new THREE.Vector3(o.x, o.y, o.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), 1);
    b.update(2, at(there.x + 1, there.y, there.z), { ...VIEW, dt: 0 });
    expect(b.group.rotation.y).toBeCloseTo(1, 9);
    expect(b.slotOf(3)[0]).toBe(b.meshes[o.shape]);
  });
});
