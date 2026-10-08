// The Chitauri on foot in Smash Run, drawn. The rules walk each one
// straight at Hulk (rules.js, KINDS.soldier.walk); this gives each a body
// to match: its legs stepping by the ground it covers (lib/three/gait.js,
// so they neither march on the spot nor skate, and each starts on its own
// foot), the staff rifle brought up as he comes within range, and fire:
// only a couple of them shooting at once (lib/ai/squad.js's tokens, the
// nearest first), each burst kicking the rifle back, the bolts glancing
// off him. A smashed one flails as it flies and goes limp when it lands.
// Nothing here touches the rules: who's where, what's smashed and when is
// theirs; the shots are for show (Hulk shrugs them off, as in the film).
//
//   createChitauri({ shooters }) → { claim(o, ahead, live) → firing,
//     audit(dt, alive), pose(h, o, { dt, ahead, firing, walk, calm }) → shot }
//   walk: its speed over the ground (m/s); shot: true when this frame's a
//   shot (the caller draws the bolt)
//   flail(h, t, landed): a thrown soldier's limbs
//   STRIDE (m), RANGE ([lo, hi] metres ahead of him they shoot from)

import { createGait } from '../../../lib/three/gait';
import { createTokens } from '../../../lib/ai/squad';
import { poseHumanoid } from '../hq/kit/humanoid';

export const STRIDE = 1.4; // a stride (two steps) of the kit figure's legs, metres
export const RANGE = [7, 30];
const BURST = [0.8, 1.7]; // seconds between shots, each its own
const LEG_CYCLE = 5; // poseHumanoid's legs: sin(k × 5) is a stride

// a steady number in [0, 1) for an id and a count
const hash = (n, k = 0) => {
  const x = Math.sin(n * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export function createChitauri({ shooters = 2 } = {}) {
  const tokens = createTokens({ pools: { fire: shooters }, timeout: 4 });
  return {
    // in range and on: shooting if it holds a token (the nearer take them first)
    claim(o, ahead, live) {
      if (live && ahead > RANGE[0] && ahead < RANGE[1]) return tokens.steal('fire', o.id, -ahead);
      tokens.release('fire', o.id);
      return false;
    },
    audit(dt, alive) {
      tokens.audit(dt, alive);
    },
    // the body for this frame: a new figure for an id starts its gait afresh
    pose(h, o, { dt, ahead, firing, walk = 0, calm = false }) {
      const c = (h.chit ??= { id: null });
      if (c.id !== o.id) {
        Object.assign(c, { id: o.id, gait: createGait({ stride: STRIDE, cadence: [2, 3], seed: o.id }), aim: 0, kick: 0, wait: hash(o.id, 1) * BURST[1], shots: 0 });
      }
      const g = c.gait.step(dt, o.passed ? 0 : walk);
      // the rifle up as he comes on, levelled at him to shoot
      const want = firing ? 1 : ahead < RANGE[1] ? 0.35 : 0.2;
      c.aim += (want - c.aim) * (1 - Math.exp(-6 * dt));
      c.kick = Math.max(0, c.kick - dt * 7);
      let shot = false;
      if (firing && c.aim > 0.8) {
        c.wait -= dt;
        if (c.wait <= 0) {
          c.shots++;
          c.wait = BURST[0] + hash(o.id, c.shots + 2) * (BURST[1] - BURST[0]);
          c.kick = 1;
          shot = !calm;
        }
      }
      const walking = g.amount > 0.05;
      poseHumanoid(h, { t: g.phase / LEG_CYCLE, mode: walking ? 'walk' : 'idle', speed: 1, phase: 0, aim: c.aim, recoil: c.kick, lean: 0.25 * g.amount });
      return shot;
    },
  };
}

const set = (b, x, y, z) => b.rotation.set(x, y, z);
// thrown: arms flung up and out, legs splayed and kicking; down: sprawled
export function flail(h, t, landed = false) {
  const b = h.bones;
  poseHumanoid(h, { t, mode: 'idle', flinch: landed ? 0 : 1 });
  if (landed) {
    set(b.shoulderL, -0.4, 0, 1.3);
    set(b.shoulderR, -0.2, 0, -1.4);
    set(b.elbowL, -0.3, 0, 0);
    set(b.elbowR, -0.5, 0, 0);
    set(b.thighL, -0.25, 0, 0.3);
    set(b.thighR, 0.1, 0, -0.25);
    set(b.kneeL, 0.6, 0, 0);
    set(b.kneeR, 0.2, 0, 0);
    set(b.head, 0.3, 0.4, 0);
    return;
  }
  const w = Math.sin(t * 14);
  const v = Math.sin(t * 11 + 1.3);
  set(b.shoulderL, -2.3 + w * 0.35, 0, 0.9 + v * 0.2);
  set(b.shoulderR, -2.0 - w * 0.35, 0, -0.9 - v * 0.2);
  set(b.elbowL, -0.6 - v * 0.3, 0, 0);
  set(b.elbowR, -0.4 + v * 0.3, 0, 0);
  set(b.thighL, -0.9 + w * 0.5, 0, 0.35);
  set(b.thighR, -0.3 - w * 0.5, 0, -0.3);
  set(b.kneeL, 1.2 + v * 0.3, 0, 0);
  set(b.kneeR, 0.6 - v * 0.3, 0, 0);
}
