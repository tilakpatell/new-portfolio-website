import { UNIVERSES } from '../universe/universes';

// The hidden worlds, one per fandom, each a page of its own (the universes
// on the map that have one, and the pages inside them: Star Wars has the
// galaxy, and the Death Star in it), in map order.
export const WORLDS = UNIVERSES.filter((u) => u.world).flatMap((u) => [{ to: u.to, label: u.world, from: u.label }, ...(u.pages ?? []).map((p) => ({ to: p.to, label: p.world, from: u.label }))]);

// What each world downloads when it opens (models, textures, skies,
// sound), in MB, measured on a phone-sized screen and rounded up: a phone
// asks before loading the heavy ones (WorldGate, lib/device's worldCheck).
// A world on the world runtime (src/runtime) says the same in its module's
// `mb` (its test checks they agree).
export const WORLD_MB = {
  '/caribbean': 16, // Dead Man's Tide's ships and sea creatures
  '/invincible': 4, // the three HD figures and the city's three skies
  '/cybertron': 36, // Iacon at war's robots, Metroplex and the city's kit (the world at the top), and below it Roll out's cast, scanned ground, rocks and sky, the statues, and Optimus's transformation
  '/avengers': 11, // the walkable compound's sky, scanned ground and trees, Spider-Man and the people from Sketchfab (each building's game more as you go in)
  '/c-137': 16, // about: the Smiths' street, the house, the school and Blips and Chitz, the Smiths and the cruiser; Portal panic's cast; the Citadel inside, its cast, the Council and the crowd's light copies (partly added up from the files). Mortytown is about 11 more, fetched when the lift goes down
  '/albuquerque': 15, // the town's buildings, cars, the RV and the cast, and Metherria's cast and lab
  '/scranton': 5, // the office cast and set (the walkable office and the one from above share them)
  '/galaxy': 8, // drawn in code (its planets, most of its ships), but for the big ships, the Death Star and its trench, Slave I and the Falcon; and down on a world, its models (its people, walkers, landmarks: a few MB a world)
  '/deathstar': 1, // drawn in code, but for the X-wing (a third of an MB)
  '/middle-earth': 1, // drawn in code too, but for two places on the map (under a tenth of an MB)
  '/music': 7, // the music planet's courtyard: its instruments, chhatri, lamps and gaddi (Meshy models), sandstone, a dusk sky
  '/dot-matrix': 1, // drawn in code
  '/dot-matrix/64': 7, // the castle's and Bob-omb Ridge's texture sets at phone size, two skies, and Mario, the cast and the props (fan-made Sketchfab models, 2 MB)
  '/earth': 2, // NASA's globe at phone size, the stars and the plane
};

// The world a path is in: '/middle-earth/moria' is Middle-earth.
export const worldAt = (pathname) => WORLDS.find((w) => pathname === w.to || pathname.startsWith(`${w.to}/`)) ?? null;
