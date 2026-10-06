import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BAKE_LIFT, BAKE_TIERS, bakeFloorTexture, bakeable, castersTop, heightFromPixels, holdForBake, liftSun, packHeight, unpackHeight } from './grounding-bake';

const DEG = Math.PI / 180;
const elevation = (d) => Math.asin(d.y / d.length()) / DEG;
const azimuth = (d) => Math.atan2(d.x, d.z);

describe('a low sun, lifted for the bake', () => {
  it('raises a sun on the horizon to the elevation asked for, facing the same way', () => {
    const dawn = new THREE.Vector3(0.973, 0.066, 0.221).normalize();
    const out = liftSun(dawn, 12.8);
    expect(elevation(out)).toBeCloseTo(12.8, 6);
    expect(azimuth(out)).toBeCloseTo(azimuth(dawn), 6);
    expect(out.length()).toBeCloseTo(1, 9);
  });

  it('leaves a sun that is already higher where it is', () => {
    const noon = new THREE.Vector3(0.1, 0.95, 0.3).normalize();
    const out = liftSun(noon, 12.8);
    expect(out.x).toBeCloseTo(noon.x, 9);
    expect(out.y).toBeCloseTo(noon.y, 9);
    expect(out.z).toBeCloseTo(noon.z, 9);
  });

  it('does nothing without an elevation, and never changes what it was given', () => {
    const dawn = new THREE.Vector3(1, 0.05, 0).normalize();
    const copy = dawn.clone();
    expect(liftSun(dawn).equals(copy)).toBe(true);
    liftSun(dawn, 20);
    expect(dawn.equals(copy)).toBe(true);
  });
});

describe('the floor height, packed in two bytes of the mask', () => {
  it('comes back as it went in, to a millimetre over ten metres', () => {
    const [g, b] = packHeight(3.2, [0, 10]);
    expect(unpackHeight(g, b, [0, 10])).toBeCloseTo(3.2, 2);
    expect(Math.abs(unpackHeight(...packHeight(7.777, [-2, 12]), [-2, 12]) - 7.777)).toBeLessThan(0.001);
  });

  it('keeps 0, 0 for no floor at all, so even the lowest floor is something', () => {
    const [g, b] = packHeight(0, [0, 10]);
    expect(g + b).toBeGreaterThan(0);
    expect(unpackHeight(0, 0, [0, 10])).toBeNull();
  });

  it('clamps a height outside its range to the range', () => {
    expect(unpackHeight(...packHeight(50, [0, 10]), [0, 10])).toBeCloseTo(10, 2);
    expect(unpackHeight(...packHeight(-5, [0, 10]), [0, 10])).toBeCloseTo(0, 2);
  });
});

describe('what a bake leaves out', () => {
  const box = (s = 2, mat = new THREE.MeshStandardMaterial()) => new THREE.Mesh(new THREE.BoxGeometry(s, s, s), mat);

  it('keeps a building-sized box', () => {
    expect(bakeable(box(2), 100)).toBe(true);
  });

  it('leaves out points, see-through things, and whatever asks not to be baked', () => {
    expect(bakeable(new THREE.Points(new THREE.BufferGeometry()), 100)).toBe(false);
    expect(bakeable(box(2, new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.5 })), 100)).toBe(false);
    const no = box(2);
    no.userData.noBake = true;
    expect(bakeable(no, 100)).toBe(false);
  });

  it('leaves out a sky dome bigger than the area, and grass too small to show', () => {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(500, 8, 6), new THREE.MeshBasicMaterial({ side: THREE.BackSide }));
    expect(bakeable(dome, 100)).toBe(false);
    const tufts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshStandardMaterial(), 50);
    expect(bakeable(tufts, 100)).toBe(false);
  });
});

