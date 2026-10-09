// Whom E talks to, and what the body does when it's pressed: one rule for
// every world. Pure, no three.js: each world keeps its own key and its own
// turn of the body; the target comes from talkTarget, the line and the
// body's answer from onTalk, and the map's greeting from createGreeter.
// (docs/superpowers/specs/2026-10-09-things-in-hand-design.md)
//
// The yaw is the toys' (castRules.motionFrom's): 0 along +x, + turning
// left, ahead (cos yaw, −sin yaw) in x and z; a world facing another way
// converts.
//
//   talkTarget(people, you, { reach = 3, cone = 1.2, facing = null,
//     floor = 3 }) → person | null
//     people: [{ id, x, z, y?, reach?, lines? }] (lines: the lines, or how
//     many there are for a world whose lines live elsewhere; none, an empty
//     list or 0, and they're never a target: the prompt never promises a
//     talk that gives nothing); you: { x, z, y?, yaw? }. Within reach (a
//     person's own `reach` beats it: a Hutt on his dais) and within `floor`
//     of your height (when both have one); facing (else you.yaw): the one
//     nearest the line you face, within `cone` of it, else the nearest.
//   onTalk(person, you, { lines = person.lines, said = person.said ?? 0,
//     hold }) → { line, n, react: { event: 'say', hold, target } | null,
//     look: { x, y, z }, face }
//     line: the next of the lines, round and round; n: said + 1, for the
//     caller to keep on the person; hold: the line's length over 14, 1.5 to
//     6 s; look: your eyes (you.y + you.eyes, 1.55 unless said), on every
//     result, so a line in brackets still looks at you; target: the same
//     point; react null for a line in brackets (what they do, not say) or no
//     line; face: you're more than 1.05 rad off their facing (person.face),
//     past what the neck turns, so the body turns. With a count for `lines`
//     (the text lives with the caller), `line` is the index and the hold is
//     the caller's `hold` (it knows the text), else 2 s.
//   createGreeter({ near = 2.8, far = 4.5 }) → (distance) → true the moment
//     someone comes within `near`, armed again once they're further than
//     `far` (the map's greeting: a wave once as you come near).

const NECK = 1.05; // the most a neck turns before the body does (rad)
const HOLD = [1.5, 6]; // a line's hold (s)
const PER_SECOND = 14; // characters read a second
const EYES = 1.55; // your eyes' height above your feet (m)
const COUNTED = 2; // a counted line's hold when the caller gives none (s)

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const count = (lines) => (Array.isArray(lines) ? lines.length : Number.isFinite(lines) ? Math.max(0, Math.floor(lines)) : 0);
// the yaw from a to b, in the toys' convention
const yawTo = (a, b) => Math.atan2(-(b.z - a.z), b.x - a.x);

export function talkTarget(people, you, { reach = 3, cone = 1.2, facing = null, floor = 3 } = {}) {
  if (!Array.isArray(people) || !you || !Number.isFinite(you.x) || !Number.isFinite(you.z)) return null;
  const yaw = Number.isFinite(facing) ? facing : Number.isFinite(you.yaw) ? you.yaw : null;
  let nearest = null;
  let nd = Infinity;
  let faced = null;
  let fa = Infinity;
  for (const p of people) {
    if (!p || !count(p.lines) || !Number.isFinite(p.x) || !Number.isFinite(p.z)) continue;
    if (Number.isFinite(p.y) && Number.isFinite(you.y) && Math.abs(p.y - you.y) > floor) continue;
    const d = Math.hypot(p.x - you.x, p.z - you.z);
    if (d > (Number.isFinite(p.reach) ? p.reach : reach)) continue;
    if (d < nd) {
      nd = d;
      nearest = p;
    }
    if (yaw == null) continue;
    const off = d < 1e-6 ? 0 : Math.abs(wrap(yawTo(you, p) - yaw));
    if (off <= cone && off < fa) {
      fa = off;
      faced = p;
    }
  }
  return faced ?? nearest;
}

export function onTalk(person, you, { lines = person?.lines, said = person?.said ?? 0, hold } = {}) {
  const k = count(lines);
  const i = k ? ((Math.floor(said) % k) + k) % k : 0;
  const listed = Array.isArray(lines);
  const line = !k ? null : listed ? lines[i] : i;
  const n = said + 1;
  const look = { x: you?.x ?? 0, y: (you?.y ?? 0) + (you?.eyes ?? EYES), z: you?.z ?? 0 };
  let react = null;
  if (line != null && !listed) react = { event: 'say', hold: Number.isFinite(hold) ? hold : COUNTED, target: { ...look } };
  else if (line != null) {
    const words = typeof line === 'string' ? line : String(line);
    if (!words.trimStart().startsWith('(')) react = { event: 'say', hold: clamp(words.length / PER_SECOND, HOLD[0], HOLD[1]), target: { ...look } };
  }
  const face = Boolean(person && you && Number.isFinite(person.face) && Math.hypot(you.x - person.x, you.z - person.z) > 1e-6 && Math.abs(wrap(yawTo(person, you) - person.face)) > NECK);
  return { line, n, react, look, face };
}

export function createGreeter({ near = 2.8, far = 4.5 } = {}) {
  let armed = true;
  return (d) => {
    if (!Number.isFinite(d)) return false;
    if (d > far) armed = true;
    if (armed && d < near) {
      armed = false;
      return true;
    }
    return false;
  };
}
