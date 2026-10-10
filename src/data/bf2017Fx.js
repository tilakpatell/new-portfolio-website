// The game’s look for the galaxy’s effects: which sheets and meshes from the
// Star Wars Battlefront II (2017) drop the site holds, written by
// scripts/bf2017-fx.mjs (do not edit by hand). lib/three/fx/gameLook.js reads
// it; an effect not here keeps its own look.

export const BF2017_FX = {
  'blast': {"from":"FX/Decals/Metal/T_Decal_01_RGBM","grid":[2,2],"sizes":{"256":33014,"512":119762},"channels":{"burn":"r"}},
  'debris.fighter': {"mesh":true,"file":"/models/galaxy/bf2017/fx/debris.fighter.glb","from":["fx/meshes/vehicle/meshp_ywing_shard1_mesh","fx/meshes/vehicle/meshp_ywing_shard2_mesh","fx/meshes/vehicle/meshp_ywing_shard3_mesh","fx/meshes/vehicle/meshp_ywing_shard4_mesh","fx/meshes/vehicle/meshp_ywing_shard5_mesh"],"bytes":13996},
  'debris.metal': {"mesh":true,"file":"/models/galaxy/bf2017/fx/debris.metal.glb","from":["fx/meshes/chunks/metal/meshp_chunk_metal_01_mesh","fx/meshes/chunks/vehiclesgeneric/meshp_chunk_vehiclesgeneric_01_mesh"],"bytes":12200},
  'debris.rock': {"mesh":true,"file":"/models/galaxy/bf2017/fx/debris.rock.glb","from":["fx/meshes/chunks/generic/meshp_chunk_generic_01_mesh","fx/meshes/chunks/generic/meshp_chunk_generic_02_mesh","fx/meshes/chunks/generic/meshp_chunk_generic_03_mesh","fx/meshes/chunks/generic/meshp_chunk_generic_04_mesh"],"bytes":12628},
  'debris.sand': {"mesh":true,"file":"/models/galaxy/bf2017/fx/debris.sand.glb","from":["fx/meshes/chunks/sand/meshp_chunk_desertrocks_4x_mesh"],"bytes":7040},
  'debris.snow': {"mesh":true,"file":"/models/galaxy/bf2017/fx/debris.snow.glb","from":["fx/meshes/chunks/snow/meshp_chunk_arcticchunks_4x_mesh"],"bytes":7036},
  'debris.walker': {"mesh":true,"file":"/models/galaxy/bf2017/fx/debris.walker.glb","from":["fx/meshes/vehicle/meshp_atst_wreck_01_mesh","fx/meshes/vehicle/meshp_atst_wreck_02_mesh","fx/meshes/vehicle/meshp_atst_wreck_03_mesh","fx/meshes/vehicle/meshp_atst_wreck_04_mesh","fx/meshes/vehicle/meshp_atst_wreck_05_mesh","fx/meshes/vehicle/meshp_atst_wreck_06_mesh"],"bytes":28444},
  'debris.wood': {"mesh":true,"file":"/models/galaxy/bf2017/fx/debris.wood.glb","from":["fx/meshes/chunks/wood/meshp_woodsplinter_01_mesh","fx/meshes/chunks/wood/meshp_chunk_treesplinter_01_mesh","fx/meshes/chunks/wood/meshp_chunk_treesplinter_02_mesh","fx/meshes/chunks/wood/meshp_chunk_treesplinter_03_mesh"],"bytes":15320},
  'force.push': {"mesh":true,"file":"/models/galaxy/bf2017/fx/force.push.glb","from":["fx/gameplay/hero/luke/meshes/forcefronthalfsphere_mesh"],"bytes":6136},
  'glow': {"from":"FX/Lensflare/Textures/T_Box_SoftEdge_02","grid":[1,1],"sizes":{"256":27327},"additive":true},
  'impact': {"from":"FX/Decals/VolumeDecals/Textures/T_Impact_01_RGB","grid":[1,1],"sizes":{"256":73560},"channels":{"scorch":"r","burst":"g","ring":"b"}},
  'ramp.blackbody': {"from":"FX/StandardShaders/T_BlackBodyRamps_01_M","grid":[1,1],"sizes":{"256":35750},"colour":true,"rampV":0.33},
  'scorch.metal': {"from":"FX/Decals/Metal/T_Decal_ScorchMark_Metal_2x4_D","grid":[2,2],"sizes":{"256":41665,"512":146633},"colour":true},
};
