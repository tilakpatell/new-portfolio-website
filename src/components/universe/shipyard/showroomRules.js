// The showroom's sums (showroom.js draws; these are tested in Node): how far
// back the camera stands for the canvas's shape, the hardpoint's pulse, and
// how far a drag turns the ship.

export const FPS = 30; // (the yard's a still life: no need to draw faster)
const MARGIN = 1.35; // (room round the ship, so a wing or a booster isn't cut)
const PULSE = 1.2; // seconds a pulse takes, up and back
const TURN = 0.012; // radians a pixel of drag turns it

// The distance at which a ship `length` long fits a canvas of this aspect
// (width / height) under a vertical field of view of `fov` degrees: a tall
// canvas fits it on its width, so the camera backs off.
export function fitDistance(aspect, length, fov) {
  const half = Math.tan(((fov / 2) * Math.PI) / 180);
  return (length * MARGIN) / (2 * half * Math.min(1, aspect));
}

// The pulse on a hardpoint pointed at: 0 at rest, up to 1 and back, 0…1.
export const pulseAt = (t) => 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / PULSE);

export const yawFromDrag = (dx) => dx * TURN;
