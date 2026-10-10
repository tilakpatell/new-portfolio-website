// The player on the character (lib/physics/character.js): what the walker
// state `st` was moved by, now moved by Rapier. Each frame `step` reads
// the input into an intent (walker.js's walkIntent: the same easing, the
// same jump buffer), holds it for the physics substeps (the hook moves the
// character once a substep), and `sync` writes the character back into
// `st` (its feet, interpolated between substeps; its yaw, its vertical
// speed, whether it stands) so everything downstream that reads the
// walker state is as it was. Whatever else writes `st` straight (a
// respawn, a blink, a roll, the jetpack's lift, the crowd's shove) is
// seen at the next step and carried into the body: a moved position is a
// teleport, a changed vertical speed a jump. The shore and the world's
// edge are the walker's own rules on the intent. Wiring beside scene.js.
//
//   createPlayerBody(sp, st, { rules = WALK }) → {
//     c (the character), st, parked, step(input, dt, rules?) → { jumped, bumped }, sync(st) → landed (the speed it
//     hit the ground at this frame, else 0), teleport(x, y, z, yaw?), bind(st), park() (on a ride: the body out of
//     the world until the next step), knock([x, y, z]), dispose() }
//   sp: surfacePhysics.js's; st: walker.js's walker()

import { CHARACTER, createCharacter } from '../../../lib/physics/character';
import { WALK, shoreStep, walkIntent } from './walker';

const HALF = 0.5; // m: the capsule's half height (with the radius, 1.76 m tall)
const MOVED = 1e-4; // m: a state written by someone else
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function createPlayerBody(sp, first, { rules = WALK } = {}) {
  let st = first;
  const { phys } = sp;
  const stand = HALF + rules.radius + CHARACTER.offset; // the capsule's centre over the feet
  const c = createCharacter(phys, { position: [st.x, st.y + stand, st.z], radius: rules.radius, halfHeight: HALF, turn: rules.turn, gravity: rules.gravity, tag: 'you' });
  c.teleport([st.x, st.y + stand, st.z], st.yaw);
  const intent = { vel: { x: 0, z: 0 }, face: null, jump: 0 };
  const wrote = { x: st.x, y: st.y, z: st.z, vy: st.vy, yaw: st.yaw };
  const pos = [0, 0, 0];
  const prev = [0, 0, 0];
  const here = { x: 0, z: 0 };
  let pending = 0; // a jump asked, m/s, until a substep takes it
  let parked = false; // on a ride: the body out of the world
  let landed = 0;
  let wasGrounded = true;
  let lowest = 0; // the vertical speed just before landing
  const off = phys.onSubstep((dt) => {
    if (parked) return;
    if (pending) {
      c.jump(pending);
      pending = 0;
    }
    lowest = Math.min(lowest, c.vy);
    c.move(intent, dt);
    if (c.grounded && !wasGrounded) {
      landed = -lowest;
      lowest = 0;
    }
    wasGrounded = c.grounded;
  });

  function teleport(x, y, z, yaw = st.yaw) {
    c.teleport([x, y + stand, z], yaw);
    st.x = wrote.x = x;
    st.y = wrote.y = y;
    st.z = wrote.z = z;
    st.yaw = wrote.yaw = yaw;
    st.vy = wrote.vy = 0;
    st.vx = st.vz = 0;
    st.grounded = true;
  }

  return {
    c,
    step(input, dt, r = rules) {
      // what someone else did to the state since the last sync
      if (Math.abs(st.x - wrote.x) > MOVED || Math.abs(st.y - wrote.y) > MOVED || Math.abs(st.z - wrote.z) > MOVED) {
        c.teleport([st.x, st.y + stand, st.z], st.yaw);
        wrote.x = st.x;
        wrote.y = st.y;
        wrote.z = st.z;
      }
      if (parked) {
        // (back from a ride: the body where the state is)
        parked = false;
        c.enable(true);
        c.teleport([st.x, st.y + stand, st.z], st.yaw);
        wrote.x = st.x;
        wrote.y = st.y;
        wrote.z = st.z;
      }
      if (Math.abs(st.vy - wrote.vy) > MOVED) c.jump(st.vy);
      if (Math.abs(st.yaw - wrote.yaw) > MOVED) c.face(st.yaw); // (a turn only: the jump and the knock go on)
      const it = walkIntent(st, input, dt, r);
      let vx = it.vel.x;
      let vz = it.vel.z;
      let bumped = false;
      // the shore, and the edge of the world (the walker's rules, on the
      // ask; from the body's own place, since the state drawn is a substep behind)
      c.position(pos);
      here.x = pos[0];
      here.z = pos[2];
      const nx = here.x + vx * dt;
      const nz = here.z + vz * dt;
      const held = shoreStep(sp.world, here, nx, nz);
      if (held) {
        vx = (held[0] - here.x) / dt;
        vz = (held[1] - here.z) / dt;
        bumped = true;
      }
      const reach = sp.world.reach;
      const far = Math.hypot(nx, nz);
      if (reach && far > reach) {
        const out = (nx * vx + nz * vz) / far; // the part going outward
        const most = (reach - Math.hypot(here.x, here.z)) / dt; // what's left to the edge (back in, past it)
        if (out > most) {
          vx -= ((out - most) * nx) / far;
          vz -= ((out - most) * nz) / far;
          bumped = true;
        }
      }
      intent.vel.x = vx;
      intent.vel.z = vz;
      intent.face = it.face;
      if (it.jump) pending = it.jump;
      landed = 0;
      return { jumped: Boolean(it.jump), landed: 0, bumped };
    },
    sync(s = st) {
      const a = phys.alpha;
      c.position(pos);
      c.prev(prev);
      s.x = prev[0] + (pos[0] - prev[0]) * a;
      s.y = prev[1] + (pos[1] - prev[1]) * a - stand;
      s.z = prev[2] + (pos[2] - prev[2]) * a;
      s.yaw = c.yaw;
      s.grounded = c.grounded;
      s.vy = c.vy;
      s.speed = Math.hypot(pos[0] - prev[0], pos[2] - prev[2]) * 60;
      if (c.blocked) {
        s.vx = (pos[0] - prev[0]) * 60;
        s.vz = (pos[2] - prev[2]) * 60;
      }
      s.air = c.grounded ? 0 : s.air + 1 / 60;
      s.wading = sp.world.water != null ? clamp((sp.world.water - s.y) / rules.wade, 0, 1) : 0;
      wrote.x = s.x;
      wrote.y = s.y;
      wrote.z = s.z;
      wrote.vy = s.vy;
      wrote.yaw = s.yaw;
      return landed;
    },
    teleport,
    get st() {
      return st;
    },
    get parked() {
      return parked;
    },
    // on a ride: the body out of the world (nothing bumps a capsule stood where you mounted)
    park() {
      if (parked) return;
      parked = true;
      c.enable(false);
    },
    // another walker state to carry (you swapped with your crewmate): the body goes to it
    bind(s) {
      st = s;
      teleport(s.x, s.y, s.z, s.yaw);
    },
    knock: (v) => c.knock(v),
    dispose() {
      off();
      c.remove();
    },
  };
}
