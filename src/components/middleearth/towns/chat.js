// E's talk in a walkable town, for its World.jsx (the rule's in
// ../castTalk.js, on lib/ai/talk.js): who E would talk to now, the line
// when it's pressed and the body's answer, the conversation let go once
// you've walked off, and the dev hooks the browser checks use. Walking by
// someone gets their greeting (cast3d's attend: the look, a wave); E gets
// their line. A spot in reach (a door, a bench) is E's first.
//
// chatFrame(s, cast, { walking, spot, onWho, onEnd }): once a frame. s: the
//   town's sim (s.h the walker: { x, z, face }); cast: who's about now
//   ([{ id, name, x, z, lines, face? }]); spot: how far the spot E would
//   open is (s.near's), when there's one. Sets s.towho (whom E would talk
//   to: { id, name, lines } or null; onWho(who) when that changes, for the
//   prompt), s.near null when they're nearer than the spot (one prompt, one
//   thing E does), and lets s.chat (whom you're talking to) go, with onEnd(), once
//   you're further than KEEP from them or not walking.
// chatTo(s, counts, fig) → nextLine's { line, bubble, react, face } | null:
//   E pressed: s.towho's next line (counts[id] kept, as the towns keep
//   them), s.chat set, the body answering (answer). fig: their figure (a
//   toy or on the cast: on a toy the body's part does nothing).
// answer(fig, said, you): the body's answer: talk on the upper body for
//   the line's length, the head to you (level with its own eyes), and the
//   body round when you're past what its neck turns (attend's rule).
// talkHooks(sim, figure, { behind }): DEV only, window.__talkers() (whom E
//   talks to here: { id, name, x, z, upper(), looking() }) and
//   window.__teleport(x, z, { face }) (the walker put there, facing that
//   point; behind(face) the camera's yaw behind them), for scripts/anim-check.mjs
//   --talk.

import { castDo, castReact } from '../cast3d';
import { nextLine, townTalk } from '../castTalk';

export const KEEP = 3.6; // how far you can go before a conversation's over

const youOf = (s) => ({ x: s.h.x, z: s.h.z, yaw: s.h.face });

export function chatFrame(s, cast, { walking = true, spot = null, onWho = null, onEnd = null } = {}) {
  const you = youOf(s);
  s.cast = cast;
  const who = walking ? townTalk(cast, you, { spot }) : null;
  if ((who?.id ?? null) !== (s.towho?.id ?? null)) onWho?.(who && { id: who.id, name: who.name });
  s.towho = who;
  if (who) s.near = null;
  if (s.chat) {
    const c = walking ? cast.find((x) => x.id === s.chat) : null;
    if (!c || Math.hypot(c.x - you.x, c.z - you.z) > KEEP) {
      s.chat = null;
      onEnd?.();
    }
  }
  return who;
}

export function chatTo(s, counts, fig = null) {
  const p = s.towho;
  if (!p) return null;
  const c = s.cast?.find((x) => x.id === p.id) ?? p;
  const you = youOf(s);
  const face = Number.isFinite(fig?.group?.rotation?.y) ? fig.group.rotation.y : c.face;
  const said = nextLine(p.lines, counts, p.id, you, { ...c, name: p.name, face });
  s.chat = p.id;
  answer(fig, said, you);
  return said;
}

export function answer(fig, said, you) {
  if (!fig || !said) return;
  const at = { x: you.x, z: you.z }; // (no height: level with their own eyes)
  if (said.react) castReact(fig, 'say', { ...said.react, target: at });
  castDo(fig, { look: at });
  if (said.face && fig.cast?.ready) fig.cast.turning = true;
}

export function talkHooks(sim, figure, { behind = null } = {}) {
  if (!import.meta.env.DEV || typeof window === 'undefined') return;
  window.__talkers = () =>
    (sim.current?.cast ?? [])
      .filter((c) => c.lines?.length)
      .map((c) => {
        const f = figure(c.id);
        return { id: c.id, name: c.name, x: c.x, z: c.z, upper: () => f?.cast?.body?.anim.playing('upper') ?? null, looking: () => Boolean(f?.cast?.body?.lookOn) };
      });
  window.__teleport = (x, z, { face = null } = {}) => {
    const s = sim.current;
    if (!s?.h) return;
    s.h.x = x;
    s.h.z = z;
    if (face) s.h.face = Math.atan2(-(face.z - z), face.x - x);
    if (behind) s.yaw = behind(s.h.face);
  };
}
