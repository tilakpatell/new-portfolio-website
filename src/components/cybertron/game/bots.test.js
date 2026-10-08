import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { riggedFigure } from './bots';

// A robot as a loader gives one: a skinned box on a humanoid skeleton named
// as Meshy and Mixamo name theirs (rig.js reads High Moon's the same way),
// its arms hanging, legs straight; with an idle clip when asked.
function template({ idle = false } = {}) {
  const bone = (name, x, y, parent, z = 0) => {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(x, y, z);
    parent?.add(b);
    return b;
  };
  const hips = bone('Hips', 0, 1);
  const spine = bone('Spine', 0, 0.2, hips);
  const neck = bone('Neck', 0, 0.35, spine);
  bone('HeadTop_End', 0, 0.2, bone('Head', 0, 0.1, neck));
  for (const [s, x] of [
    ['Left', 1],
    ['Right', -1],
  ]) {
    const arm = bone(`${s}Arm`, 0.2 * x, 0.3, spine);
    const fore = bone(`${s}ForeArm`, 0, -0.3, arm);
    bone(`${s}Hand`, 0, -0.25, fore);
    const thigh = bone(`${s}UpLeg`, 0.1 * x, -0.05, hips);
    const calf = bone(`${s}Leg`, 0, -0.45, thigh);
    const foot = bone(`${s}Foot`, 0, -0.42, calf);
    bone(`${s}ToeBase`, 0, -0.05, foot, 0.12);
  }
  const bones = [];
  hips.traverse((o) => o.isBone && bones.push(o));
  const geometry = new THREE.BoxGeometry(0.5, 1.75, 0.3).translate(0, 0.875, 0);
  const n = geometry.attributes.position.count;
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(n * 4).fill(0), 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(Array.from({ length: n * 4 }, (_, i) => (i % 4 === 0 ? 1 : 0)), 4));
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial());
  hips.updateMatrixWorld(true); // (bound where the bones stand)
  mesh.bind(new THREE.Skeleton(bones));
  const scene = new THREE.Group();
  scene.add(hips, mesh);
  const animations = [];
  if (idle) {
    // the chest rising and falling, the arms swaying
    const times = [0, 1, 2];
    const q = (a) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), a).toArray();
    animations.push(
      new THREE.AnimationClip('Scene', 2, [
        new THREE.QuaternionKeyframeTrack('Spine.quaternion', times, [...q(0), ...q(0.05), ...q(0)]),
        new THREE.QuaternionKeyframeTrack('LeftArm.quaternion', times, [...q(0.1), ...q(-0.1), ...q(0.1)]),
      ]),
    );
  }
  return { scene, animations };
}

const spec = (more = {}) => ({ metres: 7, role: 'enemy', ...more });
const make = (more = {}, opts = {}) => {
  const t = template(opts);
  const f = riggedFigure('trooper', spec(more), t.scene, t.animations, { seed: opts.seed ?? 1 });
  const root = new THREE.Group();
  root.add(f.group);
  return { f, root };
};
const world = (o) => {
  o.updateWorldMatrix(true, false);
  return o.getWorldPosition(new THREE.Vector3());
};
const ankles = (f) => [f.fig.bones.footL, f.fig.bones.footR].map(world);

