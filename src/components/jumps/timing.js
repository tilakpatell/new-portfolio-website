// The crews' jumps, as numbers: what the portal (PortalJump.jsx, and staged:
// stagedAt) and the cook (BlueSkyJump.jsx) look like t seconds in, on the jump to lightspeed's
// timeline (hyperspace3d/timeline.js). Pure, so they're tested in Node: by
// the flash each has the screen covered, and by the end each is gone.

import { T, clamp, ease } from '../hyperspace3d/timeline';

// a little past full, then back: the goo settling as it opens (rickmorty/PortalSwirl.jsx)
const settle = (k) => Math.max(0, 1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2);

// How big the portal has to be (its half height, in screen heights) for its
// goo to cover every corner, lumps and all.
const coverFor = ({ aspect }) => Math.hypot(aspect / 2 / 0.82, 0.5) / 0.84;

// The portal's numbers, t seconds in: grow (its half height in screen
// heights; 0 for none), open (the goo's opening, 0…1, which also winds it
// up), inside (through it: the vortex shows in its middle).
export function portalAt(t, view) {
  const S = T.drift / 1000;
  const J = T.jump / 1000;
  const U = T.tunnel / 1000;
  const E = T.end / 1000;
  const cover = coverFor(view) * 1.25;
  const ahead = 0.19; // a portal ahead of the cruiser, a little over a third of the screen tall
  if (t < J + 0.06) {
    // opening ahead, then flown into: the view's zoom in on it, exponential, so it feels like closing on it
    const open = t < S ? settle(clamp(t / S)) : 1;
    const p = clamp((t - S) / (J - S));
    const grow = ahead * (cover / ahead) ** (p ** 1.7);
    return { grow, open, inside: 0 };
  }
  if (t < U) return { grow: cover, open: 1, inside: 1 };
  // out the other side: it shrinks away to a point behind the cruiser, pinching shut at the last
  const k = clamp((t - U) / (E - U));
  const grow = cover * (1 - ease(k)) ** 1.6;
  const open = 1 - clamp((k - 0.82) / 0.18) ** 2;
  return { grow, open, inside: 1 };
}

// The portal staged (a 3D jump: universe/scene.js and galaxy/scene.js fly
// the cruiser into a real gate in front of it, lib/three/portalGate.js, and
// out of another at the far end): the screen clear while the ship goes in,
// the goo wiping in from the middle as it's through, the flash, the vortex,
// then a hole opening out from the middle on the ship coming out of the
// next gate. reveal: how far out the hole has come (in the oval's radii);
// dark: the darkening round it (none: the scene's own).
export const STAGED = { clear: 0.95 }; // seconds: the screen's clear till then
export function stagedAt(t, view) {
  const J = T.jump / 1000;
  const U = T.tunnel / 1000;
  const E = T.end / 1000;
  const cover = coverFor(view) * 1.25;
  if (t < STAGED.clear) return { grow: 0, open: 0, inside: 0, reveal: 0, dark: 0 };
  if (t < J + 0.06) {
    // wiping in from the middle, faster and faster, as the ship goes through
    const p = clamp((t - STAGED.clear) / (J - STAGED.clear));
    return { grow: cover * p ** 1.4, open: settle(Math.min(1, p * 1.3)), inside: 0, reveal: 0, dark: 0 };
  }
  if (t < U) return { grow: cover, open: 1, inside: 1, reveal: 0, dark: 0 };
  // the hole opening out from the middle, the lip going out past the corners
  const k = clamp((t - U) / (E - U));
  return { grow: cover * (1 + 1.6 * ease(k)), open: 1, inside: 1, reveal: 1.1 * ease(Math.min(1, k * 1.15)), dark: 0 };
}

// The cook's numbers, t seconds in: haze (the desert heat, 0…1), front (how
// far the crystals have come in from the edges: 0 none, 1.6 every shard
// grown), zoom (the view easing in on the crystal), shatter (0…1, the sheet
// flying apart), glint (whether facets flash).
export function blueSkyAt(t) {
  const S = T.drift / 1000;
  const J = T.jump / 1000;
  const F = T.flash / 1000;
  const U = T.tunnel / 1000;
  const E = T.end / 1000;
  const grown = 1.6;
  if (t < J + 0.06) {
    const heat = t < S ? ease(clamp(t / S)) : 1 - 0.5 * clamp((t - S) / (J - S));
    const p = clamp((t - (S - 0.1)) / (J - (S - 0.1)));
    return { haze: heat, front: grown * p ** 1.25, zoom: 1, shatter: 0, glint: p };
  }
  if (t < U) {
    const k = clamp((t - F) / (U - F));
    return { haze: 0, front: grown, zoom: 1 - 0.12 * ease(k), shatter: 0, glint: 1 };
  }
  const k = clamp((t - U) / (E - U));
  return { haze: 0, front: grown, zoom: 0.88, shatter: ease(k), glint: 1 - k };
}
