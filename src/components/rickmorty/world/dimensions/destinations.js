// The multiverse's destinations as data, and the portal gun's dial. Each
// place stands in its own column west of the rooms, one per 100 m of z from
// z = 900 (the plan's Global Constraints); its builder (./<id>.js) loads the
// first time the portal opens on it. Rick's garage portal goes wherever the
// dial is set (kept as tp-rm-dial), and the place's own portal goes home to
// the garage.
//
// Ten of them are the planets of the universe map's Rick and Morty sector
// (PLANETS), and aren't on the dial: you land on one from the map and come
// out at its way in (#/c-137/<id>, planetStart), and its own portal
// (isWayHome) takes you back out to the map, not to the garage.
//
// Pure: rules.js spreads these into AREAS, LINKS, PEOPLE, HOTSPOTS and
// TASKS; RmWorld.jsx takes the names, what people say and what talking to
// them does.

import { GARAGE_BACK } from './place';
import { ROWS as ROWS1 } from './rows1';
import { ROWS as ROWS2 } from './rows2';
import { ROWS as ROWS3 } from './rows3';

export { DEST_COL, DEST_X, GARAGE_BACK, destArea, destZ } from './place';

// every place, in the dial's order (the rows' files, ./place.js's shape; the planets are off the dial)
export const DESTINATIONS = [...ROWS1, ...ROWS2, ...ROWS3];

export const destinationById = (id) => DESTINATIONS.find((d) => d.id === id) ?? null;

// ── the planets ──

// in the order of the map's moons (universes.js's MOONS, which its test holds them to)
export const PLANETS = ['gazorpazorp', 'squanch', 'birdworld', 'gearworld', 'pluto', 'snakeplanet', 'nuptia', 'resort', 'cronenberg', 'purge'];
export const isPlanet = (id) => PLANETS.includes(id);
// where Morty starts on a planet he's landed on: its way in, facing in
export function planetStart(id) {
  const d = isPlanet(id) ? destinationById(id) : null;
  return d ? { area: d.id, x: d.arrive.x, z: d.arrive.z, face: d.arrive.face } : null;
}
// The big planets: whole worlds on the galaxy's surface engine
// (rickmorty/planets/, its PLANET_SITES, which its test holds this to), not
// boxes here. Their rows stay for the map's moons, but RmWorld never opens
// them and their old box tasks are retired (rules.js). Each planet joins as
// its site is made.
export const BIG = new Set(['gazorpazorp']);
export const isBigPlanet = (id) => BIG.has(id);
// is this the planet's own portal, the way back out to the map?
export const isWayHome = (link, id) => link?.id === `${id}-portal`;

// ── the dial ──

// the arcade, then every destination but the planets (an old setting for one is the arcade)
export const DIAL = [{ id: 'annex', name: 'Blips and Chitz', note: 'An arcade on an alien street. Roy: A Life Well Lived is in the back.' }, ...DESTINATIONS.filter((d) => !isPlanet(d.id)).map(({ id, name, note }) => ({ id, name, note }))];
export const DIAL_KEY = 'tp-rm-dial';
export const portalTarget = (dial) => (DIAL.some((d) => d.id === dial) ? dial : 'annex');
export function readDial() {
  try {
    return portalTarget(localStorage.getItem(DIAL_KEY));
  } catch {
    return 'annex';
  }
}
export function writeDial(id) {
  try {
    localStorage.setItem(DIAL_KEY, portalTarget(id));
  } catch {
    /* (private mode: the dial lasts the visit) */
  }
}

// the garage portal, sent where the dial is set; any other link as it is
export function linkTarget(link, dial) {
  if (link.id !== 'garage-portal') return link;
  const d = destinationById(portalTarget(dial));
  return d ? { ...link, to: d.id, label: `Through the portal to ${d.name}`, arrive: d.arrive } : link;
}

// a saved spot, if it's still somewhere Morty can be: in a built-in area, or
// in a destination (whatever the dial says now: the way home's there), else
// the garage, where the portal is
export function validArrive(saved, areas) {
  const a = saved && areas[saved.area];
  if (a && saved.x >= a.x0 && saved.x <= a.x1 && saved.z >= a.z0 && saved.z <= a.z1) return { area: saved.area, x: saved.x, z: saved.z, face: saved.face ?? 0 };
  return { area: 'garage', ...GARAGE_BACK };
}
