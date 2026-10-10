// The words and choices the page shows over the station, worked out from
// what the world says (its 'ui' and 'hud' events) and the page’s address,
// so the HUD and the start screen stay plain drawing and this stays tested
// in Node. Pure.
//
//   STATION_CHOICES → [{ id, name, era, open }]   open: the station is built (rules/stations)
//   SIDES, MODES; STORIES[station][side] → the story’s title
//   heroesFor(side) → [{ id, name }]   Luke, Han, Leia, Obi-Wan for a Rebel; a stormtrooper for an Imperial
//   fromSearch(search) → { station, side, mode, hero, at }   a deep link’s choices, null where absent
//     or unknown (`?station=ds1&side=imperial&mode=roam&at=hangar`); `at` is a room id the world checks
//   sectionName(station, id) → the name the intercom uses, or the id as it came
//   security(alert) → { id, label, red }   calm, wary, alert, lockdown, hunt, stand-down
//   promptLine(prompt, { touch }) → null | { key, text }
//     prompt: 'call the lift' or { text, use }: E (Use on a touch screen) does what `text` says;
//     `use: false` is a notice with no key, such as a door that won’t open (doors open on their own,
//     so a door is never something to press E at)
//   gunName(id) → as stamped on the gun: E-11, DL-44, DH-17, A280
//   bladeName(colour) → 'Lightsaber', or '' without a blade
//   doubtLine(doubt) → null | { k, label, red }   the disguise meter: how far the garrison doubts
//     a Rebel in armour (null: no disguise), red from where they would challenge you
//   layers(status, ui) → { playing, paused, mapOpen, free }   what stands over the station, from the
//     runtime’s status and the world’s last 'ui' event; `free`: the pointer isn’t the page’s to hold

import { CHALLENGE } from '../rules/disguise';
import { STATIONS } from '../rules/stations';

export const STATION_CHOICES = [
  { id: 'ds1', name: 'The Death Star', era: '0 BBY, over Alderaan and Yavin' },
  { id: 'ds2', name: 'The second Death Star', era: '4 ABY, over Endor' },
].map((s) => ({ ...s, open: s.id in STATIONS }));

export const SIDES = ['rebel', 'imperial'];
export const MODES = ['story', 'roam'];

export const STORIES = {
  ds1: { rebel: 'That’s no moon', imperial: 'Intruder alert' },
  ds2: { rebel: 'The Emperor’s Tower', imperial: 'Fully armed and operational' },
};

const HEROES = {
  rebel: [
    { id: 'luke', name: 'Luke Skywalker' },
    { id: 'han', name: 'Han Solo' },
    { id: 'leia', name: 'Leia Organa' },
    { id: 'obiwan', name: 'Obi-Wan Kenobi' },
  ],
  imperial: [{ id: 'stormtrooper', name: 'A stormtrooper' }],
};

export const heroesFor = (side) => HEROES[side] ?? HEROES.rebel;

export function fromSearch(search) {
  const q = new URLSearchParams(search ?? '');
  const pick = (name, allowed) => {
    const v = q.get(name);
    return v && allowed.includes(v) ? v : null;
  };
  const station = pick('station', Object.keys(STATIONS));
  const side = pick('side', SIDES);
  // (an Imperial is always a stormtrooper, so only a Rebel picks)
  const heroes = HEROES.rebel.map((h) => h.id);
  const hero = side === 'rebel' ? pick('hero', heroes) : null;
  return { station, side, mode: pick('mode', MODES), hero, at: q.get('at') || null };
}

export function sectionName(station, id) {
  if (!id) return '';
  return STATIONS[station]?.sections?.[id] ?? id;
}

const SECURITY = {
  calm: { label: 'Calm', red: false },
  wary: { label: 'Wary', red: false },
  alert: { label: 'Alert', red: true },
  lockdown: { label: 'Lockdown', red: true },
  hunt: { label: 'Hunt', red: true },
  'stand-down': { label: 'Standing down', red: false },
};

export function security(alert) {
  const id = alert in SECURITY ? alert : 'calm';
  return { id, ...SECURITY[id] };
}

export function promptLine(prompt, { touch = false } = {}) {
  const p = typeof prompt === 'string' ? { text: prompt } : prompt;
  if (!p?.text) return null;
  return { key: p.use === false ? null : touch ? 'Use' : 'E', text: p.text };
}

const GUNS = { e11: 'E-11', dl44: 'DL-44', dh17: 'DH-17', a280: 'A280' };

export const gunName = (id) => (id ? (GUNS[id] ?? id) : '');

export const bladeName = (colour) => (colour ? 'Lightsaber' : '');

// how the doubt reads, by where it has got to; from CHALLENGE (rules/disguise.js) a trooper stops you
const DOUBT = [
  [1, 'Blown'],
  [CHALLENGE, 'Questioned'],
  [0.15, 'Noticed'],
  [0, 'Unnoticed'],
];

export function doubtLine(doubt) {
  if (doubt == null || !Number.isFinite(doubt)) return null;
  const k = Math.max(0, Math.min(1, doubt));
  const label = DOUBT.find(([from]) => k >= from)[1];
  return { k, label, red: k >= CHALLENGE };
}

// The last 'ui' event outlives the world (a lost context keeps it, map open
// and all), so nothing of a game stands over the station unless it is on:
// a map left up would cover the failure screen and close on nothing.
export function layers(status, ui) {
  const on = status === 'on';
  const playing = on && ui?.mode === 'play';
  const paused = on && ui?.mode === 'pause';
  const mapOpen = playing && Boolean(ui.map?.open);
  // the pointer is the page’s to hold only while you walk: never over a menu, a conversation or the map
  return { playing, paused, mapOpen, free: !playing || Boolean(ui.talk) || mapOpen };
}
