// A behaviour tree in a few lines, for a brain whose shape is a script (an
// inspector's pull-over: come alongside, say hello, wait for you to stop or
// turn hostile). Leaves are plain functions (bb, dt) → 'running' | 'done' |
// 'failed' over a blackboard `bb` (the brain's own notes); the composites
// are the usual ones, and `utility` runs utility.pick over its options and
// ticks the winner, so a choice can be a weighing. One tree serves every
// agent: each node's state lives in the blackboard under its number, so a
// sequence resumes where it was instead of walking from the root each
// frame. Pure.
//
//   sequence(...nodes), select(...nodes), parallel(...nodes)
//   guard(test(bb), node), cooldown(seconds, node, key), repeat(node)
//   utility(options, nodesById, pickOpts) (options: utility.js's, with ids naming nodesById's keys)
//   tick(node, bb, dt) → status; reset(node, bb)
// `bb.clock` is the caller's clock in seconds (a cooldown reads it).

import { pick } from './utility';

export const RUNNING = 'running';
export const DONE = 'done';
export const FAILED = 'failed';

let ids = 0;
const node = (kind, children, extra = {}) => ({ id: ids++, kind, children, ...extra });
const state = (bb, n) => ((bb._tree ??= {})[n.id] ??= {});
const leaf = (fn) => (typeof fn === 'function' ? node('leaf', [], { fn }) : fn);

export const sequence = (...nodes) => node('sequence', nodes.map(leaf));
export const select = (...nodes) => node('select', nodes.map(leaf));
export const parallel = (...nodes) => node('parallel', nodes.map(leaf));
export const guard = (test, child) => node('guard', [leaf(child)], { test });
export const cooldown = (seconds, child, key = `cool${ids}`) => node('cooldown', [leaf(child)], { seconds, key });
export const repeat = (child) => node('repeat', [leaf(child)]);
export const utility = (options, nodesById, pickOpts = {}) => node('utility', [], { options, nodesById: Object.fromEntries(Object.entries(nodesById).map(([k, v]) => [k, leaf(v)])), pickOpts });

export function reset(n, bb) {
  if (bb._tree) delete bb._tree[n.id];
  for (const c of n.children) reset(c, bb);
  if (n.nodesById) for (const c of Object.values(n.nodesById)) reset(c, bb);
}

export function tick(n, bb, dt) {
  switch (n.kind) {
    case 'leaf':
      return n.fn(bb, dt) ?? DONE;
    case 'sequence':
    case 'select': {
      const s = state(bb, n);
      s.i ??= 0;
      const stopAt = n.kind === 'sequence' ? FAILED : DONE;
      while (s.i < n.children.length) {
        const r = tick(n.children[s.i], bb, dt);
        if (r === RUNNING) return RUNNING;
        if (r === stopAt) {
          reset(n, bb);
          return r;
        }
        s.i += 1;
      }
      reset(n, bb);
      return n.kind === 'sequence' ? DONE : FAILED;
    }
    case 'parallel': {
      let done = true;
      for (const c of n.children) {
        const r = tick(c, bb, dt);
        if (r === FAILED) {
          reset(n, bb);
          return FAILED;
        }
        if (r === RUNNING) done = false;
      }
      if (done) reset(n, bb);
      return done ? DONE : RUNNING;
    }
    case 'guard':
      if (!n.test(bb)) {
        reset(n, bb);
        return FAILED;
      }
      return tick(n.children[0], bb, dt);
    case 'cooldown': {
      const since = bb[n.key];
      if (since != null && (bb.clock ?? 0) - since < n.seconds) return FAILED;
      const r = tick(n.children[0], bb, dt);
      if (r !== RUNNING) bb[n.key] = bb.clock ?? 0;
      return r;
    }
    case 'repeat': {
      const r = tick(n.children[0], bb, dt);
      return r === FAILED ? FAILED : RUNNING;
    }
    case 'utility': {
      const s = state(bb, n);
      const out = pick(n.options, bb, { current: s.chosen ?? null, ...n.pickOpts });
      if (!out) {
        reset(n, bb);
        return FAILED;
      }
      if (s.chosen && s.chosen !== out.id) reset(n.nodesById[s.chosen], bb);
      s.chosen = out.id;
      const r = tick(n.nodesById[out.id], bb, dt);
      if (r !== RUNNING) s.chosen = null;
      return r;
    }
    default:
      throw new Error(`tree: unknown node ${n.kind}`);
  }
}
