// The game's own clips for the figures on rigs of their own (Star Wars
// Battlefront II (2017)'s walkers and droids: docs/superpowers/plans/
// 2026-10-10-bf2017-phaseV-vehicles.md), under the names the site asks for.
// A walker is not a person: rig.js's roles do not apply, and its walk is the
// game's clip, feet planted by the clip, not legRig.js's stepping. Each rig
// is one skeleton in the drop (`skeleton`, its path in web/anims.jsonl), one
// pack (`public/models/galaxy/bf2017/clips-<rig>.glb`, built by
// scripts/bf2017-rigclips.mjs from exactly the clips named here), the bone
// the figure hangs from (`root`) and the bones its feet are (`feet`, which
// scripts/anim-check.mjs watches stay put while down).
//
// The AT-M6 (22 clips on S1/…/ATM6_Ske) is left out: it is The Last Jedi's,
// and the site shows nothing of the sequel era.
//
// RIG_SET(rig) → { <site name>: <game clip name> } (null for a rig there isn't)
// RIGS[rig] → { skeleton, root, feet, set, additive?: [site names laid over
//   the clip under them rather than played instead] }
// clipFor(rig, name) → the game's clip for a site name, through CLIP_FALLBACK
//   when the rig has none by that name (null when nothing fits)

export const RIGS = {
  // the AT-AT: the game's gameplay walker (ATAT_Ske, 39 clips), the tow
  // cable's fall its own death; it has no firing clip (its guns are bones
  // the site aims, and the bolts are the site's)
  atat: {
    skeleton: 'Gameplay/Vehicles/Ground/AT-AT/ATAT_Ske',
    root: 'Hips',
    feet: ['LeftFrontFoot', 'RightFrontFoot', 'LeftBackFoot', 'RightBackFoot'],
    set: {
      idle: 'C_ATAT_Stand_Idle',
      walk: 'C_ATAT_Stand_Walk_FWD',
      'walk.back': 'C_ATAT_Stand_Walk_BWD',
      'walk.turn': 'C_ATAT_Stand_Walk_FWD_Turn',
      'idle.forward': 'C_ATAT_Stand_Idle_MoveForward',
      die: 'A_ATAT_Stand_Death_Fwd_01',
      'die.cable': 'A_ATAT_Stand_Death_TowCable_Fwd_01',
      'die.right': 'A_ATAT_Stand_Death_Right_02',
    },
  },
  // the AT-ST: the cinematics' skeleton (ATST_Ske01, 69 clips), the game's
  // only one for it; the walker itself comes as one rigid mesh, bound to
  // this skeleton at import (scripts/lib/rig-bind.mjs)
  atst: {
    skeleton: 'Cinematics/Objects/ATST/ATST_Ske01',
    root: 'Hips',
    feet: ['LeftToeBase', 'RightToeBase'],
    set: {
      idle: 'C_ATST_Stand_Idle_02',
      walk: 'C_ATST_Stand_Walk_FWD',
      'walk.back': 'C_ATST_Stand_Walk_BWD',
      run: 'C_ATST_Stand_Sprint_FWD',
      strafe: 'C_ATST_Stand_Walk_StrafeLeft_Fwd_02',
      'turn.left': 'A_ATST_Stand_Idle_Turn90',
      look: 'ATST_Idle_LookLeft',
      enter: 'A_ATST_Stand_Enter',
      shock: 'A_ATST_Stand_Shock_Cycle',
      die: 'A_ATST_Stand_Idle_Death_04',
      'die.right': 'A_ATST_Stand_Idle_Death_Right_04',
      'die.back': 'A_ATST_Stand_Idle_Death_Bwd_04',
    },
  },
  // the AT-TE: six legs, its big gun's stance its firing
  atte: {
    skeleton: 'Gameplay/Vehicles/Ground/AT_TE/AT_TE_Ske',
    root: 'Hips',
    feet: ['LeftFrontFoot', 'RightFrontFoot', 'LeftMiddleFoot', 'RightMiddleFoot', 'LeftBackFoot', 'RightBackFoot'],
    set: {
      idle: 'C_ATTE_Stand_Idle_01',
      walk: 'C_ATTE_Stand_Walk_FWD',
      'walk.back': 'C_ATTE_Stand_Walk_BWD',
      'turn.left': 'C_ATTE_Stand_Turn_InPlace_Left',
      'turn.right': 'C_ATTE_Stand_Turn_InPlace_Right',
      'fire.start': 'A_ATTE_BigFireStance_Start_01',
      fire: 'A_ATTE_BigFireStance_Loop_01',
      'fire.end': 'A_ATTE_BigFireStance_Exit_01',
      land: 'A_ATTE_IntroLanding_01',
      die: 'A_ATTE_Death_Stand_02',
    },
  },
  // the AT-RT: the game's model has its clone in the saddle, skinned to the
  // same rig, so the rider rides with the walker's clips
  atrt: {
    skeleton: 'Gameplay/Vehicles/Ground/ATRT/ATRT_Ske',
    root: 'Hips',
    feet: ['LeftToeBase', 'RightToeBase'],
    set: {
      idle: 'C_ATRT_Stand_Idle_01',
      walk: 'C_ATRT_Stand_Walk_FWD_Faster',
      'walk.back': 'C_ATRT_Stand_Walk_BWD_Faster',
      run: 'C_ATRT_Stand_Run_FWD',
      strafe: 'C_ATRT_Stand_Walk_StrafeLeft_Faster',
      'walk.stop': 'T_ATRT_Walk_To_Stand_01',
      fall: 'L_ATRT_Falling_01',
      die: 'A_ATRT_Stand_Idle_Death_01',
      'die.run': 'A_ATRT_Death_Walk_FWD_01',
    },
  },
  // the droideka: walks unfolded, rolls folded, deploys and fires (its shot
  // is the game's additive recoil, laid over whatever it is doing)
  droideka: {
    skeleton: 'Gameplay/Vehicles/Ground/Droideka_01/Droideka_01_Ske',
    root: 'Hips',
    feet: ['LeftToeBase', 'RightToeBase', 'BackToeBase'],
    additive: ['fire'],
    set: {
      idle: 'P_Droideka_Idle_01',
      walk: 'C_Droideka_Walk_Fwd_01',
      'walk.back': 'C_Droideka_Walk_Bwd_01',
      'walk.left': 'C_Droideka_Walk_Left_02',
      'walk.right': 'C_Droideka_Walk_Right_01',
      roll: 'P_Droideka_Folded_02',
      'roll.jump': 'A_Droideka_Folded_RollJump_Fwd_01',
      fold: 'A_Droideka_Fold_01',
      deploy: 'A_Droideka_Unfold_01',
      fire: 'A_Droideka_Fire_RightGun_01',
      'shield.on': 'A_Droideka_ShieldActivation_01_Activate',
      'shield.off': 'A_Droideka_ShieldActivation_01_Deactivate',
      'stagger.front': 'A_Droideka_Stagger_Front_01',
      'stagger.back': 'A_Droideka_Stagger_Back_01',
      shock: 'A_Droideka_Electrocuted_Loop_Stand_02',
      die: 'A_Droideka_Death_Stand_02',
      'die.folded': 'A_Droideka_Death_Folded_02',
    },
  },
};

