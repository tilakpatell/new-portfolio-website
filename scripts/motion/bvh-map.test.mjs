import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { meshyRig } from '../../src/lib/three/meshyRig.fixture.js';
import { UAL_MAP, retargetUal } from '../preview/ualRetarget.js';
import { SMPLH_BODY, SMPLH_PARENTS, SMPLH_TO_DEF, bvhSource, bvhText } from './bvh-map.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

// A body standing in a T-pose as SMPL-H's does: +y up, facing +z, its left
// at +x, in metres (the shape is made up; only the layout matters here)
const REST = {
  Pelvis: [0, 0.95, 0],
  L_Hip: [0.09, 0.86, 0],
  R_Hip: [-0.09, 0.86, 0],
  Spine1: [0, 1.06, -0.01],
  L_Knee: [0.1, 0.48, 0],
  R_Knee: [-0.1, 0.48, 0],
  Spine2: [0, 1.19, 0],
  L_Ankle: [0.1, 0.08, -0.02],
  R_Ankle: [-0.1, 0.08, -0.02],
  Spine3: [0, 1.25, 0.01],
  L_Foot: [0.11, 0.02, 0.1],
  R_Foot: [-0.11, 0.02, 0.1],
  Neck: [0, 1.47, -0.01],
  L_Collar: [0.07, 1.39, 0],
  R_Collar: [-0.07, 1.39, 0],
  Head: [0, 1.58, 0.03],
  L_Shoulder: [0.17, 1.42, -0.01],
  R_Shoulder: [-0.17, 1.42, -0.01],
  L_Elbow: [0.43, 1.4, -0.03],
  R_Elbow: [-0.43, 1.4, -0.03],
  L_Wrist: [0.68, 1.41, -0.02],
  R_Wrist: [-0.68, 1.41, -0.02],
};
const rest = SMPLH_BODY.map((n) => REST[n]);

// three frames: at rest; the left arm raised 80° (about +z, the T-pose's
// arm swung up) and the hips 0.3 m forward; back at rest
function synthetic() {
  const still = SMPLH_BODY.map(() => [0, 0, 0]);
  const raised = still.map((r, i) => (SMPLH_BODY[i] === 'L_Shoulder' ? [80, 0, 0] : r)); // (Z X Y, degrees)
  return bvhText({ rest, frames: [still, raised, still], root: [[0, 0, 0], [0, 0, 0.3], [0, 0, 0]], fps: 30 });
}

describe('SMPL-H’s 22 body joints onto UAL’s DEF-* bones', () => {
  it('maps every body joint onto a different DEF-* bone, and covers every bone the UAL map knows', () => {
    expect(SMPLH_BODY).toHaveLength(22);
    expect(Object.keys(SMPLH_TO_DEF).sort()).toEqual([...SMPLH_BODY].sort());
    const defs = Object.values(SMPLH_TO_DEF);
    expect(new Set(defs).size).toBe(22);
    expect([...defs].sort()).toEqual(Object.keys(UAL_MAP).sort());
  });

  it('keeps each joint’s parent the parent of its DEF-* bone (the chains line up)', () => {
    // UAL's parents, by the Meshy bone each maps to: Meshy's chain is UAL's
    const meshyParent = { Spine02: 'Hips', Spine01: 'Spine02', Spine: 'Spine01', neck: 'Spine', Head: 'neck', LeftShoulder: 'Spine', RightShoulder: 'Spine', LeftArm: 'LeftShoulder', RightArm: 'RightShoulder', LeftForeArm: 'LeftArm', RightForeArm: 'RightArm', LeftHand: 'LeftForeArm', RightHand: 'RightForeArm', LeftUpLeg: 'Hips', RightUpLeg: 'Hips', LeftLeg: 'LeftUpLeg', RightLeg: 'RightUpLeg', LeftFoot: 'LeftLeg', RightFoot: 'RightLeg', LeftToeBase: 'LeftFoot', RightToeBase: 'RightFoot' };
    SMPLH_BODY.forEach((n, i) => {
      if (SMPLH_PARENTS[i] < 0) return;
      const mine = UAL_MAP[SMPLH_TO_DEF[n]];
      const parent = UAL_MAP[SMPLH_TO_DEF[SMPLH_BODY[SMPLH_PARENTS[i]]]];
      expect(parent, n).toBe(meshyParent[mine]);
    });
  });
});

