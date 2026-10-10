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

describe('rigFrom on a mesh in several parts', () => {
  it('puts every part on the donor’s one skinned mesh, and none is left on a mesh of its own', async () => {
    const { Document, NodeIO } = await import('@gltf-transform/core');
    const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions');
    const { MeshoptDecoder } = await import('meshoptimizer');
    const { mkdtemp, writeFile } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { rigFrom } = await import('./rig-transfer.mjs');
    // a body and a head, each a box mesh on a node of its own
    const doc = new Document();
    const buffer = doc.createBuffer();
    const top = doc.createNode('top').setScale([0.5, 0.5, 0.5]);
    doc.createScene().addChild(top);
    const scene = top;
    const box = (name, [x0, y0, z0], [x1, y1, z1]) => {
      const p = [];
      const c = [];
      for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) c.push([x, y, z]);
      for (const [a, b, d, e] of [[0, 1, 3, 2], [4, 5, 7, 6], [0, 1, 5, 4], [2, 3, 7, 6], [0, 2, 6, 4], [1, 3, 7, 5]]) p.push(...c[a], ...c[b], ...c[d], ...c[a], ...c[d], ...c[e]);
      const prim = doc.createPrimitive().setAttribute('POSITION', doc.createAccessor().setArray(new Float32Array(p)).setType('VEC3').setBuffer(buffer));
      scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim)));
    };
    box('body', [-0.2, 0, -0.1], [0.2, 1.5, 0.1]);
    box('head', [-0.1, 1.5, -0.1], [0.1, 1.8, 0.1]);
    // (compressed, as an imported model comes: each mesh quantized in its own box)
    const { meshopt } = await import('@gltf-transform/functions');
    const { MeshoptEncoder } = await import('meshoptimizer');
    await MeshoptEncoder.ready;
    await MeshoptDecoder.ready;
    await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
    const dir = await mkdtemp(join(tmpdir(), 'rig-'));
    await writeFile(join(dir, 'mesh.glb'), await io.writeBinary(doc));
    const r = await rigFrom('public/models/galaxy/troops/battledroid.glb', join(dir, 'mesh.glb'), join(dir, 'out.glb'), { tex: 64 });
    expect(r.tris).toBe(24);
    const out = await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder }).read(join(dir, 'out.glb'));
    const meshes = out.getRoot().listMeshes();
    expect(meshes.length).toBe(1);
    expect(meshes[0].listPrimitives().length).toBe(2);
  }, 120000);
});
