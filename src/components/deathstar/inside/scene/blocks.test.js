// Who is faded so you can see past them (people.js's blocks): someone between
// the camera and you, or (people.js's caller) a friend just ahead of you.
import { describe, expect, it } from 'vitest';
import { blocks } from './people';

describe('who hides you from the camera', () => {
  const cam = { x: 0, y: 1.6, z: 3 };
  const you = { x: 0, y: 1.3, z: 0 };
  it('is someone standing on the line from the camera to you, short of you', () => {
    expect(blocks({ x: 0, y: 0, z: 1.5 }, 1.8, cam, you)).toBe(true);
    expect(blocks({ x: 0.3, y: 0, z: 1.5 }, 1.8, cam, you)).toBe(true);
  });
  it('is nobody beside the line, beyond you, or on another floor', () => {
    expect(blocks({ x: 1.2, y: 0, z: 1.5 }, 1.8, cam, you)).toBe(false);
    expect(blocks({ x: 0, y: 0, z: -1 }, 1.8, cam, you)).toBe(false);
    expect(blocks({ x: 0, y: -4, z: 1.5 }, 1.8, cam, you)).toBe(false);
    expect(blocks({ x: 0, y: 0, z: 1.5 }, 1.8, null, you)).toBe(false);
  });
  it('is someone the camera has backed into', () => {
    expect(blocks({ x: 0.1, y: 0, z: 3.1 }, 1.8, cam, you)).toBe(true);
  });
});

describe('a scene’s say over how someone is drawn', () => {
  it('holds for someone whose figure isn’t made yet, from the moment it is', async () => {
    const THREE = await import('three');
    const { createPeople } = await import('./people');
    const scene = new THREE.Scene();
    const people = createPeople(scene, { mat: () => new THREE.MeshStandardMaterial() }, { tier: 'high' });
    const ito = { id: 'ito', kind: 'ito', x: 2, y: 0, z: 0, yaw: 0, room: 'r', hp: 20, mode: 'routine', anim: 'idle', aim: null };
    people.stage('ito', { hidden: true, yaw: 1 });
    people.sync({ people: [ito] }, 1, { x: 0, y: 1.6, z: 0 }, { dt: 1 / 30 });
    people.sync({ people: [ito] }, 1, { x: 0, y: 1.6, z: 0 }, { dt: 1 / 30 });
    const fig = people.figure('ito');
    expect(fig.object.visible).toBe(false);
    expect(fig.object.rotation.y).toBeCloseTo(-1);
    people.stage('ito', null);
    people.sync({ people: [ito] }, 1, { x: 0, y: 1.6, z: 0 }, { dt: 1 / 30 });
    expect(fig.object.visible).toBe(true);
    people.dispose();
  });
});
