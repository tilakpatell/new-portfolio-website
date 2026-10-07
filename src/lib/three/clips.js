// Rick’s clips, for a Meshy figure that has none of its own. Every figure
// the site has made with Meshy (Portal panic’s cast, Albuquerque’s people,
// the cockpits’ crews, the galaxy’s) is rigged on the same 24-bone skeleton,
// so a clip made on Rick’s plays on any of them: the bones’ turns as they
// are, and the hips’ height scaled to the figure’s (no other bone’s length,
// since a turn doesn’t care how long the bone is). Shared by the cast
// (meshyCast.js: the wardrobe’s Walt and Jesse) and by the crews out of the
// ship (universe/footScene.js). It lives in the library, not with the
// portal, so worlds on other islands (the Death Star’s inside) can borrow
// the clips without reaching into Rick and Morty’s code;
// rickmorty/portal/clips.js passes it on for those that always came there.
//
//   borrowClips(names) → { name: clip | null }   fetched once each, for everyone
//   retarget(clip, hipsY, from) → a copy for a figure whose hips stand hipsY high
//   faceAhead(clips, up)                       every clip turned to face where the walk does

import * as THREE from 'three';
import { gltfLoader } from './gltf';

const BASE = '/games/meshy';
// how high the hips stand in the clips’ rig units, as the crews out of the
// ship have always scaled them (a clip that says, borrowClips’ do, is scaled
// from its own)
export const RICK_HIPS = 90.233;

const fetched = new Map(); // clip name → Promise<clip | null>
export function borrowClips(names = ['idle', 'walk', 'run'], { loader = null } = {}) {
  return Promise.all(
    names.map((n) => {
      if (!fetched.has(n)) {
        const L = loader ?? gltfLoader();
        fetched.set(
          n,
          L.loadAsync(`${BASE}/rick-${n}.glb`).then(
            (g) => {
              const c = g.animations[0] ?? null;
              const hips = g.scene?.getObjectByName('Hips');
              if (c && hips) c.userData = { ...c.userData, hips: hips.position.y };
              return c;
            },
            () => null,
          ),
        );
      }
      return fetched.get(n);
    }),
  ).then((got) => Object.fromEntries(names.map((n, i) => [n, got[i]])));
}

// A copy of `clip` for a figure whose hips stand `hipsY` high (in its rig’s
// units): every bone’s turn, and the hips’ position scaled from `from`’s;
// anything else (a bone’s position or scale) left out, as it would stretch
// the figure to Rick’s proportions.
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

// Meshy’s idle stands turned off to one side, like a fighter’s stance: turn
// a clip’s hips about the up axis (`up`, in the hips’ parent’s space) so its
// mean heading matches `target` (the walk’s, which faces ahead).
const hipsTrack = (clip) => clip?.tracks.find((t) => /^hips\.quaternion$/i.test(t.name));
export function heading(clip, up) {
  const v = hipsTrack(clip)?.values;
  if (!v) return null;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < v.length; i += 4) {
    // the twist about `up`: 2·atan2(q.xyz · up, q.w)
    const a = 2 * Math.atan2(v[i] * up.x + v[i + 1] * up.y + v[i + 2] * up.z, v[i + 3]);
    sx += Math.cos(a);
    sy += Math.sin(a);
  }
  return Math.atan2(sy, sx);
}
export function faceForward(clip, up, target) {
  const v = hipsTrack(clip)?.values;
  const now = heading(clip, up);
  if (!v || now == null) return;
  const fix = new THREE.Quaternion().setFromAxisAngle(up, target - now);
  const q = new THREE.Quaternion();
  for (let i = 0; i < v.length; i += 4) {
    q.set(v[i], v[i + 1], v[i + 2], v[i + 3]).premultiply(fix);
    v[i] = q.x;
    v[i + 1] = q.y;
    v[i + 2] = q.z;
    v[i + 3] = q.w;
  }
}
// every clip but the walk turned to the walk’s heading (its own copies: a
// borrowed clip is retargeted first, so Rick’s are never turned)
export function faceAhead(clips, up) {
  const ahead = heading(clips.walk, up);
  if (ahead == null) return;
  for (const [n, c] of Object.entries(clips)) if (c && n !== 'walk') faceForward(c, up, ahead);
}
