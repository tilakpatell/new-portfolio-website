// The body under a lit lightsaber: the hips, the spine, the neck and the
// legs out of two clips from Quaternius's Universal Animation Library
// (CC0), baked onto the Meshy rig by scripts/ual-bake.mjs into
// /games/meshy/ual-saber.glb. Lit, the figure sinks into Sword_Idle's
// guard, knees bent and weight low; under a stroke it steps into
// Sword_Attack's lunge, timed so the clip's strike falls on the stroke's
// (combatRules.js `lead`), and held down there while the strokes chain;
// after the last, the clip plays on and the body comes back up into the
// guard. Put out, it fades back to the clips under it. The arms aren't in
// the bake: gunplay.js and saber.js pose them over this.
//
// Laid over the mixer's pose by hand, not as one more action on the mixer
// (which would only ever average it in): each bone `w` of the way from
// where the clips under it have it to where this does. Moving, it gives
// way to the walk and the run.
//
//   loadSaberBody() → Promise<{ idle, attack } | null>   the baked clips, fetched once
//   createSaberBody(fig, clips) → { update(dt, now, { lit, swing, move }) } | null
//     fig: a rigged Meshy figure (footScene.js: bones, hipsY); swing: saber.js's
//     `swinging` ({ t0, dur, lead, heavy }) or null; move: 0…1, as fig.update's

import * as THREE from 'three';
import { retarget } from '../../rickmorty/portal/clips';
import { gltfLoader } from '../../../lib/three/gltf';

const URL = '/games/meshy/ual-saber.glb';
const EASE_IN = 5; // how quick the guard comes on once lit (per second)
const EASE_OUT = 3.5; // and goes, put out
const FROM = { single: 0.22, heavy: 0 }; // where in Sword_Attack a stroke starts (s): the heavy one from the wind-up
const HOLD = 0.75; // the lunge held there while the strokes chain (s)
const PLAY_ON = 1.25; // after the last stroke, the clip played on this much quicker
const RAMP = 0.1; // seconds the lunge takes to come in over the guard
const smooth = (a, b, x) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

let loading = null;
export function loadSaberBody() {
  loading ??= gltfLoader()
    .loadAsync(URL)
    .then(
      (g) => {
        const by = Object.fromEntries(g.animations.map((c) => [c.name, c]));
        return by.Sword_Idle && by.Sword_Attack ? { idle: by.Sword_Idle, attack: by.Sword_Attack } : null;
      },
      () => null,
    );
  return loading;
}

// a clip's tracks on the figure's bones, to sample by hand
const layer = (bones, clip) =>
  clip.tracks
    .map((tr) => {
      const [name, prop] = tr.name.split('.');
      const bone = bones[name];
      return bone && { bone, pos: prop === 'position', at: tr.createInterpolant() };
    })
    .filter(Boolean);
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const lay = (parts, t, w) => {
  if (w <= 1e-3) return;
  for (const p of parts) {
    const v = p.at.evaluate(t);
    if (p.pos) p.bone.position.lerp(_v.set(v[0], v[1], v[2]), w);
    else p.bone.quaternion.slerp(_q.set(v[0], v[1], v[2], v[3]), w);
  }
};

export function createSaberBody(fig, clips) {
  if (!clips || !fig?.bones?.Hips || !fig.hipsY) return null;
  const idleClip = retarget(clips.idle, fig.hipsY, clips.idle.userData.hips);
  const attackClip = retarget(clips.attack, fig.hipsY, clips.attack.userData.hips);
  const idle = layer(fig.bones, idleClip);
  const attack = layer(fig.bones, attackClip);
  const strike = clips.attack.userData.strike ?? 0.4;
  const back = clips.attack.userData.back ?? 0.93;
  // the lunge: { t (in the clip), swing, t0, from, rate, in (0…1, coming in) }
  const st = { w: 0, phase: Math.random() * idleClip.duration, a: null, b: null }; // b: the last lunge, going out under a new one
  const weightOf = (a) => smooth(0, 1, a.in) * (1 - smooth(back - 0.05, back + 0.3, a.t));
  return {
    update(dt, now, { lit = false, swing = null, move = 0 } = {}) {
      dt = Math.min(dt, 0.1);
      st.w += ((lit ? 1 : 0) - st.w) * (1 - Math.exp(-dt * (lit ? EASE_IN : EASE_OUT)));
      st.phase = (st.phase + dt) % idleClip.duration;
      // a stroke starts a lunge, its strike on the stroke's; one chained on
      // while it's still down holds it there; one once it's coming back up
      // starts the next, the last going out under it
      if (swing && st.a?.swing !== swing) {
        if (st.a && st.a.t <= HOLD) Object.assign(st.a, { swing, t0: swing.t0 });
        else {
          if (st.a) st.b = { t: st.a.t, w: weightOf(st.a) };
          const from = swing.heavy ? FROM.heavy : FROM.single;
          st.a = { t: from, swing, t0: swing.t0, from, rate: (strike - from) / Math.max(0.05, swing.lead * swing.dur), in: 0 };
        }
      }
      const a = st.a;
      if (a) {
        if (swing) a.t = Math.min(Math.max(a.t, a.from + (now - a.t0) * a.rate), HOLD);
        else a.t += dt * PLAY_ON;
        a.in = Math.min(1, a.in + dt / RAMP);
        if (a.t >= clips.attack.duration) st.a = null;
      }
      if (st.b) {
        st.b.t = Math.min(clips.attack.duration, st.b.t + dt * PLAY_ON);
        if (!st.a || st.a.in >= 1) st.b = null;
      }
      const stand = 1 - smooth(0.04, 0.3, move);
      const w = st.w * stand;
      if (w <= 1e-3 && !st.a) return;
      lay(idle, st.phase, w);
      if (st.b) lay(attack, st.b.t, stand * st.b.w);
      if (st.a) lay(attack, st.a.t, stand * weightOf(st.a));
    },
  };
}
