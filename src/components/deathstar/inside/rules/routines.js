// What people aboard do when nothing is wrong, and the legs they do
// everything on. The routines are small behaviour trees on src/lib/ai/tree:
// a patrol walks its round of spots and stands a while at each; a post is
// stood to attention with a glance either way now and then; work is a
// console and a breather; a chat is two people walking up to each other
// and talking; a march goes on without stopping; a droid wanders room to
// room; a companion keeps up with whoever it follows; a scripted person
// does what the story says, step by step, and then stands as it was left.
// The trees only ask; the body that answers is the blackboard brains.js
// hands them, so a tree never knows about walls, doors or paths, and one
// tree serves everyone with that role. The legs answer the blackboard’s
// go and face for the routines and the fights alike: a way from nav.route
// (through doors that open for this person), its waypoints walked with the
// walker so walls, doors and floors hold everyone as they hold you, bent
// round anyone close with steer.separate, a lift ridden, a way worked out
// again when no headway is made, and the body turned to where it walks or
// looks. Pure apart from the people it moves.
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
//   where: a spot name | { x, z, room } | { who: id } | { wander: true } | { path } (a route already found)
//   opts: { run, near (metres that count as there), keepUp (run when more than 6 m behind) }
//   face: a yaw | a spot name (its yaw) | { spot, turn } (its yaw turned) | { who: id } | a point
//
//   legsOf(person) → legs                  { nav, want: { yaw, lock }, ride, ctx, wander }, kept in person.mind.legs
//   walkTo(crew, person, where, opts) → 'running' | 'done' | 'failed'   (an 'arrive' event at a named spot,
//     the station’s or a furnished one’s { name, room, x, z, yaw })
//   faceTo(crew, person, target)
//   placeOf(crew, person, where) → { x, z, room, y?, yaw? } | null
//   canPass(crew, person, doorId, door) → bool   not sealed, and not locked against them
//   stepLegs(crew, person, dt, frozen) → { speed, run, riding }   one step of walking the way asked for
//     this step (a way nobody asked for is dropped, so a stop is a stop)
//   crew: brains.js’s ({ layout, nav, rand, clock, people, byId, solidsOf, out, routes, world: { you, open, doors } }),
//     routes: the new ways worked out this step, which brains.js sets back to 0 each step

