// How the office's people move and carry themselves, as numbers: for
// ./people.js (the figures the Scranton branch, Albuquerque and the page's
// panels share) and the scenes that place them. A figure standing on its
// feet walks on borrowed clips (lib/three/animator.js), its stride paced to
// the ground it covers, which this measures from where the scene puts it
// each frame; one sitting at a desk keeps its own pose and breathes, talks
// with its hands as its character does, and keeps the habit the show gave
// it (Michael on the phone, Stanley's crossword, Phyllis knitting).
// (docs/superpowers/specs/2026-10-07-living-characters-design.md, W5)
//
// Pure: no three.js, no Math.random.
//
//   GAITS: the paces (m/s) where an office's walk is whole, where it's
//     going over into a run, and where it's all run
//   moveFor(speed, gaits) → locomotion.js's `move` (0…1) for a pace
//   createMotion({ ease, jump }) → { step(x, z, yaw, dt) → { speed, side,
//     turn, move }, reset() }: how a figure the scene places each frame is
//     moving: along its facing (+ ahead), across it (+ its right), turning
//     (+ left, rad/s), each eased over `ease` seconds so a frame's jitter
//     doesn't reach its feet. A jump further than `jump` metres is someone
//     put somewhere, not a step. yaw: a figure's rotation.y (0 along +z,
//     toward +x).
//   seedOf(id, n) → an integer from a name and which copy of it this is
//   TALK: { [who]: [gesture…] } the hands each talks with (people.js's
//     gestures), in the order they come round
//   createManner(who, seed) → { step(dt, talking) → gesture | null }: while
//     they're talking, a gesture of theirs every so often (the first soon),
//     none twice running unless it's all they have
//   HABITS: { [who]: habit } what each does at their desk when they aren't
//     typing; habitAt(habit, t, seed) → { hand, where, amt, wiggle } | null:
//     which hand ('left', 'right' or 'both') goes where ('ear', 'mouth',
//     'chin', 'desk' or 'lap'), how far there it is (0…1, eased in and
//     out), and a small motion while it's there (−1…1: the pen, the needles)

import { bodyFrom } from '../../lib/ai/body';
import { seeded } from '../../lib/seeded';

export const GAITS = { walk: 1.2, jog: 2.2, run: 3.8 };

export function moveFor(speed, { walk = GAITS.walk, jog = GAITS.jog, run = GAITS.run } = {}) {
  const s = Math.abs(Number.isFinite(speed) ? speed : 0);
  if (s <= walk) return (0.3 * s) / walk;
  if (s <= jog) return 0.3 + (0.25 * (s - walk)) / (jog - walk);
  return Math.min(1, 0.55 + (0.35 * (s - jog)) / (run - jog));
}

export function createMotion({ ease = 0.12, jump = 1.5 } = {}) {
  let prev = null;
  const out = { speed: 0, side: 0, turn: 0, move: 0 };
  return {
    step(x, z, yaw, dt) {
      const next = { x, z, yaw };
      const d = dt > 0 ? Math.min(dt, 0.1) : 0;
      let want = { speed: 0, side: 0, turn: 0 };
      const put = !prev || Math.hypot(x - prev.x, z - prev.z) > jump;
      if (!put && dt > 0) want = bodyFrom(prev, next, dt).motion;
      prev = next;
      if (put) {
        out.speed = out.side = out.turn = 0;
      } else if (d > 0) {
        const k = 1 - Math.exp(-d / Math.max(1e-3, ease));
        out.speed += (want.speed - out.speed) * k;
        out.side += (want.side - out.side) * k;
        out.turn += (want.turn - out.turn) * k;
      }
      out.move = moveFor(Math.hypot(out.speed, out.side));
      return out;
    },
    reset() {
      prev = null;
      out.speed = out.side = out.turn = out.move = 0;
    },
  };
}

export function seedOf(id, n = 0) {
  let h = 2166136261;
  for (const ch of String(id)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h + Math.imul(n + 1, 0x9e3779b1)) | 0;
}

