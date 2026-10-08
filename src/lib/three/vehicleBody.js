// The car’s visible half put onto its meshes (docs/superpowers/specs/2026-10-
// 08-one-feel-site-wide-design.md §4): lib/vehicleFeel.js says how far the
// body squashes, pitches and rolls and where the antenna’s tip trails; this
// moves the meshes. The body is one pivot over the chassis’s meshes (never
// the wheels: they stay on the springs), squashed by 1 − squash in y and
// 1 + squash / 2 across about `base` (its y in the pivot’s parent, where it
// meets the wheels), so its underside stays put while it shortens; then
// pitched and rolled about the pivot. The antenna bends away from the
// acceleration by its tip × 1.2, a lean from its base (its own origin).
//
// Forward is +x, as lib/physics/vehicle.js’s car (the right +z): a negative
// pitch is the nose up, a positive roll the right side down. `forward: 'z'`
// is for a car modelled facing +z (the right −x).
//
//   attachVehicleBody({ body: Object3D, antenna = null, base = 0,
//     forward = 'x' | 'z' }) → { apply({ squash, roll, pitch, antenna:
//     [x, z] }), dispose() (the body and antenna as they were) }

const BEND = 1.2;

export function attachVehicleBody({ body, antenna = null, base = 0, forward = 'x' } = {}) {
  const y0 = body.position.y;
  const scale0 = body.scale.clone();
  const rotation0 = body.rotation.clone();
  const bend0 = antenna?.rotation.clone();
  const faceZ = forward === 'z';
  return {
    apply({ squash = 0, roll = 0, pitch = 0, antenna: tip = null } = {}) {
      const across = 1 + squash / 2;
      const up = 1 - squash;
      body.scale.set(scale0.x * across, scale0.y * up, scale0.z * across);
      // the base, scaled about the pivot, put back where it was
      body.position.y = base - (base - y0) * up;
      if (faceZ) body.rotation.set(pitch, 0, roll);
      else body.rotation.set(roll, 0, -pitch);
      if (antenna && tip) {
        const [along, right] = tip;
        if (faceZ) antenna.rotation.set(-along * BEND, 0, -right * BEND);
        else antenna.rotation.set(-right * BEND, 0, along * BEND);
      }
    },
    dispose() {
      body.position.y = y0;
      body.scale.copy(scale0);
      body.rotation.copy(rotation0);
      if (antenna) antenna.rotation.copy(bend0);
    },
  };
}
