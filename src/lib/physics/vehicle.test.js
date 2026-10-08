import { describe, expect, it } from 'vitest';
import { createPhysics } from './world';
import { addHeightfield } from './heightfield';
import { CAR, addVehicle } from './vehicle';

// a flat world 192 m square, and a car on it
async function flatWorld() {
  const physics = await createPhysics();
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) addHeightfield(physics, { heights: new Float32Array(65 * 65), x: i * 64 - 32, z: j * 64 - 32 });
  return physics;
}
const run = (physics, car, steps, input = {}) => {
  for (let i = 0; i < steps; i++) {
    car.drive({ throttle: 0, steer: 0, brake: 0, boost: 0, ...input }, 1 / 60);
    physics.step(1 / 60);
    car.measure();
  }
};
const settle = async () => {
  const physics = await flatWorld();
  const car = addVehicle(physics);
  car.moveTo(0, 3, 0, 0);
  run(physics, car, 120);
  return { physics, car };
};

describe('CAR', () => {
  it('is his table', () => {
    expect(CAR.chassis).toEqual([
      { shape: 'cuboid', args: [1.3, 0.4, 0.85], position: [0, -0.1, 0], mass: 2.5, centreOfMass: [0, -0.5, 0] },
      { shape: 'cuboid', args: [0.5, 0.15, 0.65], position: [0, 0.4, 0], mass: 0 },
      { shape: 'cuboid', args: [1.5, 0.5, 0.9], position: [0.1, -0.2, 0], mass: 0, group: 'bumper' },
    ]);
    expect(CAR.wheels).toMatchObject({ offset: [0.9, 0, 0.75], radius: 0.4, frictionSlip: 0.9, maxSuspensionForce: 150, maxSuspensionTravel: 2, sideFrictionStiffness: 3, suspensionCompression: 10, suspensionRelaxation: 2.7, suspensionStiffness: 25 });
    expect(CAR.suspensions).toEqual({ low: [0.88, 20], mid: [1.23, 30], high: [1.63, 40] });
    expect(CAR).toMatchObject({ friction: 0.4, steering: 0.5, engineForce: 300, boost: 2, topSpeed: 5, topSpeedBoost: 40, brake: 35, idleBrake: 0.06, reverseBrake: 0.4, unflip: { after: 3, force: 5 } });
  });
});

