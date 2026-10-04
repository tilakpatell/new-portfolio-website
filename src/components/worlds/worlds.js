import { UNIVERSES } from '../universe/universes';

// The hidden worlds, one per fandom, each a page of its own (the universes
// on the map that have one), in map order.
export const WORLDS = UNIVERSES.filter((u) => u.world).map((u) => ({ to: u.to, label: u.world, from: u.label }));

// What each world downloads when it opens (models, textures, skies,
// sound), in MB, measured on a phone-sized screen and rounded up: a phone
// asks before loading the heavy ones (WorldGate, lib/device's worldCheck).
export const WORLD_MB = {
  '/caribbean': 16, // Dead Man's Tide's ships and sea creatures
  '/cybertron': 13, // Roll out's cast, scanned ground, rocks and sky
  '/avengers': 9, // the compound's skies, scanned props and trees
  '/albuquerque': 6, // Metherria's cast and lab
  '/c-137': 6, // the cruiser and Portal panic's cast
  '/scranton': 5, // the office cast and set
  '/deathstar': 1, // drawn in code: nothing to download
  '/middle-earth': 1, // drawn in code too
  '/music': 1,
};

// The world a path is in: '/middle-earth/moria' is Middle-earth.
export const worldAt = (pathname) => WORLDS.find((w) => pathname === w.to || pathname.startsWith(`${w.to}/`)) ?? null;
