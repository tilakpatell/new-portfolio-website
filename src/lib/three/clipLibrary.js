// Every clip a figure on the Meshy skeleton can play, by what it is. Every
// figure the site has made with Meshy (Portal panic's cast, Albuquerque's
// people, the cockpits' crews, the galaxy's, the troopers) is rigged on the
// same 24-bone skeleton, so a clip made on one plays on any of them: the
// bones' turns as they are, and the hips' height scaled to the figure's (no
// other bone's length, since a turn doesn't care how long the bone is).
// This was rickmorty/portal/clips.js, Rick's clips lent to the figures
// without their own; it re-exports from here, so its callers (meshyCast.js,
// universe/footScene.js, the cockpits, saberBody.js) are as they were.
//
//   CLIPS: { name: { url, take?, hips?, loop?, mask? } }   the registry: the
//     GLB, the clip's name in it (else its first), the hips' height it was
//     made for (else read from the file), whether it repeats, and the bones
//     it may move when played as a layer ('upper', 'lower', 'full'; full
//     when it doesn't say)
//   loadClip(name, { loader }) → Promise<clip | null>   fetched once, for
//     everyone, with clip.userData.hips; a file that won't load is null
//   forFigure(name, { hipsY, up, key, ahead }) → Promise<clip | null>   a
//     copy for a figure whose hips stand hipsY high, turned about `up` to
//     face where its walk does (`ahead`, else Rick's walk's heading), kept
//     per name and `key` (the figure's template) so copies of one figure
//     share it
//   preload(names) → Promise<void>   a world's clips fetched up front, so
//     the first wave isn't late
//   borrowClips(names) → { name: clip | null }   Rick's own (rick-<name>.glb)
//   retarget(clip, hipsY, from) → a copy for a figure whose hips stand hipsY high
//   faceAhead(clips, up)                       every clip turned to face where the walk does
//   heading(clip, up), faceForward(clip, up, target)   a clip's hips' heading, and turning it

import * as THREE from 'three';
import { gltfLoader } from './gltf';
import { checkRig } from './rigCheck';

const BASE = '/games/meshy';
const TROOPS = '/models/galaxy/troops';
// how high the hips stand in the clips' rig units, as the crews out of the
// ship have always scaled them (a clip that says, as every loaded one does,
// is scaled from its own)
export const RICK_HIPS = 90.233;