describe('addVehicle on the flat', () => {
  it('rests on four wheels, steady', async () => {
    const { physics, car } = await settle();
    expect(car.state.wheels.map((w) => w.contact)).toEqual([true, true, true, true]);
    const rest = car.chassis.position()[1];
    expect(rest).toBeGreaterThan(0.5);
    run(physics, car, 60);
    expect(Math.abs(car.chassis.position()[1] - rest)).toBeLessThan(1e-3);
    expect(car.state.upsideDown).toBe(false);
    expect(car.state.speed).toBeLessThan(0.05);
    physics.dispose();
  });

  it('reaches his top speed at full throttle, forward along +x', async () => {
    const { physics, car } = await settle();
    run(physics, car, 180, { throttle: 1 });
    expect(car.state.speed).toBeGreaterThan(4);
    expect(car.state.speed).toBeLessThan(6);
    expect(car.state.goingForward).toBe(true);
    expect(car.state.forwardSpeed).toBeGreaterThan(4);
    expect(car.chassis.position()[0]).toBeGreaterThan(5);
    expect(Math.abs(car.chassis.position()[2])).toBeLessThan(1);
    // and the brake stops it within 2 s
    run(physics, car, 120, { brake: 1 });
    expect(car.state.speed).toBeLessThan(0.1);
    physics.dispose();
  });

  it('goes faster with the boost', async () => {
    const { physics, car } = await settle();
    run(physics, car, 180, { throttle: 1, boost: 1 });
    expect(car.state.speed).toBeGreaterThan(6);
    physics.dispose();
  });

  it('coasts to a stop on the idle brake', async () => {
    const { physics, car } = await settle();
    run(physics, car, 120, { throttle: 1 });
    run(physics, car, 600);
    expect(car.state.speed).toBeLessThan(0.1);
    physics.dispose();
  });

  it('must stop before it reverses', async () => {
    const { physics, car } = await settle();
    run(physics, car, 120, { throttle: 1 });
    expect(car.state.speed).toBeGreaterThan(0.5);
    let reversed = false;
    for (let i = 0; i < 240; i++) {
      run(physics, car, 1, { throttle: -1 });
      if (car.state.forwardSpeed < -0.2) {
        reversed = true;
        break;
      }
      // while it still rolls forward, nothing pushes it back
      if (car.state.speed > 0.5) expect(car.controller.wheelEngineForce(0)).toBe(0);
    }
    expect(reversed).toBe(true);
    physics.dispose();
  });

  it('turns right on a right steer (toward +z)', async () => {
    const { physics, car } = await settle();
    run(physics, car, 180, { throttle: 1, steer: 1 });
    expect(car.chassis.position()[2]).toBeGreaterThan(1);
    physics.dispose();
  });

  it('rights itself with unflip', async () => {
    const physics = await flatWorld();
    const car = addVehicle(physics);
    car.moveTo(0, 2, 0, 0);
    car.chassis.body.setRotation({ x: 1, y: 0, z: 0, w: 0 }, true);
    run(physics, car, 120);
    expect(car.state.upsideDown).toBe(true);
    car.unflip();
    let upright = false;
    for (let i = 0; i < 90 && !upright; i++) {
      run(physics, car, 1);
      upright = !car.state.upsideDown;
    }
    expect(upright).toBe(true);
    physics.dispose();
  });

  it('jumps on its high suspension, held for a tap (0.1 s)', async () => {
    const { physics, car } = await settle();
    const rest = car.chassis.position()[1];
    for (let i = 0; i < 4; i++) car.suspension(i, 'high');
    run(physics, car, 6);
    for (let i = 0; i < 4; i++) car.suspension(i, 'low');
    let top = rest;
    for (let i = 0; i < 30; i++) {
      run(physics, car, 1);
      top = Math.max(top, car.chassis.position()[1]);
    }
    expect(top - rest).toBeGreaterThan(0.3);
    physics.dispose();
  });

  it('moves to a place, still', async () => {
    const { physics, car } = await settle();
    run(physics, car, 60, { throttle: 1 });
    car.moveTo(10, 4, -5, Math.PI / 2);
    expect(car.chassis.position()).toEqual([10, 4, -5]);
    const v = car.chassis.body.linvel();
    expect([v.x, v.y, v.z]).toEqual([0, 0, 0]);
    // facing: yaw π/2 turns +x to −z
    const q = car.chassis.quaternion();
    expect(q[1]).toBeCloseTo(Math.SQRT1_2, 5);
    physics.dispose();
  });

  it('knows it is stuck after 3 s throttling without getting anywhere', async () => {
    const physics = await flatWorld();
    physics.add({ type: 'fixed', position: [2.0, 1, 0], group: 'floor', colliders: [{ shape: 'cuboid', args: [0.5, 3, 5] }] });
    const car = addVehicle(physics);
    car.moveTo(0, 2, 0, 0);
    run(physics, car, 60);
    run(physics, car, 200, { throttle: 1 });
    expect(car.state.stuck).toBe(true);
    physics.dispose();
  });

  it('is removed with its controller', async () => {
    const physics = await flatWorld();
    const n = physics.world.bodies.len();
    const car = addVehicle(physics);
    expect(physics.world.bodies.len()).toBe(n + 1);
    car.remove();
    expect(physics.world.bodies.len()).toBe(n);
    physics.dispose();
  });
});

describe('addVehicle, when things go wrong', () => {
  it('drives on through inputs that are not numbers', async () => {
    const { physics, car } = await settle();
    run(physics, car, 60, { throttle: NaN, steer: Infinity, brake: undefined, boost: NaN });
    expect(car.chassis.position().every(Number.isFinite)).toBe(true);
    run(physics, car, 120, { throttle: 1 });
    expect(car.state.speed).toBeGreaterThan(1);
    physics.dispose();
  });

  it('can be removed twice', async () => {
    const { physics, car } = await settle();
    car.remove();
    expect(() => car.remove()).not.toThrow();
    expect(physics.world.bodies.len()).toBe(9); // (the ground's nine cells)
    physics.dispose();
  });
});

describe('addVehicle in the air', () => {
  it('says it flipped when it lands from a whole turn in the air', async () => {
    const { physics, car } = await settle();
    car.chassis.body.setLinvel({ x: 0, y: 12, z: 0 }, true);
    car.chassis.body.setAngvel({ x: 0, y: 0, z: 7 }, true);
    let flipped = false;
    for (let i = 0; i < 240 && !flipped; i++) {
      car.drive({}, 1 / 60);
      physics.step(1 / 60);
      flipped = car.measure().flipped;
    }
    expect(flipped).toBe(true);
    physics.dispose();
  });
});
