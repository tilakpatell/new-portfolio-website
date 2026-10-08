// The compound's people, drawn: what ./castLife.js says each is doing, on
// the body each has. Thor, Natasha and the Hulk (people.js's Sketchfab
// figures) play their own idle and walk and whatever else of Meshy's
// library they're asked for, made for their rigs as it's first needed
// (./borrow.js), crossing from one to the next; turned more than a little
// they step round on their walk rather than pivot on planted feet, and
// their heads turn to what they look at, eased and kept to what a neck can
// do. The training bot (the HQ games' kit figure) and the kit stand-ins
// shown until the others arrive are posed by hand: the bot leads jumping
// jacks, waves, cheers and gestures as it talks; the stand-ins keep the
// stances they always had (Thor's folded arms, Natasha's hand on her hip,
// the Hulk's fists) and look at him.
//
//   createCastBody(person, template, { yaw }) → { yaw, update(dt, body,
//     at) → the one-shot it played through this frame (or null), need(names),
//     dispose(), head }   person: people.js's, template its loadPerson's; body:
//     castLife's step; at: the point in the world it looks at, or null
//   poseKit(h, style, body, { t, dt, phase, look, yaw, state }) → the
//     one-shot it played through (or null)   h: buildHumanoid's figure;
//     state: a { } the caller keeps for it
//   createLook(head, neck) → { restore(), update(dt, yaw, at, root) }   a
//     head turned to look over its clips (Spider-Man's too, at whoever's
//     talking to him)

import * as THREE from 'three';
import { rotateWorld } from '../../../lib/three/ik';
import { turn as easeTurn } from '../../../lib/three/gait';
import { poseHumanoid } from '../hq/kit/humanoid';
import { borrowFor, rigOf } from './borrow';

const STEP_FROM = 0.5; // turned this far off (rad), they step round…
const STEP_TO = 0.14; // …until they're this near
const STEP_RATE = 2.2; // rad/s while stepping
const STEP_PACE = 0.75; // the walk's pace on the spot, stepping round
const TURN_RATE = 3; // eased turn, otherwise
const MISSING = 2.5; // a one-shot that can't be had (yet) is let go after this (s)
const YAW = 1.1; // the most the head turns from the chest (rad)
const PITCH = 0.5; // and up or down
const LOOK_RATE = 5;

const UP = new THREE.Vector3(0, 1, 0);
const angle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const _h = new THREE.Vector3();
const _d = new THREE.Vector3();
const _f = new THREE.Vector3();
const _l = new THREE.Vector3();
const _r = new THREE.Vector3();

// the look's turn and tilt toward `at` from a head facing `yaw`, clamped
function aimOf(head, yaw, at) {
  head.getWorldPosition(_h);
  _d.copy(at).sub(_h);
  _f.set(Math.sin(yaw), 0, Math.cos(yaw));
  _l.set(Math.cos(yaw), 0, -Math.sin(yaw)); // (the figure's left)
  const x = _d.dot(_l);
  const z = _d.dot(_f);
  return { y: clamp(Math.atan2(x, z), -YAW, YAW), p: clamp(Math.atan2(_d.y, Math.hypot(x, z)), -PITCH, PITCH) };
}

// A head that turns to look at something over whatever its clips have it
// doing: eased, kept to what a neck can do, a third of the turn in the neck.
// restore() before the clips run (they may not write the head every frame:
// a clip that doesn't move it), update() after them.
export function createLook(head, neck = null) {
  const posed = [head, neck].filter(Boolean);
  const saved = posed.map((b) => b.quaternion.clone());
  const st = { y: 0, p: 0 };
  return {
    restore() {
      for (let i = 0; i < posed.length; i++) posed[i].quaternion.copy(saved[i]);
    },
    // facing `yaw` (the figure's, about the vertical), toward `at` (or back to straight ahead)
    update(dt, yaw, at, root = null) {
      for (let i = 0; i < posed.length; i++) saved[i].copy(posed[i].quaternion);
      if (!head) return;
      let wy = 0;
      let wp = 0;
      if (at) {
        (root ?? head).updateMatrixWorld(true);
        ({ y: wy, p: wp } = aimOf(head, yaw, at));
      }
      const k = 1 - Math.exp(-LOOK_RATE * Math.max(0, dt));
      st.y += (wy - st.y) * k;
      st.p += (wp - st.p) * k;
      if (Math.abs(st.y) + Math.abs(st.p) < 1e-4) return;
      // (nodding about its own left-right as it's turned: + tips it back, to look up)
      _r.set(Math.sin(yaw), 0, Math.cos(yaw)).cross(UP).applyAxisAngle(UP, st.y);
      if (neck) {
        rotateWorld(neck, UP, st.y / 3);
        rotateWorld(neck, _r, st.p / 3);
      }
      const rest = neck ? 2 / 3 : 1;
      rotateWorld(head, UP, st.y * rest);
      rotateWorld(head, _r, st.p * rest);
    },
  };
}

