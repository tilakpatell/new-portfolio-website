import { UNIVERSES } from '../universe/universes';

// The hidden worlds, one per fandom, each a page of its own (the universes
// on the map that have one), in map order.
export const WORLDS = UNIVERSES.filter((u) => u.world).map((u) => ({ to: u.to, label: u.world, from: u.label }));

// What each world downloads when it opens (models, textures, skies,
// sound), in MB, measured on a phone-sized screen and rounded up: a phone
// asks before loading the heavy ones (WorldGate, lib/device's worldCheck).
export const WORLD_MB = {
  '/caribbean': 16, // Dead Man's Tide's ships and sea creatures
  '/invincible': 4, // the three HD figures and the city's three skies
  '/cybertron': 18, // Roll out's cast, scanned ground, rocks and sky, the statues, and Optimus's transformation
  '/avengers': 12, // the walkable compound's sky, scanned ground and trees, and its people from Sketchfab (each building's game more as you go in)
  '/c-137': 6, // the cruiser and Portal panic's cast
  '/albuquerque': 15, // the town's buildings, cars, the RV and the cast, and Metherria's cast and lab
  '/scranton': 5, // the office cast and set
  '/deathstar': 1, // drawn in code, but for the X-wing (a third of an MB)
  '/middle-earth': 1, // drawn in code too, but for two places on the map (under a tenth of an MB)
  '/music': 7, // the music planet's courtyard: its instruments, chhatri, lamps and gaddi (Meshy models), sandstone, a dusk sky
  '/dot-matrix': 1, // drawn in code
  '/earth': 2, // NASA's globe at phone size, the stars and the plane
};

// The world a path is in: '/middle-earth/moria' is Middle-earth.
export const worldAt = (pathname) => WORLDS.find((w) => pathname === w.to || pathname.startsWith(`${w.to}/`)) ?? null;
