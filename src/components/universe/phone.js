// A phone, floating just out past the home system, that nothing mentions:
// a yellowed Pixel that says SAMSUNG gAlaxy (dickansh/galaxyPhone.js), its
// lock screen a portal. It's on no list (not the universes, the wonders, the
// nav map, the mini-map, the beacons or the tour) and nothing crashes into
// it: click it, or fly up to it, and the page asks for its password
// (dickansh/PhoneOverlay.jsx).
//
// PHONE: where it is (map units), how big, how near counts as at it, and how
// near flies you into it. createPhone() → { group, update(t, camera), radius, dispose }.

import { build } from '../dickansh/galaxyPhone';

// (as big as a world, the world behind it being one: half its height about
// a planet's radius (scale.js). Out past the home system's edge, where the
// ceiling's lifting, in the widest gap between the ways out to the worlds
// and the wonders (between the Office and Music), so no trip the autopilot
// flies goes through it and asks for its password on the way; above the
// disc, and outside the sun's glow)
const AT = { angle: 2.44, out: 470, up: 60 };
export const PHONE = { at: [Math.cos(AT.angle) * AT.out, AT.up, Math.sin(AT.angle) * AT.out], scale: 45, reach: 110, touch: 45 }; // (reach: about a planet's, 1.9 of half its height)

export function createPhone() {
  const phone = build();
  const { group } = phone;
  group.position.set(...PHONE.at);
  group.scale.setScalar(PHONE.scale);
  group.rotation.set(0.12, 0.5, -0.18);
  const base = group.rotation.clone();
  return {
    group,
    update(t, camera) {
      // turning slowly, and bobbing, as if dropped out here a while ago
      group.rotation.set(base.x + Math.sin(t * 0.21) * 0.08, base.y + t * 0.09, base.z + Math.sin(t * 0.17) * 0.06);
      group.position.y = PHONE.at[1] + Math.sin(t * 0.33) * 1.6;
      phone.update(t, camera);
    },
    // half its height, in map units: for picking it on screen
    radius: PHONE.scale * 1.15,
    dispose: () => phone.dispose(),
  };
}
