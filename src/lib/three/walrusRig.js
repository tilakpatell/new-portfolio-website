// What the site knows of Star Wars Battlefront II (2017)'s humanoid
// skeleton, Walrus_HumanMale: the game's names for the body, the fingers and
// the sockets its weapons hang from, a check that a model's tree has them,
// and which clip stands in for one a figure lacks. The rig is kept whole,
// as DICE made it (the owner's ruling, 2026-10-10: no bone pruned or
// renamed), so the site reads the game's names rather than mapping them to
// Meshy's. Pure: names in, names out (lib/three/walrus.js loads and drives
// a figure with it; docs/superpowers/specs/2026-10-10-battlefront-2017-asset-pipeline-design.md, section 4).
//
//   BODY, FINGERS            the bones a clip moves the figure by, and its hands'
//   SOCKETS                  { weapon, muzzle, aim, handL, handR }: the game's weapon socket, its muzzle and aim, the two hands' IK targets
//   checkWalrus(names)       → { ok, missing }: ok when every body bone and socket is there (missing fingers are said, not failed)
//   isWalrus(names)          → whether it is the game's rig (Spine1, never Meshy's Spine02)
//   CLIP_FALLBACK            a clip name → the one to play when a pack hasn't it (always a game clip's role, never a UAL one)
//   resolveClip(name, has)   → the name, or its fallback, whichever `has`; else null
//   WEAPON_FRAME             { quaternion, position }: the site's gun frame in Wep_Root's

export const BODY = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Neck1', 'Head', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'];

// (each hand: a thumb of four, the other four fingers of five from the palm)
export const FINGERS = ['Left', 'Right'].flatMap((side) =>
  ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'].flatMap((f) => (f === 'Thumb' ? [1, 2, 3, 4] : [0, 1, 2, 3, 4]).map((i) => `${side}Hand${f}${i}`)),
);

export const SOCKETS = { weapon: 'Wep_Root', muzzle: 'Wep_Muzzle', aim: 'Wep_Aim', handL: 'IK_Joint_LeftHand', handR: 'IK_Joint_RightHand' };

// The site's gun frame (a blaster's barrel +z, a saber's blade +y, the grip
// at the origin: universe/gunplay.js) in the Wep_Root socket's. The game
// models its weapons in that socket's own frame, so the two are the same:
// Luke's hilt runs from its pommel at y −0.216 to its emitter at +0.070
// about the grip at the origin, the DL-44's and the EE-3's barrels along +z
// (0.33 and 0.79 m); and through Luke's own clips the socket's +y is the
// blade's way: up and across at his guard, overhead and out at a strike's
// contact. walrusSocket.test.js is the measurement, on the committed
// skeleton and packs: the grip within 0.15 m of the right hand, the blade
// up and away from the forearm at the guard (a frame turned half over
// fails it). Kept as a frame, not assumed away, so a weapon that sits
// wrong is one number to change.
export const WEAPON_FRAME = { quaternion: [0, 0, 0, 1], position: [0, 0, 0] };

export function checkWalrus(names) {
  const has = new Set(names);
  const missing = [...BODY, ...Object.values(SOCKETS), ...FINGERS].filter((n) => !has.has(n));
  const fingers = new Set(FINGERS);
  return { ok: missing.every((n) => fingers.has(n)), missing };
}

export function isWalrus(names) {
  const has = new Set(names);
  return BODY.every((n) => has.has(n)) && !has.has('Spine02');
}

// A role a pack may not have, and the nearest it will: a hero has no
// pistol stance, a trooper no kneel; the idle is always there.
export const CLIP_FALLBACK = {
  'hit.head': 'hit.chest',
  'hit.back': 'hit.chest',
  'die.fwd': 'die',
  'die.back': 'die',
  'die.blown': 'die',
  'aim.pistol': 'idle',
  'shoot.pistol': 'idle',
  'aim.rifle': 'idle',
  'shoot.rifle': 'idle',
  kneel: 'idle',
  crouch: 'idle',
  roll: 'idle',
  jab: 'idle',
  cheer: 'idle',
  talk: 'idle',
};

export function resolveClip(name, has) {
  if (has(name)) return name;
  const to = CLIP_FALLBACK[name];
  return to && has(to) ? to : null;
}