export function createCastBody(p, template, { yaw = 0 } = {}) {
  const rig = rigOf(p.model);
  const look = createLook(rig?.bones.head ?? null, rig?.bones.neck ?? null);
  const own = new Set(Object.keys(p.actions));
  const got = new Map(); // name → 'loading' | true | false
  let disposed = false;
  const have = (name) => {
    if (own.has(name) || got.get(name) === true) return true;
    if (!got.has(name)) {
      got.set(name, 'loading');
      borrowFor(template, name).then((clip) => {
        if (disposed) return;
        if (clip) p.add(clip);
        got.set(name, Boolean(clip));
      });
    }
    return false;
  };
  const st = { yaw, stepping: false, playing: null, once: false, asked: null, since: 0, told: false };
  p.root.rotation.y = yaw;

  return {
    get yaw() {
      return st.yaw;
    },
    // (its head, for whoever looks at it)
    head: rig?.bones.head ?? null,
    need(names) {
      for (const n of names) if (n) have(n);
    },
    update(dt, body, at) {
      if (disposed) return null;
      let ended = null;
      // a new ask: its clock starts
      if (body.clip !== st.asked) {
        st.asked = body.clip;
        st.since = 0;
        st.told = false;
      }
      st.since += dt;

      // turned far from where it wants to face: step round first
      const err = angle(body.face - st.yaw);
      st.stepping = Math.abs(err) > (st.stepping ? STEP_TO : STEP_FROM) && have('walk');
      if (st.stepping) st.yaw = angle(st.yaw + Math.sign(err) * Math.min(Math.abs(err), STEP_RATE * dt));
      else st.yaw = angle(easeTurn(st.yaw, body.face, dt, TURN_RATE));
      p.root.rotation.y = st.yaw;

      // what to play: stepping, the clip asked for once it's here, else its own idle
      let name = body.clip;
      let loop = body.loop;
      let speed = 1;
      let fade = body.fade ?? 0.3;
      if (st.stepping) {
        name = 'walk';
        loop = true;
        speed = STEP_PACE;
        fade = 0.25;
      } else if (!have(name)) {
        // (a one-shot that isn't coming, or is slow to, is let go so the life goes on)
        if (body.once && !st.told && (got.get(name) === false || st.since > MISSING)) {
          st.told = true;
          ended = name;
        }
        name = 'idle';
        loop = true;
      }
      if (name !== st.playing) {
        p.play(name, { loop, speed, fade, again: true });
        st.playing = name;
        st.once = !loop;
      } else if (loop) p.actions[name].timeScale = speed;

      look.restore();
      p.update(dt);
      if (st.once && !st.told && name === body.clip && p.finished(name)) {
        st.told = true;
        ended = name;
      }
      // the head: toward what it looks at
      look.update(dt, st.yaw, at, p.root);
      return ended;
    },
    dispose() {
      disposed = true;
    },
  };
}

// ── the kit figures ──

const KIT_ONCE = { wave: 2.2, cheer: 1.8 }; // the kit's one-shots, seconds; anything else it can't do: a beat
const set = (b, x = 0, y = 0, z = 0) => b.rotation.set(x, y, z);