export const CLIPS = {
  // Rick's, for any figure without its own
  idle: { url: `${BASE}/rick-idle.glb`, loop: true },
  walk: { url: `${BASE}/rick-walk.glb`, loop: true },
  run: { url: `${BASE}/rick-run.glb`, loop: true },
  sit: { url: `${BASE}/rick-sit.glb`, loop: true },
  // Meshy's animation library, made once on one Meshy skeleton
  // (scripts/meshy-rm-local.mjs's `clips`): the thirteen meshyCast's
  // SHARED_CLIPS plays over a figure's idle, walk and run
  drink: { url: `${BASE}/clips-drink.glb` },
  cheer: { url: `${BASE}/clips-cheer.glb` },
  wave: { url: `${BASE}/clips-wave.glb` },
  happy: { url: `${BASE}/clips-happy.glb` },
  hit: { url: `${BASE}/clips-hit.glb` },
  fall: { url: `${BASE}/clips-fall.glb` },
  scared: { url: `${BASE}/clips-scared.glb` },
  shoot: { url: `${BASE}/clips-shoot.glb` },
  dance: { url: `${BASE}/clips-dance.glb`, loop: true },
  punch: { url: `${BASE}/clips-punch.glb` },
  taunt: { url: `${BASE}/clips-taunt.glb` },
  shot: { url: `${BASE}/clips-shot.glb` },
  sitcross: { url: `${BASE}/clips-sitcross.glb`, loop: true },
  // the troopers', made on the clone's rig (scripts/meshy-troopers.mjs's
  // CLIPS, Meshy's library by number), its hips 100.4 high
  'die.back': { url: `${TROOPS}/clip-die.glb` }, // Shot_and_Fall_Backward
  'die.fwd': { url: `${TROOPS}/clip-dieFwd.glb` }, // Shot_and_Fall_Forward
  'die.blown': { url: `${TROOPS}/clip-dieBlown.glb` }, // Shot_and_Blown_Back
  kneel: { url: `${TROOPS}/clip-kneel.glb` }, // Kneeling_Reload
  'taunt.trooper': { url: `${TROOPS}/clip-taunt.glb` }, // Chest_Pound_Taunt
  'hit.trooper': { url: `${TROOPS}/clip-hit.glb` }, // Gunshot_Reaction
  // ── Quaternius's Universal Animation Library ──
  // Each clip baked onto Luke's rest skeleton by scripts/ual-bake.mjs into
  // its own /games/meshy/ual-<name>.glb, full body (the mask applied at play
  // time), its hips read off the file's (Luke's). UAL's name for each after it.
  talk: { url: `${BASE}/ual-talk.glb`, loop: true }, // Idle_Talking_Loop
  'sit.enter': { url: `${BASE}/ual-sit.enter.glb` }, // Sitting_Enter
  'sit.idle': { url: `${BASE}/ual-sit.idle.glb`, loop: true }, // Sitting_Idle_Loop
  'sit.talk': { url: `${BASE}/ual-sit.talk.glb`, loop: true }, // Sitting_Talking_Loop
  'sit.exit': { url: `${BASE}/ual-sit.exit.glb` }, // Sitting_Exit
  crouch: { url: `${BASE}/ual-crouch.glb`, loop: true }, // Crouch_Idle_Loop
  'crouch.walk': { url: `${BASE}/ual-crouch.walk.glb`, loop: true }, // Crouch_Fwd_Loop
  interact: { url: `${BASE}/ual-interact.glb` }, // Interact
  pickup: { url: `${BASE}/ual-pickup.glb` }, // PickUp_Table
  'kneel.fix': { url: `${BASE}/ual-kneel.fix.glb` }, // Fixing_Kneeling
  'hit.chest': { url: `${BASE}/ual-hit.chest.glb` }, // Hit_Chest
  'hit.head': { url: `${BASE}/ual-hit.head.glb` }, // Hit_Head
  die: { url: `${BASE}/ual-die.glb` }, // Death01
  'aim.pistol': { url: `${BASE}/ual-aim.pistol.glb` }, // Pistol_Aim_Neutral
  'aim.pistol.up': { url: `${BASE}/ual-aim.pistol.up.glb` }, // Pistol_Aim_Up
  'aim.pistol.down': { url: `${BASE}/ual-aim.pistol.down.glb` }, // Pistol_Aim_Down
  'shoot.pistol': { url: `${BASE}/ual-shoot.pistol.glb` }, // Pistol_Shoot
  reload: { url: `${BASE}/ual-reload.glb` }, // Pistol_Reload
  jab: { url: `${BASE}/ual-jab.glb` }, // Punch_Jab
  cross: { url: `${BASE}/ual-cross.glb` }, // Punch_Cross
  roll: { url: `${BASE}/ual-roll.glb` }, // Roll
  'jump.start': { url: `${BASE}/ual-jump.start.glb` }, // Jump_Start
  'jump.loop': { url: `${BASE}/ual-jump.loop.glb`, loop: true }, // Jump_Loop
  'jump.land': { url: `${BASE}/ual-jump.land.glb` }, // Jump_Land
  push: { url: `${BASE}/ual-push.glb`, loop: true }, // Push_Loop
  'cast.enter': { url: `${BASE}/ual-cast.enter.glb` }, // Spell_Simple_Enter
  'cast.idle': { url: `${BASE}/ual-cast.idle.glb`, loop: true }, // Spell_Simple_Idle_Loop
  cast: { url: `${BASE}/ual-cast.glb` }, // Spell_Simple_Shoot
  sprint: { url: `${BASE}/ual-sprint.glb`, loop: true }, // Sprint_Loop
  'walk.formal': { url: `${BASE}/ual-walk.formal.glb`, loop: true }, // Walk_Formal_Loop
  torch: { url: `${BASE}/ual-torch.glb`, loop: true }, // Idle_Torch_Loop
  'dance.ual': { url: `${BASE}/ual-dance.ual.glb`, loop: true }, // Dance_Loop
  swim: { url: `${BASE}/ual-swim.glb`, loop: true }, // Swim_Fwd_Loop
  'swim.idle': { url: `${BASE}/ual-swim.idle.glb`, loop: true }, // Swim_Idle_Loop
  drive: { url: `${BASE}/ual-drive.glb`, loop: true }, // Driving_Loop
  'idle.calm': { url: `${BASE}/ual-idle.calm.glb`, loop: true }, // Idle_Loop
  // ── end of the UAL's ──
};

