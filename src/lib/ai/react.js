// What happens to a body: the reactions a figure plays to what happens
// around it (you come near, it's hit, it goes down, it hears gunfire, its
// side wins), from a table every world gets and can override. Each event
// has a cooldown (utility's: it can't be chosen again at once) and a
// chance, rolled once each time the cooldown's over and cooling down again
// whether it hit or missed, so a reaction is never twice in a row, one
// asked every frame doesn't keep rolling until it lands, and a crowd's
// reactions spread out (give each figure its own seeded rand). Pure, no
// three.js: the caller plays what comes back on its animator.
//
//   REACTIONS: { [event]: { cooldown = 0, chance = 1, react(ctx, kit) → reaction | null } } (the spec's table)
//   createReactions(table = REACTIONS, { rand, has }) → { on(event, ctx) → reaction | null }
//     ctx: { t (seconds, the caller's clock), dir?, force? (0…1), moving?, target?, where?, hold?, yaw? }
//     dir: the way a hit travels, in the figure's frame (+z ahead, +x its left: yaw 0's), or
//     in the world's if `yaw` (the figure's) is given; where: 'head' | 'chest'; hold: a line's length
//     has(clip) → bool: the clips the figure has (absent: every one)
//     kit: { rand, has, first(names) → the first the figure has (else the last), any(names) → a random one it has }
//   reaction: { clip, layer: 'full' | 'upper', hold, look, then?, cut? }
//     hold: false a one-shot, true held on its last frame (down), a number looped that
//     many seconds (a line's talk); look: the ctx's target, or null; then: the clip
//     held after (the aim after a shot); cut: seconds in, where it stops (a start)

import { seeded } from '../seeded';
import { cooldown } from './utility';

// the upper layer while moving (the legs keep walking), else the whole body
const byMoving = (ctx) => (ctx.moving ? 'upper' : 'full');
const lookAt = (ctx) => ctx.target ?? null;

// the hit's direction in the figure's own frame: which way it falls
function fallOf(ctx) {
  const d = ctx.dir;
  if (!d || !Number.isFinite(d.x) || !Number.isFinite(d.z)) return null;
  let ahead = d.z;
  if (Number.isFinite(ctx.yaw)) ahead = d.x * Math.sin(ctx.yaw) + d.z * Math.cos(ctx.yaw);
  return ahead >= 0 ? 'die.fwd' : 'die.back';
}

// The site's defaults (the spec's "react.js: what happens to it").
export const REACTIONS = {
  // you come within a few metres, it knows you or talks: a wave, looking at you
  greet: { cooldown: 20, chance: 0.6, react: (ctx) => ({ clip: 'wave', layer: 'upper', hold: false, look: lookAt(ctx) }) },
  // a line of its plays, voiced or a bubble: talk for the line's length, looking at whom it says it to
  say: { react: (ctx) => ({ clip: 'talk', layer: 'upper', hold: ctx.hold ?? 2, look: lookAt(ctx) }) },
  // the chest or the head by where; on the upper layer while moving
  hit: { cooldown: 0.25, react: (ctx) => ({ clip: ctx.where === 'head' ? 'hit.head' : 'hit.chest', layer: byMoving(ctx), hold: false, look: null }) },
  // forward, back or blown by the hit's direction and force, else a fall, else a death; never nothing
  down: {
    react: (ctx, { first }) => {
      const way = (ctx.force ?? 0) > 0.8 ? 'die.blown' : fallOf(ctx);
      return { clip: first(way ? [way, 'fall', 'die'] : ['fall', 'die']), layer: 'full', hold: true, look: null };
    },
  },
  // gunfire near, or a feared kind seen: scared, then its brain flees
  gunfire: { cooldown: 4, react: (ctx) => ({ clip: 'scared', layer: byMoving(ctx), hold: false, look: lookAt(ctx) }) },
  // its side took the post, the duel's over, the quest's done
  win: { cooldown: 6, react: (ctx, { any }) => ({ clip: any(['cheer', 'happy', 'taunt']), layer: byMoving(ctx), hold: false, look: null }) },
  // the pistol's shot on the upper layer, the aim held after (a world's own aim overrides the row)
  fire: { react: (ctx) => ({ clip: 'shoot.pistol', layer: 'upper', hold: false, look: lookAt(ctx), then: 'aim.pistol' }) },
  // a watcher reaches you
  caught: { cooldown: 1, react: (ctx) => ({ clip: 'jab', layer: byMoving(ctx), hold: false, look: lookAt(ctx) }) },
  // a watcher sees you: a point once the figure has one, else a sharp look and hit.head's first frames as a start
  alert: {
    cooldown: 3,
    react: (ctx, { has }) =>
      has('point', false) ? { clip: 'point', layer: 'upper', hold: false, look: lookAt(ctx) } : { clip: 'hit.head', layer: 'upper', hold: false, look: lookAt(ctx), cut: 0.3 },
  },
};

export function createReactions(table = REACTIONS, { rand = seeded(1), has = null } = {}) {
  const last = {};
  // has(name, dflt): what the figure has, or `dflt` when the caller didn't say
  const hasClip = (name, dflt = true) => (has ? !!has(name) : dflt);
  const kit = {
    rand,
    has: hasClip,
    first: (names) => names.find((n) => hasClip(n)) ?? names[names.length - 1],
    any: (names) => {
      const got = names.filter((n) => hasClip(n));
      const from = got.length ? got : names;
      return from[Math.min(from.length - 1, Math.floor(rand() * from.length))];
    },
  };
  return {
    on(event, ctx = {}) {
      const row = table?.[event];
      if (!row?.react) return null;
      const t = ctx.t ?? 0;
      if (cooldown(t - (last[event] ?? -Infinity), row.cooldown ?? 0) < 1) return null;
      const chance = row.chance ?? 1;
      if (chance < 1) {
        last[event] = t;
        if (rand() >= chance) return null;
      }
      const out = row.react(ctx, kit);
      if (!out?.clip) return null;
      last[event] = t;
      return { clip: out.clip, layer: out.layer ?? 'full', hold: out.hold ?? false, look: out.look ?? null, ...(out.then ? { then: out.then } : {}), ...(out.cut != null ? { cut: out.cut } : {}) };
    },
  };
}
