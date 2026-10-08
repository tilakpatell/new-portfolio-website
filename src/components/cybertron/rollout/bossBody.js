// A Roll out boss on its feet (Megatron, Shockwave, Optimus for the
// Decepticons' last fight, Ultra Magnus as shapes), drawn from the run's
// state; rules.js decides everything, this only says how it looks. It goes
// backward ahead of you at the road's pace with its legs on the ground it
// covers (not a walk run backward at whatever rate), taunts you as it comes
// out, brings its cannon arm up at you through a charge and keeps it there
// through the shots, kicking with each, shouts its Vehicons in and beckons
// its drones, is thrown back when you break its charge and holds its head
// while it's exposed, and goes over on its back when it's beaten.
//
//   createBossBody({ taunt, stride }) → { step(dt, boss, g) → { motion,
//     phase, plays, stop, aim, look } }
//   motion: { move (0…1), speed (+ ahead), side (+ its right) }: metres a
//     second in its own frame. It faces you, so going down the road is
//     going backward, and to its right is −x.
//   phase: its legs' swing for a figure built from shapes, a turn a stride
//     of `stride` metres, going back as it goes backward
//   plays: [{ name, layer, loop, hold }] clips to start this frame, in
//     order; stop: [layer] layers to let go of first
//   aim: 0…1, how far its cannon arm is up at you; look: its head on you

const TAU = Math.PI * 2;
const CANNON = new Set(['fusion', 'beam', 'wave', 'cannon']); // the attacks it shoots, arm up
const CALLS = { reinforce: 'shout', drones: 'beckon' }; // the ones it calls in
const JUMP = 8; // metres in a frame: further is being put somewhere, not going
const RUN_AT = 12; // metres a second for a full run (its run clip from about 11)
const DAZED_AFTER = 0.7; // seconds thrown back before it's holding its head

export function createBossBody({ taunt = 'taunt', stride = 7 } = {}) {
  let seen = null; // the boss it's drawing
  let prev = null;
  let speed = 0;
  let side = 0;
  let phase = 0;
  let aim = 0;
  let attack = null;
  let fired = 0;
  let exposed = 0;
  let hitAt = -1;
  let dazed = false;
  let alive = true;
  let clock = 0;
  return {
    step(dt, b, g) {
      const d = dt > 0 ? Math.min(dt, 0.1) : 0;
      clock += d;
      const plays = [];
      const stop = [];
      if (b !== seen) {
        // a new one (or the first frame of one): nothing carried over, the
        // last one's fall and daze let go of (the model's reused for a run
        // begun again)
        if (seen) stop.push('full', 'upper');
        seen = b;
        prev = null;
        speed = side = aim = fired = exposed = 0;
        attack = b.attack ?? null;
        dazed = false;
        alive = b.alive !== false;
        if (alive && taunt) plays.push({ name: taunt, layer: 'upper' });
      }
      const ease = (k) => 1 - Math.exp(-d * k);
      // beaten: over on its back, the arm down, nothing more
      if (b.alive === false) {
        if (alive) {
          alive = false;
          stop.push('upper');
          plays.push({ name: 'die.back', layer: 'full', hold: true });
        }
        aim += (0 - aim) * ease(6);
        return { motion: { move: 0, speed: 0, side: 0 }, phase, plays, stop, aim, look: false };
      }
      // where it went since the last frame, along the road and across it
      const z = (g?.z ?? 0) + (b.dz ?? 0);
      const x = b.x ?? 0;
      if (prev && d > 0 && Math.hypot(z - prev.z, x - prev.x) < JUMP) {
        speed += (-(z - prev.z) / d - speed) * ease(10);
        side += (-(x - prev.x) / d - side) * ease(10);
      } else if (!prev || d > 0) speed = side = 0;
      prev = { z, x };
      const ground = Math.hypot(speed, side);
      phase += (speed < 0 ? -1 : 1) * ((ground * d) / Math.max(0.5, stride)) * TAU;
      // what it's doing
      const a = b.attack ?? null;
      if (a !== attack) {
        attack = a;
        fired = 0;
        if (a && CALLS[a.type]) plays.push({ name: CALLS[a.type], layer: 'upper' });
      }
      const shooting = Boolean(a && CANNON.has(a.type));
      if (shooting && (a.fired ?? 0) > fired) {
        fired = a.fired;
        plays.push({ name: 'shoot', layer: 'upper' });
      }
      // its charge broken: thrown back, then dazed till it's up again
      const now = b.exposed ?? 0;
      if (now > 0 && !(exposed > 0)) {
        hitAt = clock;
        dazed = false;
        plays.push({ name: 'hit.chest', layer: 'upper' });
      }
      if (now > 0 && !dazed && clock - hitAt >= DAZED_AFTER) {
        dazed = true;
        plays.push({ name: 'headache', layer: 'upper', loop: true });
      }
      if (!(now > 0) && exposed > 0 && dazed) {
        dazed = false;
        stop.push('upper');
      }
      exposed = now;
      aim += ((shooting && !(now > 0) ? 1 : 0) - aim) * ease(5);
      return { motion: { move: Math.min(1, ground / RUN_AT), speed, side }, phase, plays, stop, aim, look: true };
    },
  };
}
