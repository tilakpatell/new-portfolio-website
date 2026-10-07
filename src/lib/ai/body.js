// The seam from brain to body: what a brain's step looks like on a figure.
// A brain says where it is, which way it faces and what it's doing; every
// world then worked its figure's `move` out by hand (the Citadel's walkTo,
// actors.js's, activity.js's, assault.js's, npc.js's) and most forgot the
// rest. This reads two steps a frame apart and gives the animator what it
// wants: the motion in the figure's own frame (speed along its facing,
// side across it, turn from its yaw), where its head looks, and what its
// mode looks like, from a table every world gets and can override. Pure,
// no three.js: the caller turns `look` into a point for the animator.
//
//   MODE_BODY: { [mode]: { look?: 'aim' | 'belief', base?, action?, scan?, rise? } } (the spec's table)
//   bodyFrom(prev, next, dt, { table = MODE_BODY, unit = 1, range = 12 })
//     → { motion: { speed, side, turn, down, hurt }, look: { x, z } | null, base, action, scan }
//     a step: { x, z, yaw, mode, aim?, look?, belief?, down?, hurt?, fire?, use? }
//     yaw: 0 along +z, turning toward +x (vec.yawOf's), which is the figure's left;
//     speed and side in metres a second (the world's units over `unit`; side + right,
//     turn + left, as locomotion.js reads them); aim, look and belief are points
//     ({ x, z }, or a perception belief with `at`); range is in metres; fire: the
//     brain is shooting this frame (cover's "up to fire"); use: the place a
//     `use:<want>` step is using, as needs.js's places advertise it ({ clip, base? })
//
// A row's `look` puts one source first: 'aim' (a strafer's chest on its
// target), 'belief' (a chaser's eyes on where it thinks you are, at any
// range). Past that, every mode looks the same way round: the brain's own
// `look`, else its `aim`, else its belief of you within `range`, else
// nothing. `base` is a looping base state in place of the feet (crouch),
// `action` a loop on the upper layer while the mode lasts (talk), `scan`
// the head sweeping across its cone (the animator's look does the sweep,
// over time), and `rise` takes the base away while the step fires.

import { wrapAngle } from './vec';

// What each mode looks like, with the defaults every world gets (the spec's
// "The seam from brain to body"). Motion always comes from the step itself:
// a mode never stops feet the brain is moving, or they'd slide.
export const MODE_BODY = {
  // idle, looking at what it watches
  hold: {},
  watch: {},
  // stops, a half turn (the brain's), stares at where it heard you
  suspicious: { look: 'belief' },
  // walks, the head sweeping
  search: { scan: true },
  // runs, looking at its belief of you
  chase: { look: 'belief' },
  // hips toward travel (locomotion turns them), chest and aim at the target
  strafe: { look: 'aim' },
  back: { look: 'aim' },
  // the crouch base, up to fire
  cover: { base: 'crouch', rise: true },
  // runs, a look back now and then (the belief when it's close: the look's clamp makes it a glance over the shoulder)
  flee: {},
  // idle, talk on the upper layer, looking at whom it talks to
  talk: { action: 'talk' },
  // the want's advertised clip as a base or a loop (the step's `use`)
  'use:': {},
};

// a point from a point, a point with y, or a belief (its `at`)
const pointOf = (p) => {
  const q = p?.at ?? p;
  return q && Number.isFinite(q.x) && Number.isFinite(q.z) ? { x: q.x, z: q.z } : null;
};

const rowFor = (table, mode) => {
  if (mode == null) return {};
  if (table[mode]) return table[mode];
  if (typeof mode === 'string' && mode.startsWith('use:')) return table['use:'] ?? {};
  return {};
};

export function bodyFrom(prev, next, dt, { table = MODE_BODY, unit = 1, range = 12 } = {}) {
  const motion = { speed: 0, side: 0, turn: 0, down: next?.down ?? 0, hurt: next?.hurt ?? 0 };
  if (prev && next && dt > 0) {
    const dx = (next.x - prev.x) / unit;
    const dz = (next.z - prev.z) / unit;
    const turned = wrapAngle((next.yaw ?? 0) - (prev.yaw ?? 0));
    // the displacement in the frame it faced halfway through the step
    const yaw = (prev.yaw ?? 0) + turned / 2;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    // ahead (sin, cos); its right (−cos, sin)
    motion.speed = (dx * fx + dz * fz) / dt;
    motion.side = (dz * fx - dx * fz) / dt;
    motion.turn = turned / dt;
    for (const k of ['speed', 'side', 'turn']) if (!Number.isFinite(motion[k])) motion[k] = 0;
  }
  const row = rowFor(table, next?.mode);

  // where the head looks: the row's first choice, then look, aim, a near belief
  const belief = pointOf(next?.belief);
  let look = null;
  if (row.look === 'aim') look = pointOf(next?.aim);
  else if (row.look === 'belief') look = belief;
  look ??= pointOf(next?.look) ?? pointOf(next?.aim);
  if (!look && belief && next && Math.hypot(belief.x - next.x, belief.z - next.z) / unit <= range) look = belief;

  let base = row.base ?? null;
  let action = row.action ?? null;
  if (row.rise && next?.fire) base = null;
  // a place in use: its base if it has one (the animator enters it through its clip), else its clip looped
  const use = typeof next?.mode === 'string' && next.mode.startsWith('use:') ? next.use : null;
  if (use) {
    base = use.base ?? base;
    action = use.base ? null : (use.clip ?? action);
  }
  return { motion, look, base, action, scan: !!row.scan };
}
