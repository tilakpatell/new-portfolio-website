// The small rules of life on foot at a landing, kept pure so they're
// tested without a scene: when someone standing by their ship greets you
// and talks while their line's shown; how your mate keeps up without
// shuffling on the spot; what a hit does to the mate and how long it stays
// down; and what your body says to the other pilots over the wire (an
// emote, a flinch, a fall) beside where you are. footScene.js and
// landings/people.js call these; nothing here knows three.js.
//
//   saidFor(line) → seconds a line's talked for (its words, within bounds)
//   greetStep(st, { d, r, t, line }) → { st, wave, talk, look }
//     d: metres to the player, r: the figure's say radius; wave: this frame,
//     talk: seconds to talk (0 none), look: whether to look at the player
//   followMove(gap, st, { stop, start, far }) → { move, run, st }
//     gap: metres to the spot behind the player; with hysteresis, so the
//     mate neither overshoots and turns back nor twitches at the edge
//   mateHit(st, damage, t) → st   { health, hitAt, downAt }; mateStand(st, t) → st
//   walkerExtras({ emote, t, hitAt, down }) → { e?, hurt?, down? } for the wire
//   readWalkerExtras(w) → { emote (the wire's packet), hurt, down } from one,
//     older clients' packets reading as none

import { emotePacket } from '../../lib/emote';

export const GREET = { cooldown: 20, look: 8, talkAfter: 0.5 };
export const FOLLOW = { stop: 0.5, start: 1.3, far: 4, ease: 2 };
export const MATE = { health: 100, down: 4, heal: 12 };

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// how long a line is said for: a word a third of a second, and a breath
export function saidFor(line) {
  if (typeof line !== 'string' || !line.trim()) return 0;
  const words = line.trim().split(/\s+/).length;
  return clamp(1.2 + words * 0.32, 1.8, 9);
}

// A figure by its ship as you come and go: it looks at you while you're
// near enough to see you (GREET.look metres), waves the first time you come
// within its say radius (not again for GREET.cooldown seconds), and talks
// with its hands for as long as its line is shown.
export function greetStep(st = {}, { d = Infinity, r = 3, t = 0, line = null } = {}) {
  const near = d <= r;
  const next = { near, wavedAt: st.wavedAt ?? -Infinity };
  let wave = false;
  let talk = 0;
  if (near && !st.near && t - next.wavedAt >= GREET.cooldown) {
    wave = true;
    next.wavedAt = t;
    talk = saidFor(line);
  }
  return { st: next, wave, talk, look: d <= Math.max(GREET.look, r) };
}

// The mate's pace toward the spot behind you: off once the gap's past
// `start`, on till it's under `stop`, slowing in over the last couple of
// metres so it arrives rather than overshoots; running when far behind.
export function followMove(gap, st = {}, { stop = FOLLOW.stop, start = FOLLOW.start, far = FOLLOW.far, ease = FOLLOW.ease } = {}) {
  let going = Boolean(st.going);
  if (!going && gap > start) going = true;
  else if (going && gap < stop) going = false;
  const move = going ? clamp((gap - stop) / ease, 0.3, 1) : 0;
  return { move, run: going && gap > far, st: { going } };
}

// A hit on the mate: health off, a flinch from now, and down when it's
// gone (for MATE.down seconds, then back up and whole: a mate doesn't die)
export function mateHit(st = {}, damage = 0, t = 0) {
  if (st.downAt != null) return st;
  const health = Math.max(0, (st.health ?? MATE.health) - Math.max(0, num(damage)));
  return { ...st, health, hitAt: t, downAt: health <= 0 ? t : null };
}
export function mateStand(st = {}, t = 0, dt = 0) {
  if (st.downAt != null) return t - st.downAt >= MATE.down ? { ...st, health: MATE.health, downAt: null, upAt: t } : st;
  const health = st.health ?? MATE.health;
  if (health < MATE.health && t - (st.hitAt ?? -Infinity) > 4) return { ...st, health: Math.min(MATE.health, health + MATE.heal * dt) };
  return st;
}
// how far down the mate is this frame (0 up … 1 flat): over in a second, up again over the last
export function mateDown(st = {}, t = 0) {
  if (st.downAt == null) return 0;
  const k = t - st.downAt;
  return clamp(k / 0.95, 0, 1) * (1 - clamp((k - (MATE.down - 0.7)) / 0.7, 0, 1));
}

// ── the wire ──
export function walkerExtras({ emote = null, t = 0, hitAt = -Infinity, down = 0 } = {}) {
  const out = {};
  const e = emotePacket(emote, t);
  if (e) out.e = e;
  const hurt = clamp(1 - (t - hitAt) / 0.4, 0, 1);
  if (hurt > 0) out.hurt = Math.round(hurt * 100) / 100;
  if (down > 0) out.down = Math.round(clamp(down, 0, 1) * 100) / 100;
  return out;
}
export function readWalkerExtras(w) {
  return { emote: Array.isArray(w?.e) ? w.e : null, hurt: clamp(num(w?.hurt), 0, 1), down: clamp(num(w?.down), 0, 1) };
}
