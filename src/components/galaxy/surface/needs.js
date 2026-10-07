// What the people out on a world want, and whom they know (actors.js's
// `think` takes it from here): a wanderer with `needs` picks a place among
// the site's `wants` (lib/ai/utility's pick: the kinds it needs, nearer
// over farther, not the one it just left, not one it saw lately, a little
// chance), goes there and waits; one with `relations` runs from a kind it
// `fears` when it has seen it (18 m, in sight), and goes after one it
// `chases` (25 m). Pure.
//
//   site.wants: [{ id, kind, at: [x, z], pause? }]
//   spec.needs: [kind…]; spec.fears / spec.chases: [actor kind…]
//   pickWant(spec, wants, b, t, rand) → want | null   (b.visited[id]: when it was last there; b.last: the one before)
//   relate(b, spec, others, t, { seesThrough }) → { flee | chase: { x, z }, until } | null  (and b.flee / b.chase set)

import { consider, cooldown, curve, pick } from '../../../lib/ai/utility';

const REACH = 120; // metres: a want further off isn't wanted
const AGAIN = 240; // seconds before a want visited draws again
const FEAR = 18;
const FLEE = 6;
const CHASE = 25;
const AFTER = 6;

export function pickWant(spec, wants, b, t, rand = Math.random) {
  const needs = spec?.needs;
  if (!needs?.length || !wants?.length) return null;
  const options = wants
    .filter((w) => needs.includes(w.kind) && w.id !== b.last)
    .map((w) => ({
      id: w.id,
      want: w,
      considerations: [
        (c) => consider(Math.hypot(w.at[0] - c.x, w.at[1] - c.z), [0, REACH], curve.inverse),
        (c) => (c.visited[w.id] == null ? 1 : cooldown(c.t - c.visited[w.id], AGAIN)),
        () => 0.7 + 0.3 * rand(),
      ],
    }));
  const best = pick(options, { x: b.x, z: b.z, visited: b.visited ?? {}, t }, { momentum: 0, rand, spread: 0.1 });
  return best ? options.find((o) => o.id === best.id).want : null;
}

export function relate(b, spec, others, t, { seesThrough = null } = {}) {
  if (!spec?.fears?.length && !spec?.chases?.length) return null;
  const me = { x: b.x, z: b.z };
  const nearest = (kinds, within) => {
    let best = null;
    let bd = within;
    for (const o of others ?? []) {
      if (o === b || !kinds?.includes(o.kind)) continue;
      const d = Math.hypot(o.x - me.x, o.z - me.z);
      if (d < bd && (!seesThrough || seesThrough(me, { x: o.x, z: o.z }))) {
        bd = d;
        best = o;
      }
    }
    return best;
  };
  const feared = nearest(spec.fears, FEAR);
  if (feared) {
    b.flee = { from: [feared.x, feared.z], until: t + FLEE };
    return { flee: { x: feared.x, z: feared.z }, until: t + FLEE };
  }
  const prey = nearest(spec.chases, CHASE);
  if (prey) {
    b.chase = { to: [prey.x, prey.z], until: t + AFTER };
    return { chase: { x: prey.x, z: prey.z }, until: t + AFTER };
  }
  return null;
}