describe('a robot on its feet', () => {
  it('stands on the floor, and keeps the foot that’s down on it as it walks', () => {
    const { f } = make();
    f.update(1 / 60);
    const stand = Math.min(...ankles(f).map((p) => p.y));
    expect(stand).toBeGreaterThan(-0.05);
    let worst = 0;
    let lowestHips = Infinity;
    for (let i = 0; i < 240; i++) {
      f.play('walk', { speed: 5 });
      f.group.position.z += 5 / 60;
      f.update(1 / 60);
      if (i > 60) {
        worst = Math.max(worst, Math.abs(Math.min(...ankles(f).map((p) => p.y)) - stand));
        lowestHips = Math.min(lowestHips, f.fig.holder.position.y);
      }
    }
    // (the planted foot stays down to a few centimetres, and the hips come
    // down as the legs open: the weight in each step)
    expect(worst).toBeLessThan(0.06);
    expect(lowestHips).toBeLessThan(f.fig.hipHeight - 0.02);
  });

  it('turns its legs to a strafe and keeps its chest and gun ahead', () => {
    const { f } = make();
    for (let i = 0; i < 90; i++) {
      f.play('walk', { speed: 0, side: 4, aim: [0, 0, 1] });
      f.update(1 / 60);
    }
    expect(f.fig.body.rotation.y).toBeLessThan(-1);
    // the gun hand out ahead of the figure, not off to the side it walks
    f.group.updateMatrixWorld(true);
    const hand = world(f.fig.bones.handR);
    const shoulder = world(f.fig.bones.armR);
    expect(hand.z - shoulder.z).toBeGreaterThan(0.3);
  });

  it('goes over about its feet the way it was knocked, and lies there', () => {
    const { f } = make();
    f.update(1 / 60);
    for (let i = 0; i < 240; i++) {
      f.play('dead', { fall: [1, 0] });
      f.update(1 / 60);
    }
    f.group.updateMatrixWorld(true);
    const head = world(f.fig.bones.head);
    expect(head.y).toBeLessThan(0.6);
    expect(head.x).toBeGreaterThan(1.2);
  });

  it('turns its head to what it looks at, on its left', () => {
    const { f } = make();
    for (let i = 0; i < 120; i++) {
      f.look({ x: 20, y: 5, z: 5 });
      f.update(1 / 60);
    }
    f.group.updateMatrixWorld(true);
    const ahead = new THREE.Vector3(0, 0, 1).applyQuaternion(f.fig.bones.head.getWorldQuaternion(new THREE.Quaternion()));
    const rest = make().f;
    rest.update(1 / 60);
    rest.group.updateMatrixWorld(true);
    const was = new THREE.Vector3(0, 0, 1).applyQuaternion(rest.fig.bones.head.getWorldQuaternion(new THREE.Quaternion()));
    expect(ahead.x - was.x).toBeGreaterThan(0.4);
  });

  it('waves with its right hand up by its head', () => {
    const { f } = make();
    for (let i = 0; i < 60; i++) {
      f.gesture('wave', { t: i / 60, hold: 2.4 });
      f.update(1 / 60);
    }
    f.group.updateMatrixWorld(true);
    expect(world(f.fig.bones.handR).y).toBeGreaterThan(world(f.fig.bones.armR).y);
  });
});

describe('a robot with an idle of its own', () => {
  // the most any bone turns in one frame
  const jolt = (f, frames, each) => {
    const bones = [];
    f.fig.model.traverse((o) => o.isBone && bones.push(o));
    let last = bones.map((b) => b.quaternion.clone());
    let worst = 0;
    for (let i = 0; i < frames; i++) {
      each(i);
      f.update(1 / 60);
      bones.forEach((b, k) => {
        worst = Math.max(worst, b.quaternion.angleTo(last[k]));
        last[k] = b.quaternion.clone();
      });
    }
    return worst;
  };

  it('fades from its clip into a walk and back, never jumping', () => {
    const { f } = make({ clips: { idle: 'Scene' } }, { idle: true });
    for (let i = 0; i < 60; i++) {
      f.play('idle');
      f.update(1 / 60);
    }
    const into = jolt(f, 60, () => f.play('walk', { speed: 4 }));
    const out = jolt(f, 120, () => f.play('idle'));
    // (a turn of a tenth of a radian in a frame is a pop; a stride's own is far under)
    expect(into).toBeLessThan(0.12);
    expect(out).toBeLessThan(0.12);
  });

  it('lets go of a held clip with a fade, not a pop', () => {
    const t = template({ idle: true });
    const f = riggedFigure('megatron-foc', { metres: 10, role: 'boss', clips: { transform: 'Scene' } }, t.scene, t.animations, { seed: 2 });
    f.hold('Scene', 0.5);
    f.update(1 / 60);
    // (from the last frame drawn held: stopping the clip puts the bones back
    // as they were before it, a frame nobody sees)
    const worst = jolt(f, 40, (i) => {
      if (i === 0) f.release();
      f.play('idle');
    });
    expect(worst).toBeLessThan(0.12);
  });
});
