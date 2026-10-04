import { UNIVERSES } from '../universe/universes';

// The hidden worlds, one per fandom, each a page of its own (the universes
// on the map that have one), in map order.
export const WORLDS = UNIVERSES.filter((u) => u.world).map((u) => ({ to: u.to, label: u.world, from: u.label }));
