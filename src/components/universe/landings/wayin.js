// The way into a planet's world from its landing. Once the crew are out,
// crashing into the planet from above shouldn't be the only way in: a
// button on the HUD (and Enter) says “Enter Albuquerque” the whole time
// you're down there, and a beacon stands over the landing's door so you
// can see where the way in is from the ship. Both go where the door does
// (G at it: the planet's page).
//
// Pure rules, tested in Node: scene.js shows the button and takes the key,
// beacon.js draws the marker, furnish.js stands it on the door.

import { byId } from '../universes';

export const ENTER_KEY = 'Enter';

// the phases of footScene.js in which the crew are on the ground: stepping
// out, walking about, and down after a fight (not coming down, nor boarding
// and lifting off: you've chosen to leave by then)
const DOWN = new Set(['out', 'walk', 'down']);

// the universe a landing is the way into, if it has a world of its own
const worldOf = (id) => {
  const u = id ? byId(id) : null;
  return u && u.kind !== 'core' && u.to ? u : null;
};

// the world's name (the universe's own if it has none)
export const worldName = (id) => {
  const u = worldOf(id);
  return u ? (u.world ?? u.label) : null;
};

// what the button says
export const enterLabel = (id) => {
  const name = worldName(id);
  return name ? `Enter ${name}` : null;
};

// Flown down into a planet's air at a speed it could land at: straight on
// into its world (what onOpen takes: where the button and the door go),
// not a landing beside the ship first. Null with no world to go into.
export const flownInto = (id) => (worldOf(id) ? id : null);

// The button, for the HUD: { id (what onOpen takes), label, key } while the
// crew are down on a planet that has a world, else null.
export function wayIn({ id, phase, frozen = false, crashing = false } = {}) {
  if (frozen || crashing || !DOWN.has(phase)) return null;
  const label = enterLabel(id);
  return label ? { id, label, key: ENTER_KEY } : null;
}

// a door of its own for a landing with none: ahead of the ship, clear of it
const OWN_DOOR = { at: [0, 16], reach: 4 };

// The beacon over a landing's door: { label, thing (the index of the thing
// with a door, which it stands on), at (or, with no door on the landing,
// where it stands: [x, z] metres, as a thing's), reach and door (the door's
// name, for G's prompt) for a door of its own }; null with no world to go into.
export function beaconOf(id, landing) {
  const label = enterLabel(id);
  if (!label || !landing) return null;
  const things = landing.things ?? [];
  const i = things.findIndex((t) => t.door);
  if (i >= 0) return { label, thing: i, at: null };
  const u = worldOf(id);
  return { label, thing: null, at: [...OWN_DOOR.at], reach: OWN_DOOR.reach, door: u.world ?? u.label };
}
