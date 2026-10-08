import * as THREE from 'three';
import { it, vi } from 'vitest';
import { createPeople } from './people';
it('dbg', async () => {
  const errs = [];
  vi.spyOn(console, 'error').mockImplementation((...a) => errs.push(a.map(String).join(' ')));
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const scene = new THREE.Scene();
  const people = createPeople(scene, { mat: () => new THREE.MeshStandardMaterial() }, { tier: 'high' });
  const crew = { people: [{ id: 'a', kind: 'dstrooper', x: 1, y: 0, z: -4, yaw: 0, room: 'r', mode: 'routine', anim: 'idle' }] };
  for (let i = 0; i < 40; i++) {
    people.sync(crew, 1, { x: 0, y: 1.6, z: 0 }, { dt: 1 / 30 });
    await new Promise((r) => setTimeout(r, 50));
  }
  const names = [];
  scene.traverse((o) => names.push(o.name));
  process.stdout.write(JSON.stringify(['ERRS', errs, 'NAMES', names.filter(Boolean)]) + '\n');
});
