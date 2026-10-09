// How a clip made on one Meshy-skeleton figure is lent to another: every
// bone's turn as it is, and the hips' height scaled to the borrower's (a turn
// doesn't care how long the bone is; a position or a scale would stretch the
// figure to Rick's proportions). It lives apart from clipLibrary.js, which
// re-exports it, because scripts/vat-bake.mjs needs the very same function to
// bake clips that match the ones the site plays, and the library's loader
// can't run in Node. Imports only three.
//
//   RICK_HIPS   how high the hips stand in the clips' rig units, as the crews
//     out of the ship have always scaled them (a clip that says, as every
//     loaded one does, is scaled from its own)
//   retarget(clip, hipsY, from = RICK_HIPS) → a copy for a figure whose hips
//     stand hipsY high, or null for no clip

import * as THREE from 'three';

export const RICK_HIPS = 90.233;

// A copy of `clip` for a figure whose hips stand `hipsY` high (in its rig's
// units): every bone's turn, and the hips' position scaled from `from`'s;
// anything else (a bone's position or scale) left out, as it would stretch
// the figure to Rick's proportions.
export function retarget(clip, hipsY, from = RICK_HIPS) {
  if (!clip) return null;
  const k = hipsY / from;
  const tracks = [];
  for (const tr of clip.tracks) {
    if (/\.quaternion$/.test(tr.name)) tracks.push(tr.clone());
    else if (/^Hips\.position$/.test(tr.name)) {
      const t = tr.clone();
      for (let i = 0; i < t.values.length; i++) t.values[i] *= k;
      tracks.push(t);
    }
  }
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}
