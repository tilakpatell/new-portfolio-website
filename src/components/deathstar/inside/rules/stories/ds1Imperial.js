// The first Death Star’s Imperial story, “Intruder alert”: a stormtrooper
// of Bay 327’s garrison, from the freighter coming in on the tractor beam
// to the homing beacon on her hull as she goes. Data for rules/story.js,
// in six beats, each a run of steps whose first carries the beat’s name
// and is where a failed step starts again.
//
// The intruders are the Rebel story’s own people, seen from the other
// side; they are scripted, so they fall back down the cell bay and swing
// across the chasm whatever you hit them with. The things a step acts on
// stand at the station’s spots of the same name (the control room’s door
// panel at `ctl-door`, the freighter’s hull at `beacon`). The scanning
// crew follow you (role 'follow') while you walk them, since an escort
// is done only on an arrival whose `with` names them.
//
//   DS1_IMPERIAL → { id, station, side, hero, title, steps }

import { chain, say, spawn } from '../story';

// on the deck of the bay by the foot of the control room’s stair, where the garrison’s trooper starts
const BEGIN = { spot: 'stairs327', hero: 'stormtrooper', armour: true, helmet: true, companions: [], flags: [], gun: 'e11' };

const MUSTER = [
  {
    id: 'muster',
    type: 'reach',
    text: 'Fall in with the ranks on the deck of Docking Bay 327.',
    target: { spot: 'ranks' },
    start: [{ music: 'calm' }, ...spawn('stormtrooper', 'ranks', 'ranks', {}, 3)],
  },
  {
    id: 'muster-tractor',
    type: 'scene',
    text: 'Stand fast while the tractor beam draws the freighter in.',
    need: { scene: 'tractor' },
    start: [{ intercom: { section: 'bay327', text: 'Bay 327, stand clear of the field. The freighter is coming in on the beam.' } }, { scene: 'tractor' }],
  },
];

const SCAN = [
  {
    id: 'scan',
    type: 'escort',
    text: 'Take the scanning crew out to the freighter’s ramp.',
    target: { spot: 'falcon-ramp' },
    need: 'scan-crew',
    start: [...spawn('technician', 'scan-crew', 'scan-crew', { role: 'follow' }, 2), say('officer', 'Get the scanning crew aboard. Every compartment of that ship, checked.')],
  },
  {
    id: 'scan-back',
    type: 'escort',
    text: 'Walk them back to the stair once they’re done.',
    target: { spot: 'scan-crew' },
    need: 'scan-crew',
    start: [say('technician', 'Nothing aboard. No crew, no cargo, not even a warm seat.')],
    // back at the stair they go up to make their report, and stop following you
    end: [{ despawn: 'scan-crew' }],
  },
  {
    id: 'scan-vader',
    type: 'reach',
    text: 'Report to Lord Vader.',
    target: { spot: 'vader-bay' },
    start: spawn('vader', 'vader-bay', 'vader', { role: 'scripted' }),
    end: [say('vader', 'Did you find any droids?'), say('you', 'No, my lord. If there were any aboard, they went with the crew.')],
  },
  {
    id: 'scan-orders',
    type: 'timer',
    text: 'Stand to attention while Lord Vader decides.',
    time: 5,
    end: [say('vader', 'Search her again. Every panel.'), { despawn: 'vader' }],
  },
];

const TK421 = [
  {
    id: 'tk421',
    type: 'reach',
    text: 'TK-421 isn’t answering at the freighter, and Docking Control 327 has gone quiet. Go up and see why.',
    target: { spot: 'ctl-door' },
    // whoever is inside has locked the door behind them
    start: [{ lock: 'bay327-ctl' }, { intercom: { section: 'bay327', text: 'TK-421, report. TK-421, do you copy?' } }],
  },
  { id: 'tk421-door', type: 'use', text: 'The door is locked from inside. Override it at its panel.', target: { tag: 'ctl-door' }, end: [{ unlock: 'bay327-ctl' }] },
  {
    id: 'tk421-closet',
    type: 'reach',
    text: 'The officer is down. Search the control room.',
    target: { spot: 'ctl-closet' },
    start: [...spawn('threepio', 'ctl-closet', 'closet-droids', { role: 'scripted' }), ...spawn('artoo', 'ctl-closet', 'closet-droids', { role: 'scripted' })],
    end: [say('threepio', 'Madmen, sir, the lot of them. They’ve gone for the prison level. If you hurry you’ll catch them.')],
  },
];