// ── talking ──
// How each of them talks, as the show has it: Michael all hands, Dwight
// arms folded and shaking his head, Stanley not moving for anyone, Kelly
// never stopping. (people.js's gestures: nod, shake, shrug, fold, cheer, wave)
export const TALK = {
  michael: ['shrug', 'nod', 'cheer', 'shrug'],
  dwight: ['fold', 'shake', 'nod'],
  jim: ['shrug', 'nod'],
  pam: ['nod', 'shrug'],
  erin: ['nod', 'shrug', 'nod'],
  andy: ['cheer', 'nod', 'shrug'],
  phyllis: ['nod', 'fold'],
  stanley: ['fold', 'shake'],
  angela: ['fold', 'shake'],
  kevin: ['nod', 'shrug'],
  oscar: ['shrug', 'shake', 'nod'],
  creed: ['nod', 'shrug'],
  meredith: ['shrug', 'nod'],
  darryl: ['fold', 'nod'],
  ryan: ['shrug', 'nod'],
  toby: ['shrug', 'nod'],
  kelly: ['nod', 'shrug', 'nod', 'cheer'],
  // Albuquerque's
  saul: ['shrug', 'nod', 'shrug'],
  gus: ['nod'],
  mike: ['fold', 'shake'],
  jesse: ['shrug', 'nod', 'cheer'],
  tuco: ['shake', 'shrug'],
  badger: ['nod', 'shrug'],
  pete: ['nod', 'shrug'],
};
const FIRST = [0.5, 1.1]; // seconds into a talk before the first gesture
const EVERY = [1.5, 2.8]; // and between the rest
const QUIET = { stanley: 2, gus: 2, mike: 1.6 }; // those who move less: their waits, times this

export function createManner(who, seed = seedOf(who)) {
  const list = TALK[who] ?? ['nod', 'shrug'];
  const rand = seeded(seed);
  const span = ([lo, hi]) => (lo + (hi - lo) * rand()) * (QUIET[who] ?? 1);
  let wait = null;
  let i = Math.floor(rand() * list.length);
  let last = null;
  return {
    step(dt, talking) {
      if (!talking) {
        wait = null;
        return null;
      }
      if (wait == null) wait = span(FIRST);
      wait -= dt > 0 ? dt : 0;
      if (wait > 0) return null;
      wait = span(EVERY);
      let g = list[i % list.length];
      i += 1;
      if (g === last && list.length > 1) {
        g = list[i % list.length];
        i += 1;
      }
      last = g;
      return g;
    },
  };
}

// ── at the desk ──
export const HABITS = {
  michael: 'phone', // on the phone (to himself, it sounds like)
  stanley: 'crossword',
  phyllis: 'knit',
  meredith: 'mug',
  kevin: 'snack',
  creed: 'chin',
  pam: 'mug',
  darryl: 'chin',
  toby: 'chin',
  // Albuquerque's
  saul: 'phone',
  mike: null,
};
const SCHEDULE = {
  // every: seconds between, lasts: seconds it goes on (null: always), and the hand and where it goes
  phone: { every: [22, 38], lasts: [7, 12], hand: 'left', where: 'ear' },
  mug: { every: [16, 30], lasts: [2.4, 3.2], hand: 'right', where: 'mouth' },
  snack: { every: [8, 15], lasts: [1.2, 1.7], hand: 'right', where: 'mouth' },
  chin: { every: [18, 34], lasts: [4, 7], hand: 'left', where: 'chin' },
  crossword: { lasts: null, hand: 'right', where: 'desk' },
  knit: { lasts: null, hand: 'both', where: 'lap' },
};
const IN = 0.45; // seconds to get there, and back

export function habitAt(habit, t, seed = 0) {
  const s = SCHEDULE[habit];
  if (!s || !Number.isFinite(t)) return null;
  const r = seeded(seed);
  if (s.lasts == null) {
    // always at it: the pen goes round, the needles in and out, each at its own pace
    const pace = 3.2 + r() * 1.4;
    return { hand: s.hand, where: s.where, amt: 1, wiggle: Math.sin(t * pace + r() * 6.28) };
  }
  // a cycle of its own length, starting somewhere of its own, the habit at its start
  const every = s.every[0] + r() * (s.every[1] - s.every[0]);
  const lasts = s.lasts[0] + r() * (s.lasts[1] - s.lasts[0]);
  const at = (((t + r() * every) % every) + every) % every;
  if (at >= lasts) return null;
  const k = Math.min(1, at / IN, (lasts - at) / IN);
  const amt = k * k * (3 - 2 * k);
  return { hand: s.hand, where: s.where, amt, wiggle: Math.sin(at * 7) };
}
