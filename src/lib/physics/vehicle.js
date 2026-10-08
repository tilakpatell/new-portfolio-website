// His car (folio-2025's PhysicsVehicle.js; research note §2): Rapier's
// ray-cast vehicle controller on a chassis of three boxes, the mass box's
// centre of mass 0.5 m below it (the anti-roll trick) and a massless bumper
// in its own group that shoves props but never touches the ground. Forward
// is +x, up +y, right +z. CAR is his table, verbatim: a world passes its own.
//
// drive() is his pre-physics (a soft top speed, force / (1 + overflow); an
// idle brake that coasts it to a stop; stop before you reverse; boost),
// called once a frame before physics.step; the controller itself updates on
// every fixed substep (physics.onSubstep). measure() is his post-physics,
// called after the step: speed, contact, upside down, stuck.
//
// His force and brake are multiplied by his frame's scaled delta (a quirk of
// tuning at about 1/30 s) and applied by a controller stepped at 1/60 s in a
// world stepped at 1/30 s; ours are his impulse per simulated second, held
// fixed, so the car pulls the same at any frame rate. His soft top speed,
// force / (1 + overflow), barely bites on our fixed step (the car passed
// 11 m/s in 3 s against his 5): ours is force / (1 + 25 × overflow), which
// holds it near 5.5. Speed is his: from the chassis's travel over the
// simulated time since the last measure (the controller's impulses leave
// the body's own velocity reading a few cm/s off at rest). No three.js, no
// DOM.
//
//   CAR: { chassis, friction, wheels, suspensions, steering, engineForce,
//     boost, topSpeed, topSpeedBoost, brake, idleBrake, reverseBrake, unflip }
//   addVehicle(physics, spec = CAR) → { chassis: Body, controller,
//     drive({ throttle −1…1, steer −1…1 (+1 right), brake 0…1, boost 0…1 }),
//     measure() → state, state: { speed, forwardSpeed, goingForward,
//     wheels: [{ contact, point: [x, y, z], suspension }], upsideDown,
//     stuck, flipped }, suspension(i, 'low' | 'mid' | 'high'), unflip(),
//     moveTo(x, y, z, yaw), remove() }

export const CAR = {
  chassis: [
    { shape: 'cuboid', args: [1.3, 0.4, 0.85], position: [0, -0.1, 0], mass: 2.5, centreOfMass: [0, -0.5, 0] },
    { shape: 'cuboid', args: [0.5, 0.15, 0.65], position: [0, 0.4, 0], mass: 0 },
    { shape: 'cuboid', args: [1.5, 0.5, 0.9], position: [0.1, -0.2, 0], mass: 0, group: 'bumper' },
  ],
  friction: 0.4,
  wheels: {
    offset: [0.9, 0, 0.75],
    radius: 0.4,
    frictionSlip: 0.9,
    maxSuspensionForce: 150,
    maxSuspensionTravel: 2,
    sideFrictionStiffness: 3,
    suspensionCompression: 10,
    suspensionRelaxation: 2.7,
    suspensionStiffness: 25,
  },
  // rest length and stiffness: the jump is all four 'high', the low-rider one
  suspensions: { low: [0.88, 20], mid: [1.23, 30], high: [1.63, 40] },
  steering: 0.5,
  engineForce: 300,
  boost: 2,
  topSpeed: 5,
  topSpeedBoost: 40,
  // ours: how hard the soft top speed bites (his is 1; see the header)
  overflowGain: 25,
  brake: 35,
  idleBrake: 0.06,
  reverseBrake: 0.4,
  unflip: { after: 3, force: 5 },
};

// his force and brake are per his frame's scaled delta (1/30 s) but act over
// his controller's 1/60 s: per simulated second, that is this
const HIS_DELTA = 1 / 60;
const STUCK_TIME = 3;
const STUCK_TRAVEL = 0.5;

// v rotated by the quaternion q ([x, y, z, w])
function rotate(q, v) {
  const [qx, qy, qz, qw] = q;
  const [x, y, z] = v;
  const ix = qw * x + qy * z - qz * y;
  const iy = qw * y + qz * x - qx * z;
  const iz = qw * z + qx * y - qy * x;
  const iw = -qx * x - qy * y - qz * z;
  return [ix * qw + iw * -qx + iy * -qz - iz * -qy, iy * qw + iw * -qy + iz * -qx - ix * -qz, iz * qw + iw * -qz + ix * -qy - iy * -qx];
}

