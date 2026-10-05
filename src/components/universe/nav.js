// The nav map's numbers: everywhere there is to go on the universe map, the
// ways to get there, how long each takes, and where things sit on the chart.
// Pure (no React, no three.js), so it's tested in Node; NavMap.jsx draws it
// and scene.js flies it.
//
// Three drives, picked on the nav map and kept between visits:
//   hyper   Hyperspeed. A jump to lightspeed: the site's own jump plays over
//           the map, and the ship comes out parked at the place, whatever
//           the distance. It can't jump while hunters have it interdicted,
//           and the hyperdrive takes HYPER.recharge seconds to charge again.
//   super   Super speed. The autopilot on the pulse drive pushed to
//           OVERDRIVE times its speed (ship.js), roughly half the trip. You
//           see the whole way and can take the stick back at any time.
//   cruise  The pulse drive as it comes: the scenic way, the crew talking.
// Picking a place anywhere on the map (its name, the panel, the nav map)
// goes by the drive picked.

import { EDGE, GOALS, OVERDRIVE, SHIP, autopilot, parkAt, step } from './ship';
import { MAW, parkNear } from './maw';
import { WONDERS, reachOf } from './deep';
import { HOME_RADIUS, ORDER, POSITIONS, REACH } from './layout';
import { byId } from './universes';

export const DRIVE_KEY = 'tp-universe-drive';

export const DRIVES = [
  {
    id: 'hyper',
    name: 'Hyperspeed',
    verb: 'Jump',
    od: 1,
    about: 'A jump to lightspeed. You come out parked at it, however far it is. Nothing to see on the way, and the hyperdrive needs a few seconds to charge again after.',
  },
  {
    id: 'super',
    name: 'Super speed',
    verb: 'Super speed',
    od: OVERDRIVE,
    about: `The pulse drive pushed to ${OVERDRIVE}× its speed, about half the trip. You fly the whole way and can take the stick back any time.`,
  },
  {
    id: 'cruise',
    name: 'Cruise',
    verb: 'Cruise',
    od: 1,
    about: 'The pulse drive as it comes. The scenic route, with time for the crew to talk on the way.',
  },
];
export const driveById = (id) => DRIVES.find((d) => d.id === id) ?? DRIVES[1];
// a stored drive, or super speed (quick, and still a flight)
export const parseDrive = (v) => (DRIVES.some((d) => d.id === v) ? v : 'super');

// the jump, in seconds: to the flash, when the ship's moved (the site's jump
// overlay flashes at 1.15 to 1.3 s, components/Hyperspace.jsx); all of it;
// and how long till the hyperdrive can go again
export const HYPER = { flash: 1.2, length: 2.45, recharge: 10 };

// Whether the hyperdrive can jump now: { ready, wait (seconds), why }.
// `last` is when it last jumped and `now` the clock (both in seconds), or
// null for never.
export function hyperState({ last = null, now = 0, interdicted = false } = {}) {
  if (interdicted) return { ready: false, wait: 0, why: 'interdicted' };
  const wait = last === null ? 0 : Math.max(0, last + HYPER.recharge - now);
  return wait > 0 ? { ready: false, wait, why: 'charging' } : { ready: true, wait: 0, why: null };
}

// What each wonder is, in a line (they have no page: the crews have their say as you pass)
const WONDER_KIND = { 'gas-giant': 'Gas giant', 'ice-giant': 'Ice giant', star: 'Star', 'black-hole': 'Black hole', nebula: 'Nebula', citadel: 'Space station' };
const WONDER_ABOUT = {
  aurelia: 'A ringed gas giant, bigger than any world on the map. Its rings go a long way out.',
  glacia: 'An ice giant: cold, blue and very quiet.',
  ember: 'An orange sun with two planets of its own, a rock and an ocean world.',
  halcyon: 'A blue sun, hot and young, with a rock and a gas giant round it.',
  maw: 'A black hole. The nav computer stops you at the edge of its pull: past that it has you, and on its far side is a friend’s universe.',
  veil: 'A nebula, purple and rose. Not solid: fly right into it. Slow going inside.',
  cradle: 'A green and gold nebula. Not solid: fly right into it. Slow going inside.',
  citadel: 'The Citadel of Ricks. Fly into it too fast and you’re inside its world.',
};
const wonderColor = (w) => w.color ?? w.colors?.[0] ?? (w.kind === 'black-hole' ? '#ffb070' : '#7fd6ff');

// Everywhere there is to go: the site's pages (stations round the sun), the
// fandoms' worlds and the wonders out in deep space. Each { id, name, kind
// ('station', 'world' or 'wonder'), type (in words), at, reach, color,
// about, to (its page, or null) }.
export const DESTINATIONS = [
  ...ORDER.map((id) => {
    const u = byId(id);
    const station = u.kind === 'core';
    return {
      id,
      name: station ? u.label : u.world,
      kind: station ? 'station' : 'world',
      type: station ? 'Station' : u.label,
      at: POSITIONS[id],
      reach: REACH[id],
      color: u.swatch,
      about: station ? u.sign[1] : u.portal ? `The hyperspace gate into ${u.world.toLowerCase()}.` : `${u.world}, the ${u.label} world.`,
      to: u.to,
    };
  }),
  ...WONDERS.map((w) => ({
    id: w.id,
    name: w.name,
    kind: 'wonder',
    type: WONDER_KIND[w.kind] ?? 'Wonder',
    at: w.at,
    reach: reachOf(w),
    color: wonderColor(w),
    about: WONDER_ABOUT[w.id] ?? '',
    to: null,
  })),
];
const BY_ID = Object.fromEntries(DESTINATIONS.map((d) => [d.id, d]));
export const destinationById = (id) => BY_ID[id] ?? null;

