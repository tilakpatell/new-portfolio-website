// Fetches the cockpit ahead of time (three.js, the scene, the first
// vehicle's code and its crew), so the cockpit is ready when the opening
// crawl ends (App starts this as the crawl begins). No three.js import
// here, so this costs nothing until it's asked for.

import { gpu, mode3D, resolve3D } from '../../lib/gpu';

let mod = null;
let pending = null;

// the scene module, if it has arrived
export const cockpitScene = () => mod;

// Can the cockpit be drawn here at all? (WebGL, 3D not switched off.)
export const cockpitPossible = () => typeof window !== 'undefined' && resolve3D(mode3D(), gpu());

export function preloadCockpit(first = 'falcon') {
  if (mod || pending) return pending;
  if (!cockpitPossible()) return null;
  pending = import('./scene')
    .then((m) => {
      mod = m;
      m.preloadVehicle(first);
      return m;
    })
    .catch(() => {
      pending = null; // a dropped connection: try again next time
      return null;
    });
  return pending;
}
