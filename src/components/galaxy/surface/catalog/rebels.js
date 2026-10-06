// The surface models for the Rebellion's forest worlds that the back lane
// of the planets overhaul does (Dagobah, Yavin 4, Kashyyyk), from
// Sketchfab: what scripts/sketchfab-surface.mjs brings in
// (`node scripts/sketchfab-surface.mjs rebels`), each written to
// public/models/galaxy/surface/<kind>.glb standing on y = 0, facing +z, in
// metres. A group of its own, apart from forest.js (Endor's, the front
// lane's), so the two lanes never edit the same lines.
export const MODELS = {
  // Dagobah: great bald cypresses on their buttress roots, mangrove roots
  // in the bog
  dagocypress: { uid: 'dca97787b1b24fd8a0fb6bb536e383e3', as: 'the great trees of Dagobah', metres: 22, yaw: 0, tris: 7500, tex: 1024 },
  dagoroots: { uid: 'c32d977c14e04e5ebc1fbef9b6111957', as: 'the mangrove roots of Dagobah', metres: 5, yaw: 0, tris: 3900, tex: 1024 },
  // Yavin 4: the jungle's tall trees, vines hanging from them
  yavintree: { uid: '46f83ec5f6c04abf9d509c1070f67d1e', as: 'the jungle trees of Yavin 4', metres: 30, yaw: 0, tris: 6000, tex: 1024 },
  // the Rebel hangar in the Massassi temple: a transport speeder, ammo
  // canisters and a welder's rack
  yavinspeeder: { uid: '75bf19967c0c489ebca764a5047500d3', as: 'the Rebel transport speeder', metres: 6, along: 'max', yaw: 0, tris: 12000, tex: 1024 },
  ammocan: { uid: 'db00456beb9f429b87b791fc5eabe276', as: 'the Rebel ammo canisters', metres: 0.9, along: 'max', yaw: 0, tris: 4000, tex: 512 },
  welderrack: { uid: '4f058bf5a7974677b9772470d476ad91', as: 'the Rebel welder rack', metres: 1.8, yaw: 0, tris: 12000, tex: 1024 },
};
