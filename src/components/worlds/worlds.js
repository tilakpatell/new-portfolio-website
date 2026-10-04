import { UNIVERSES } from '../universe/universes';

// The hidden worlds, one per fandom, each a page of its own (the universes
// on the map that have one), in map order.
export const WORLDS = UNIVERSES.filter((u) => u.world).map((u) => ({ to: u.to, label: u.world, from: u.label }));

// What each world downloads when it opens (models, textures, skies,
// sound), in MB, measured on a phone-sized screen and rounded up: a phone
// asks before loading the heavy ones (WorldGate, lib/device's worldCheck).
export const WORLD_MB = {
  '/caribbean': 15, // Dead Man's Tide's ships and sea creatures
  '/avengers': 10, // the compound's skies, scanned props and trees
  '/cybertron': 7, // Roll out's scanned ground, rocks and sky
  '/scranton': 7, // the office cast and set
  '/albuquerque': 6, // Metherria's cast and lab
  '/c-137': 6, // the cruiser and Portal panic's cast
  '/deathstar': 1, // drawn in code: nothing to download
  '/middle-earth': 1,
  '/music': 1,
};

// The world a path is in: '/middle-earth/moria' is Middle-earth.
export const worldAt = (pathname) => WORLDS.find((w) => pathname === w.to || pathname.startsWith(`${w.to}/`)) ?? null;
