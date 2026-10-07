import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { LOOK, createHouse } from '../../../lib/three/house';
import { adoptLater, exposureOf, groundPieces, lookOf } from './look';

const site = (over = {}) => ({ sky: { zenith: '#26335e', horizon: '#f2a46a' }, ...over });
const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;

describe('a site’s look for the house', () => {
  it('defaults from the sky: the fog is the horizon and the zenith, the shadow a third from zenith toward horizon, darkened', () => {
    const look = lookOf(site());
    expect(hex(look.fogLow)).toBe('#f2a46a');
    expect(hex(look.fogHigh)).toBe('#26335e');
    const want = new THREE.Color('#26335e').lerp(new THREE.Color('#f2a46a'), 1 / 3).multiplyScalar(0.55);
    expect(hex(look.shadow)).toBe(hex(want.getHex()));
    expect(look.edge).toEqual(LOOK.edge);
    expect(look.fogBelow).toBe(LOOK.fogBelow);
    expect(look.halo).toBe(LOOK.halo);
    expect(look.mix).toBe(1);
    expect(look.fogMix).toBe(1);
  });

  it('takes a site’s own look over the defaults, key by key', () => {
    const look = lookOf(site({ look: { shadow: '#5a4a7a', fogBelow: 0.7 } }));
    expect(hex(look.shadow)).toBe('#5a4a7a');
    expect(look.fogBelow).toBe(0.7);
    expect(hex(look.fogLow)).toBe('#f2a46a');
    expect(look.edge).toEqual(LOOK.edge);
  });

  it('drops nonsense', () => {
    const look = lookOf(site({ look: { edge: 'x', shadow: 12, fogBelow: 'no', halo: null } }));
    expect(look.edge).toEqual(LOOK.edge);
    expect(hex(look.shadow)).toBe(hex(lookOf(site()).shadow));
    expect(look.fogBelow).toBe(LOOK.fogBelow);
    expect(look.halo).toBe(LOOK.halo);
  });

  it('exposes a site at its own exposure times the base it’s given (the post’s own tone map: 1)', () => {
    expect(exposureOf(site())).toBeCloseTo(1);
    expect(exposureOf(site({ exposure: 0.8 }))).toBeCloseTo(0.8);
    expect(exposureOf(site({ exposure: 'x' }))).toBeCloseTo(1);
    expect(exposureOf(site({ exposure: 0.8 }), LOOK.exposure)).toBeCloseTo(0.8 * LOOK.exposure);
  });

  it('says which ground pieces a world gets: none with no ground, no grass without grass', () => {
    expect(groundPieces(site({ noGround: true, grass: { h: [0.2, 0.5] } }))).toEqual({ map: false, grass: false, bounce: false });
    expect(groundPieces(site())).toEqual({ map: true, grass: false, bounce: true });
    expect(groundPieces(site({ grass: { h: [0.2, 0.5] } }))).toEqual({ map: true, grass: true, bounce: true });
  });

  it('counts the lit materials of something adopted after the scene', () => {
    const house = createHouse();
    const late = new THREE.Group();
    late.add(new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshLambertMaterial()), new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial()));
    expect(adoptLater(house, late)).toBe(1);
    expect(adoptLater(house, late)).toBe(0);
    expect(adoptLater(house, null)).toBe(0);
  });
});
