// Where a pilot is, for the roster: off the universe map, the place's own
// name (where.js's placeName); on it, the region they were last seen in
// (regions.js), so a universe spread this wide still says roughly where:
// “Universe · Near Middle-earth”, “Universe · the void”. A module of its
// own, not where.js, which the site's shell loads on every page: this one
// pulls in the map's layout, and only the roster (loaded once you're
// online) needs it.

import { regionAt } from '../regions';
import { SECTORS, sectorOf } from '../layout';
import { UNIVERSE, placeName } from './where';

// (mid-sentence, a leading “The” goes small: “the home system”)
const small = (name) => name.replace(/^The /, 'the ');

// the roster's words for `where` (a page key), with the pilot's last pose
// ({ x, y, z }, or null) to say whereabouts on the map
export function rosterWhere(where, pose) {
  if (where !== UNIVERSE || !pose) return placeName(where);
  const { x, y, z } = pose;
  // (the Rick and Morty sector is through its portal: none of the regions reach it)
  const sector = sectorOf(x, y, z);
  const area = sector !== 'main' ? SECTORS[sector].name : (regionAt(x, y, z)?.name ?? 'the void');
  return `Universe · ${small(area)}`;
}
