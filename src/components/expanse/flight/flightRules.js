// The ship's rules on a planet: a kinematic body, no physics engine (the
// ground is read, never collided by Rapier: the spec's “What is not here”).
// Speed between a floor and a ceiling under the throttle; pitch, roll and
// yaw at fixed rates; a bank turns it, as a plane's does, and the wings
// level when let go, so a keyboard alone flies it. Pure, so it's tested.
//
//   SHIP: { speedMin, speedMax, accel, pitchRate, yawRate, rollRate, clearance }
//   stepShip(ship, input, dt) → a new ship ({ x, y, z, pitch, yaw, roll, speed });
//     input: { pitch, yaw, roll, throttle }, each −1…1 (pitch −1: the nose down)
//   forwardOf({ pitch, yaw }) → [x, y, z], the way the nose points (yaw 0: −z)
//   crashed(ship, groundY) → under groundY + clearance (never over NaN: ground not yet in)

export const SHIP = { speedMin: 40, speedMax: 320, accel: 60, pitchRate: 1.2, yawRate: 0.9, rollRate: 2.4, clearance: 3 };

const MAX_PITCH = 1.3; // rad: short of straight up, so the camera never flips over
const MAX_ROLL = 1.1; // rad
const LEVEL = 2.5; // a second: how fast the wings come level, let go
const BANK_TURN = 0.7; // rad a second at full bank

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export const forwardOf = ({ pitch, yaw }) => [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];

export function stepShip(ship, input, dt) {
  const speed = clamp(ship.speed + (input.throttle || 0) * SHIP.accel * dt, SHIP.speedMin, SHIP.speedMax);
  const pitch = clamp(ship.pitch + (input.pitch || 0) * SHIP.pitchRate * dt, -MAX_PITCH, MAX_PITCH);
  let roll = ship.roll;
  if (input.roll) roll = clamp(roll + input.roll * SHIP.rollRate * dt, -MAX_ROLL, MAX_ROLL);
  else roll *= Math.exp(-LEVEL * dt);
  // (a bank to the right, roll > 0, turns to the right: yaw down)
  const yaw = ship.yaw + ((input.yaw || 0) * SHIP.yawRate - Math.sin(roll) * BANK_TURN) * dt;
  const [fx, fy, fz] = forwardOf({ pitch, yaw });
  return { ...ship, x: ship.x + fx * speed * dt, y: ship.y + fy * speed * dt, z: ship.z + fz * speed * dt, pitch, yaw, roll, speed };
}

export const crashed = (ship, groundY) => Number.isFinite(groundY) && ship.y < groundY + SHIP.clearance;
