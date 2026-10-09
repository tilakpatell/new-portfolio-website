// Whom E talks to in a Middle-earth town, and what they say: the towns' side
// of lib/ai/talk.js. A town's people's lines play when you press E to them
// (the prompt says “E Talk · Name”), not as you walk by: walking by gets
// the greeting (cast3d's attend: the look, a wave). The story beats a town's
// rules start on approach still do. Pure, so it's tested in Node.
// (docs/superpowers/specs/2026-10-09-things-in-hand-design.md)
//
// townTalk(cast, you, { spot, reach = 2.8, facing }) → { id, name, lines } | null
//   cast: the town's people here now ([{ id, name, x, z, y?, lines }]);
//   you: { x, z, y?, yaw? } (the toys' yaw: 0 along +x, + turning left);
//   spot: what E would open where you stand (a door, a bench): its
//   distance (a number, or { d }), and it wins when it's nearer than the
//   person (a spot given with no distance always wins): nobody is
//   addressed by a key that opens a door. The one you face
//   within talk.js's cone, else the nearest, within reach; nobody with
//   nothing to say.
// nextLine(pool, counts, id, you, person) → { line, bubble: { id, name,
//   line }, react, face }: the next of `pool` for `id` (counts[id] kept,
//   round and round), the bubble to show, the body's reaction for
//   castReact (null for a line in brackets), and whether the body turns
//   to you (person.face: their yaw).
// promptFor(person) → { verb: 'Talk', thing: name } | null: the prompt's words.

import { onTalk, talkTarget } from '../../lib/ai/talk';

export function townTalk(cast, you, { spot = null, reach = 2.8, facing = null } = {}) {
  // (how far the spot is: none, or one with no distance, which always wins)
  const sd = spot == null || spot === false ? Infinity : typeof spot === 'number' ? spot : Number.isFinite(spot.d) ? spot.d : -Infinity;
  const p = talkTarget(cast, you, { reach, facing });
  if (!p || Math.hypot(p.x - you.x, p.z - you.z) >= sd) return null;
  return { id: p.id, name: p.name, lines: p.lines };
}

export function nextLine(pool, counts, id, you, person = {}) {
  const said = counts[id] ?? 0;
  const out = onTalk({ ...person, lines: pool }, you, { lines: pool, said });
  counts[id] = out.n;
  return { line: out.line, bubble: { id, name: person.name ?? id, line: out.line }, react: out.react, face: out.face };
}

export const promptFor = (person) => (person ? { verb: 'Talk', thing: person.name } : null);
