// A duellist's mind: a small state machine that fences. It closes to its
// reach, circles you there a moment, strokes, recovers; when you start a
// stroke within reach of it, it rolls to block (its `guard` rate) and,
// blocking, to parry (its `parry` rate). A parry is a block raised within
// the parry window before your blade's contact (anchored to your contact,
// not your stroke's start, which is what makes a parry read as one: the
// research's §2); it turns your stroke and it ripostes. Pure: numbers in,
// numbers out, so the same seed fences the same way. What it decides is
// drawn by galaxy/surface/duellists.js on a saber (saber.js), whose blade's
// sweep is what lands a stroke.
//
//   DUEL                 the timings: circle [min, max] s, recover [min, max] s, attack (a stroke's
//                        seconds until swung says), combo (the chance it strokes again at once),
//                        window (the parry window, s: combatRules.js's PARRY.window), jump (metres you
//                        may move in a stroke before it's at air), near (how far past its reach it guards),
//                        stagger { hit, heavy, parried, broken } (seconds)
//   createDuellist({ reach, guard, parry, stance, strokes, cadence, seed }) → d (d.at = [x, z]: the caller keeps it);
//                        cadence { stroke: { dur, back } } (a 2017 hero's, stanceFromTable.js's): a stroke held `dur`
//                        until swung says, and the recovery after it its return's `back` seconds, in place of DUEL's
//   duelStep(d, you, dt, rng = d's own) → { state, move: [dx, dz] (0…1 of its pace, world axes), face (yaw to you),
//                        stroke (the clip while it attacks, else null), begin (the frame a stroke starts), block }
//     you: { pos: [x, z], swinging: { contact: [t0, t1], t, speed? } | null (your stroke, t seconds into its clip),
//            dist?, dead? } or null; states approach | circle | attack | recover | block | parry | stagger | dead
//   swung(d, secs)       how long the stroke it began takes (its clip's, at its speed)
//   guarding(d)          'parry' | 'block' | null: what meets your stroke now
//   onHit(d, { heavy, dead }), onParried(d) (stagger 0.6 s, then attack), onGuardBroken(d) (stagger 2 s),
//   onStagger(d, secs, next) (shoved, struck hard: reeling `secs`, then `next` or approach)

export const DUEL = {
  circle: [1, 2],
  recover: [0.35, 0.6],
  attack: 0.9,
  combo: 0.3,
  window: 0.25,
  jump: 6,
  near: 1.5,
  stagger: { hit: 0.3, heavy: 1.2, parried: 0.6, broken: 2 },
};

// (a single blade's strokes, by name, when none are given: combatRules.js's table has the stance's own)
const STROKES = ['sword.light.a', 'sword.light.b', 'sword.light.c', 'sword.a'];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const within = ([a, b], k) => a + (b - a) * k;
// a repeatable roll of its own (Park–Miller), for a duellist given a seed and no rng
const roller = (seed) => {
  let s = Math.abs(Math.round(seed)) % 2147483646 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
};

export function createDuellist({ reach = 2.2, guard = 0.6, parry = 0.35, stance = 'single', strokes = null, cadence = null, seed = 1 } = {}) {
  return {
    reach,
    guard,
    parry,
    stance,
    strokes: strokes?.length ? strokes : STROKES,
    cadence, // { stroke: { dur, back } }: the game's, where its strokes are (null: DUEL's)
    at: [0, 0],
    state: 'approach',
    timer: 0,
    i: 0, // the next stroke of the table
    side: 1, // which way it circles
    face: 0,
    stroke: null, // the clip it's in
    youAt: null, // where you were when its stroke began
    next: null, // what a stagger gives way to
    plan: null, // for your stroke: 'block' | 'parry' | null
    seen: -1, // your stroke's clip time last frame (a smaller one is a new stroke)
    rng: roller(seed),
  };
}

const out = (d, move, extra = {}) => ({ state: d.state, move, face: d.face, stroke: d.stroke, begin: false, block: d.state === 'block' || d.state === 'parry', ...extra });
const STILL = [0, 0];

function attack(d, you) {
  d.state = 'attack';
  d.stroke = d.strokes[d.i % d.strokes.length];
  d.i++;
  d.timer = d.cadence?.[d.stroke]?.dur ?? DUEL.attack;
  d.youAt = you ? [...you.pos] : null;
}
function enter(d, state, timer = 0) {
  d.state = state;
  d.timer = timer;
  d.stroke = null;
}