export const KINDS = [
  { id: 'all', name: 'Everywhere' },
  { id: 'station', name: 'Stations' },
  { id: 'world', name: 'Worlds' },
  { id: 'wonder', name: 'Wonders' },
];

// the destinations a filter and a search leave, in map order (the search
// matches the name, its fandom or what it is, ignoring case and accents)
const fold = (t) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
export function findDestinations(kind = 'all', query = '') {
  const q = fold(query.trim());
  return DESTINATIONS.filter((d) => (kind === 'all' || d.kind === kind) && (!q || fold(`${d.name} ${d.type} ${byId(d.id)?.label ?? ''}`).includes(q)));
}

// where the ship parks at a place (the Maw: the edge of its pull, not in it)
export function parkFor(id, from) {
  if (id === MAW.id) return parkNear(from);
  return parkAt(id, from);
}

// how far it is from (x, y, z) to a place: to its parking spot's side of
// it, in map units (the edge of what's there, not its middle)
export function distanceTo(ship, id) {
  const d = destinationById(id);
  if (!d || !ship) return null;
  const c = Math.hypot(ship.x - d.at[0], (ship.y ?? 0) - d.at[1], ship.z - d.at[2]);
  return Math.max(0, c - d.reach);
}

// How long the trip takes on a drive, in seconds: the jump, or the
// autopilot flown there on the ship's own physics (without hunters, who'd
// slow it); null if it can't get there (or isn't somewhere to go)
export function tripTime(ship, id, drive = 'super', { limit = 150, dt = 1 / 30 } = {}) {
  if (!ship || !GOALS[id]) return null;
  if (drive === 'hyper') return HYPER.length;
  const park = parkFor(id, [ship.x, ship.z]);
  if (!park) return null;
  const od = driveById(drive).od;
  let s = { ...ship };
  for (let t = 0; t < limit; t += dt) {
    const a = autopilot(s, id, park, undefined, od);
    if (a.done) return t;
    s = step(s, a.input, dt).ship;
  }
  return null;
}

// "8 s", "1 min 5 s", or a dash
export function formatTime(t) {
  if (t === null || t === undefined || !Number.isFinite(t)) return '—';
  if (t < 10) return `${t.toFixed(1)} s`;
  if (t < 60) return `${Math.round(t)} s`;
  const m = Math.floor(t / 60);
  const s = Math.round(t - m * 60);
  return s ? `${m} min ${s} s` : `${m} min`;
}
// map units in the map's own measure: ship-lengths (the ship's 0.26 long)
const SHIP_LENGTH = 0.26;
export function formatDistance(units) {
  if (units === null || units === undefined) return '—';
  const n = units / SHIP_LENGTH;
  if (n < 1) return 'Here';
  const r = n < 1000 ? Math.round(n / 10) * 10 : Math.round(n / 100) * 100;
  return `${Math.max(10, r).toLocaleString('en-US')} ship-lengths`;
}

// ── The chart ──
// Seen from straight above, north (−z) up. Two views: the whole universe,
// out to the edge of the map, on a square-root scale (so the home system
// opens up and the far worlds still fit), and the home system alone, to
// scale. chartAt gives where (x, z) is on it, 0…1 across and down.
export const CHART_VIEWS = {
  all: { id: 'all', name: 'Universe', r: EDGE, scale: 'sqrt' },
  home: { id: 'home', name: 'Home system', r: HOME_RADIUS * 1.15, scale: 'linear' },
};
const MARGIN = 0.47; // the chart's radius, of its width (a little room round the edge)
export function chartRadius(r, view = CHART_VIEWS.all) {
  const k = Math.max(0, r) / view.r;
  return (view.scale === 'sqrt' ? Math.sqrt(k) : k) * MARGIN;
}
export function chartAt(x, z, view = CHART_VIEWS.all) {
  const r = Math.hypot(x, z);
  if (r < 1e-9) return [0.5, 0.5];
  const k = chartRadius(r, view) / r;
  return [0.5 + x * k, 0.5 + z * k];
}
// on the chart at all (the home view leaves deep space off it)
export const onChart = ([u, v]) => u >= -0.01 && u <= 1.01 && v >= -0.01 && v <= 1.01;
// which way the ship's nose points on the chart, in degrees clockwise from
// pointing right (its heading 0 is −z: up)
export const chartHeading = (heading) => (Math.atan2(-Math.cos(heading), -Math.sin(heading)) * 180) / Math.PI;

// how fast the ship's going, in words: parked, flying, on the pulse drive, at super speed
export function speedWord(speed) {
  const v = Math.abs(speed ?? 0);
  if (v < 0.3) return 'Holding still';
  if (v <= SHIP.boost + 1) return 'Flying';
  if (v <= SHIP.pulse + 5) return 'On the pulse drive';
  return 'At super speed';
}
