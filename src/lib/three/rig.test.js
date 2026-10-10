import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { POSES, figure } from './rig';
import { meshyRig, swingClip } from './meshyRig.fixture';

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
  const scene = new THREE.Group();
  scene.add(hips, skin(bones));
  void head;
  return { scene, clips };
}

// a box 1.8 high, all on the first bone, bound to `bones`
function skin(bones) {
  const geometry = new THREE.BoxGeometry(0.5, 1.8, 0.3).translate(0, 0.9, 0);
  const n = geometry.attributes.position.count;
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(n * 4).fill(0), 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(Array.from({ length: n * 4 }, (_, i) => (i % 4 === 0 ? 1 : 0)), 4));
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial());
  mesh.bind(new THREE.Skeleton(bones));
  return mesh;
}

// The whole Meshy skeleton, toes and all (so locomotion measures its
// strides), with its idle, walk and run, and `more` clips made on it.
function meshyTemplate(more = () => ({})) {
  const rig = meshyRig();
  rig.model.add(skin(Object.values(rig.bones)));
  return { scene: rig.model, clips: [...Object.values(rig.clips), ...Object.values(more(rig))] };
}

// a clip that swings the left arm a quarter-turn about z over a second
const swing = new THREE.AnimationClip('wave', 1, [new THREE.QuaternionKeyframeTrack('LeftArm.quaternion', [0, 1], [0, 0, 0, 1, ...new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2).toArray()])]);

const DT = 1 / 60;
const frames = (f, secs, each = null) => {
  for (let i = 0, n = Math.round(secs / DT); i < n; i++) {
    each?.(i);
    f.tick(DT);
  }
};
// where a limb points, in the world
const pointing = (f, a, b) => f.bones[b].getWorldPosition(new THREE.Vector3()).sub(f.bones[a].getWorldPosition(new THREE.Vector3())).normalize();
// how far round a clip is, past where its left foot comes down (0…1)
const strideAt = (f, name) => {
  const a = f.anim.actions[name];
  const s = f.anim.loco.strides[name];
  return (((a.time / a.getClip().duration - s.plant) % 1) + 1) % 1;
};
const apart = (a, b) => Math.min(Math.abs(a - b), 1 - Math.abs(a - b));

describe('a figure’s clips', () => {
  it('plays one by name and moves its bones with time', () => {
    const f = figure(template([swing]));
    expect(f.clips).toEqual(['wave']);
    const rest = f.bones.armL.quaternion.clone();
    expect(f.act('wave', { fade: 0 })).toBe(true);
    expect(f.acting).toBe('wave');
    frames(f, 0.5);
    expect(f.bones.armL.quaternion.angleTo(rest)).toBeGreaterThan(0.3);
  });

  it('says it has none by a name it lacks, so the caller poses it instead', () => {
    const f = figure(template([swing]));
    expect(f.act('fly')).toBe(false);
    expect(f.acting).toBe(null);
  });

  it('starts where it is asked to in a clip', () => {
    const a = figure(template([swing]));
    const b = figure(template([swing]));
    a.act('wave', { fade: 0 });
    b.act('wave', { fade: 0, at: 0.5 });
    a.tick(DT);
    b.tick(DT);
    expect(b.bones.armL.quaternion.angleTo(a.bones.armL.quaternion)).toBeGreaterThan(0.3);
  });

  it('has no clips when its file has none', () => {
    const f = figure(template());
    expect(f.clips).toEqual([]);
    expect(f.act('idle')).toBe(false);
    f.tick(1); // (harmless)
    expect(f.anim).toBe(null);
  });

  it('makes no animator for a figure that is only ever posed, which poses as it always did', () => {
    const posed = figure(template([swing]));
    const bare = figure(template());
    for (const f of [posed, bare]) f.pose({ armL: [0, 1, 0] }, 1, Infinity);
    expect(posed.anim).toBe(null);
    expect(pointing(posed, 'armL', 'foreL').y).toBeCloseTo(1, 4);
    expect(posed.bones.armL.quaternion.angleTo(bare.bones.armL.quaternion)).toBeLessThan(1e-6);
  });
});

