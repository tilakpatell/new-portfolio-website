// The first Death Star’s Rebel story, “That’s no moon”: Luke, with Han,
// Chewbacca, Ben and the droids, from the smuggling hold through the
// rescue of the princess to the run back to the freighter. Data for
// rules/story.js, in thirteen beats; each beat is a run of steps, the
// first carrying the beat’s name, and a beat is what a failed step goes
// back to the start of.
//
// The things a step acts on stand at the station’s spots of the same name
// (the hold’s panel at `ambush-panel`, the cameras at `aa23-camera-1` and
// `-2`), the swing is the station’s jump `swing`, and the comlink is the
// one Luke takes from the control room. Someone to talk to is spawned
// with the talk’s id as their tag, so talk.js offers it to them. Lines are
// the site’s own but for a few short famous ones.
//
// What the game is held to here: the ramp guards are spawned only once
// the hold’s panel is used, at the foot of the ramp, as scripted people
// whose spawn `script` (routines.js’s, handed to brains.addPerson) walks
// them up it, through the hatch the ramp flag holds open, to the panel;
// so nobody stands outside to be shot first. Chewbacca counts as walked
// in only when the arrival’s `with` names him. The compactor’s hatch
// opens to its own code by doors.js, and the step out listens for the
// `dialled` event the 3263827 egg hears, so the story never opens it.
//
//   DS1_REBEL → { id, station, side, hero, title, steps }

import { chain, say, spawn } from '../story';

// They come aboard in the freighter’s smuggling hold, all six of them.
const BEGIN = { spot: 'scan-hide', hero: 'luke', armour: false, helmet: false, companions: ['han', 'chewie', 'obiwan', 'threepio', 'artoo'], flags: [], gun: 'e11' };

const SCAN = [
  {
    id: 'scan',
    type: 'hide',
    text: 'Lie low in the smuggling hold. Keep crouched and still until the search is over.',
    target: { spot: 'scan-hide' },
    time: 25,
    start: [
      { music: 'quiet' },
      say('han', 'I had these holds put in for cargo. Never thought I’d ride in one. Down, and don’t move.'),
      // a trooper searches the hold while the technicians scan the hull from the ramp
      ...spawn('technician', 'falcon-ramp', 'scan-crew', { role: 'work' }, 2),
      ...spawn('stormtrooper', 'ambush-panel', 'scan-crew'),
    ],
    end: [{ despawn: 'scan-crew' }, say('han', 'They’ve gone. Their scanner never looked under the deck plates.'), { music: 'calm' }],
    fail: [say('trooper', 'Movement in the hold. Out, all of you, and keep your hands where I can see them.')],
  },
];

// one of the two guards the panel calls, from his own place at the ramp’s foot up into the hold
const rampGuard = (n) => spawn('stormtrooper', `ambush-trooper-${n}`, 'ambush', { role: 'scripted', squad: 'ramp', script: [{ to: 'falcon-ramp' }, { to: 'ambush-panel' }] });

const AMBUSH = [
  {
    id: 'ambush',
    type: 'use',
    text: 'Bang on the panel by the hatch to bring the ramp guards up.',
    target: { tag: 'ambush-panel' },
    end: [say('han', 'You two at the ramp. The scanner’s jammed in here; come and take the other end.'), ...rampGuard(1), ...rampGuard(2)],
  },
  {
    id: 'ambush-down',
    type: 'fight',
    text: 'Put both troopers down as they come aboard, quietly.',
    target: { tag: 'ambush' },
    need: 2,
    // The armour is TK-421’s: the game reads the flag for the operating
    // number on it, which the disguise’s challenge and the egg go by.
    end: [{ flag: 'tk421' }, { give: 'armour' }, { give: 'helmet' }, say('han', 'Suit up. If anyone looks at us for long, we’re finished.')],
  },
];