const AA23 = [
  {
    id: 'aa23',
    type: 'reach',
    text: 'Emergency in Detention Block AA-23. Take the lift down to Level 5.',
    target: { room: 'aa23' },
    start: [
      { alarm: { section: 'aa23', how: 'intercom' } },
      { music: 'alert' },
      ...spawn('luke', 'cellbay-squad', 'intruders', { role: 'scripted', hostile: true }),
      ...spawn('han', 'cellbay-squad', 'intruders', { role: 'scripted', hostile: true }),
      ...spawn('chewie', 'cellbay-squad', 'intruders', { role: 'scripted', hostile: true }),
      ...spawn('leia', 'cell2187-door', 'intruders', { role: 'scripted', hostile: true }),
    ],
  },
  {
    id: 'aa23-cellbay',
    type: 'reach',
    text: 'Drive them back down the cell bay.',
    target: { spot: 'chute-grate' },
    end: [{ despawn: 'intruders' }, say('you', 'They’ve gone down the garbage chute.')],
  },
];

const SWEEP = [
  {
    id: 'sweep',
    type: 'reach',
    text: 'Sweep the maintenance corridors on Level 6.',
    target: { spot: 'maint-sweep' },
    start: [{ intercom: { section: 'aa23', text: 'All units to Level 6. The intruders have come up out of a compactor.' } }],
  },
  {
    id: 'sweep-upper',
    type: 'reach',
    text: 'They’re cornered where the bridge is drawn back. Take the gantry up to the chasm’s upper ledge.',
    target: { spot: 'chasm-upper' },
    start: [{ bridge: false }, ...spawn('luke', 'chasm-ledge', 'chasm-pair', { role: 'scripted', hostile: true }), ...spawn('leia', 'chasm-ledge', 'chasm-pair', { role: 'scripted', hostile: true })],
  },
  { id: 'sweep-fire', type: 'timer', text: 'Fire across the chasm and keep them pinned on the ledge.', time: 10 },
  { id: 'sweep-swing', type: 'scene', text: 'They’re swinging across.', need: { scene: 'swing' }, start: [{ scene: 'swing' }], end: [{ despawn: 'chasm-pair' }] },
];

const BEACON = [
  {
    id: 'beacon',
    type: 'use',
    text: 'Orders from Lord Vader: let them reach their ship. Get to Bay 327 and fix the homing beacon to the freighter’s hull before she lifts.',
    target: { tag: 'beacon' },
    time: 60,
    start: [
      { intercom: { section: 'core', text: 'All units, hold your fire. Let them reach the freighter. Lord Vader’s orders.' } },
      { give: 'beacon' },
      ...spawn('vader', 'duel', 'duel', { role: 'scripted' }),
      ...spawn('obiwan', 'duel', 'duel', { role: 'scripted' }),
      { music: 'calm' },
    ],
    end: [{ take: 'beacon' }, say('you', 'Beacon’s on her hull.')],
    fail: [say('you', 'Too late. She’s lifting, and no beacon on her.')],
  },
  {
    id: 'beacon-escape',
    type: 'scene',
    text: 'The freighter lifts through the field, carrying your beacon.',
    need: { scene: 'escape' },
    start: [{ despawn: 'duel' }, { scene: 'escape' }],
    end: [{ achievement: 'ds-ds1-imperial' }, { end: true }],
  },
];

export const DS1_IMPERIAL = {
  id: 'ds1-imperial',
  station: 'ds1',
  side: 'imperial',
  hero: 'stormtrooper',
  title: 'Intruder alert',
  steps: chain(BEGIN, [MUSTER, SCAN, TK421, AA23, SWEEP, BEACON]),
};