describe('a bake chunk holds the scene and gives it back', () => {
  it('turns every light\'s shadow off, the casters on, hides the movers, then restores them all', () => {
    const scene = new THREE.Scene();
    const sun = new THREE.DirectionalLight();
    sun.castShadow = true;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), new THREE.MeshStandardMaterial());
    floor.receiveShadow = true;
    const house = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4), new THREE.MeshStandardMaterial());
    const walker = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshStandardMaterial());
    walker.castShadow = true;
    scene.add(sun, floor, house, walker);
    const restore = holdForBake(scene, { floor: [floor], casters: [scene], skip: [walker], radius: 100 });
    expect(sun.castShadow).toBe(false);
    expect(house.castShadow).toBe(true);
    expect(floor.castShadow).toBe(false);
    expect(walker.visible).toBe(false);
    restore();
    expect(sun.castShadow).toBe(true);
    expect(house.castShadow).toBe(false);
    expect(walker.visible).toBe(true);
    expect(walker.castShadow).toBe(true);
  });
});

describe('the bake on arrival', () => {
  it('has the sizes the spec gives each tier', () => {
    expect(BAKE_TIERS.high).toEqual({ size: 1024, sun: 40, sky: 40, shadow: 2048 });
    expect(BAKE_TIERS.mid).toEqual({ size: 512, sun: 24, sky: 24, shadow: 2048 });
    expect(BAKE_TIERS.low).toEqual({ size: 512, sun: 12, sky: 16, shadow: 1024 });
  });

  it('gives up, with nothing, where the GPU cannot draw into a float picture', async () => {
    const renderer = { extensions: { has: () => false } };
    const out = await bakeFloorTexture(renderer, new THREE.Scene(), { area: { x0: 0, z0: 0, w: 10, d: 10 }, floor: [], casters: [], sun: new THREE.Vector3(0, 1, 0) });
    expect(out).toBeNull();
  });
});

describe('the floor\'s height, read back from the baked mask', () => {
  // a 2 × 2 mask over a 10 m square at x 0…10, z 0…10: row 0 is z 0…5
  const range = [0, 20];
  const px = new Uint8Array(2 * 2 * 4);
  const put = (col, row, h) => {
    const [g, b] = h == null ? [0, 0] : packHeight(h, range);
    const i = (row * 2 + col) * 4;
    px.set([255, g, b, 255], i);
  };
  put(0, 0, 1); // x 0…5, z 0…5
  put(1, 0, 2); // x 5…10, z 0…5
  put(0, 1, 7.5); // x 0…5, z 5…10
  put(1, 1, null); // no floor
  const area = { x0: 0, z0: 0, w: 10, d: 10 };

  it('gives the height of the texel a point is over', () => {
    expect(heightFromPixels(px, 2, area, range, 1, 1)).toBeCloseTo(1, 2);
    expect(heightFromPixels(px, 2, area, range, 9, 1)).toBeCloseTo(2, 2);
    expect(heightFromPixels(px, 2, area, range, 1, 9)).toBeCloseTo(7.5, 2);
  });

  it('has nothing where no floor was seen, or outside the area', () => {
    expect(heightFromPixels(px, 2, area, range, 9, 9)).toBeNull();
    expect(heightFromPixels(px, 2, area, range, -1, 3)).toBeNull();
    expect(heightFromPixels(px, 2, area, range, 3, 11)).toBeNull();
  });
});

describe('how high what casts stands', () => {
  it('counts a city of instanced towers, not only single meshes', () => {
    const scene = new THREE.Scene();
    const towers = new THREE.InstancedMesh(new THREE.BoxGeometry(20, 1, 20).translate(0, 0.5, 0), new THREE.MeshStandardMaterial(), 2);
    const m = new THREE.Matrix4();
    towers.setMatrixAt(0, m.compose(new THREE.Vector3(0, 0, 0), new THREE.Quaternion(), new THREE.Vector3(1, 40, 1)));
    towers.setMatrixAt(1, m.compose(new THREE.Vector3(50, 0, 0), new THREE.Quaternion(), new THREE.Vector3(1, 120, 1)));
    scene.add(towers);
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshStandardMaterial()));
    scene.updateMatrixWorld(true);
    expect(castersTop([scene], 10000, 0)).toBeCloseTo(120, 0);
  });
});

describe('a low sun, for a bake on arrival', () => {
  it('is baked at least 20 degrees up, so a dusk town isn\'t drowned in one hill\'s shadow', () => {
    expect(BAKE_LIFT).toBe(20);
  });
});
