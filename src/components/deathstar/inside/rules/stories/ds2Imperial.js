// The second Death Star’s Imperial story, “Fully armed and operational”:
// a Death Star trooper at the command station, from clearing ST 321
// through the shield to the reactor breach and the run for the shuttles.
// Data for rules/story.js, in four beats, each a run of steps whose first
// carries the beat’s name and is where a failed step starts again. The
// walk to the hangar closes the first beat rather than opening the
// second, so a trooper who moves in the ranks starts the stand again in
// his place, not back at the console.
//
// The things a step acts on stand at the station’s spots of the same name
// (the shuttle console at `st321-console`, the firing switch at
// `firing-switch`). Jerjerrod is spawned under his talk’s id in the
// command centre, so talk.js offers it to him.
//
// What the game is held to here:
// - The `emperor` scene plays round you in the hangar and leaves you your
//   eyes and your feet, since keeping still through his arrival is the
//   step; moving is being caught, and earns the reprimand.
// - The chatter’s “It’s a trap!” carries the line `trap`, which the game
//   reports heard as it is said, for eggs.js.
// - While the flag `breach` is set the station shakes, panels fall and
//   fires burn in the corridors.
//
//   DS2_IMPERIAL → { id, station, side, hero, title, steps }

import { chain, say, spawn } from '../story';

// at the command station, by the shuttle console
const BEGIN = { spot: 'st321-console', hero: 'dstrooper', armour: false, helmet: true, companions: [], flags: [], gun: 'e11' };

// the crew abandoning the station, running for ST 321 at the dock’s west ramp
const FLEE = { role: 'scripted', hostile: false, script: [{ to: 'dock-ramp', run: true }] };

const CLEARANCE = [
  {
    id: 'clearance',
    type: 'talk',
    text: 'A shuttle is calling for clearance. Take the call at the command station’s shuttle console.',
    target: { tag: 'st321-console' },
    need: { talk: 'st321' },
    start: [{ music: 'calm' }, ...spawn('officer', 'st321-console', 'controller', { role: 'work' }), ...spawn('gunner', 'firing-switch', 'command-crew', { role: 'work' }, 2)],
  },
  {
    id: 'clearance-arrive',
    type: 'scene',
    text: 'ST 321 sets down in the dock.',
    need: { scene: 'arrive2' },
    start: [
      ...spawn('jerjerrod', 'vader-arrive', 'arrival', { role: 'scripted' }),
      // (under his own tag, so the scene keeps him aboard till the shuttle is down)
      ...spawn('vader', 'dock-ramp', 'vader', { role: 'scripted' }),
      ...spawn('dstrooper', 'vader-arrive', 'arrival', {}, 4),
      { scene: 'arrive2' },
    ],
  },
  {
    id: 'clearance-vader',
    type: 'talk',
    text: 'Commander Jerjerrod meets Lord Vader at the foot of the ramp.',
    need: { talk: 'jerjerrod-vader' },
    end: [{ despawn: 'arrival' }, { despawn: 'vader' }],
  },
  {
    id: 'clearance-hangar',
    type: 'reach',
    text: 'The Emperor is coming. Fall in with the ranks in Hangar 272.',
    target: { spot: 'ranks272' },
    start: [{ intercom: { section: 'command', text: 'All off-watch troops to Hangar 272. Full ranks for His Majesty’s arrival.' } }],
  },
];

const RANKS = [
  {
    id: 'ranks',
    type: 'still',
    text: 'Stand to attention while the Emperor comes down the aisle. Don’t move until he has passed.',
    time: 40,
    start: [
      ...spawn('stormtrooper', 'ranks272', 'ranks', {}, 6),
      ...spawn('officer', 'ranks272', 'ranks'),
      // down the ramp and the aisle at his own slow pace, once Vader has knelt to him at its foot; his
      // guards a pace behind, two and two
      ...spawn('emperor', 'emperor-ramp', 'procession', { role: 'scripted', script: [{ wait: 5 }, { say: 'Rise, my friend.' }, { wait: 1 }, { to: 'aisle-end' }, { face: 'aisle-end' }] }),
      ...spawn('vader', 'emperor-ramp', 'procession', { role: 'scripted', script: [{ anim: 'kneel', s: 6 }, { to: 'aisle-vader' }, { face: 'aisle-vader' }] }),
      ...spawn('royalguard', 'emperor-ramp', 'procession', { role: 'scripted', script: [{ wait: 7 }, { to: 'aisle-guard-l' }, { face: 'aisle-guard-l' }] }, 2),
      ...spawn('royalguard', 'emperor-ramp', 'procession', { role: 'scripted', script: [{ wait: 7 }, { to: 'aisle-guard-r' }, { face: 'aisle-guard-r' }] }, 2),
      { scene: 'emperor' },
    ],
    fail: [say('officer', 'Eyes front, trooper. Not a muscle while His Majesty is on the deck.')],
  },
];

const FIRE = [
  {
    id: 'fire',
    type: 'reach',
    text: 'The Rebel fleet has come out of hyperspace. Back to the command centre and take the firing station.',
    target: { spot: 'firing-switch' },
    start: [
      { despawn: 'procession' },
      { despawn: 'ranks' },
      { music: 'alert' },
      { intercom: { section: 'hangar272', text: 'Battle stations. The Rebel fleet is closing on the station.' } },
      ...spawn('jerjerrod', 'st321-console', 'jerjerrod'),
    ],
  },
  {
    id: 'fire-wait',
    type: 'timer',
    text: 'Stand by the firing switch for the order, and listen to the fleet on the comms.',
    time: 8,
    start: [{ intercom: { section: 'command', text: 'Intercepted, Rebel command channel: “It’s a trap!”', line: 'trap' } }],
  },
  {
    id: 'fire-switch',
    type: 'use',
    text: 'The order. Throw the firing switch.',
    target: { tag: 'firing-switch' },
    start: [say('emperor', 'Fire at will, Commander.'), say('jerjerrod', 'You heard His Majesty. Fire.')],
  },
  { id: 'fire-cruiser', type: 'scene', text: 'The superlaser fires. A Rebel cruiser dies in the window.', need: { scene: 'cruiser' }, start: [{ scene: 'cruiser' }] },
];

const BREACH = [
  {
    id: 'breach',
    type: 'reach',
    text: 'The main reactor is breached. Get to the shuttles in the dock before it goes.',
    target: { room: 'dock' },
    time: 150,
    start: [
      { flag: 'breach' },
      { music: 'alert' },
      { intercom: { section: 'command', text: 'Main reactor breach. All hands, abandon station.' } },
      ...spawn('gunner', 'firing-switch', 'crowd', FLEE, 3),
      ...spawn('technician', 'st321-console', 'crowd', FLEE, 2),
    ],
    fail: [say('you', 'The last shuttle’s gone, and the station with it.')],
  },
  {
    id: 'breach-escape',
    type: 'scene',
    text: 'Away from the station as the reactor goes.',
    need: { scene: 'escape2' },
    start: [{ scene: 'escape2' }],
    end: [{ achievement: 'ds-ds2-imperial' }, { end: true }],
  },
];

export const DS2_IMPERIAL = {
  id: 'ds2-imperial',
  station: 'ds2',
  side: 'imperial',
  hero: 'dstrooper',
  title: 'Fully armed and operational',
  steps: chain(BEGIN, [CLEARANCE, RANKS, FIRE, BREACH]),
};
