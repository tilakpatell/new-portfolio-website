// What the site knows about the 2017 game's humanoid skeleton,
// Walrus_HumanMale: 604 of the game's people share it, about 250 joints
// (body, fingers, face, cloth and physics bones), named as Maya HumanIK
// names them. The owner chose to keep it whole (2026-10-10): nothing here
// renames or drops a bone; the site learns these names instead of Meshy's.
// Pure, no three, so the import scripts and the loader read the same list.
// (docs/superpowers/specs/2026-10-10-battlefront-2017-asset-pipeline-design.md, section 4)
//
//   BODY: the 23 bones every clip drives and every figure must have
//   FINGERS: the 48 finger bones (thumb 1–4, the rest 0–4, both hands); reported when
//     missing, never fatal: a figure without them still walks
//   SOCKETS: the game's named points; the weapon is modelled for Wep_Root
//   checkWalrus(names) → { ok, missing }   ok when BODY and SOCKETS are all there
//   isWalrus(names) → boolean   a 2017 rig, not Meshy's (Meshy names its
//     spine Spine01, Spine02; the game's Spine1, Spine2)
//   CLIP_FALLBACK, resolveClip(name, has) → name | null   a clip the site
//     asks for that a body's library lacks, played as the nearest it has
//     (react.js's hit.head as hit.chest, every death as the one it has), so
//     a 2017 duellist never freezes on a name

const SIDES = ['Left', 'Right'];

export const BODY = [
  'Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Neck1', 'Head',
  ...SIDES.flatMap((s) => [`${s}Shoulder`, `${s}Arm`, `${s}ForeArm`, `${s}Hand`]),
  ...SIDES.flatMap((s) => [`${s}UpLeg`, `${s}Leg`, `${s}Foot`, `${s}ToeBase`]),
];

export const FINGERS = SIDES.flatMap((s) =>
  ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'].flatMap((f) =>
    (f === 'Thumb' ? [1, 2, 3, 4] : [0, 1, 2, 3, 4]).map((i) => `${s}Hand${f}${i}`),
  ),
);

export const SOCKETS = {
  weapon: 'Wep_Root',
  muzzle: 'Wep_Muzzle',
  aim: 'Wep_Aim',
  handL: 'IK_Joint_LeftHand',
  handR: 'IK_Joint_RightHand',
};

export function checkWalrus(names) {
  const have = new Set(names);
  const need = BODY.concat(Object.values(SOCKETS));
  const missing = need.filter((n) => !have.has(n));
  const ok = missing.length === 0;
  return { ok, missing: missing.concat(FINGERS.filter((n) => !have.has(n))) };
}

export function isWalrus(names) {
  const have = new Set(names);
  return BODY.every((n) => have.has(n)) && have.has('Spine1') && !have.has('Spine02');
}

export const CLIP_FALLBACK = {
  'hit.head': 'hit.chest',
  'die.fwd': 'die',
  'die.back': 'die',
  'die.blown': 'die',
  'aim.pistol': 'idle',
  'shoot.pistol': 'idle',
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
