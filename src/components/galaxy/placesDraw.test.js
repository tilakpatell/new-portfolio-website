import { describe, expect, it } from 'vitest';
import { createPlaces } from './placesDraw';
import { placesOf } from './places';
import { systemById } from './systems';

describe('createPlaces', () => {
  it('draws every place in a system in two draws: one mesh of the solid ones, one cloud of the glows', () => {
    const places = placesOf(systemById('tatooine'));
    const p = createPlaces({ places, sun: [0.5, 0.3, 0.8] });
    expect(p.group.children).toHaveLength(2);
    const [mesh, points] = p.group.children;
    expect(mesh.isMesh).toBe(true);
    expect(points.isPoints).toBe(true);
    expect(mesh.geometry.attributes.position.count).toBeGreaterThan(100);
    expect(mesh.geometry.attributes.color.count).toBe(mesh.geometry.attributes.position.count);
    expect(points.geometry.attributes.position.count).toBeGreaterThan(places.length);
    p.update(1.5, 1 / 60);
    expect(points.material.uniforms.uTime.value).toBe(1.5);
    p.dispose();
    expect(p.group.children).toHaveLength(0);
  });
  it('draws fewer glows on a small tier, and the same solids', () => {
    const places = placesOf(systemById('hoth'));
    const big = createPlaces({ places, sun: [0, 1, 0] });
    const small = createPlaces({ places, sun: [0, 1, 0], small: true });
    expect(small.group.children[1].geometry.attributes.position.count).toBeLessThan(big.group.children[1].geometry.attributes.position.count);
    expect(small.group.children[0].geometry.attributes.position.count).toBe(big.group.children[0].geometry.attributes.position.count);
    big.dispose();
    small.dispose();
  });
  it('draws nothing solid for a system with only a nebula, but still its glow', () => {
    const p = createPlaces({ places: [{ id: 'place-nebula', kind: 'nebula', at: [900, 0, 0], r: 0, reach: 40 }], sun: [0, 1, 0] });
    expect(p.group.children).toHaveLength(2);
    expect(p.group.children[0].geometry.attributes.position.count).toBe(0);
    expect(p.group.children[1].geometry.attributes.position.count).toBeGreaterThan(50);
    p.dispose();
  });
});
