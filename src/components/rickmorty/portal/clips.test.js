import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { RICK_HIPS, borrowClips, faceAhead, faceForward, heading, retarget } from './clips';

const Y = new THREE.Vector3(0, 1, 0);
// a clip whose hips turn about y by `a` (radians), and a few other tracks a Meshy clip has
const clip = (a, name = 'idle') => {
  const q = new THREE.Quaternion().setFromAxisAngle(Y, a);
  return new THREE.AnimationClip(name, 1, [
    new THREE.QuaternionKeyframeTrack('Hips.quaternion', [0, 1], [...q.toArray(), ...q.toArray()]),
    new THREE.VectorKeyframeTrack('Hips.position', [0, 1], [0, 90, 1, 2, 88, 3]),
    new THREE.QuaternionKeyframeTrack('Spine.quaternion', [0], [0, 0, 0, 1]),
    new THREE.VectorKeyframeTrack('Spine.position', [0], [0, 10, 0]),
    new THREE.VectorKeyframeTrack('Hips.scale', [0], [1, 1, 1]),
  ]);
};

describe('borrowing Rick’s clips', () => {
  it('keeps the bones’ turns and scales only the hips’ height to the figure’s', () => {
    const c = clip(0.3);
    const r = retarget(c, RICK_HIPS * 2);
    expect(r.tracks.map((t) => t.name)).toEqual(['Hips.quaternion', 'Hips.position', 'Spine.quaternion']);
    expect([...r.tracks[1].values]).toEqual([0, 180, 2, 4, 176, 6]);
    expect([...c.tracks[1].values]).toEqual([0, 90, 1, 2, 88, 3]); // (Rick’s own left as it was: it’s shared)
    expect(r.duration).toBe(1);
    expect(retarget(null, 90)).toBeNull();
  });

  it('scales from the hips the clip was made on, where it says', () => {
    const r = retarget(clip(0), 100, 50);
    expect(r.tracks[1].values[1]).toBe(180);
  });

  it('turns a clip’s hips so it faces where the walk does', () => {
    const idle = clip(0.9);
    expect(heading(idle, Y)).toBeCloseTo(0.9, 5);
    faceForward(idle, Y, -0.2);
    expect(heading(idle, Y)).toBeCloseTo(-0.2, 5);
    const clips = { idle: clip(1.1), walk: clip(0.25, 'walk'), run: clip(-0.4, 'run'), sit: null };
    faceAhead(clips, Y);
    for (const n of ['idle', 'walk', 'run']) expect(heading(clips[n], Y), n).toBeCloseTo(0.25, 5);
    expect(heading(new THREE.AnimationClip('x', 1, []), Y)).toBeNull();
  });

  it('fetches each of Rick’s clips once, whoever borrows it, noting the hips it was made on', async () => {
    const hips = new THREE.Bone();
    hips.name = 'Hips';
    hips.position.y = 93.3;
    const scene = new THREE.Group();
    scene.add(hips);
    const loader = { loadAsync: vi.fn(async (url) => ({ scene, animations: [clip(0, url)] })) };
    const a = await borrowClips(['jump', 'crawl'], { loader });
    const b = await borrowClips(['crawl'], { loader });
    expect(loader.loadAsync.mock.calls.map(([u]) => u)).toEqual(['/games/meshy/rick-jump.glb', '/games/meshy/rick-crawl.glb']);
    expect(b.crawl).toBe(a.crawl);
    expect(a.jump.userData.hips).toBe(93.3);
    const none = { loadAsync: vi.fn(async () => Promise.reject(new Error('404'))) };
    expect((await borrowClips(['swim'], { loader: none })).swim).toBeNull();
  });
});
