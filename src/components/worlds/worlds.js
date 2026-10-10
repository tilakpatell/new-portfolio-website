import { UNIVERSES } from '../universe/universes';
import { classicPathFor, readStart, universePathFor, viewOf } from '../../lib/view';

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
  '/universe': 6, // not a world (nothing gates it), but the map's own download, for the tour's "Open the universe map · N MB" on a phone: the planets' textures, the stations and ships, from /home at a phone's size (5.8 measured)
  '/caribbean': 16, // Dead Man's Tide's ships and sea creatures
  '/invincible': 4, // the three HD figures and the city's three skies
  '/cybertron': 38, // Iacon at war's robots, Metroplex and the city's kit (the world at the top), and below it Roll out's cast, scanned ground, rocks and sky, the statues, and Optimus's transformation; and Rapier (1.7 MB) for Iacon's loose crates, on a computer that loads it (never a phone)
  '/avengers': 13, // the walkable compound's sky, scanned ground and trees, Spider-Man and the people from Sketchfab (each building's game more as you go in); and Rapier (1.7 MB) for the lawn's props, on a computer that loads it (never a phone)
  '/c-137': 16, // about: the Smiths' street, the house, the school and Blips and Chitz, the Smiths and the cruiser; Portal panic's cast; the Citadel inside, its cast, the Council and the crowd's light copies (partly added up from the files). Mortytown is about 11 more, fetched when the lift goes down
  '/albuquerque': 22, // the town's buildings, cars, the RV and the cast, and Metherria's cast and lab; and Rapier (1.7 MB) for the street's props, on a computer that loads it (never a phone)
  '/scranton': 5, // the office cast and set (the walkable office and the one from above share them)
  '/galaxy': 18, // (10 before the 2017 heroes: one duel on Hoth adds 7.2 MB at high, Luke 1.9 and Maul 1.5, the humanoid, Luke and Maul clip packs 3.3 and the two hilts 0.6; 5.1 MB on a phone's light cuts) drawn in code (its planets, most of its ships), but for the big ships, the Death Star and its trench, Slave I and the Falcon; and down on a world, its models (its people, walkers, landmarks: a few MB a world); and Rapier (1.7 MB) for the loose crates by a site's stacks, on a computer that loads it (never a phone)
  '/deathstar': 1, // drawn in code, but for the X-wing (a third of an MB)
  // the ground is made in a worker from the planet's seed and wears the galaxy's scans (a few at a planet, under 2 MB); Coruscant adds its film-made Senate, Temple and tower (2.2 MB);
  // the POIs' buildings and the kit clutter round where it starts add the heaviest planet's 16.2 MB at mid (Naboo; Middle-earth 11.2, Geonosis 10.3,
  // Mustafar 7.8, Lothal 7.4, Yavin 6.2, Tatooine 5.9, Hoth 4.0, the rest under 5.5, an Expanse planet 1.5 at most: expanse/flight/landmarkFiles.test.js)
  '/fly': 22,
  '/deathstar/inside': 6, // aboard the station: the first room's kit and textures at phone size, and the cast it starts with (people, guns, the borrowed clips)
  '/middle-earth': 1, // drawn in code too, but for two places on the map (under a tenth of an MB)
  '/music': 7, // the music planet's courtyard: its instruments, chhatri, lamps and gaddi (Meshy models), sandstone, a dusk sky
  '/dot-matrix': 1, // drawn in code
  '/dot-matrix/64': 7, // the castle's and Bob-omb Ridge's texture sets at phone size, two skies, and Mario, the cast and the props (fan-made Sketchfab models, 2 MB)
  '/earth': 2, // NASA's globe at phone size, the stars and the plane
  '/dot-matrix/minecraft': 2, // drawn in code from the pack's tiles: the block strip, the skins and the sky's and HUD's sprites (under a tenth of an MB today)
};

// The world a path is in: '/middle-earth/moria' is Middle-earth. Some
// worlds sit inside another's address ('/dot-matrix/64' inside
// '/dot-matrix'), so the longest match wins: each gets its own download size
// and its own phone gate, not its parent's.
export const worldAt = (pathname) =>
  WORLDS.filter((w) => pathname === w.to || pathname.startsWith(`${w.to}/`)).reduce((best, w) => (best && best.to.length >= w.to.length ? best : w), null);

// The way out of a world, for the view the visitor is in (the glossary's
// last row): "Universe map", back to this world's place on the map, or
// "Classic site", to the pages, for one who reads the site as pages. For a
// world's HUD Menu (runtime/hud's Menu takes it as it is).
export const wayOut = (pathname, start = readStart()) =>
  viewOf(pathname, start) === 'classic' ? { label: 'Classic site', to: classicPathFor(pathname) } : { label: 'Universe map', to: universePathFor(pathname) };
