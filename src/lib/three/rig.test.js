import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { POSES, figure } from './rig';

// A figure as a loader gives one: a skinned box on a little humanoid
// skeleton named as Meshy names its bones, with `clips` if any.
function template(clips = []) {
  const bone = (name, x, y, parent) => {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(x, y, 0);
    parent?.add(b);
    return b;
  };
  const hips = bone('Hips', 0, 1);
  const spine = bone('Spine', 0, 0.2, hips);
  const head = bone('Head', 0, 0.5, spine);
  const armL = bone('LeftArm', 0.2, 0.4, spine);
  const foreL = bone('LeftForeArm', 0.3, 0, armL);
  bone('LeftHand', 0.25, 0, foreL);
  const armR = bone('RightArm', -0.2, 0.4, spine);
  const foreR = bone('RightForeArm', -0.3, 0, armR);
  bone('RightHand', -0.25, 0, foreR);
  for (const [s, x] of [['Left', 0.1], ['Right', -0.1]]) {
    const thigh = bone(`${s}UpLeg`, x, -0.1, hips);
    const calf = bone(`${s}Leg`, 0, -0.45, thigh);
    bone(`${s}Foot`, 0, -0.45, calf);
  }
  const bones = [];
  hips.traverse((o) => o.isBone && bones.push(o));
  const geometry = new THREE.BoxGeometry(0.5, 1.8, 0.3).translate(0, 0.9, 0);
  const n = geometry.attributes.position.count;
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(n * 4).fill(0), 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(Array.from({ length: n * 4 }, (_, i) => (i % 4 === 0 ? 1 : 0)), 4));
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial());
  const scene = new THREE.Group();
  scene.add(hips, mesh);
  mesh.bind(new THREE.Skeleton(bones));
  void head;
  return { scene, clips };
}

// a clip that swings the left arm a quarter-turn about z over a second
const swing = new THREE.AnimationClip('wave', 1, [new THREE.QuaternionKeyframeTrack('LeftArm.quaternion', [0, 1], [0, 0, 0, 1, ...new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2).toArray()])]);

describe('a figure’s clips', () => {
  it('plays one by name and moves its bones with time', () => {
    const f = figure(template([swing]));
    expect(f.clips).toEqual(['wave']);
    const rest = f.bones.armL.quaternion.clone();
    expect(f.act('wave', { fade: 0 })).toBe(true);
    expect(f.acting).toBe('wave');
    f.tick(0.5);
    expect(f.bones.armL.quaternion.angleTo(rest)).toBeGreaterThan(0.3);
  });

  it('says it has none by a name it lacks, so the caller poses it instead', () => {
    const f = figure(template([swing]));
    expect(f.act('fly')).toBe(false);
    expect(f.acting).toBe(null);
  });

  it('stops playing when it is posed', () => {
    const f = figure(template([swing]));
    f.act('wave', { fade: 0 });
    f.tick(0.5);
    f.pose(POSES.stand, 1, Infinity);
    expect(f.acting).toBe(null);
  });

  it('starts where it is asked to in a clip', () => {
    const a = figure(template([swing]));
    const b = figure(template([swing]));
    a.act('wave', { fade: 0 });
    b.act('wave', { fade: 0, at: 0.5 });
    a.tick(0);
    b.tick(0);
    expect(b.bones.armL.quaternion.angleTo(a.bones.armL.quaternion)).toBeGreaterThan(0.3);
  });

  it('has no clips when its file has none', () => {
    const f = figure(template());
    expect(f.clips).toEqual([]);
    expect(f.act('idle')).toBe(false);
    f.tick(1); // (harmless)
  });
});
