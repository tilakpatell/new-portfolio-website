// The car’s sliders for the ?debug panel (lib/debugPanel.js): his numbers
// (lib/physics/vehicle.js’s CAR) set live on a running car. A car number
// writes the car’s own spec, which drive() reads every frame; a wheel
// number writes the spec and every wheel through the controller at once.
// Stiffness is the stance it drives on (suspensions.low): drive() sets the
// springs from the stance every frame, so a slider on the wheel alone
// would be undone a frame later; the jump’s stance keeps its own.
//
// A car made with CAR itself shares that table: pass addVehicle a copy
// (structuredClone(CAR)) so tuning one car tunes no other.
//
//   carGroups(vehicle) → [{ name: 'car', items }]

// [key, label, min, max, step]
const CAR_ITEMS = [
  ['engineForce', 'engine', 0, 800, 5],
  ['topSpeed', 'top speed', 0, 20, 0.1],
  ['topSpeedBoost', 'top boosted', 0, 80, 0.5],
  ['brake', 'brake', 0, 80, 0.5],
  ['idleBrake', 'idle brake', 0, 0.3, 0.005],
  ['steering', 'steering', 0, 1, 0.01],
];
// [key, label, min, max, step, the controller’s setter]
const WHEEL_ITEMS = [
  ['suspensionStiffness', 'stiffness', 5, 60, 0.5, 'setWheelSuspensionStiffness'],
  ['suspensionCompression', 'compression', 0, 20, 0.1, 'setWheelSuspensionCompression'],
  ['suspensionRelaxation', 'relaxation', 0, 10, 0.1, 'setWheelSuspensionRelaxation'],
  ['frictionSlip', 'grip', 0, 3, 0.05, 'setWheelFrictionSlip'],
  ['sideFrictionStiffness', 'side grip', 0, 6, 0.05, 'setWheelSideFrictionStiffness'],
];
const WHEELS = 4;

export function carGroups(vehicle) {
  const spec = vehicle.spec;
  const everyWheel = (setter, v) => {
    for (let i = 0; i < WHEELS; i++) vehicle.controller[setter](i, v);
  };
  const car = CAR_ITEMS.map(([key, label, min, max, step]) => ({ key, label, type: 'range', min, max, step, get: () => spec[key], set: (v) => (spec[key] = v) }));
  const wheels = WHEEL_ITEMS.map(([key, label, min, max, step, setter]) => {
    const stiffness = key === 'suspensionStiffness';
    return {
      key,
      label,
      type: 'range',
      min,
      max,
      step,
      get: () => (stiffness ? spec.suspensions.low[1] : spec.wheels[key]),
      set(v) {
        spec.wheels[key] = v;
        if (stiffness) spec.suspensions.low[1] = v;
        everyWheel(setter, v);
      },
    };
  });
  return [{ name: 'car', items: [...car, ...wheels] }];
}