export function addVehicle(physics, spec = CAR) {
  const chassis = physics.add({ type: 'dynamic', position: [0, 2, 0], canSleep: false, friction: spec.friction, colliders: spec.chassis });
  const controller = physics.world.createVehicleController(chassis.body);
  const w = spec.wheels;
  const [ox, oy, oz] = w.offset;
  // 0 front right, 1 front left, 2 rear right, 3 rear left
  const corners = [
    [ox, oy, oz],
    [ox, oy, -oz],
    [-ox, oy, oz],
    [-ox, oy, -oz],
  ];
  const named = ['low', 'low', 'low', 'low'];
  for (const [x, y, z] of corners) {
    controller.addWheel({ x, y, z }, { x: 0, y: -1, z: 0 }, { x: 0, y: 0, z: 1 }, spec.suspensions.low[0], w.radius);
  }
  for (let i = 0; i < 4; i++) {
    controller.setWheelFrictionSlip(i, w.frictionSlip);
    controller.setWheelMaxSuspensionForce(i, w.maxSuspensionForce);
    controller.setWheelMaxSuspensionTravel(i, w.maxSuspensionTravel);
    controller.setWheelSideFrictionStiffness(i, w.sideFrictionStiffness);
    controller.setWheelSuspensionCompression(i, w.suspensionCompression);
    controller.setWheelSuspensionRelaxation(i, w.suspensionRelaxation);
    controller.setWheelSuspensionStiffness(i, spec.suspensions.low[1]);
  }
  let simulated = 0; // seconds stepped since the last measure
  const off = physics.onSubstep((dt) => {
    controller.updateVehicle(dt);
    simulated += dt;
  });

  const state = {
    speed: 0,
    forwardSpeed: 0,
    goingForward: true,
    wheels: corners.map(() => ({ contact: false, point: [0, 0, 0], suspension: 0 })),
    upsideDown: false,
    stuck: false,
    flipped: false,
  };
  // the last STUCK_TIME seconds of throttling: [dt, distance] per frame
  let travel = [];
  let throttling = false;
  let last = null;
  let clock = 0;

  function drive({ throttle = 0, steer = 0, brake = 0, boost = 0 } = {}, dt = 1 / 60) {
    clock += dt;
    throttling = Math.abs(throttle) > 0.1;
    const top = spec.topSpeed + (spec.topSpeedBoost - spec.topSpeed) * boost;
    const overflow = Math.max(0, state.speed - top) * spec.overflowGain;
    let force = (throttle * (1 + boost * spec.boost) * spec.engineForce) / (1 + overflow);
    let b = brake;
    if (!brake && !throttling) b = spec.idleBrake;
    // stop before you reverse: an input against the way it rolls brakes
    if (state.speed > 0.5 && throttling && throttle > 0 !== state.goingForward) {
      b = spec.reverseBrake;
      force = 0;
    }
    b *= spec.brake * HIS_DELTA;
    force *= HIS_DELTA;
    for (let i = 0; i < 4; i++) {
      controller.setWheelBrake(i, b);
      controller.setWheelEngineForce(i, force);
      const [rest, stiffness] = spec.suspensions[named[i]];
      controller.setWheelSuspensionRestLength(i, rest);
      controller.setWheelSuspensionStiffness(i, stiffness);
    }
    controller.setWheelSteering(0, -steer * spec.steering);
    controller.setWheelSteering(1, -steer * spec.steering);
  }

  const pos = [0, 0, 0];
  const quat = [0, 0, 0, 1];
  function measure() {
    chassis.quaternion(quat);
    chassis.position(pos);
    const forward = rotate(quat, [1, 0, 0]);
    const up = rotate(quat, [0, 1, 0]);
    if (simulated > 0 && last) {
      const vx = (pos[0] - last[0]) / simulated;
      const vy = (pos[1] - last[1]) / simulated;
      const vz = (pos[2] - last[2]) / simulated;
      state.speed = Math.hypot(vx, vy, vz);
      const ratio = state.speed > 1e-6 ? (vx * forward[0] + vy * forward[1] + vz * forward[2]) / state.speed : 0;
      if (state.speed > 0.04) state.goingForward = ratio > 0.5;
      state.forwardSpeed = state.speed * ratio;
    } else if (!last) {
      state.speed = 0;
      state.forwardSpeed = 0;
    }
    for (let i = 0; i < 4; i++) {
      const s = state.wheels[i];
      s.contact = controller.wheelIsInContact(i);
      const p = controller.wheelContactPoint(i);
      if (p) {
        s.point[0] = p.x;
        s.point[1] = p.y;
        s.point[2] = p.z;
      }
      s.suspension = controller.wheelSuspensionLength(i) ?? 0;
    }
    state.upsideDown = -up[1] * 0.5 + 0.5 > 0.3;
    // stuck: under STUCK_TRAVEL metres in the last STUCK_TIME s of throttling
    const moved = last && simulated > 0 ? Math.hypot(pos[0] - last[0], pos[2] - last[2]) : 0;
    if (simulated > 0 || !last) last = [pos[0], pos[1], pos[2]];
    simulated = 0;
    const now = clock;
    if (throttling) travel.push([now, moved]);
    else travel = [];
    while (travel.length && now - travel[0][0] > STUCK_TIME) travel.shift();
    const span = travel.length ? now - travel[0][0] : 0;
    state.stuck = span >= STUCK_TIME - 0.05 && travel.reduce((a, t) => a + t[1], 0) < STUCK_TRAVEL;
    return state;
  }

  return {
    chassis,
    controller,
    state,
    drive,
    measure,
    suspension(i, name) {
      if (spec.suspensions[name]) named[i] = name;
    },
    // his: a hop up, and a turn by whichever axis points up
    unflip() {
      const body = chassis.body;
      const mass = body.mass();
      chassis.quaternion(quat);
      const forward = rotate(quat, [1, 0, 0]);
      const up = rotate(quat, [0, 1, 0]);
      const side = rotate(quat, [0, 0, 1]);
      body.applyImpulse({ x: 0, y: spec.unflip.force * mass, z: 0 }, true);
      let t;
      if (Math.abs(up[1]) >= Math.abs(forward[1]) && Math.abs(up[1]) >= Math.abs(side[1])) t = [0.8 * mass, 0, 0];
      else t = [side[1] * 0.4 * mass, 0, -forward[1] * 0.8 * mass];
      const [x, y, z] = rotate(quat, t);
      body.applyTorqueImpulse({ x, y, z }, true);
    },
    moveTo(x, y, z, yaw = 0) {
      const body = chassis.body;
      body.setTranslation({ x, y, z }, true);
      body.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      last = null;
      simulated = 0;
      travel = [];
    },
    remove() {
      off();
      physics.world.removeVehicleController(controller);
      physics.remove(chassis);
    },
  };
}