// Each file fetched once for everyone, its clips and the hips' height its
// rig stands at. A file that fails is forgotten, so a later ask tries it
// again (a dropped connection shouldn't cost the clip for the page's life).
const files = new Map(); // url → Promise<{ animations, hips } | null>
function file(url, loader) {
  if (!files.has(url)) {
    const p = (loader ?? gltfLoader()).loadAsync(url).then(
      (g) => ({ animations: g.animations ?? [], hips: g.scene?.getObjectByName('Hips')?.position.y ?? null }),
      () => {
        if (files.get(url) === p) files.delete(url);
        return null;
      },
    );
    files.set(url, p);
  }
  return files.get(url);
}
// the clip an entry names, noting the hips it was made on
function take(entry, loader) {
  return file(entry.url, loader).then((f) => {
    if (!f) return null;
    const c = (entry.take ? f.animations.find((a) => a.name === entry.take) : f.animations[0]) ?? null;
    const hips = entry.hips ?? f.hips;
    if (c && hips != null && c.userData.hips !== hips) c.userData = { ...c.userData, hips };
    return c;
  });
}

export function loadClip(name, { loader = null } = {}) {
  const entry = CLIPS[name];
  return entry ? take(entry, loader) : Promise.resolve(null);
}

export function preload(names = [], { loader = null } = {}) {
  return Promise.all(names.map((n) => loadClip(n, { loader }))).then(() => undefined);
}

// The figures' copies: one per clip and figure template. The library's own
// clip is never changed (everyone shares it); a copy that couldn't be made
// is forgotten with its file.
const copies = new Map(); // `${name}:${key}` → Promise<clip | null>
export function forFigure(name, { hipsY = null, up = null, key = null, ahead = null, loader = null } = {}) {
  const id = key == null ? null : `${name}:${key}`;
  if (id && copies.has(id)) return copies.get(id);
  const p = Promise.all([loadClip(name, { loader }), up && ahead == null ? loadClip('walk', { loader }) : null]).then(([clip, walk]) => {
    if (!clip) return null;
    const from = clip.userData.hips ?? RICK_HIPS;
    const copy = retarget(clip, hipsY ?? from, from);
    const to = up ? (ahead ?? heading(walk, up)) : null;
    if (to != null) faceForward(copy, up, to);
    return copy;
  });
  if (id) {
    copies.set(id, p);
    p.then((c) => {
      if (!c && copies.get(id) === p) copies.delete(id);
    });
  }
  return p;
}

// Rick's clips by name (rick-<name>.glb), whether the registry has them or
// not; the same clip loadClip hands out for the ones it does
export function borrowClips(names = ['idle', 'walk', 'run'], { loader = null } = {}) {
  return Promise.all(names.map((n) => take({ url: `${BASE}/rick-${n}.glb` }, loader))).then((got) => Object.fromEntries(names.map((n, i) => [n, got[i]])));
}

// A copy of `clip` for a figure whose hips stand `hipsY` high (in its rig's
// units): every bone's turn, and the hips' position scaled from `from`'s;
// anything else (a bone's position or scale) left out, as it would stretch
// the figure to Rick's proportions. The hips are found by role (rigCheck's
// ROLES.hips: Meshy's Hips, mixamorig:Hips, Unreal's pelvis, Character
// Creator's hip), the role's first name the clip moves, so a clip from any
// family keeps its root's travel.
export function retarget(clip, hipsY, from = RICK_HIPS) {
  if (!clip) return null;
  const k = hipsY / from;
  const at = (tr) => tr.name.slice(0, tr.name.lastIndexOf('.'));
  const root = checkRig(clip.tracks.filter((tr) => /\.position$/.test(tr.name)).map(at)).roles.hips;
  const tracks = [];
  for (const tr of clip.tracks) {
    if (/\.quaternion$/.test(tr.name)) tracks.push(tr.clone());
    else if (root != null && /\.position$/.test(tr.name) && at(tr) === root) {
      const t = tr.clone();
      for (let i = 0; i < t.values.length; i++) t.values[i] *= k;
      tracks.push(t);
    }
  }
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

// Meshy's idle stands turned off to one side, like a fighter's stance: turn
// a clip's hips about the up axis (`up`, in the hips' parent's space) so its
// mean heading matches `target` (the walk's, which faces ahead).
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
// every clip but the walk turned to the walk's heading (its own copies: a
// borrowed clip is retargeted first, so Rick's are never turned)
export function faceAhead(clips, up) {
  const ahead = heading(clips.walk, up);
  if (ahead == null) return;
  for (const [n, c] of Object.entries(clips)) if (c && n !== 'walk') faceForward(c, up, ahead);
}
