// The surface models for Tatooine and Jakku, from Sketchfab: what
// scripts/sketchfab-surface.mjs brings in (`node scripts/sketchfab-surface.mjs desert`),
// each written to public/models/galaxy/surface/<kind>.glb standing on y = 0,
// facing +z, in metres. (The script's header has what each field means;
// `anim`, for a model kept rigged, names its clips: { idle, walk, run }.)
export const MODELS = {
  // a moisture vaporator, the tall pole of a Tatooine farm
  vaporator: { uid: 'acf6211d84eb4a46bb38c9a321771826', as: 'the moisture vaporators', metres: 5, along: 'y', yaw: 0, up: 'y', tris: 3000, tex: 512 },
  // Luke's X-34 landspeeder
  landspeeder: { uid: '3adfdc41c67f4731910800404ba97b4e', as: "Luke's landspeeder", metres: 3.4, along: 'z', yaw: 0, up: 'y', tris: 16000, tex: 1024 },
  jawa: { uid: '08124df6beef4ca18b2d24a25f5fd6bf', as: 'the Jawas', metres: 1, along: 'y', yaw: 0, up: 'y', tris: 8000, tex: 512 },
  bantha: { uid: '3581f3a312dc426d87af3031f5198edf', as: 'the banthas', metres: 2.8, along: 'y', yaw: 0, up: 'y', tris: 10000, tex: 512, gain: 1.3, rig: true, anim: { walk: 'Bantha_Walk' } },
  // a domed adobe house of Mos Eisley
  adobe: { uid: '66893ef6ad5f434e9db954b1f5496dfc', as: 'the adobe houses', metres: 10, along: 'max', yaw: Math.PI, up: 'y', tris: 35000, tex: 1024 },
};