const CONTROL = [
  {
    id: 'control',
    type: 'reach',
    text: 'In the troopers’ armour, take everyone across the bay to the door of Docking Control 327.',
    target: { spot: 'ctl-door' },
    start: [...spawn('officer', 'ctl-intercom', 'ctl-crew'), ...spawn('officer', 'ctl-aide', 'ctl-crew', { role: 'work' })],
  },
  {
    // no target: the gantry calls TK-421 on the helmet’s comlink
    id: 'control-call',
    type: 'talk',
    text: 'The gantry is calling TK-421 on your helmet’s comlink. Answer it.',
    need: { talk: 'ctl-officer' },
  },
  {
    id: 'control-fight',
    type: 'fight',
    text: 'The officer is coming out to see to it. Down him and his aide before either reaches the alarm.',
    target: { tag: 'ctl-crew' },
    need: 2,
    start: [{ music: 'alert' }],
    end: [{ music: 'calm' }],
  },
];

const SCOMP = [
  {
    id: 'scomp',
    type: 'use',
    text: 'Plug Artoo into the scomp link and find what holds the freighter.',
    target: { tag: 'scomp' },
    end: [
      { flag: 'tractor-found' },
      { flag: 'leia-found' },
      say('threepio', 'The tractor beam is coupled to the main reactor in seven places, sir. And Artoo says the princess is here, in Detention Block AA-23.'),
      say('obiwan', 'The tractor beam is mine to see to, and I go alone. Stay with the droids.'),
      { give: 'comlink' },
      say('luke', 'Keep this channel open, Threepio.'),
      { companion: 'obiwan', follow: false },
      { companion: 'threepio', follow: false },
      { companion: 'artoo', follow: false },
    ],
  },
];

const TRACTOR = [
  {
    id: 'tractor',
    type: 'swap',
    text: 'As Ben, go alone to the tractor beam’s power terminal on Level 6.',
    // Luke, Han and Chewbacca wait in the control room while Ben goes
    start: [{ hero: 'obiwan' }, { take: 'armour' }, { take: 'helmet' }, { take: 'gun:e11' }, { companion: 'han', follow: false }, { companion: 'chewie', follow: false }, { to: 'core6-start' }, { music: 'quiet' }],
  },
  {
    id: 'tractor-guards',
    type: 'reach',
    text: 'Two guards stand between you and the terminal. Turn their heads with the Force and slip past to the ledge unseen.',
    target: { spot: 'tractor-ledge' },
    need: 'unseen',
    start: spawn('stormtrooper', 'core6-guards', 'tractor-guards', {}, 2),
    fail: [say('trooper', 'You there, old man. Stay where you are.')],
  },
  { id: 'tractor-power-1', type: 'use', text: 'Out on the ledge, turn down the first of the terminal’s two power controls.', target: { tag: 'tractor-power-1' } },
  {
    id: 'tractor-power-2',
    type: 'use',
    text: 'Now the second.',
    target: { tag: 'tractor-power-2' },
    end: [{ flag: 'tractor-off' }, say('obiwan', 'There. She can go when the time comes.')],
  },
  {
    id: 'tractor-back',
    type: 'swap',
    text: 'Back to Luke in Docking Control 327.',
    start: [{ hero: 'luke' }, { give: 'armour' }, { give: 'helmet' }, { give: 'gun:e11' }, { companion: 'han', follow: true }, { companion: 'chewie', follow: true }, { to: 'window327' }, { music: 'calm' }],
  },
];

const TRANSFER = [
  {
    id: 'transfer',
    type: 'escort',
    text: 'Walk Chewbacca to lift 1 as your “prisoner”, and take it down to Level 5.',
    target: { spot: 'lift5' },
    need: 'chewie',
    // the detention officer is offered the transfer line only while this is set
    start: [{ flag: 'transfer' }],
  },
  {
    id: 'transfer-desk',
    type: 'escort',
    text: 'Bring him to the duty officer at Detention Block AA-23.',
    target: { spot: 'aa23-desk' },
    need: 'chewie',
    start: [...spawn('officer', 'aa23-desk', 'aa23-officer'), ...spawn('stormtrooper', 'aa23-guards', 'aa23-guard', { squad: 'aa23' }, 3)],
  },
  {
    id: 'transfer-1138',
    type: 'choose',
    text: 'Tell the officer where the prisoner has come from.',
    target: { npc: 'aa23-officer' },
    need: { talk: 'aa23-officer', choice: 'transfer-1138' },
    end: [{ unflag: 'transfer' }],
  },
  {
    id: 'transfer-fight',
    type: 'fight',
    text: 'Chewbacca has broken loose. Down the three guards.',
    target: { tag: 'aa23-guard' },
    need: 3,
    start: [{ music: 'alert' }],
  },
  { id: 'transfer-cameras', type: 'kill', text: 'Shoot out the block’s two cameras before they see any more.', target: { tag: 'aa23-camera' }, need: 2 },
];

