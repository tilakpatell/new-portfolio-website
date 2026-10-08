import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildHumanoid, poseHumanoid } from './humanoid';
import { mixPose, snapPose } from './blend';

const mats = { body: new THREE.MeshBasicMaterial(), dark: new THREE.MeshBasicMaterial(), glow: new THREE.MeshBasicMaterial() };

describe('kit pose blending', () => {
  it('lies between two poses by the weight, the ends exactly each', () => {
    const h = buildHumanoid({ style: 'ultron', materials: mats });
    poseHumanoid(h, { t: 0.3, mode: 'idle' });
    const a = snapPose(h);
    poseHumanoid(h, { t: 0.3, mode: 'run' });
    const b = snapPose(h);
    mixPose(h, a, b, 0);
    expect(h.bones.thighL.quaternion.angleTo(a.find((s) => s.bone === h.bones.thighL).q)).toBeLessThan(1e-6);
    mixPose(h, a, b, 1);
    expect(h.bones.thighL.quaternion.angleTo(b.find((s) => s.bone === h.bones.thighL).q)).toBeLessThan(1e-6);
    mixPose(h, a, b, 0.5);
    const qa = a.find((s) => s.bone === h.bones.thighL).q;
    const qb = b.find((s) => s.bone === h.bones.thighL).q;
    expect(h.bones.thighL.quaternion.angleTo(qa)).toBeCloseTo(qa.angleTo(qb) / 2, 5);
    // the hips' height too
    const ya = a.find((s) => s.bone === h.bones.hips).p.y;
    const yb = b.find((s) => s.bone === h.bones.hips).p.y;
    expect(h.bones.hips.position.y).toBeCloseTo((ya + yb) / 2, 6);
  });

  it('reuses the snapshot it is given', () => {
    const h = buildHumanoid({ style: 'ultron', materials: mats });
    const into = snapPose(h);
    poseHumanoid(h, { t: 1, mode: 'walk' });
    expect(snapPose(h, into)).toBe(into);
    expect(into.find((s) => s.bone === h.bones.thighL).q.equals(h.bones.thighL.quaternion)).toBe(true);
  });
});
