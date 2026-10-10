// The flight's planets, composed: the pure tables (lib/land/flight) given
// the Expanse they fly over. This is the one file of the flight that reads
// the Expanse's generator, so the tables stay pure (lib knows no page) and
// the flight can be lifted out without the Expanse noticing.
//
//   EXPANSE → the thirteen Expanse rows the roster flies, in sector order
//   expanseRow(id) → any Expanse planet's row, or null (a typed /fly/e:… URL
//     reaches past the thirteen, as it always has)
//   PLANETS → the fifty, { id, name, type, seed }
//   planetSpecOf(id) → the planet's spec, or null
//   lifeOf(spec) → what lives on it
//   occurrencesOf(spec), eventsOf(spec) → what is there to find, and what happens

import { makeSector } from '../gen/sector.js';
import { UNIVERSE } from '../gen/seed.js';
import { planetSpecOf as specWith, planetsOf } from '../../../lib/land/flight/planetSpec';
import { lifeFor } from '../../../lib/land/flight/lifeTables';
import { occurrencesFor } from '../../../lib/land/flight/occurrences';
import { eventsFor } from '../../../lib/land/flight/eventTables';

const EXPANSE_COUNT = 13;
// the order the roster takes them in: sectors round home
const SECTORS = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1]];
const EXPANSE_ID = /^e:(-?\d+),(-?\d+):(\d+):(\d+)$/i;

// a planet and its system as plain data: what the tables read, and no more
const rowOf = (p, s) => ({
  id: p.id.toLowerCase(),
  name: p.name,
  type: p.type,
  seed: String(p.seed),
  system: { faction: s.faction ? { id: s.faction.id } : null, traffic: s.traffic, hazard: s.hazard ?? null },
});

export function expanseRow(id) {
  const m = String(id).match(EXPANSE_ID);
  if (!m) return null;
  const [sx, sz, i, j] = m.slice(1).map(Number);
  const s = makeSector(UNIVERSE, sx, sz).systems[i];
  const p = s?.planets[j];
  return p ? rowOf(p, s) : null;
}

function expanseRows() {
  const rows = [];
  for (const [sx, sz] of SECTORS) {
    for (const s of makeSector(UNIVERSE, sx, sz).systems) for (const p of s.planets) if (rows.length < EXPANSE_COUNT) rows.push(rowOf(p, s));
    if (rows.length >= EXPANSE_COUNT) break;
  }
  return rows;
}

export const EXPANSE = expanseRows();
export const PLANETS = planetsOf(EXPANSE);
export const planetSpecOf = (id) => specWith(id, { expanse: expanseRow });
export const lifeOf = (spec) => lifeFor(spec, { expanse: expanseRow });
export const occurrencesOf = (spec) => occurrencesFor(spec, null, { expanse: expanseRow });
export const eventsOf = (spec) => eventsFor(spec, null, { expanse: expanseRow });