const INTERCOM = [
  {
    id: 'intercom',
    type: 'talk',
    text: 'The intercom wants to know what the shooting was. Han takes it; pick his lines.',
    target: { tag: 'aa23-intercom' },
    need: { talk: 'han-intercom' },
    // however it goes the panel is shot, and the block goes on alert
    end: [{ alarm: { section: 'aa23', how: 'intercom' } }],
  },
];

const CELL = [
  {
    id: 'cell',
    type: 'reach',
    text: 'Find cell 2187 down the cell bay and open it.',
    target: { spot: 'cell2187-door' },
    // the block’s console is yours now, so the cell opens helmet or no
    start: [{ unlock: 'cell2187-door' }, ...spawn('leia', 'leia', 'leia-2187', { role: 'scripted' })],
  },
  {
    id: 'cell-leia',
    type: 'talk',
    text: 'Talk to the prisoner.',
    target: { npc: 'leia-2187' },
    need: { talk: 'leia-2187' },
    end: [{ despawn: 'leia-2187' }, { companion: 'leia', follow: true }],
  },
];

const CELLBAY = [
  {
    id: 'cellbay',
    type: 'fight',
    text: 'A squad has come up in the lift. Hold the cell bay.',
    target: { tag: 'cellbay-squad' },
    need: 3,
    start: spawn('stormtrooper', 'cellbay-squad', 'cellbay-squad', { squad: 'cellbay', hostile: true }, 3),
  },
  {
    id: 'cellbay-chute',
    type: 'reach',
    text: 'Leia has blasted the grate open. Into the garbage chute.',
    target: { spot: 'chute-slide' },
    // the station keeps the grate shut by this flag
    start: [{ flag: 'grate' }, say('leia', 'Into the garbage chute, flyboy.')],
  },
];

const COMPACTOR = [
  {
    id: 'compactor',
    type: 'reach',
    text: 'Dive down the chute after her.',
    target: { spot: 'compactor-drop' },
    end: [say('han', 'The hatch is sealed. Stand back.'), say('leia', 'Put that away. It’s magnetically sealed, and that bolt nearly came back through all of us.')],
  },
  {
    id: 'compactor-dianoga',
    type: 'use',
    text: 'Something has you by the leg and under. Mash use to fight free.',
    target: { tag: 'dianoga' },
    need: 9,
    time: 6,
    start: [...spawn('dianoga', 'dianoga', 'dianoga', { role: 'scripted' }), say('luke', 'Something brushed my leg. There’s something alive in the water.')],
    end: [{ despawn: 'dianoga' }, say('leia', 'It let go of you. Why would it let go?')],
    fail: [say('han', 'Luke. Luke, where are you?')],
  },
  {
    // Done on asking for the mashers off (the line that stops the walls in
    // talk.js), not when the talk closes, so the lines after it never run
    // the clock out on walls that have already stopped.
    id: 'compactor-walls',
    type: 'choose',
    text: 'The walls are closing in. Get Threepio on the comlink.',
    target: { tag: 'comlink' },
    need: { talk: 'threepio-comlink', choice: 'mashers' },
    time: 40,
    start: [{ walls: 'close' }, { music: 'alert' }, say('han', 'The walls are moving. Brace them with anything you can find.')],
    // Threepio has the mashers shut down, and the walls draw back
    end: [{ walls: 'open' }, { music: 'calm' }],
    // put back as the beat found them, for it to begin again
    fail: [say('leia', 'There’s no room left.'), { walls: 'open' }],
  },
  // the hatch is locked to this code, and opens to it without the story
  { id: 'compactor-hatch', type: 'use', text: 'Dial the compactor’s number, 3263827, on the hatch.', target: { tag: 'compactor-hatch' }, need: { code: '3263827' } },
];

