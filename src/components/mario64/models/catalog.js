// The models the Mario 64 tribute is drawn with: fan-made uploads on
// Sketchfab (CC BY; who made each, and where it came from, are in
// src/data/modelCredits.json as m64-<kind>), none of them taken from a game.
// scripts/sketchfab-cybertron.mjs --world mario64 brings them in with the
// settings here: stood on the ground facing +z, `metres` tall (or along
// `along`), simplified to `tris`, maps at `tex`, written to `file`.
// Mario keeps his skeleton (`rig`), which lib/three/rig.js poses; his upload's
// automatic glTF lost his head, so he's made from its own .fbx (`fbx`, with
// the overalls' map it named by a path that wasn't there). The code-made
// models in ./cast.js, ./things.js and ./mario.js stand in until these load,
// and stay if they can't.
//
// What the game reads besides: `role` (mario, actor or prop: what it stands
// in for), `for` (the actor type or prop kind it draws), `bones` (a rig's
// bones by role, for lib/three/rig.js) and `paint` (a model that came
// uncoloured: ./hd.js colours it by height).

// his rig's bones by what they are (a Rigify rig: its 'spine' is the hips,
// the last spine bone the head)
const MARIO_BONES = { hips: 'spine', head: 'spine004', armL: 'upper_armL', foreL: 'forearmL', handL: 'handL', armR: 'upper_armR', foreR: 'forearmR', handR: 'handR', thighL: 'thighL', calfL: 'shinL', footL: 'footL', toeL: 'toeL', thighR: 'thighR', calfR: 'shinR', footR: 'footR', toeR: 'toeR' };

export const MODELS = {
  mario: { uid: 'bc65c57fe1b9472db828226d6ba98e82', as: 'Mario, whom you play', metres: 1.6, tris: 40000, tex: 1024, maps: 512, rig: true, fbx: { maps: { 'blu body': 'JacketColor.png' } }, file: '/models/mario64/mario.glb', role: 'mario', bones: MARIO_BONES },
  goomba: { uid: 'c2cebdfd58b1471f9da8cc555c9ca47f', as: 'the Goombas', metres: 0.95, tris: 8000, tex: 1024, maps: 512, file: '/models/mario64/goomba.glb', role: 'actor', for: 'goomba' },
  bobomb: { uid: '35b12aa67da04119bf30fbd7ce11367d', as: 'the Bob-ombs', metres: 1.25, tris: 10000, tex: 1024, maps: 512, file: '/models/mario64/bobomb.glb', role: 'actor', for: 'bobomb' },
  king: { uid: 'c7d0446bf68d401e871f64f503978788', as: 'King Bob-omb', metres: 3.3, tris: 16000, tex: 1024, file: '/models/mario64/king.glb', role: 'actor', for: 'king' },
  chomp: { uid: '8612429a08864078b98d7b7a938fe46a', as: 'the Chain Chomp', metres: 3, yaw: -1.5708, drop: '^chain$', tris: 6000, tex: 1024, maps: 512, file: '/models/mario64/chomp.glb', role: 'actor', for: 'chomp' },
  toad: { uid: 'e1f9d2953e044729b5dfb9763e492b81', as: 'Toad, in the castle', metres: 1.45, tris: 12000, tex: 1024, file: '/models/mario64/toad.glb', role: 'actor', for: 'toad' },
  star: { uid: 'bab82082f27e45deb17b9e04183c974d', as: 'the Power Stars', metres: 1.25, yaw: -1.5708, tris: 6000, tex: 512, file: '/models/mario64/star.glb', role: 'actor', for: 'star' },
  coin: { uid: 'dbf9945cc49340c0a50f57338a3786ab', as: 'the coins', metres: 0.74, tris: 1900, tex: 512, file: '/models/mario64/coin.glb', role: 'actor', for: 'coin' },
  oneup: { uid: '6ba27a7f3460472d9c2356a0582d50c9', as: 'the 1-Up Mushrooms', metres: 0.78, tris: 5200, tex: 512, file: '/models/mario64/oneup.glb', role: 'actor', for: 'oneup' },
  sign: { uid: '7556d3e7237749eda5ee876736e5c601', as: 'the signs', metres: 1.5, tris: 2000, tex: 1024, maps: 512, file: '/models/mario64/sign.glb', role: 'actor', for: 'sign' },
  tree: { uid: '0ff16e2954c54972bcb9794f31199d28', as: 'the trees, after Super Mario 64’s own', metres: 6.5, tris: 8000, tex: 512, file: '/models/mario64/tree.glb', role: 'prop', for: 'tree', paint: { trunk: 0.2, bark: '#7a5230', leaves: ['#2f7a22', '#5cb83e'] } },
  pine: { uid: '071914806126487b9f5067693b39f335', as: 'the pines', metres: 6.6, tris: 2700, tex: 1024, maps: 512, file: '/models/mario64/pine.glb', role: 'prop', for: 'pine' },
  rock: { uid: 'f0309cd2e4a347c3996cd7d887cd2d4a', as: 'the boulders', metres: 3.4, along: 'max', tris: 400, tex: 1024, maps: 512, file: '/models/mario64/rock.glb', role: 'prop', for: 'rock' },
  chandelier: { uid: '66b536be170d42d7a8aac5992977ec11', as: 'the castle’s chandeliers', metres: 2.6, tris: 12000, tex: 1024, maps: 512, file: '/models/mario64/chandelier.glb', role: 'prop', for: 'chandelier' },
};
