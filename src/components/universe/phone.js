// A phone, floating just out past the asteroid belt, that nothing mentions:
// a yellowed Pixel that says SAMSUNG gAlaxy (dickansh/galaxyPhone.js), its
// lock screen a portal. It's on no list (not the universes, the wonders, the
// nav map, the mini-map, the beacons or the tour) and nothing crashes into
// it: click it, or fly up to it, and the page asks for its password
// (dickansh/PhoneOverlay.jsx).
//
// PHONE: where it is (map units), how big, how near counts as at it, and how
// near flies you into it. createPhone() → { group, update(t, camera), radius, dispose }.

import { build } from '../dickansh/galaxyPhone';
import { HOME_SPREAD } from './scale';

// (out past Resume, beyond the belt and above the disc: clear of every route
// the autopilot flies between the places, and outside the sun's glow; out
// as far as the belt went when the home system grew, scale.js, but no higher:
// it stays under the ship's ceiling)
export const PHONE = { at: [0, 48, -210 * HOME_SPREAD], scale: 9, reach: 40, touch: 9 };

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
