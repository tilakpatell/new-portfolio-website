// The station’s security, section by section. Each section of a station
// (`station.sections`, a room’s `room.section`) has a level that trouble
// raises and time lowers: wary when something is odd, alert when someone
// is seen where they shouldn’t be, lockdown (blast doors sealed, squads
// called) six seconds later or at once on shots, hunt (doors open, squads
// search where you were last seen) once ten seconds pass without a
// sighting, and back down to wary after a minute of hunting with nobody
// found. A lockdown makes the sections next door wary, since whoever it is
// may come through. The intercom speaks at each step up and at the stand
// down, naming the section. Pure.
//
//   ALARM                                   the levels, lowest first
//   createAlarm(station) → alarm            { sections: { [id]: { level, since, seen, at } }, names, neighbours, pending }
//     since: when the section reached its level; seen: the last sighting there; at: where the trouble was last placed
//   raise(alarm, section, how, at, now) → level | null   null for a section the station doesn’t have
//     how: 'odd' (wary) | 'body' (alert) | 'seen' | 'camera' | 'intercom' (alert, and a sighting) | 'shots' (lockdown, and a sighting)
//   stepAlarm(alarm, dt, now) → events      what raise changed since the last step, then every timed change due by now
//     events: { type: 'level', section, level } | { type: 'intercom', key, section, name, text }
//     key: 'alert' | 'lockdown' | 'search' (to hunt) | 'standdown' (hunt to wary)
//   lockdowns(alarm) → Set<section>         what doors.js seals
//   levelOf(alarm, section) → level | null

export const ALARM = ['calm', 'wary', 'alert', 'lockdown', 'hunt'];

const WARY = 20; // seconds a wary section stays so after the last odd thing
const ALERT = 6; // seconds from alert to lockdown, for someone to be caught before the doors seal
const LOCKDOWN = 10; // seconds unseen before a lockdown opens up into a hunt
const HUNT = 60; // seconds of hunting with nobody found before the stand-down

// The least each cause raises a section to.
const CAUSES = { odd: 'wary', body: 'alert', seen: 'alert', camera: 'alert', intercom: 'alert', shots: 'lockdown' };
// The causes that say where the intruder is now, which keep a lockdown
// sealed and turn a hunt back into one. A body says only where they were.
const SIGHTINGS = new Set(['seen', 'camera', 'intercom', 'shots']);

// What the intercom says. The alert is the one line from the film (for
// Detention Block AA-23); the rest are the station’s own.
const SAYS = { alert: 'alert', lockdown: 'lockdown', hunt: 'search' };
const INTERCOM = {
  alert: (name) => `We have an emergency alert in ${name}.`,
  lockdown: (name) => `Security lockdown in ${name}. All blast doors sealed.`,
  search: (name) => `Blast doors opening in ${name}. Search parties, sweep every room.`,
  standdown: (name) => `Stand down in ${name}. Stay watchful at your posts.`,
};

const rank = (level) => ALARM.indexOf(level);

export function createAlarm(station) {
  const ids = Object.keys(station.sections);
  const sections = Object.fromEntries(ids.map((id) => [id, { level: 'calm', since: 0, seen: null, at: null }]));
  // Two sections neighbour each other when a door joins rooms of each; a
  // lift doesn’t count, since it joins levels far apart.
  const sectionOf = new Map(station.rooms.map((r) => [r.id, r.section]));
  const neighbours = new Map(ids.map((id) => [id, new Set()]));
  for (const door of station.doors) {
    const a = sectionOf.get(door.a);
    const b = sectionOf.get(door.b);
    if (a === b || !neighbours.has(a) || !neighbours.has(b)) continue;
    neighbours.get(a).add(b);
    neighbours.get(b).add(a);
  }
  return { sections, names: { ...station.sections }, neighbours, pending: [] };
}

// When a section next changes by itself, and to what. A lockdown holds
// ten seconds from the later of its start and the last sighting, so one
// begun by an alert’s timer isn’t over almost as soon as it seals.
function due(s) {
  if (s.level === 'wary') return { time: s.since + WARY, level: 'calm' };
  if (s.level === 'alert') return { time: s.since + ALERT, level: 'lockdown' };
  if (s.level === 'lockdown') return { time: Math.max(s.since, s.seen ?? s.since) + LOCKDOWN, level: 'hunt' };
  if (s.level === 'hunt') return { time: s.since + HUNT, level: 'wary' };
  return null;
}

function enter(alarm, id, level, time, events) {
  const s = alarm.sections[id];
  const key = level === 'wary' && s.level === 'hunt' ? 'standdown' : SAYS[level];
  s.level = level;
  s.since = time;
  events.push({ type: 'level', section: id, level });
  if (key) {
    const name = alarm.names[id];
    events.push({ type: 'intercom', key, section: id, name, text: INTERCOM[key](name) });
  }
  if (level !== 'lockdown') return;
  for (const n of alarm.neighbours.get(id)) {
    const next = alarm.sections[n];
    if (next.level === 'calm') enter(alarm, n, 'wary', time, events);
    else if (next.level === 'wary') next.since = Math.max(next.since, time);
  }
}

export function raise(alarm, section, how, at, now) {
  const goal = CAUSES[how];
  // a typo in a story’s effects should fail its test, not pass quietly
  if (!goal) throw new Error(`alarm: no cause called “${how}”`);
  const s = alarm.sections[section];
  if (!s) return null;
  const sighted = SIGHTINGS.has(how);
  if (sighted) s.seen = now;
  let to = s.level;
  if (s.level === 'hunt') to = sighted ? 'lockdown' : 'hunt';
  else if (rank(goal) > rank(s.level)) to = goal;
  if (to !== s.level) enter(alarm, section, to, now, alarm.pending);
  // more oddness keeps a wary section wary for longer
  else if (to === 'wary') s.since = now;
  // a lesser cause changes nothing, not even where the squads will look
  else if (!sighted) return s.level;
  // a copy: the body passed in moves on, the place it was seen does not
  if (at) s.at = { x: at.x, y: at.y ?? 0, z: at.z };
  return s.level;
}

// The clocks run on `now` (the sim’s seconds) so a raise and a step agree
// on the time; `dt` is taken to match every other step.
export function stepAlarm(alarm, dt, now) {
  const events = alarm.pending.splice(0);
  for (;;) {
    let next = null;
    for (const [id, s] of Object.entries(alarm.sections)) {
      const d = due(s);
      if (d && d.time <= now && (!next || d.time < next.time)) next = { id, ...d };
    }
    if (!next) return events;
    enter(alarm, next.id, next.level, next.time, events);
  }
}

export function lockdowns(alarm) {
  return new Set(Object.keys(alarm.sections).filter((id) => alarm.sections[id].level === 'lockdown'));
}

export function levelOf(alarm, section) {
  return alarm.sections[section]?.level ?? null;
}
