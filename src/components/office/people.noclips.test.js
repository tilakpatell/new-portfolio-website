// ./people.js when the clips it borrows don't come (a file of its own: the
// clip library keeps a file it's fetched for the page's life, so it has to
// be asked first here)
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { meshyRig } from '../../lib/three/meshyRig.fixture';
import { loadPeople } from './people';

const figure = () => {
  const r = meshyRig();
  const bones = Object.values(r.bones);
  const geo = new THREE.BoxGeometry(0.4, 1.8, 0.3).translate(0, 0.9, 0);
  const n = geo.attributes.position.count;
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(n * 4).fill(0), 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Array(n * 4).fill(0).map((_, i) => (i % 4 ? 0 : 1)), 4));
  const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshStandardMaterial());
  r.model.add(mesh);
  r.model.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));
  return r.model;
};
const SPEC = { id: 'lost', model: '/models/office/cast/lost.glb', height: 1.8 };

describe('people whose clips don’t come', () => {
  it('stand as before', async () => {
    const none = { loadAsync: async (url) => (url.includes('/models/') ? { scene: figure(), animations: [] } : Promise.reject(new Error('404'))) };
    const cast = await loadPeople([SPEC], null, { clips: true, loader: none });
    expect(cast.clips).toBe(false);
    const p = cast.person(SPEC, { pose: 'stand', anim: true, idle: true });
    expect(p.anim).toBeNull();
    p.walk(true);
    expect(() => {
      for (let i = 0; i < 20; i++) p.update(i / 60, 1 / 60);
    }).not.toThrow();
    expect(p.bob()).toBeGreaterThan(0);
    cast.dispose();
  });
});