export function poseKit(h, style, body, { t = 0, dt = 0, phase = 0, look = null, yaw = 0, state = {} } = {}) {
  const b = h.bones;
  if (body.clip !== state.asked) {
    state.asked = body.clip;
    state.since = 0;
    state.told = false;
  }
  state.since = (state.since ?? 0) + dt;
  let ended = null;
  if (body.once && !state.told && state.since >= (KIT_ONCE[body.clip] ?? MISSING)) {
    state.told = true;
    ended = body.clip;
  }
  const bot = style === 'bot';
  const clip = body.clip;
  poseHumanoid(h, { t, mode: 'idle', phase });
  b.chest.rotation.x = Math.sin(t * 1.4 + phase) * 0.025;
  if (bot && clip === 'jacks') {
    // a jumping jack a second: arms from the sides to over its head and
    // back, feet out and in, a hop at each
    const a = (t + phase) * Math.PI * 2;
    const k = (1 - Math.cos(a)) / 2;
    b.hips.position.y = h.rest.hips.y + Math.abs(Math.sin(a)) * 0.06 * h.scale;
    set(b.shoulderL, 0, 0, 0.12 + k * 2.75);
    set(b.shoulderR, 0, 0, -0.12 - k * 2.75);
    set(b.elbowL, 0, 0, 0.15 * k);
    set(b.elbowR, 0, 0, -0.15 * k);
    set(b.thighL, 0, 0, 0.03 + k * 0.32);
    set(b.thighR, 0, 0, -0.03 - k * 0.32);
    set(b.kneeL, 0.08 * (1 - k), 0, 0);
    set(b.kneeR, 0.08 * (1 - k), 0, 0);
    set(b.footL, 0, 0, -k * 0.3);
    set(b.footR, 0, 0, k * 0.3);
  } else if (bot && clip === 'wave') {
    // the right arm up, waving over its head
    const s = Math.min(1, state.since / 0.3) * Math.min(1, Math.max(0, (KIT_ONCE.wave - state.since) / 0.3));
    set(b.shoulderL, 0, 0, 0.12);
    set(b.shoulderR, -0.2 * s, 0, -0.12 - s * (2.35 + Math.sin(state.since * 9) * 0.28));
    set(b.elbowR, 0, 0, -0.35 * s);
  } else if (bot && clip === 'cheer') {
    const s = Math.min(1, state.since / 0.25) * Math.min(1, Math.max(0, (KIT_ONCE.cheer - state.since) / 0.3));
    const pump = Math.sin(state.since * 10) * 0.2;
    set(b.shoulderL, 0, 0, 0.12 + s * (2.6 + pump));
    set(b.shoulderR, 0, 0, -0.12 - s * (2.6 + pump));
  } else if (bot && body.state === 'talk') {
    // a hand turned out as it speaks, a nod now and then
    set(b.shoulderL, 0, 0, 0.12);
    set(b.shoulderR, -0.45 + Math.sin(t * 2.2) * 0.15, 0, -0.25);
    set(b.elbowR, -1.15 + Math.sin(t * 3.1) * 0.25, 0, 0);
  } else if (style === 'hulk') {
    // fists at his sides, shoulders heaving
    set(b.shoulderL, 0.1, 0, 0.32 + Math.sin(t * 1.1) * 0.03);
    set(b.shoulderR, 0.1, 0, -0.32 - Math.sin(t * 1.1) * 0.03);
    set(b.elbowL, -0.5, 0, 0);
    set(b.elbowR, -0.5, 0, 0);
  } else if (style === 'thor') {
    // arms folded, waiting to see who's worthy
    set(b.shoulderL, -0.7, 0.3, 0.25);
    set(b.shoulderR, -0.7, -0.3, -0.25);
    set(b.elbowL, -1.7, 0, 0);
    set(b.elbowR, -1.7, 0, 0);
  } else if (style === 'widow') {
    // a hand on her hip
    set(b.shoulderL, 0.05, 0, 0.55);
    set(b.elbowL, -1.4, 0.4, 0);
    set(b.shoulderR, 0.05, 0, -0.1);
    set(b.elbowR, -0.2, 0, 0);
    b.hips.rotation.z = 0.05;
  } else {
    set(b.shoulderL, 0, 0, 0.12);
    set(b.shoulderR, 0, 0, -0.12);
  }
  // the head: toward what it looks at (eased), else the bot scanning and the others easy
  let hy = bot ? Math.sin(t * 0.9 + phase) * 0.6 : Math.sin(t * 0.5 + phase) * 0.2;
  let hp = 0;
  if (look) {
    h.root.updateMatrixWorld(true);
    const a = aimOf(b.head, yaw, look);
    hy = a.y;
    hp = a.p;
  }
  const k = 1 - Math.exp(-LOOK_RATE * dt);
  state.hy = (state.hy ?? hy) + (hy - (state.hy ?? hy)) * k;
  state.hp = (state.hp ?? hp) + (hp - (state.hp ?? hp)) * k;
  set(b.head, -state.hp * 0.8, state.hy * 0.75, 0);
  set(b.neck, -state.hp * 0.2, state.hy * 0.25, 0);
  return ended;
}