const MAINT = [
  {
    id: 'maint',
    type: 'reach',
    text: 'Find a way through the maintenance corridors to the core shaft. Han and Chewbacca are drawing the troopers off.',
    target: { spot: 'chasm-door' },
    // as in the film, Han and Chewbacca make their own way and meet you at the bay
    start: [{ companion: 'han', follow: false }, { companion: 'chewie', follow: false }, say('han', 'We’ll lead them off. Meet you at the ship.'), ...spawn('stormtrooper', 'maint-squad', 'maint-squad', { squad: 'maint', hostile: true }, 3)],
  },
];

const CHASM = [
  {
    id: 'chasm',
    type: 'reach',
    text: 'The bridge is drawn back. Get to the edge of the ledge.',
    target: { spot: 'chasm-ledge' },
    // the blast door shuts behind, and a bolt takes the bridge’s control with it
    start: [
      { lock: 'maint2-chasm' },
      { bridge: false },
      say('luke', 'That was the bridge’s control. It won’t come out now.'),
      ...spawn('stormtrooper', 'chasm-upper', 'chasm-squad', { squad: 'chasm', hostile: true }, 2),
    ],
  },
  {
    id: 'chasm-grapple',
    type: 'use',
    text: 'Throw Luke’s grapple over the pipe above and swing across with Leia.',
    target: { tag: 'swing' },
    // the swing is the station’s jump, locked until there’s a line to swing on
    start: [{ flag: 'grapple' }],
  },
  { id: 'chasm-swing', type: 'scene', text: 'Across the chasm.', need: { scene: 'swing' }, start: [{ scene: 'swing' }], end: [{ to: 'chasm-far' }] },
];

const BAY = [
  {
    id: 'bay',
    type: 'reach',
    text: 'Back to Docking Bay 327: lift 2 up from the far side, then through the TIE launch bay.',
    target: { spot: 'bay-door' },
    end: [{ companion: 'han', follow: true }, { companion: 'chewie', follow: true }, say('han', 'Didn’t we just leave this party?')],
  },
  {
    id: 'bay-duel',
    type: 'scene',
    text: 'Ben and Vader, in the bay.',
    need: { scene: 'duel' },
    start: [...spawn('vader', 'duel', 'duel-vader', { role: 'scripted' }), ...spawn('obiwan', 'duel', 'duel-obiwan', { role: 'scripted' }), { scene: 'duel' }],
    // Ben is gone; his robe lies where he stood
    end: [{ despawn: 'duel-obiwan' }],
  },
  {
    id: 'bay-run',
    type: 'reach',
    text: 'Run for the freighter.',
    target: { spot: 'falcon-ramp' },
    time: 30,
    start: [say('obiwan', 'Run, Luke. Run.'), { alarm: { section: 'bay327', how: 'seen' } }, { music: 'alert' }, ...spawn('stormtrooper', 'scan-crew', 'bay-squad', { squad: 'bay', hostile: true }, 3)],
    fail: [say('han', 'She’s not going to wait for us.')],
  },
  { id: 'bay-escape', type: 'scene', text: 'Out through the magnetic field.', need: { scene: 'escape' }, start: [{ scene: 'escape' }], end: [{ achievement: 'ds-ds1-rebel' }, { end: true }] },
];

export const DS1_REBEL = {
  id: 'ds1-rebel',
  station: 'ds1',
  side: 'rebel',
  hero: 'luke',
  title: 'That’s no moon',
  steps: chain(BEGIN, [SCAN, AMBUSH, CONTROL, SCOMP, TRACTOR, TRANSFER, INTERCOM, CELL, CELLBAY, COMPACTOR, MAINT, CHASM, BAY]),
};