import { DONE, guard, repeat, reset, RUNNING, select, sequence, tick } from '../../../../lib/ai/tree';
import { clear as clearSteer, createContext, interest, resolve, seek, separate } from '../../../../lib/ai/steer';
import { CAST } from './cast';
import { route } from './nav';
import { BODY, stepBody } from './walker';

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
    return repeat(
      select(
        guard((bb) => bb.near(who, 2.4), sequence(face(who), wait([3, 6], 'talk'), wait([2, 4], 'idle'))),
        go(who, { near: 1.6 }),
      ),
    );
  },
  march: (role) => repeat(sequence(...role.spots.map((s) => go(s)))),
  droid: () => repeat(sequence(go({ wander: true }), wait([0.5, 2.5], 'idle'))),
  follow: (role) => {
    const who = { who: role.who };
    return repeat(
      select(
        guard((bb) => bb.near(who, 3), wait(0.5, 'idle')),
        go(who, { near: 2, keepUp: true }),
      ),
    );
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

// ── the legs ──

const TURN = 8; // radians a second anyone turns
const ARRIVE = 0.3; // metres from a waypoint that count as there
const PASS = 0.45; // metres from a door’s middle that count as through it: a shut leaf holds a body 0.35 off
const SPACING = 1.1; // how far people keep from each other
const RIDE = 3; // seconds a lift ride takes (game.js’s)
const STUCK = 2; // seconds without headway before a way is worked out again
const GIVE_UP = 3; // times stuck before the way counts as gone
const RETRY = 3; // seconds before a way that failed is tried again
// New ways worked out a step, crew-wide: a long way across a bay with stairs in it costs tens of
// milliseconds, so a squad setting off at once is spread over a few steps (anyone left waits a step).
const ROUTES = 2;

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
// yaw 0 faces −z, turning towards +x is positive
const yawTo = (p, q) => Math.atan2(q.x - p.x, -(q.z - p.z));
const idle = () => ({ key: null, path: null, i: 0, touched: -1, failedAt: -Infinity, stuck: 0 });
const youOf = (crew, id) => (crew.world.you && (crew.world.you.id ?? 'you') === id ? crew.world.you : null);

export const legsOf = (p) => ({ nav: idle(), want: { yaw: p.yaw, lock: false }, ride: null, ctx: null, wander: null });

export function canPass(crew, p, id, door) {
  const s = crew.world.doors?.[id];
  if (!s) return true;
  if (s.sealed) return false;
  if (!s.locked) return true;
  return door.kind !== 'hatch' && door.lock === 'side:imperial' && p.side === 'imperial';
}

export function placeOf(crew, p, where) {
  if (where == null) return null;
  if (typeof where === 'string') {
    const s = crew.layout.station.spots?.[where];
    return s ? { x: s.x, z: s.z, room: s.room, yaw: s.yaw } : null;
  }
  if (where.who !== undefined) {
    const q = youOf(crew, where.who) ?? crew.byId.get(where.who);
    return q && q.mode !== 'dead' ? { x: q.x, y: q.y, z: q.z, room: q.room } : null;
  }
  if (where.wander) return (p.mind.legs.wander ??= wanderFrom(crew, p));
  if (where.path) return where.path.at(-1);
  if (where.spot !== undefined) return placeOf(crew, p, where.spot);
  return where.room ? where : null;
}

const keyOf = (where, to) => {
  if (typeof where === 'string') return `spot:${where}`;
  if (where.who !== undefined) return `who:${where.who}`;
  return `at:${to.x.toFixed(2)},${to.z.toFixed(2)},${to.room}`;
};

// Somewhere to scurry: a point in this room or, as often as not, the room through one of its doors.
function wanderFrom(crew, p) {
  const { layout, rand } = crew;
  let id = p.room;
  const doors = (layout.rooms.get(id)?.doors ?? []).filter((d) => canPass(crew, p, d, layout.doors.get(d)));
  if (doors.length && rand() < 0.5) {
    const d = layout.doors.get(doors[Math.floor(rand() * doors.length)]);
    id = d.a === id ? d.b : d.a;
  }
  const r = layout.rooms.get(id);
  for (let k = 0; k < 6; k++) {
    const x = r.box.x0 + 0.8 + rand() * Math.max(0, r.box.x1 - r.box.x0 - 1.6);
    const z = r.box.z0 + 0.8 + rand() * Math.max(0, r.box.z1 - r.box.z0 - 1.6);
    const y = layout.floorAt(id, x, z);
    if (y !== null && Math.abs(y - r.y) <= BODY.step && layout.roomAt(x, y + 0.1, z) === id) return { x, z, room: id };
  }
  return { x: p.x, z: p.z, room: p.room };
}

export function walkTo(crew, p, where, { run = false, near = ARRIVE, keepUp = false } = {}) {
  const legs = p.mind.legs;
  const clock = crew.clock;
  const to = placeOf(crew, p, where);
  if (!to?.room) return 'failed';
  const key = keyOf(where, to);
  const nav = legs.nav;
  if (flat(p, to) <= near && (p.room === to.room || near > ARRIVE)) {
    // a station’s spot goes by its name, a furnished one (rules/furnish.js) by the name it carries
    const spot = typeof where === 'string' ? where : where.name;
    if (nav.key === key && nav.path && spot) crew.out.push({ type: 'arrive', id: p.id, spot, room: p.room });
    if (where.wander) legs.wander = null;
    legs.nav = idle();
    return 'done';
  }
  if (nav.key === key && !nav.path && clock - nav.failedAt < RETRY) return 'failed';
  // someone walked towards moves on: the way is worked out again now and then
  const moved = where.who !== undefined && nav.path && flat(nav.path.at(-1), to) > 1.5 && clock - nav.routedAt > 0.5;
  if (nav.key !== key || !nav.path || moved) {
    if (!where.path && crew.routes >= ROUTES) return 'running';
    if (!where.path) crew.routes = (crew.routes ?? 0) + 1;
    const path = where.path ?? route(crew.nav, p, to, { canPass: (id, door) => canPass(crew, p, id, door), solidsOf: crew.solidsOf });
    const stuck = nav.key === key ? nav.stuck : 0;
    if (!path) {
      legs.nav = { ...idle(), key, failedAt: clock, stuck };
      if (where.wander) legs.wander = null;
      return 'failed';
    }
    legs.nav = { key, path, i: 1, routedAt: clock, touched: clock, run: false, failedAt: -Infinity, stuck, checkAt: clock + STUCK, best: Infinity, mark: 1 };
  }
  legs.nav.touched = clock;
  legs.nav.run = run || (keepUp && flat(p, to) > 6);
  return 'running';
}

export function faceTo(crew, p, target) {
  const want = p.mind.legs.want;
  if (typeof target === 'number') {
    want.yaw = target;
    return;
  }
  if (target?.turn !== undefined) {
    const s = placeOf(crew, p, target.spot);
    if (s?.yaw !== undefined) want.yaw = s.yaw + target.turn;
    return;
  }
  const q = placeOf(crew, p, target) ?? (target?.x !== undefined ? target : null);
  if (!q) return;
  // a spot is faced the way it faces; a person or a point is faced towards
  if (target.who === undefined && q.yaw !== undefined) want.yaw = q.yaw;
  else if (flat(p, q) > 1e-6) want.yaw = yawTo(p, q);
}

export function stepLegs(crew, p, dt, frozen = false) {
  const legs = p.mind.legs;
  const clock = crew.clock;
  if (legs.nav.touched !== clock && legs.nav.path) legs.nav = idle();
  let dir = null;
  if (legs.ride) {
    if (clock >= legs.ride.until) ride(crew, p);
  } else if (!frozen && legs.nav.path) dir = follow(crew, p);
  const run = Boolean(dir && legs.nav.run);
  const g = gait((run ? BODY.run : BODY.walk) * (CAST[p.kind].speed ?? 1));
  const was = { x: p.x, z: p.z };
  stepBody(p, { dir: dir ? { x: dir.x * g.len, z: dir.z * g.len } : { x: 0, z: 0 }, run: g.run }, dt, { layout: crew.layout, open: crew.world.open, solids: crew.solidsOf(p.room) });
  const moved = flat(was, p);
  if (dir && moved > 1e-3 && !legs.want.lock) legs.want.yaw = Math.atan2(dir.x, -dir.z);
  const most = TURN * dt;
  p.yaw = wrap(p.yaw + Math.max(-most, Math.min(most, wrap(legs.want.yaw - p.yaw))));
  if (legs.nav.path && !legs.ride) unstick(crew, p);
  return { speed: moved / dt, run, riding: Boolean(legs.ride) };
}

// The walker walks at its walk or its run; a scale on either is a shorter push or the run cut down.
const gait = (speed) => (speed <= BODY.walk + 1e-9 ? { len: speed / BODY.walk, run: false } : { len: Math.min(1, speed / BODY.run), run: true });

// The way on from here: the next waypoint not yet reached, bent round anyone close.
function follow(crew, p) {
  const legs = p.mind.legs;
  const nav = legs.nav;
  const path = nav.path;
  while (nav.i < path.length) {
    const q = path[nav.i];
    if (flat(p, q) > (q.door ? PASS : ARRIVE)) break;
    if (q.lift && path[nav.i + 1]) {
      // the car’s doors aren’t held for a ride nobody else is on: it just takes its time
      legs.ride = { until: crew.clock + RIDE, from: q.room, to: path[nav.i + 1].room };
      nav.i += 2;
      return null;
    }
    nav.i += 1;
  }
  if (nav.i >= path.length) return null;
  const q = path[nav.i];
  const l = flat(p, q) || 1;
  return steerAround(crew, p, { x: (q.x - p.x) / l, z: (q.z - p.z) / l }, q);
}

function ride(crew, p) {
  const { from, to } = p.mind.legs.ride;
  const [a, b] = [crew.layout.rooms.get(from), crew.layout.rooms.get(to)];
  Object.assign(p, { x: p.x + b.x - a.x, y: p.y + b.y - a.y, z: p.z + b.z - a.z, room: to, vy: 0 });
  Object.assign(p.safe, { x: p.x, y: p.y, z: p.z, room: to });
  p.mind.legs.ride = null;
}

// Straight on when nobody is close; else a context map: the way on, a pull to
// the right so two meeting in a corridor pass each other, and danger towards
// anyone within SPACING. A squeeze with no way left is walked straight
// through, as people brush past each other.
function steerAround(crew, p, d, q) {
  const legs = p.mind.legs;
  const others = [];
  const you = crew.world.you;
  for (const o of you ? [...crew.people, you] : crew.people) {
    if (o === p || o.mode === 'dead' || Math.abs(o.y - p.y) > 1 || Math.abs(o.x - p.x) > SPACING || Math.abs(o.z - p.z) > SPACING) continue;
    others.push(o);
  }
  if (!others.length) {
    if (legs.ctx) legs.ctx.blended = false;
    return d;
  }
  const ctx = (legs.ctx ??= createContext(16));
  clearSteer(ctx);
  seek(ctx, p, q, 1, 3);
  interest(ctx, { x: d.x * 0.64 - d.z * 0.77, y: 0, z: d.z * 0.64 + d.x * 0.77 }, 0.6, 2);
  separate(ctx, p, others, SPACING);
  const r = resolve(ctx);
  return r.strength > 0.05 ? { x: r.dir.x, z: r.dir.z } : d;
}

// No headway for a while: the way is worked out afresh; stuck often enough, it is gone.
function unstick(crew, p) {
  const nav = p.mind.legs.nav;
  if (crew.clock < nav.checkAt) return;
  const d = flat(p, nav.path[Math.min(nav.i, nav.path.length - 1)]);
  const headway = nav.i > nav.mark || d < nav.best - 0.3 || nav.i >= nav.path.length;
  Object.assign(nav, { mark: nav.i, best: d, checkAt: crew.clock + STUCK });
  if (headway) {
    nav.stuck = 0;
    return;
  }
  nav.stuck += 1;
  nav.path = null;
  if (nav.stuck >= GIVE_UP) nav.failedAt = crew.clock;
}