describe('walking and running on locomotion', () => {
  it('goes from the walk to the run in step, never from the run’s first frame', () => {
    const f = figure(meshyTemplate(), { seed: 3 });
    f.act('walk');
    frames(f, 0.83);
    f.act('run');
    f.tick(DT);
    expect(f.acting).toBe('run');
    expect(apart(strideAt(f, 'run'), strideAt(f, 'walk'))).toBeLessThan(0.02);
    expect(f.anim.actions.run.time).toBeGreaterThan(0.05);
  });

  it('crossfades the walk into the run rather than swapping them', () => {
    const f = figure(meshyTemplate(), { seed: 3 });
    f.act('walk');
    frames(f, 1);
    f.act('run', { fade: 0.3 });
    f.tick(DT);
    expect(f.anim.actions.walk.getEffectiveWeight()).toBeGreaterThan(0.5);
    frames(f, 0.5, () => f.act('run', { fade: 0.3 }));
    expect(f.anim.actions.run.getEffectiveWeight()).toBeCloseTo(1, 3);
    expect(f.anim.actions.walk.getEffectiveWeight()).toBeCloseTo(0, 3);
  });

  it('paces the feet to the ground it covers', () => {
    const one = figure(meshyTemplate(), { seed: 3 });
    const two = figure(meshyTemplate(), { seed: 3 });
    const pace = () => one.anim?.loco.strides.walk.speed ?? 1;
    one.act('walk');
    two.act('walk');
    frames(one, 0.5, () => one.act('walk', { ground: pace() }));
    frames(two, 0.5, () => two.act('walk', { ground: 2 * pace() }));
    const a = strideAt(one, 'walk');
    const b = strideAt(two, 'walk');
    frames(one, 0.25, () => one.act('walk', { ground: pace() }));
    frames(two, 0.25, () => two.act('walk', { ground: 2 * pace() }));
    const da = (strideAt(one, 'walk') - a + 1) % 1;
    const db = (strideAt(two, 'walk') - b + 1) % 1;
    expect(db / da).toBeCloseTo(2, 1);
  });

  it('goes back to the idle from a whole-body clip with a fade', () => {
    const f = figure(meshyTemplate((rig) => ({ hover: swingClip(rig, 'hover', 2, (n) => (n === 'LeftUpLeg' ? -0.8 : 0)) })), { seed: 3 });
    f.act('hover', { fade: 0.2 });
    frames(f, 0.5, () => f.act('hover', { fade: 0.2 }));
    expect(f.acting).toBe('hover');
    f.act('idle', { fade: 0.4 });
    f.tick(DT);
    expect(f.anim.actions.hover.getEffectiveWeight()).toBeGreaterThan(0.8);
    frames(f, 0.6, () => f.act('idle', { fade: 0.4 }));
    expect(f.acting).toBe('idle');
    expect(f.anim.actions.idle.getEffectiveWeight()).toBeCloseTo(1, 3);
  });

  it('lets a clip played over the whole body play out under the acts that come each frame', () => {
    const f = figure(meshyTemplate((rig) => ({ cheer: swingClip(rig, 'cheer', 1, (n) => (/Arm$/.test(n) ? -1.5 : 0)) })), { seed: 3 });
    f.act('idle');
    f.tick(DT);
    f.play('cheer');
    frames(f, 0.4, () => f.act('idle'));
    expect(f.acting).toBe('cheer');
    frames(f, 1, () => f.act('idle'));
    expect(f.acting).toBe('idle');
  });
});

describe('a pose over the clips', () => {
  it('eases in over the clip, which keeps playing, and back out once it is not asked for', () => {
    const f = figure(meshyTemplate(), { seed: 3 });
    f.act('walk');
    frames(f, 0.5, () => f.act('walk'));
    const under = pointing(f, 'armL', 'foreL');
    const up = new THREE.Vector3(0, 1, 0);
    // a frame in: some of the way, not all
    f.act('walk');
    f.pose({ armL: [0, 1, 0] }, DT, 12);
    f.tick(DT);
    const first = pointing(f, 'armL', 'foreL');
    expect(first.angleTo(up)).toBeLessThan(under.angleTo(up) - 0.02);
    expect(first.angleTo(up)).toBeGreaterThan(0.2);
    // a second on: there, while the legs walk on under it
    frames(f, 1, () => {
      f.act('walk');
      f.pose({ armL: [0, 1, 0] }, DT, 12);
    });
    expect(pointing(f, 'armL', 'foreL').angleTo(up)).toBeLessThan(0.02);
    expect(f.acting).toBe('walk');
    const legs = [];
    frames(f, 0.3, () => {
      f.act('walk');
      f.pose({ armL: [0, 1, 0] }, DT, 12);
      legs.push(pointing(f, 'thighL', 'calfL').z);
    });
    expect(Math.max(...legs) - Math.min(...legs)).toBeGreaterThan(0.05);
    // let go: a frame on it's still mostly up, then the clip has it again
    f.act('walk', { fade: 0.3 });
    f.tick(DT);
    expect(pointing(f, 'armL', 'foreL').angleTo(up)).toBeLessThan(0.3);
    frames(f, 0.5, () => f.act('walk', { fade: 0.3 }));
    expect(pointing(f, 'armL', 'foreL').angleTo(up)).toBeGreaterThan(0.5);
  });

  it('lays only the limbs it names, so the rest keep their clip', () => {
    const f = figure(meshyTemplate(), { seed: 3 });
    const g = figure(meshyTemplate(), { seed: 3 });
    for (const x of [f, g]) x.act('walk');
    frames(f, 0.5, () => {
      f.act('walk');
      f.pose({ armL: [0, 1, 0] }, DT, Infinity);
    });
    frames(g, 0.5, () => g.act('walk'));
    expect(f.bones.thighR.quaternion.angleTo(g.bones.thighR.quaternion)).toBeLessThan(1e-4);
    expect(f.bones.armR.quaternion.angleTo(g.bones.armR.quaternion)).toBeLessThan(1e-4);
  });

  it('stands the legs under a whole pose asked for with no act', () => {
    const f = figure(meshyTemplate(), { seed: 3 });
    f.act('walk');
    frames(f, 0.5, () => f.act('walk'));
    frames(f, 1, () => f.pose(POSES.stand, DT, 12));
    expect(f.anim.actions.idle.getEffectiveWeight()).toBeCloseTo(1, 3);
    expect(f.acting).toBe('walk'); // (what it last acted; its legs are the idle's under the pose)
  });

  it('lies over a clip on the upper layer too, so an aimed arm wins over a wave', async () => {
    const f = figure(meshyTemplate((rig) => ({ wave: swingClip(rig, 'wave', 2, (n) => (n === 'RightArm' || n === 'LeftArm' ? -1.4 : 0)) })), { seed: 3 });
    f.act('walk');
    f.tick(DT);
    expect(await f.play('wave', { layer: 'upper', loop: true })).toBe(true);
    frames(f, 0.5, () => {
      f.act('walk');
      f.pose({ armL: [0, 0, 1] }, DT, Infinity);
    });
    expect(f.anim.playing('upper')).toBe('wave');
    expect(pointing(f, 'armL', 'foreL').z).toBeCloseTo(1, 3);
  });

  it('snaps straight to a pose over the clips', () => {
    const f = figure(meshyTemplate(), { seed: 3 });
    f.act('idle');
    f.tick(DT);
    f.snap({ armR: [0, 0, 1] });
    expect(pointing(f, 'armR', 'foreR').z).toBeCloseTo(1, 4);
    f.tick(DT);
    expect(pointing(f, 'armR', 'foreR').z).toBeCloseTo(1, 4);
  });
});

