// Mario: his state and the action machine that runs him, one frame at a
// time at 30 frames a second, in the original's units and numbers. Each
// action is a function in ./moves (ground.js, air.js, water.js, carry.js)
// that reads the input, moves him through ./physics.js and may hand over to
// another action, which then runs in the same frame, as the original does.
// What happened (jumps, landings, punches, hurts…) comes back as events for
// the sounds and the game.
//
// newMario({ x, y, z, yaw }) → m; stepMario(m, inp, world) → events, where
// inp = { sx, sy (the stick, −1…1, up is +), a, ap, b, bp, z, zp (held and
// pressed), walk, camYaw }.

import { findFloor } from './collide';
import { AIR } from './moves/air';
import { GROUND } from './moves/ground';
import { MAX_HEALTH, ride, setAction } from './physics';
import { wrapAngle } from './vec';

export { MAX_HEALTH };
export { airStep, die, groundStep, heal, hurt, setAction } from './physics';

export const START_LIVES = 4;

export function newMario({ x, y, z, yaw = 0 }) {
  return {
    pos: { x, y, z },
    vel: { x: 0, y: 0, z: 0 },
    fwd: 0,
    yaw,
    action: 'idle',
    prev: 'idle',
    arg: 0,
    t: 0,
    health: MAX_HEALTH,
    lives: START_LIVES,
    coins: 0,
    air: MAX_HEALTH,
    floor: null,
    floorY: y,
    wall: null,
    held: null,
    invuln: 0,
    peakY: y,
    chain: { n: 0, t: 99 },
    mag: 0,
    iyaw: yaw,
    events: [],
    cutJump: false,
    airborne: false,
    attack: null,
    placed: false,
  };
}

// the stick, as how hard (0…1) and which way in the world, seen from the camera
export function intent(inp, camYaw) {
  let mag = Math.min(1, Math.hypot(inp.sx, inp.sy));
  if (mag < 0.05) return { mag: 0, yaw: camYaw };
  if (inp.walk) mag *= 0.5;
  return { mag, yaw: wrapAngle(camYaw + Math.atan2(-inp.sx, inp.sy)) };
}

const ACTIONS = { ...GROUND, ...AIR };
export const ACTION_NAMES = Object.keys(ACTIONS);

// at the start: on the floor below if there is one close, falling otherwise
function place(m, w) {
  m.placed = true;
  const f = findFloor(w, m.pos.x, m.pos.y, m.pos.z);
  if (f && m.pos.y - f.y < 4) {
    m.pos.y = f.y;
    m.floor = f.surf;
    m.floorY = f.y;
    return;
  }
  m.airborne = true;
  setAction(m, 'freefall');
}

export function stepMario(m, input, w) {
  m.events = [];
  const inp = { ...input };
  if (!m.placed) place(m, w);
  const it = intent(inp, inp.camYaw ?? 0);
  m.mag = it.mag;
  m.iyaw = it.yaw;
  if (m.invuln > 0) m.invuln--;
  m.chain.t++;
  m.attack = null;
  ride(m);
  // an action that hands over runs the next one in the same frame (a few at most)
  for (let i = 0; i < 4; i++) {
    const fn = ACTIONS[m.action];
    if (!fn) throw new Error(`no action ${m.action}`);
    if (!fn(m, inp, w)) break;
  }
  m.t++;
  return m.events;
}
