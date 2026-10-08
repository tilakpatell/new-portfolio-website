// What people aboard do when nothing is wrong: the routines, each a small
// behaviour tree on src/lib/ai/tree. A patrol walks its round of spots and
// stands a while at each; a post is stood to attention with a glance either
// way now and then; work is a console and a breather; a chat is two people
// walking up to each other and talking; a march goes on without stopping;
// a droid wanders room to room; a companion keeps up with whoever it
// follows; a scripted person does what the story says, step by step, and
// then stands as it was left. The trees only ask; the body that answers is
// the blackboard brains.js hands them, so a routine never knows about
// walls, doors or paths, and the same tree serves everyone with that role.
// Pure.
//
//   ROLES                                  every role type a person may have
//   routineFor(role, script?) → node       the tree for a role (a typo throws)
//     role: { type: 'patrol', spots } | { type: 'post', spot } | { type: 'work', spot }
//       | { type: 'chat', with } | { type: 'march', spots } | { type: 'droid' }
//       | { type: 'follow', who } | { type: 'scripted' }
//     script (scripted only): [{ to, run? } | { face } | { say, key? } | { anim, s? } | { wait }]
//       { anim } with no s is the pose kept from then on; with s, held that long
//   runRoutine(node, bb, dt) → 'running' | 'done' | 'failed'
//   resetRoutine(node, bb)                 back to the start (after a fight, a failed way)
//
// The blackboard: { clock, rand, timers: {}, go(where, opts) → status, face(target),
//   pose(anim), say(key, text?), near(who, metres) → bool }
//   where: a spot name | { x, z, room } | { who: id } | { wander: true }
//   face: a yaw | a spot name (its yaw) | { spot, turn } (its yaw turned) | { who: id }

import { DONE, guard, repeat, reset, RUNNING, select, sequence, tick } from '../../../../lib/ai/tree';

export const ROLES = Object.freeze(['patrol', 'post', 'work', 'chat', 'march', 'droid', 'follow', 'scripted']);

// Each timed leaf keeps its end time in the blackboard under its own key,
// since a tree is shared by everyone with the role and a leaf has no state.
let leaves = 0;

const span = (bb, s) => (Array.isArray(s) ? s[0] + (s[1] - s[0]) * bb.rand() : s);

// Stands for `seconds` (a [lo, hi] is picked from afresh each time) in a pose;
// no pose keeps whatever the person was last told to rest in.
function wait(seconds, anim) {
  const key = `wait${leaves++}`;
  return (bb) => {
    const t = (bb.timers ??= {});
    t[key] ??= bb.clock + span(bb, seconds);
    bb.pose(anim ?? bb.rest ?? 'idle');
    if (bb.clock < t[key] - 1e-9) return RUNNING;
    delete t[key];
    return DONE;
  };
}

const go = (where, opts) => (bb) => bb.go(where, opts);
const face = (target) => (bb) => {
  bb.face(target);
  return DONE;
};

// Where a patrol looks while it stands: along the spot’s own way, then a
// little to one side.
const GLANCE = 0.6;

const TREES = {
  patrol: (role) => repeat(sequence(...role.spots.flatMap((s) => [go(s), face(s), wait([2, 4], 'idle'), face({ spot: s, turn: GLANCE }), wait([1, 2], 'idle')]))),
  post: ({ spot }) =>
    sequence(
      go(spot),
      face(spot),
      repeat(sequence(wait([5, 9], 'attention'), face({ spot, turn: GLANCE }), wait([1.5, 2.5], 'attention'), face({ spot, turn: -GLANCE }), wait([1.5, 2.5], 'attention'), face(spot))),
    ),
  work: ({ spot }) => sequence(go(spot), face(spot), repeat(sequence(wait([6, 12], 'work'), wait([1.5, 3], 'idle')))),
  // talks while they stand together; walks back up if the other wanders off
  chat: (role) => {
    const who = { who: role.with };
    return repeat(select(guard((bb) => bb.near(who, 2.4), sequence(face(who), wait([3, 6], 'talk'), wait([2, 4], 'idle'))), go(who, { near: 1.6 })));
  },
  march: (role) => repeat(sequence(...role.spots.map((s) => go(s)))),
  droid: () => repeat(sequence(go({ wander: true }), wait([0.5, 2.5], 'idle'))),
  follow: (role) => {
    const who = { who: role.who };
    return repeat(select(guard((bb) => bb.near(who, 3), wait(0.5, 'idle')), go(who, { near: 2, keepUp: true })));
  },
  scripted: (role, script) => sequence(...(script ?? []).map(stepOf), repeat(wait(1))),
};

// One step of a story’s script as a leaf.
function stepOf(step) {
  if (step.to !== undefined) return go(step.to, { run: Boolean(step.run) });
  if (step.face !== undefined) return face(step.face);
  if (step.say !== undefined)
    return (bb) => {
      bb.say(step.key ?? null, step.say);
      return DONE;
    };
  if (step.anim !== undefined && step.s !== undefined) return wait(step.s, step.anim);
  if (step.anim !== undefined)
    return (bb) => {
      bb.rest = step.anim;
      bb.pose(step.anim);
      return DONE;
    };
  if (step.wait !== undefined) return wait(step.wait);
  throw new Error(`routines: a script step that does nothing: ${JSON.stringify(step)}`);
}

export function routineFor(role, script) {
  const make = TREES[role?.type];
  if (!make) throw new Error(`routines: no role called “${role?.type}”`);
  return make(role, script);
}

export const runRoutine = (node, bb, dt) => tick(node, bb, dt);

export function resetRoutine(node, bb) {
  reset(node, bb);
  bb.timers = {};
}
