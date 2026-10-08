import { beforeAll, describe, expect, it } from 'vitest';
import { createPhysics } from './world';
import { CAR, addVehicle } from './vehicle';
import { carGroups } from './carTuning';

let physics;
beforeAll(async () => {
  physics = await createPhysics();
});
const fresh = () => addVehicle(physics, structuredClone(CAR));

describe('carGroups', () => {
  it('is one group of the eleven numbers, each in its range', () => {
    const car = fresh();
    const groups = carGroups(car);
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe('car');
    expect(groups[0].items.map((it) => it.key)).toEqual(['engineForce', 'topSpeed', 'topSpeedBoost', 'brake', 'idleBrake', 'steering', 'suspensionStiffness', 'suspensionCompression', 'suspensionRelaxation', 'frictionSlip', 'sideFrictionStiffness']);
    for (const it of groups[0].items) {
      expect(it.type).toBe('range');
      expect(it.get()).toBeGreaterThanOrEqual(it.min);
      expect(it.get()).toBeLessThanOrEqual(it.max);
    }
    car.remove();
  });

  it('writes the car’s live spec, which drive reads', () => {
    const car = fresh();
    const item = (key) => carGroups(car)[0].items.find((it) => it.key === key);
    item('engineForce').set(500);
    expect(car.spec.engineForce).toBe(500);
    expect(item('engineForce').get()).toBe(500);
    item('steering').set(0.8);
    car.drive({ steer: 1 });
    expect(car.controller.wheelSteering(0)).toBeCloseTo(-0.8, 6);
    car.remove();
  });

  it('writes a wheel number to every wheel at once, and it holds through a drive', () => {
    const car = fresh();
    const item = (key) => carGroups(car)[0].items.find((it) => it.key === key);
    item('suspensionStiffness').set(42);
    for (let i = 0; i < 4; i++) expect(car.controller.wheelSuspensionStiffness(i)).toBeCloseTo(42, 4);
    car.drive({});
    expect(car.controller.wheelSuspensionStiffness(0)).toBeCloseTo(42, 4);
    expect(item('suspensionStiffness').get()).toBe(42);
    for (const [key, getter] of [
      ['suspensionCompression', 'wheelSuspensionCompression'],
      ['suspensionRelaxation', 'wheelSuspensionRelaxation'],
      ['frictionSlip', 'wheelFrictionSlip'],
      ['sideFrictionStiffness', 'wheelSideFrictionStiffness'],
    ]) {
      item(key).set(1.5);
      for (let i = 0; i < 4; i++) expect(car.controller[getter](i)).toBeCloseTo(1.5, 4);
      expect(car.spec.wheels[key]).toBe(1.5);
    }
    car.remove();
  });

  it('leaves the shared table alone when the car has its own', () => {
    const car = fresh();
    carGroups(car)[0].items.find((it) => it.key === 'topSpeed').set(12);
    expect(CAR.topSpeed).toBe(5);
    car.remove();
  });
});
