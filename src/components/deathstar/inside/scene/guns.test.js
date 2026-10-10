import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { WEAPONS } from '../rules/combat';
import { GUN_PARTS, buildGun, disposeGuns } from './guns';

const bounds = (gun) => new THREE.Box3().setFromObject(gun);

describe('the guns, built in code', () => {
  it('builds every gun the combat rules know, and nothing for one they don’t', () => {
    for (const kind of Object.keys(WEAPONS)) expect(buildGun(kind), kind).toBeInstanceOf(THREE.Group);
    expect(buildGun('bowcaster')).toBeNull();
  });

  it('marks each gun’s muzzle at the very front of its barrel, pointing the way it fires', () => {
    for (const kind of Object.keys(WEAPONS)) {
      const gun = buildGun(kind);
      gun.updateMatrixWorld(true);
      const muzzle = gun.getObjectByName('muzzle');
      expect(muzzle, kind).toBeTruthy();
      expect(muzzle.position.z, kind).toBeCloseTo(bounds(gun).min.z, 2);
      // and on the barrel’s line, not off to one side
      expect(Math.abs(muzzle.position.x), kind).toBeLessThan(0.01);
    }
  });

  it('holds each gun by its grip at the origin, its barrel out in front', () => {
    for (const kind of Object.keys(WEAPONS)) {
      const box = bounds(buildGun(kind));
      expect(box.min.z, kind).toBeLessThan(-0.2);
      expect(box.min.y, kind).toBeLessThan(0);
      expect(box.max.y, kind).toBeGreaterThan(0);
    }
  });

  it('gives the E-11 its scope, its folding stock and its barrel shroud with holes', () => {
    expect(GUN_PARTS.e11).toEqual(expect.arrayContaining(['scope', 'stock', 'shroud', 'holes', 'magazine', 'grip']));
  });

  it('gives the DL-44 its scope and flash hider, and the A280 a stock to the shoulder', () => {
    expect(GUN_PARTS.dl44).toEqual(expect.arrayContaining(['scope', 'flash hider']));
    expect(GUN_PARTS.a280).toEqual(expect.arrayContaining(['stock', 'scope']));
  });

  it('makes the long guns longer than the pistols', () => {
    const length = (kind) => bounds(buildGun(kind)).getSize(new THREE.Vector3()).z;
    expect(length('a280')).toBeGreaterThan(length('e11'));
    expect(length('e11')).toBeGreaterThan(length('dl44'));
    expect(length('e11')).toBeGreaterThan(length('dh17'));
  });

  it('builds each kind once and shares it, so a squad of troopers costs one gun’s geometry', () => {
    const a = buildGun('e11');
    const b = buildGun('e11');
    const meshes = (g) => g.children.filter((o) => o.isMesh);
    expect(a).not.toBe(b);
    expect(meshes(a)).toHaveLength(1);
    expect(meshes(a)[0].geometry).toBe(meshes(b)[0].geometry);
    expect(meshes(a)[0].material).toBe(meshes(buildGun('dl44'))[0].material);
  });

  it('frees what it shares when told to, and builds afresh after', () => {
    const before = buildGun('dh17').children.find((o) => o.isMesh).geometry;
    let freed = false;
    before.addEventListener('dispose', () => (freed = true));
    disposeGuns();
    expect(freed).toBe(true);
    expect(buildGun('dh17').children.find((o) => o.isMesh).geometry).not.toBe(before);
  });
});
