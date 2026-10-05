import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SYSTEMS } from './systems';
import { FAMILIES, LOOKS, buildBody } from './bodies';
import { createRocks } from './rocks';

// every look the systems name, each body and rock field they'd build: what
// can be checked without a GPU (the shaders themselves need a browser)
const used = () => {
  const ids = new Set();
  for (const s of SYSTEMS) {
    if (s.body) ids.add(s.body.look);
    if (s.parent) ids.add(s.parent.look);
    for (const m of s.moons ?? []) ids.add(m.look);
  }
  return [...ids];
};

describe('LOOKS', () => {
  it('has every look the systems use', () => {
    for (const id of used()) expect(LOOKS[id], id).toBeTruthy();
  });

  it('gives every look a name, a swatch, a family and all its colours', () => {
    for (const [id, l] of Object.entries(LOOKS)) {
      expect(typeof l.name, id).toBe('string');
      expect(l.swatch, id).toMatch(/^#[0-9a-f]{6}$/i);
      expect(FAMILIES[l.family], id).toBeTruthy();
      for (const slot of FAMILIES[l.family].slots) expect(l.pal[slot], `${id} ${slot}`).toMatch(/^#[0-9a-f]{6}$/i);
      for (const k of Object.keys(l.p ?? {})) expect(FAMILIES[l.family].params, `${id} ${k}`).toContain(k);
    }
  });
});

describe('buildBody', () => {
  it('builds every look, sized as asked, its reach past its surface', () => {
    const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 9000);
    camera.position.set(0, 0, 200);
    for (const id of Object.keys(LOOKS)) {
      for (const small of [false, true]) {
        const b = buildBody(id, { r: 30, small });
        expect(b.group, id).toBeInstanceOf(THREE.Group);
        expect(b.radius, id).toBe(30);
        expect(b.reach, id).toBeGreaterThanOrEqual(30);
        expect(b.reach, id).toBeLessThan(30 * 1.2);
        b.setSuns([{ dir: new THREE.Vector3(1, 0, 0), color: new THREE.Color(1.2, 1.1, 1) }, { dir: new THREE.Vector3(0, 0, 1), color: new THREE.Color(0.6, 0.5, 0.4) }]);
        b.update(12.5, camera);
        b.set('charge', 1);
        b.set('shield', 1);
        b.set('flash', 0.5);
        b.set('nonsense', 3);
        const surface = b.group.children[0];
        expect(surface.material.fragmentShader, id).toContain('void surface(');
        expect(surface.material.uniforms.uMaxOct.value, id).toBe(small ? 5 : 9);
        b.dispose();
      }
    }
  });

  it('puts Scarif inside its shield, and nothing else in one', () => {
    expect(buildBody('scarif', { r: 32 }).reach).toBeCloseTo(32 * 1.12);
    expect(buildBody('hoth', { r: 36 }).reach).toBeLessThan(36 * 1.1);
  });
});

describe('createRocks', () => {
  const kinds = [
    { kind: 'ring', at: [10, 0, -5], inner: 54, outer: 88, thickness: 5, tilt: [0.22, 0.08], count: 900, seed: 11 },
    { kind: 'field', at: [230, 30, 150], radius: 80, count: 420, seed: 7 },
    { kind: 'debris', at: [0, 0, 0], radius: 70, count: 520, seed: 3 },
  ];

  it('makes its solids, the big rocks, where the field is', () => {
    for (const k of kinds) {
      const r = createRocks(k);
      expect(r.solids.length, k.kind).toBeGreaterThan(0);
      expect(r.solids.length, k.kind).toBeLessThanOrEqual(60);
      const c = new THREE.Vector3(...k.at);
      const far = k.kind === 'ring' ? k.outer + k.thickness + 10 : k.radius * 1.3;
      for (const s of r.solids) {
        expect(s.id).toMatch(/^rock-\d+$/);
        expect(s.r).toBeGreaterThan(0);
        expect(s.reach).toBe(s.r);
        expect(new THREE.Vector3(...s.at).distanceTo(c), k.kind).toBeLessThan(far);
        if (k.kind === 'ring') expect(new THREE.Vector3(...s.at).distanceTo(c)).toBeGreaterThan(k.inner - k.thickness - 10);
      }
      r.update(30, null);
      r.dispose();
    }
  });

  it('gives the Hoth field a few huge rocks and the big ones room', () => {
    const r = createRocks(kinds[1]);
    const max = Math.max(...r.solids.map((s) => s.r));
    expect(max).toBeGreaterThan(4);
    expect(max).toBeLessThanOrEqual(8);
    for (let a = 0; a < r.solids.length; a++) {
      for (let b = a + 1; b < r.solids.length; b++) {
        const d = new THREE.Vector3(...r.solids[a].at).distanceTo(new THREE.Vector3(...r.solids[b].at));
        expect(d).toBeGreaterThan((r.solids[a].r + r.solids[b].r) * 0.9);
      }
    }
  });

  it('is the same field for everyone with the same seed', () => {
    const a = createRocks(kinds[2]).solids;
    const b = createRocks(kinds[2]).solids;
    expect(a).toEqual(b);
  });
});