describe('a BVH of those joints through retargetUal', () => {
  it('reads back as a mannequin under the DEF-* names, its clip on them', () => {
    const { src, clip } = bvhSource(synthetic(), { name: 'strike' });
    for (const def of Object.keys(UAL_MAP)) expect(src.bones[def]?.isBone, def).toBe(true);
    expect(clip.name).toBe('strike');
    expect(clip.tracks.some((t) => t.name === 'DEF-upper_armL.quaternion')).toBe(true);
    expect(clip.tracks.some((t) => /^(L_|R_|Pelvis|Spine\d|Neck|Head)/.test(t.name))).toBe(false);
  });

  it('lands on every one of Meshy’s 22 mapped bones, with no bone missing and nothing undefined', () => {
    const { src, clip } = bvhSource(synthetic(), { name: 'strike' });
    const rig = meshyRig();
    const out = retargetUal(src, clip, rig.model);
    const turned = out.tracks.filter((t) => t.name.endsWith('.quaternion')).map((t) => t.name.split('.')[0]);
    expect(turned.sort()).toEqual(Object.values(UAL_MAP).sort());
    expect(out.tracks.map((t) => t.name)).toContain('Hips.position');
    for (const t of out.tracks) for (const v of t.values) expect(Number.isFinite(v), t.name).toBe(true);
  });

  it('raises Meshy’s left hand, not its right, when the BVH raises the left arm; and carries the hips forward', () => {
    const { src, clip } = bvhSource(synthetic(), { name: 'strike' });
    const rig = meshyRig();
    const out = retargetUal(src, clip, rig.model);
    const mixer = new THREE.AnimationMixer(rig.model);
    mixer.clipAction(out).play();
    const at = (t) => {
      mixer.setTime(t);
      rig.model.updateMatrixWorld(true);
      const p = (n) => rig.bones[n].getWorldPosition(new THREE.Vector3());
      return { l: p('LeftHand'), r: p('RightHand'), hips: p('Hips') };
    };
    const a = at(0);
    const b = at(1 / 30);
    expect(b.l.y - a.l.y).toBeGreaterThan(0.3);
    expect(Math.abs(b.r.y - a.r.y)).toBeLessThan(0.02);
    expect(b.hips.z - a.hips.z).toBeGreaterThan(0.15);
  });
});

// generate.py's own BVH writer, run on a seeded random motion: what three's
// BVHLoader reads back must stand every joint where HY-Motion's forward
// kinematics put it. Skipped where there is no Python with numpy.
const python = (() => {
  for (const exe of ['python3', 'python']) {
    try {
      execFileSync(exe, ['-c', 'import numpy'], { stdio: 'ignore' });
      return exe;
    } catch {
      /* not this one */
    }
  }
  return null;
})();

describe.skipIf(!python)('generate.py’s BVH', () => {
  it('stands every joint where the forward kinematics put it, frame by frame', () => {
    const dir = mkdtempSync(join(tmpdir(), 'motion-'));
    execFileSync(python, ['-I', join(HERE, 'generate.py'), '--check', dir], { stdio: 'pipe' });
    const want = JSON.parse(readFileSync(join(dir, 'check.json'), 'utf8'));
    const { src, clip } = bvhSource(readFileSync(join(dir, 'check.bvh'), 'utf8'), { name: 'check', keepNames: true });
    const mixer = new THREE.AnimationMixer(src.scene);
    // (once, held: looping, the last frame's time would wrap to the first)
    const action = mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    want.frames.forEach((joints, f) => {
      mixer.setTime(f / want.fps);
      src.scene.updateMatrixWorld(true);
      SMPLH_BODY.forEach((n, i) => {
        const p = src.bones[n].getWorldPosition(new THREE.Vector3());
        expect(p.distanceTo(new THREE.Vector3(...joints[i])), `${n} at frame ${f}`).toBeLessThan(1e-3);
      });
    });
  });
});

describe('bake.mjs', () => {
  it('writes the clip onto Luke as the library’s clips are: the same nodes, every mapped bone, the hips’ height', async () => {
    const { bakeBvh, OUT } = await import('./bake.mjs');
    const dir = mkdtempSync(join(tmpdir(), 'motion-bake-'));
    const r = await bakeBvh(synthetic(), 'test-strike', { out: dir, prompt: 'a test' });
    const json = (f) => {
      const b = readFileSync(f);
      return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8'));
    };
    const mine = json(r.file);
    const library = json(join(OUT, 'ual-sword.heavy.a.glb'));
    expect(mine.nodes.map((n) => n.name)).toEqual(library.nodes.map((n) => n.name));
    const [anim] = mine.animations;
    expect(anim.name).toBe('gen.test-strike');
    expect(anim.channels).toHaveLength(23); // 22 turns and the hips' travel
    expect(anim.extras).toMatchObject({ hips: library.animations[0].extras.hips, prompt: 'a test' });
    expect(anim.extras.strike).toBeGreaterThan(0);
    expect(anim.extras.strike).toBeLessThan(r.seconds);
  });
});