describe('looking', () => {
  const left = new THREE.Vector3(5, 1.6, 2); // (+x is its left)
  const headYaw = (f) => {
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(f.bones.head.getWorldQuaternion(new THREE.Quaternion()));
    return fwd;
  };

  it('turns the head of a figure that acts toward a point, and back', () => {
    const f = figure(meshyTemplate(), { seed: 3 });
    const g = figure(meshyTemplate(), { seed: 3 });
    for (const x of [f, g]) x.act('idle');
    f.look(left);
    frames(f, 1, () => f.act('idle'));
    frames(g, 1, () => g.act('idle'));
    const a = headYaw(f);
    const b = headYaw(g);
    expect(Math.atan2(a.x, a.z) - Math.atan2(b.x, b.z)).toBeGreaterThan(0.4);
    f.look(null);
    frames(f, 2, () => f.act('idle'));
    frames(g, 2, () => g.act('idle'));
    expect(f.bones.head.quaternion.angleTo(g.bones.head.quaternion)).toBeLessThan(0.02);
  });

  it('turns the head of a figure that is only posed, after its pose', () => {
    const f = figure(template());
    const g = figure(template());
    f.look(left);
    for (let i = 0; i < 90; i++) {
      f.pose(POSES.stand, DT, 12);
      g.pose(POSES.stand, DT, 12);
    }
    const a = headYaw(f);
    const b = headYaw(g);
    expect(Math.atan2(a.x, a.z) - Math.atan2(b.x, b.z)).toBeGreaterThan(0.4);
    expect(f.anim).toBe(null);
  });
});

describe('the library', () => {
  it('offers its clips only to a figure on Meshy’s skeleton', () => {
    expect(figure(meshyTemplate()).has('scared')).toBe(true);
    expect(figure(template([swing])).has('scared')).toBe(false);
    expect(figure(template([swing])).has('wave')).toBe(true);
  });
});

describe('findBones on a downloaded Mixamo rig', () => {
  it('finds the roles through the number a download appended (mixamorig:Hips_52)', async () => {
    const { findBones } = await import('./rig');
    const make = (name, parent) => {
      const b = new THREE.Bone();
      b.name = name;
      parent?.add(b);
      return b;
    };
    const hips = make('mixamorig:Hips_52');
    const s0 = make('mixamorig:Spine_38', hips);
    const s1 = make('mixamorig:Spine1_37', s0);
    const s2 = make('mixamorig:Spine2_35', s1);
    const neck = make('mixamorig:Neck_1', s2);
    const head = make('mixamorig:Head_0', neck);
    const thigh = make('mixamorig:LeftUpLeg_7', hips);
    const { bones, spine } = findBones(hips);
    expect(bones.hips).toBe(hips);
    expect(bones.head).toBe(head);
    expect(bones.thighL).toBe(thigh);
    expect(spine).toEqual([s0, s1, s2, neck]);
  });
});
