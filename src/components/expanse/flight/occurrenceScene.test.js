import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { withOccurrences } from './occurrenceScene';
import { makePlay } from './eventPlays';
import { EVENTS, eventsFor } from '../../../lib/land/flight/eventTables';
import { planetSpecOf } from '../../../lib/land/flight/planetSpec';
import { eventNow } from './eventNews';

const flat = { heightAt: () => 10, biomeAt: () => 0 };
const ship = { x: 1024, y: 300, z: 1024, pitch: 0, yaw: 0, roll: 0, speed: 200 };

// the view as scene.js hands it on: a scene with fog, a sky, its lights
function viewOf() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#c0c8d0', 1500, 21000);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(10), new THREE.ShaderMaterial({ uniforms: { uLow: { value: new THREE.Color('#aabbcc') }, uHigh: { value: new THREE.Color('#3366aa') } } }));
  scene.add(sky);
  const hemi = new THREE.HemisphereLight('#ffffff', '#444444', 1.7);
  const sun = new THREE.DirectionalLight('#ffffff', 2.2);
  scene.add(hemi, sun);
  const camera = new THREE.PerspectiveCamera();
  const view = { scene, camera, hemi, sun, sky, place: vi.fn(), dispose: vi.fn() };
  return view;
}

describe('the occurrences drawn', () => {
  it('builds, steps and frees every play there is', () => {
    const root = new THREE.Group();
    const ctx = { root, material: new THREE.MeshLambertMaterial(), camera: new THREE.PerspectiveCamera(), field: flat, spec: planetSpecOf('caribbean'), fire: vi.fn(), crater: vi.fn() };
    const kinds = new Set();
    for (const id of ['hoth', 'mustafar', 'geonosis', 'purge', 'caribbean', 'c-137', 'snakeplanet', 'naboo', 'pluto', 'cybertron', 'mandalore', 'endor', 'resort'])
      for (const row of eventsFor(planetSpecOf(id))) {
        kinds.add(row.play);
        const ev = { ...row, id: `1:${row.kind}:0,0`, at: [1000, 1000], t0: 0, seed: 42 };
        const play = makePlay(ev, ctx, ship);
        for (let age = 0; age < 6; age += 0.5) play.step(ship, [0, 0, 0], 0.5, age, 1);
        play.dispose();
      }
    // (every play the tables name is among them)
    for (const k of new Set(Object.values(EVENTS).map((e) => e.play))) expect(kinds, k).toContain(k);
    expect(root.children).toHaveLength(0);
  });

  it('closes the fog in for a blizzard and puts it back exactly when it ends or you leave', () => {
    const view = withOccurrences(planetSpecOf('hoth'), viewOf());
    const fog = view.scene.fog;
    const was = { near: fog.near, far: fog.far, color: fog.color.getHex(), hemi: view.hemi.intensity };
    view.place(ship, [0, 0, 0], 0.016);
    const ev = view.occurrences.force('blizzard');
    // (eased in over a few seconds)
    const now = Date.now;
    Date.now = () => (ev.t0 + 10) * 1000;
    view.place(ship, [0, 0, 0], 0.016);
    expect(fog.far).toBeLessThan(1000);
    expect(eventNow()?.kind).toBe('blizzard');
    // leaving mid-blizzard
    view.dispose();
    Date.now = now;
    expect({ near: fog.near, far: fog.far, color: fog.color.getHex(), hemi: view.hemi.intensity }).toEqual(was);
    expect(eventNow()).toBe(null);
    expect(view.scene.getObjectByName('flight-occurrences')).toBeUndefined();
  });

  it('draws the cells’ occurrences round the ship', () => {
    const view = withOccurrences(planetSpecOf('tatooine'), viewOf());
    view.place(ship, [0, 0, 0], 0.016);
    const root = view.scene.getObjectByName('flight-occurrences');
    const drawn = root.children.filter((o) => o.isInstancedMesh).reduce((n, m) => n + m.count, 0);
    expect(drawn).toBe(view.occurrences.placed().length);
    expect(drawn).toBeGreaterThan(0);
    view.dispose();
  });
});