export const RIG_SET = (rig) => RIGS[rig]?.set ?? null;

// A name a rig has no clip for, to the nearest it has: a death by a side or
// a cause to the plain death, a run to the walk, any walk's variant to the
// walk, firing's ends to nothing (the loop is enough), anything else to idle.
// Never to another rig's clip, never to a humanoid one.
export const CLIP_FALLBACK = [
  [/^die\./, 'die'],
  [/^run$/, 'walk'],
  [/^(walk|strafe)\./, 'walk'],
  [/^strafe$/, 'walk'],
  [/^fire\.(start|end)$/, null],
  [/^turn\./, 'idle'],
  [/.*/, 'idle'],
];

export function clipFor(rig, name) {
  const set = RIG_SET(rig);
  if (!set) return null;
  if (set[name]) return set[name];
  for (const [re, to] of CLIP_FALLBACK) if (re.test(name)) return to && to !== name ? clipFor(rig, to) : null;
  return null;
}

// Which death a walker plays when the rules bring it down: the tow cable's
// fall when the cable tripped it, a fall to the side it was hit from when it
// has one, else its plain death.
export function deathFor(rig, { cable = false, side = null } = {}) {
  const set = RIG_SET(rig) ?? {};
  if (cable && set['die.cable']) return 'die.cable';
  if (side && set[`die.${side}`]) return `die.${side}`;
  return 'die';
}
