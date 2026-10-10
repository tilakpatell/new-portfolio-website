import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FADE, createProbes, probeFor } from './probes';

const hall = { min: [0, 0, 0], max: [40, 10, 40] };
const room = { min: [10, 0, 10], max: [18, 4, 18] };

describe('probeFor', () => {
  it('the smallest volume holding the point, and how far in', () => {
    expect(probeFor([hall, room], [14, 2, 14])).toEqual({ i: 1, blend: 0.5 }); // (2 m under the ceiling)
    expect(probeFor([hall, room], [30, 2, 30]).i).toBe(0);
    expect(probeFor([hall, room], [11, 2, 14]).blend).toBeCloseTo(0.25);
    expect(probeFor([hall, room], [50, 2, 50])).toEqual({ i: -1, blend: 0 });
    expect(probeFor([], [0, 0, 0]).i).toBe(-1);
  });
});

const cube = (name) => Object.assign(new THREE.CubeTexture(), { name });
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('createProbes', () => {
  it('starts on the fallback, crossfades into a volume’s cube over FADE and swaps in place', async () => {
    const scene = { environment: cube('sky'), environmentNode: null };
    const loaded = [];
    const probes = await createProbes(scene, [hall, room], async (v, i) => {
      loaded.push(i);
      return cube(`probe${i}`);
    });
    const node = scene.environmentNode;
    expect(node).not.toBe(null);
    probes.update([14, 2, 14], 0);
    await flush();
    expect(loaded).toEqual([1]);
    expect(probes.current).toBe(1);
    probes.update([14, 2, 14], FADE / 2);
    expect(probes.fade).toBeCloseTo(0.5);
    probes.update([14, 2, 14], FADE);
    expect(probes.fade).toBe(0);
    // (the same node throughout: nothing recompiles)
    expect(scene.environmentNode).toBe(node);
    // back out to the hall, then back in: the room's cube is not loaded twice
    probes.update([30, 2, 30], 0);
    await flush();
    probes.update([14, 2, 14], 0);
    await flush();
    expect(loaded).toEqual([1, 0]);
    await probes.dispose();
    expect(scene.environmentNode).toBe(null);
  });
  it('a quick crossing shows only the last volume asked for', async () => {
    const scene = { environment: null };
    let release;
    const slow = new Promise((r) => (release = r));
    const probes = await createProbes(scene, [hall, room], (v, i) => (i === 0 ? slow : Promise.resolve(cube('room'))));
    probes.update([30, 2, 30], 0);
    probes.update([14, 2, 14], 0);
    await flush();
    release(cube('hall'));
    await flush();
    expect(probes.current).toBe(1);
  });
});

