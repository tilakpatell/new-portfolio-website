// The surface models for the galaxy's soldiers and droids, on every world, from Sketchfab: what
// scripts/sketchfab-surface.mjs brings in (`node scripts/sketchfab-surface.mjs people`),
// each written to public/models/galaxy/surface/<kind>.glb standing on y = 0,
// facing +z, in metres. (The script's header has what each field means;
// `anim`, for a model kept rigged, names its clips: { idle, walk, run }.)
export const MODELS = {
  // its one clip a walk, blaster held (its rest pose a stride: a still one stands on the walk's first frame)
  stormtrooper: { uid: 'dc7237f92c824cd78abc0f5bb4cb6290', as: 'the stormtroopers', metres: 1.83, yaw: -Math.PI / 2, tris: 8000, tex: 512, rig: true, anim: { walk: 'GltfAnimation 0' } },
  // a B1 battle droid
  battledroid: { uid: 'ade3a1205cce449caf91f78e595e5676', as: 'the battle droids', metres: 1.91, yaw: 0, tris: 8000, tex: 512 },
  // a Phase II clone trooper
  clone: { uid: '8519076c1bf24bcbb352f96930a29b55', as: 'the clone troopers', metres: 1.83, yaw: 0, tris: 8000, tex: 512, drop: /dc-15s/, rig: true, anim: { idle: 'Armature|Armature.001|mixamo.com|Layer0', walk: 'Armature|Armature|mixamo.com|Layer0' } },
  // a scout trooper, as on Endor
  scouttrooper: { uid: 'bdcf732e6f374b6d87b02cd023991aae', as: 'the scout troopers', metres: 1.83, yaw: 0, tris: 8000, tex: 512 },
  // a B2 super battle droid
  superdroid: { uid: 'a0f947934672450bad323d6438499812', as: 'the super battle droids', metres: 1.93, yaw: 0, tris: 4500, tex: 512, rig: true, anim: { idle: 'at attention', walk: 'walk guns up' } },
  c3po: { uid: '19b9099bf348488bb781677de04ba0c0', as: 'C-3PO', metres: 1.67, yaw: 0, tris: 7000, tex: 512, rig: true, anim: { idle: 'mixamo.com' } },
  // a shoretrooper, as on Scarif
  shoretrooper: { uid: '67611b62211648b7805359ab148c949a', as: 'the shoretroopers', metres: 1.83, yaw: 0, tris: 8000, tex: 512 },
  vader: { uid: '15c6b612a5834924b0959261aa89e80f', as: 'Darth Vader', metres: 2.02, yaw: 0, tris: 8000, tex: 512 },
  // a death trooper (Rogue One)
  deathtrooper: { uid: '503860c8c63b419daa391f296ab874f1', as: 'the death troopers', metres: 2.0, yaw: 0, tris: 8000, tex: 512 },
  r2d2: { uid: 'b251906902104fddb6f1a9a38bfe92ab', as: 'R2-D2', metres: 1.09, yaw: 0, tris: 8000, tex: 512 },
  // every world's astromechs, until they have their own: R2's model, gliding
  // (they were built in code, figures.js's `droid`)
  droid: { uid: 'b251906902104fddb6f1a9a38bfe92ab', machine: true, as: 'R2-D2', metres: 1.09, yaw: 0, tris: 8000, tex: 512 },
  // a snowtrooper, as on Hoth (the Empire's side of the galactic assault
  // there, missions/assault.js); still as it comes, walked with a bob
  snowtrooper: { uid: '8cad640402844e489d1080f5400ec667', as: 'the snowtroopers', metres: 1.83, yaw: 0, tris: 8000, tex: 512 },
};
