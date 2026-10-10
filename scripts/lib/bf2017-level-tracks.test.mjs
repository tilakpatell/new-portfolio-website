import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createTracks, evalTrack } from '../../src/lib/three/animTracks.js';
import { tracksJson } from './bf2017-level-tracks.mjs';

const fixture = (name) => JSON.parse(readFileSync(new URL(`../fixtures/bf2017/web/animtracks/${name}.json`, import.meta.url), 'utf8'));
const MESH = 'models/a3/objects/props/objectsets/_generic/asteroid_large_01/asteroid_large_01_mesh.glb';

describe('the game’s curve tracks', () => {
  const [spin] = tracksJson([fixture('asteroid_large_01')], { meshes: [{ name: MESH }] }).tracks.filter((t) => t.channel === 'rotation.z');

  it('evaluates the asteroid’s spin: 0 at 0, 360 at 30, half-way between', () => {
    expect(evalTrack(spin.keys, 0)).toBeCloseTo(0, 4);
    expect(evalTrack(spin.keys, 30.0000019)).toBeCloseTo(360, 3);
    expect(evalTrack(spin.keys, 15)).toBeCloseTo(180, 1);
  });

  it('loops a turning track and holds a moving one past its last key', () => {
    expect(evalTrack(spin.keys, 45, { loop: true })).toBeCloseTo(180, 1);
    expect(evalTrack(spin.keys, 45)).toBeCloseTo(360, 3);
    expect(evalTrack([[0, 5, 1, 0, 1, 0]], 9)).toBe(5);
    expect(evalTrack([], 3)).toBe(0);
  });

  it('splits a track’s keys into its channels where time starts again', () => {
    const out = tracksJson([fixture('asteroid_large_01')], { meshes: [{ name: MESH }] });
    expect(out.tracks.map((t) => t.channel)).toEqual(['position.x', 'position.y', 'position.z', 'rotation.x', 'rotation.y', 'rotation.z']);
    expect(out.tracks.every((t) => t.mesh === 0 && t.owner === 'a3/objects/props/objectsets/_generic/asteroid_large_01')).toBe(true);
    expect(out.tracks.find((t) => t.channel === 'rotation.x').keys[0][1]).toBe(45);
    // (a one-curve rotate track turns about y)
    const one = tracksJson([fixture('geejaw_01_rotate')], { meshes: [{ name: 'models/objects/livingworld/geejaw_01/geejaw_01_mesh.glb' }] });
    expect(one.tracks).toHaveLength(1);
    expect(one.tracks[0]).toMatchObject({ channel: 'rotation.y', loop: true });
  });

  it('lists a track whose owner the pack does not hold, and writes nothing for it', () => {
    const out = tracksJson([fixture('naboo_01_movement'), fixture('geejaw_01_rotate')], { meshes: [{ name: MESH }] });
    expect(out.tracks).toEqual([]);
    expect(out.unplaced).toEqual(['levels/mp/naboo_01', 'objects/livingworld/geejaw_01']);
  });

  it('drives a node by its channel, and a track with no node does nothing and says so once', () => {
    const node = { position: { x: 1, y: 2, z: 3 }, rotation: { x: 0, y: 0, z: 0 } };
    const warn = vi.fn();
    const list = tracksJson([fixture('asteroid_large_01')], { meshes: [{ name: MESH }] }).tracks;
    const tracks = createTracks([...list, { owner: 'gone', mesh: 7, channel: 'rotation.y', keys: [[0, 0, 1, 0, 1, 0]] }], { nodeOf: (t) => (t.mesh === 0 ? node : null), warn });
    tracks.update(15);
    expect(node.rotation.z).toBeCloseTo(Math.PI, 2);
    expect(node.rotation.x).toBeCloseTo(Math.PI / 4, 4);
    expect(node.position).toEqual({ x: 1, y: 2, z: 3 });
    tracks.update(16);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/gone/);
    tracks.dispose();
    expect(node.rotation.z).toBe(0);
  });
});
