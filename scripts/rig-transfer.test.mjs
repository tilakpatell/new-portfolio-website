// What scripts/rig-transfer.mjs promises of the weights it moves from a
// rigged donor onto a new mesh: a vertex takes the joints of the donor's
// surface nearest it, the weights of each vertex sum to one over at most
// four joints, a vertex facing away from the nearest donor point prefers
// one facing its way (the inside of one thigh isn't the other thigh), and
// smoothing over the mesh's own edges evens out a seam.
import { describe, expect, it } from 'vitest';
import { fitTo, loosen, smoothWeights, transferWeights } from './rig-transfer.mjs';

// a donor of points, each fully on one joint
function donorOf(points, joints, normals = points.map(() => [0, 0, 1])) {
  const n = points.length;
  const d = { positions: new Float32Array(n * 3), normals: new Float32Array(n * 3), joints: new Uint16Array(n * 4), weights: new Float32Array(n * 4) };
  points.forEach((p, i) => {
    d.positions.set(p, i * 3);
    d.normals.set(normals[i], i * 3);
    d.joints[i * 4] = joints[i];
    d.weights[i * 4] = 1;
  });
  return d;
}
const flat = (pts) => new Float32Array(pts.flat());
const jointsOf = (out, i) => {
  const m = {};
  for (let k = 0; k < 4; k++) if (out.weights[i * 4 + k] > 0) m[out.joints[i * 4 + k]] = out.weights[i * 4 + k];
  return m;
};

describe('transferWeights', () => {
  it('gives a vertex on a donor point that point’s joint', () => {
    const donor = donorOf([[0, 0, 0], [1, 0, 0], [0, 1, 0]], [3, 7, 9]);
    const out = transferWeights(donor, { positions: flat([[1, 0, 0]]) }, { k: 1 });
    expect(jointsOf(out, 0)).toEqual({ 7: 1 });
  });

  it('weighs the nearer donor points more, and sums to one over at most four joints', () => {
    const pts = [];
    const js = [];
    for (let i = 0; i < 12; i++) {
      pts.push([Math.cos(i), Math.sin(i), 0]);
      js.push(i);
    }
    const out = transferWeights(donorOf(pts, js), { positions: flat([[0.9, 0.1, 0], [0, 0, 0]]) }, { k: 8 });
    for (let v = 0; v < 2; v++) {
      const m = jointsOf(out, v);
      expect(Object.keys(m).length).toBeLessThanOrEqual(4);
      expect(Object.values(m).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
    }
    // (cos 0, sin 0) is joint 0, the nearest to (0.9, 0.1)
    const first = jointsOf(out, 0);
    expect(Math.max(...Object.values(first))).toBe(first[0]);
  });

  it('prefers donor points that face the vertex’s own way', () => {
    // two sheets 2 cm apart facing away from each other: the inside of two thighs
    const donor = donorOf([[0, 0, 0.01], [0, 0, -0.01]], [1, 2], [[0, 0, 1], [0, 0, -1]]);
    // a vertex just on the −z sheet’s side, but facing +z
    const out = transferWeights(donor, { positions: flat([[0, 0, -0.004]]), normals: flat([[0, 0, 1]]) }, { k: 2 });
    expect(Math.max(...Object.values(jointsOf(out, 0)))).toBe(jointsOf(out, 0)[1]);
  });
});

describe('smoothWeights', () => {
  it('evens out a vertex unlike its neighbours along the mesh’s edges, and keeps each sum one', () => {
    // a strip of five vertices, the middle one on joint 5 and the rest on joint 2
    const n = 5;
    const joints = new Uint16Array(n * 4);
    const weights = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      joints[i * 4] = i === 2 ? 5 : 2;
      weights[i * 4] = 1;
    }
    const index = new Uint32Array([0, 1, 2, 1, 2, 3, 2, 3, 4]);
    const out = smoothWeights({ joints, weights }, index, n, { passes: 1, amount: 0.5 });
    const mid = jointsOf(out, 2);
    expect(mid[5]).toBeLessThan(1);
    expect(mid[2]).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) expect(Object.values(jointsOf(out, i)).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
  });
});

describe('fitTo', () => {
  it('scales a mesh to the donor’s height, stands it on the donor’s floor and centres it over the donor', () => {
    const donorBox = { min: [-0.8, 0, -0.3], max: [0.8, 1.8, 0.3] };
    const pts = flat([[10, 5, 10], [12, 9, 11]]);
    const out = fitTo(pts, donorBox);
    // height 4 → 1.8: k = 0.45
    expect(out[1]).toBeCloseTo(0, 5);
    expect(out[4]).toBeCloseTo(1.8, 5);
    expect((out[0] + out[3]) / 2).toBeCloseTo(0, 5);
    expect((out[2] + out[5]) / 2).toBeCloseTo(0, 5);
  });
});

describe('loosen', () => {
  // a leg straight down from (0.1, 1) to (0.1, 0.1), the hips at the origin's height 1
  const bones = {
    index: { Hips: 0, LeftUpLeg: 1, LeftLeg: 2, LeftFoot: 3, LeftToeBase: 4, RightUpLeg: 5, RightLeg: 6, RightFoot: 7, RightToeBase: 8 },
    at: { LeftUpLeg: [0.1, 1, 0], LeftLeg: [0.1, 0.5, 0], LeftFoot: [0.1, 0.1, 0], LeftToeBase: [0.1, 0.02, 0.1], RightUpLeg: [-0.1, 1, 0], RightLeg: [-0.1, 0.5, 0], RightFoot: [-0.1, 0.1, 0], RightToeBase: [-0.1, 0.02, 0.1] },
  };
  it('hands a hem vertex far out from the leg partly to the hips, and leaves one on the leg alone', () => {
    const positions = new Float32Array([0.1, 0.6, 0.05, 0.1, 0.6, -0.4]);
    const joints = new Uint16Array([2, 0, 0, 0, 2, 0, 0, 0]);
    const weights = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0]);
    const out = loosen(positions, { joints, weights }, bones);
    expect(jointsOf(out, 0)).toEqual({ 2: 1 });
    const hem = jointsOf(out, 1);
    expect(hem[0]).toBeCloseTo(0.75, 5);
    expect(hem[2]).toBeCloseTo(0.25, 5);
  });
});
