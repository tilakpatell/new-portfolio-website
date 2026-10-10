import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { bake, createLifeLayer, modelGeometry, withLife } from './lifeScene';
import { planetSpecOf } from '../../../lib/land/flight/planetSpec';

const flat = { heightAt: () => 0, biomeAt: () => 0 };

describe('lifeScene', () => {
  it('bakes a model to one geometry, its colours in the vertices', () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#ff0000' })));
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 6, 4), new THREE.MeshStandardMaterial({ color: '#0000ff' }));
    m.position.x = 3;
    g.add(m);
    const geo = bake(g);
    expect(geo.attributes.color.count).toBe(geo.attributes.position.count);
    geo.computeBoundingBox();
    expect(geo.boundingBox.max.x).toBeCloseTo(4);
    const c = geo.attributes.color.array;
    expect([c[0], c[1], c[2]]).toEqual([1, 0, 0]);
  });

  it('builds a figure, a stand-in and a ship at their sizes', () => {
    const tall = (g) => (g.computeBoundingBox(), g.boundingBox.getSize(new THREE.Vector3()));
    expect(tall(modelGeometry('tauntaun')).y).toBeGreaterThan(2.5);
    expect(tall(modelGeometry('figure', { body: 'beast', tint: '#5a4232' })).y).toBeGreaterThan(1.5);
    const ship = tall(modelGeometry('wedge', { name: 'seeker', tint: '#7a6aa8' }, true));
    expect(Math.max(ship.x, ship.y, ship.z)).toBeCloseTo(12, 0);
    // (a ship kind whose builder can't run here stands in as a craft of a fighter's size)
    const tie = tall(modelGeometry('tie', {}, true));
    expect(Math.max(tie.x, tie.y, tie.z)).toBeGreaterThan(5);
  });

  it('makes nothing for a dead world: no draw, no brain', () => {
    const scene = new THREE.Scene();
    const dead = createLifeLayer(scene, { spec: planetSpecOf('e:1,0:4:3'), field: flat });
    dead.step({ x: 0, y: 300, z: 0, yaw: 0, pitch: 0, roll: 0 }, [0, 0, 0], 1 / 30);
    expect(dead.stats().dead).toBe(true);
    expect(scene.children).toHaveLength(0);
  });

  it('draws a planet’s life as one draw a model, and frees it all', () => {
    const scene = new THREE.Scene();
    const spec = planetSpecOf('hoth');
    const layer = createLifeLayer(scene, { spec, field: flat, tier: 'mid' });
    const ship = { x: 1200, y: 300, z: -800 + 3400, yaw: 0, pitch: 0, roll: 0 };
    for (let i = 0; i < 40; i++) layer.step(ship, [0, 0, 0], 1 / 30);
    const root = scene.getObjectByName('flight-life');
    const meshes = root.children.filter((o) => o.isInstancedMesh && o.count > 0);
    expect(meshes.length).toBeGreaterThan(1);
    const s = layer.stats();
    expect(s.actors).toBeGreaterThan(0);
    expect(root.children.length).toBeLessThanOrEqual(s.draws + 1);
    layer.dispose();
    expect(scene.getObjectByName('flight-life')).toBeUndefined();
  });

  it('rides on the view: its place steps the life, its dispose frees it', () => {
    const scene = new THREE.Scene();
    let placed = 0;
    let freed = 0;
    const view = withLife(planetSpecOf('dagobah'), { scene, place: () => placed++, dispose: () => freed++ });
    view.place({ x: 0, y: 200, z: 0, yaw: 0, pitch: 0, roll: 0 }, [0, 0, 0], 1 / 30);
    expect(placed).toBe(1);
    expect(view.life.stats().cells).toBe(1);
    view.dispose();
    expect(freed).toBe(1);
  });
});
