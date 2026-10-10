import { describe, expect, it } from 'vitest';
import { detailOf, detailsJson } from './bf2017-level-detail.mjs';

// materials.jsonl's rows, cut: an AT-AT plate with its detail, a crate with a scalar tiling, a rock with none
const atat = { name: 'MeshMaterial', textures: { DetailNS: 'Gameplay/Vehicles/Ground/AT-AT/Old/textures/T_ATATDetail_01_NS', NormalTexture: 'x' }, vectors: { Detail_Tiling: [8, 4, 0, 1], NormalDetail_Intensity: [0.5, 0, 0, 1] } };
const crate = { name: 'MeshMaterial', textures: { NormalDetail: 'Objects/Props/_CommonTextures/T_MetalDetail_06_NS' }, vectors: { NormalDetailScalar: [3, 3, 0, 0] } };
const rock = { name: 'MeshMaterial', textures: { NormalTexture: 'y' }, vectors: {} };

describe('the game’s detail normals', () => {
  it('reads a material’s detail map, its tiling and strength', () => {
    expect(detailOf(atat)).toEqual({ tex: 'Gameplay/Vehicles/Ground/AT-AT/Old/textures/T_ATATDetail_01_NS', tiling: [8, 4], strength: 0.5 });
    expect(detailOf(crate)).toEqual({ tex: 'Objects/Props/_CommonTextures/T_MetalDetail_06_NS', tiling: [3, 3], strength: 1 });
    expect(detailOf(rock)).toBe(null);
  });

  it('lists the pack’s meshes whose materials tile one, by mesh index and material', () => {
    const records = new Map([
      ['gameplay/vehicles/ground/at-at/atat_body_mesh', { materials: [rock, atat] }],
      ['objects/props/crate_01/crate_01_mesh', { materials: [crate] }],
    ]);
    const meshes = [{ name: 'models/objects/props/crate_01/crate_01_mesh.glb' }, { name: 'models/rock_mesh.glb' }, { name: 'models/gameplay/vehicles/ground/at-at/atat_body_mesh.glb' }];
    const j = detailsJson(meshes, records);
    expect(j.meshes).toEqual({ 0: [{ material: 0, tex: 'tex/detail/t_metaldetail_06_ns.ktx2', tiling: [3, 3], strength: 1 }], 2: [{ material: 1, tex: 'tex/detail/t_atatdetail_01_ns.ktx2', tiling: [8, 4], strength: 0.5 }] });
    expect(j.sources).toEqual({ t_atatdetail_01_ns: 'Gameplay/Vehicles/Ground/AT-AT/Old/textures/T_ATATDetail_01_NS', t_metaldetail_06_ns: 'Objects/Props/_CommonTextures/T_MetalDetail_06_NS' });
  });
});