export function duelStep(d, you, dt, rng = d.rng) {
  if (d.state === 'dead') return out(d, STILL);
  // nobody to fight: whatever it was in, it stands down (Review Focus 5)
  if (!you || you.dead) {
    if (d.state !== 'stagger') enter(d, 'approach');
    d.plan = null;
    d.seen = -1;
    return out(d, STILL);
  }
  const dx = you.pos[0] - d.at[0];
  const dz = you.pos[1] - d.at[1];
  const dist = you.dist ?? Math.hypot(dx, dz);
  const ux = dist > 1e-6 ? dx / dist : 0;
  const uz = dist > 1e-6 ? dz / dist : 1;
  d.face = Math.atan2(dx, dz);
  const toward = [ux, uz];

  if (d.state === 'stagger') {
    d.timer -= dt;
    if (d.timer > 0) return out(d, STILL);
    const next = d.next ?? 'approach';
    d.next = null;
    if (next === 'attack') {
      attack(d, you);
      return out(d, STILL, { begin: true });
    }
    enter(d, 'approach');
  }

  // your stroke: seen as it starts (a clip time smaller than last frame's is a new one)
  const sw = you.swinging;
  if (!sw) d.seen = -1;
  else {
    const fresh = d.seen < 0 || sw.t < d.seen - 1e-6;
    d.seen = sw.t;
    const free = d.state === 'approach' || d.state === 'circle' || d.state === 'recover';
    if (fresh) {
      d.plan = null;
      if (free && dist <= d.reach + DUEL.near && rng() < d.guard) {
        // (too late for a parry once your blade's already in its contact)
        const lead = (sw.contact[0] - sw.t) / (sw.speed ?? 1);
        d.plan = lead >= 0 && rng() < d.parry ? 'parry' : 'block';
      }
    }
    const lead = (sw.contact[0] - sw.t) / (sw.speed ?? 1);
    const past = sw.t > sw.contact[1];
    if (d.plan === 'block' && !past && d.state !== 'block') enter(d, 'block');
    // (a parry waits for the window, then goes up)
    if (d.plan === 'parry' && !past && lead <= DUEL.window && d.state !== 'parry') enter(d, 'parry');
  }
  // the block let down once your contact's passed: a parry ripostes at once
  if ((d.state === 'block' || d.state === 'parry') && (!sw || sw.t > sw.contact[1])) {
    const parried = d.state === 'parry';
    d.plan = null;
    if (parried) {
      attack(d, you);
      return out(d, STILL, { begin: true });
    }
    enter(d, 'circle', within(DUEL.circle, rng()) * 0.4);
  }
  if (d.state === 'block' || d.state === 'parry') return out(d, STILL);

  if (d.state === 'attack') {
    // you went somewhere it can't follow inside a stroke: it's at air, so it stops
    if (d.youAt && Math.hypot(you.pos[0] - d.youAt[0], you.pos[1] - d.youAt[1]) > DUEL.jump) {
      enter(d, 'approach');
      return out(d, toward);
    }
    d.timer -= dt;
    if (d.timer > 0) return out(d, STILL);
    if (dist <= d.reach * 1.3 && rng() < DUEL.combo) {
      attack(d, you);
      return out(d, STILL, { begin: true });
    }
    // (after the game's strike it's open as long as its way back to the guard takes: the punish window)
    const back = d.cadence?.[d.stroke]?.back;
    enter(d, 'recover', back ?? within(DUEL.recover, rng()));
  }
  if (d.state === 'recover') {
    d.timer -= dt;
    if (d.timer > 0) return out(d, [-ux * 0.3, -uz * 0.3]);
    enter(d, 'circle', within(DUEL.circle, rng()));
    d.side = rng() < 0.5 ? -1 : 1;
  }
  if (d.state === 'approach') {
    if (dist > d.reach) return out(d, toward);
    enter(d, 'circle', within(DUEL.circle, rng()));
    d.side = rng() < 0.5 ? -1 : 1;
  }
  // circling: across the line to you, held at its reach
  if (dist > d.reach * 1.6) {
    enter(d, 'approach');
    return out(d, toward);
  }
  d.timer -= dt;
  if (d.timer <= 0) {
    attack(d, you);
    return out(d, STILL, { begin: true });
  }
  const radial = clamp((dist - d.reach) / d.reach, -1, 1);
  const side = [uz * d.side * 0.5, -ux * d.side * 0.5];
  return out(d, [side[0] + ux * radial, side[1] + uz * radial]);
}

export function swung(d, secs) {
  if (d.state === 'attack' && secs > 0) d.timer = secs;
}

export const guarding = (d) => (d.state === 'parry' ? 'parry' : d.state === 'block' ? 'block' : null);

export function onHit(d, { heavy = false, dead = false } = {}) {
  if (d.state === 'dead') return;
  if (dead) {
    enter(d, 'dead');
    return;
  }
  // (a light hit doesn't stop a stroke it's in; a heavy one does)
  if (d.state === 'attack' && !heavy) return;
  onStagger(d, heavy ? DUEL.stagger.heavy : DUEL.stagger.hit);
}

export function onStagger(d, secs, next = null) {
  if (d.state === 'dead') return;
  enter(d, 'stagger', secs);
  d.next = next;
  d.plan = null;
}

export const onParried = (d) => onStagger(d, DUEL.stagger.parried, 'attack');
export const onGuardBroken = (d) => onStagger(d, DUEL.stagger.broken);
