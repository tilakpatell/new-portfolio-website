// The second Death Star’s Rebel story, “The Emperor’s Tower”: Luke in
// black and unarmed, given up to Vader, from ST 321’s ramp up the tower to
// the throne room, the duel and the lightning, then down again with his
// father on his shoulders to a shuttle as the reactor goes. Data for
// rules/story.js, in eight beats; each beat is a run of steps, the first
// carrying the beat’s name, and a beat is what a failed step goes back to
// the start of.
//
// Vader and the Emperor stand in several beats, and a beat begun from a
// save has only what it brings itself, so each beat that needs them
// brings them afresh (`bring`): whoever stands under the tag goes first,
// so a beat begun in play has no double. Those fought in the duel are
// spawned under tags of their own, one Vader a round, since a fight
// counts everyone put down under its tag. The conversations are in
// rules/talks/ds2.js; none needs a target, so each opens as its step
// begins. Lines are the site’s own but for a few short famous ones.
//
// What the game is held to here:
// - A Vader spawned hostile is fought with saber.js and force.js’s
//   vaderMind and is never killed: at half his health he is put down (a
//   `killed` event under his tag) and gives ground. While you hide he
//   hunts the throne room, and finding you is being caught.
// - The throne talk’s `pull-saber` pulls the saber off the armrest with
//   the Force (the `pulled` event, 'armrest-saber', is the egg’s); the
//   talk ends there, so the duel begins at once.
// - A hostile Emperor is run by emperorMind. With the saber thrown away,
//   Luke’s guard is his raised arms, which force.js takes as any guard
//   facing the Emperor: half the lightning, paid for in stamina.
// - While the flag `carrying` is set, Vader is the companion held up at
//   Luke’s side, his arm over Luke’s shoulders, limping as Luke walks
//   (plot.js’s holdUp), and Luke walks (never runs, jumps or crouches);
//   while `breach` is set the station shakes, panels burst off the walls
//   in fire and smoke (breach.js).
// - At the foot of the ramp Vader is set down sitting against it for the
//   mask, and lies there once the talk is over; he goes aboard with you.
//
//   DS2_REBEL → { id, station, side, hero, title, steps }

import { chain, say, spawn } from '../story';

// Down the ramp of Vader’s shuttle, with nothing in his hands.
// (he is Vader's prisoner from the first: the garrison lets him walk, and only those the story sets
// on him fight him)
const BEGIN = { spot: 'dock-ramp', hero: 'luke', armour: false, helmet: false, companions: [], flags: ['prisoner'], gun: null };

const bring = (kind, spot, tag, opts, n) => [{ despawn: tag }, ...spawn(kind, spot, tag, opts, n)];

// the station emptying: the crew run for the shuttle at the west ramp, and leave Luke to it
const FLEE = { role: 'scripted', hostile: false, script: [{ to: 'dock-ramp', run: true }] };

const ESCORT = [
  {
    id: 'escort',
    type: 'scene',
    text: 'Vader’s shuttle sets down in the dock with you aboard.',
    need: { scene: 'arrive2' },
    // (Vader walks his prisoner to the lift, and his guards keep close behind)
    start: [{ music: 'quiet' }, ...spawn('vader', 'vader-arrive', 'vader', { role: 'lead', to: 'holding-lift' }), ...spawn('royalguard', 'dock-ramp', 'guards', { role: 'follow' }, 2), { scene: 'arrive2' }],
  },
  {
    id: 'escort-walk',
    type: 'escort',
    text: 'Walk with Vader and his guards through the station to the lift up the Emperor’s Tower.',
    target: { spot: 'holding-lift' },
    need: 'vader',
  },
];

const LIFT = [
  {
    id: 'lift',
    type: 'talk',
    text: 'The lift doors close on the four of you. Your father speaks first.',
    need: { talk: 'vader-lift' },
    start: [...bring('vader', 'holding-lift', 'vader', { role: 'follow' }), ...bring('royalguard', 'holding-lift', 'guards', { role: 'follow' }, 2)],
  },
  {
    id: 'lift-ride',
    type: 'scene',
    text: 'Up the Emperor’s Tower.',
    need: { scene: 'tower' },
    start: [{ scene: 'tower' }],
    // the guards keep the lift doors at the top, and Vader walks you before the throne
    end: [{ despawn: 'guards' }, { to: 'under-stairs' }],
  },
];

// the Emperor on his throne, watching (he stands for the lightning)
const SEATED = { role: 'scripted', script: [{ anim: 'sit' }] };

const THRONE = [
  {
    id: 'throne',
    type: 'talk',
    text: 'Before the throne. The Emperor speaks, and your saber lies on the armrest at his side.',
    need: { talk: 'throne' },
    start: [...bring('emperor', 'throne-seat', 'emperor', SEATED), ...bring('vader', 'under-stairs', 'vader', { role: 'scripted' })],
  },
];

const DUEL = [
  {
    id: 'duel',
    type: 'fight',
    text: 'Vader’s blade meets yours. Fight him across the dais, down the stairs and out on the catwalk until he gives ground.',
    target: { tag: 'duel-vader' },
    start: [
      { give: 'saber' },
      { music: 'alert' },
      ...bring('emperor', 'throne-seat', 'emperor', SEATED),
      { despawn: 'vader' },
      ...spawn('vader', 'throne-armrest', 'duel-vader', { role: 'scripted', hostile: true }),
      say('vader', 'Obi-Wan has taught you well.'),
    ],
    fail: [say('vader', 'You are beaten. It is useless to resist.')],
  },
  {
    id: 'duel-hide',
    type: 'reach',
    text: 'He is giving ground. Put up your blade and slip away into the dark under the stairs.',
    target: { spot: 'under-stairs' },
    start: [say('you', 'I will not fight you, Father.')],
  },
  {
    id: 'duel-wait',
    type: 'hide',
    text: 'Stay hidden under the stairs while he hunts for you.',
    target: { spot: 'under-stairs' },
    time: 10,
    start: [say('vader', 'You cannot hide forever, Luke.')],
    // he finds you anyway, in your thoughts
    end: [say('vader', 'Your thoughts betray you.'), say('vader', 'Sister…'), say('vader', 'If you will not turn, perhaps she will.'), { despawn: 'duel-vader' }],
    fail: [say('vader', 'There you are.')],
  },
  {
    id: 'duel-fury',
    type: 'fight',
    text: 'Out of the dark after him. Drive him back along the catwalk and beat him down.',
    target: { tag: 'fury-vader' },
    start: [say('you', 'Never.'), ...spawn('vader', 'shaft-edge', 'fury-vader', { role: 'scripted', hostile: true })],
    fail: [say('vader', 'You are beaten. It is useless to resist.')],
  },
  {
    // every way through the Emperor’s talk ends with the saber thrown away
    id: 'duel-choice',
    type: 'talk',
    text: 'Vader is down, his hand cut away. Strike him down, as the Emperor asks, or throw your saber away.',
    need: { talk: 'strike-down', node: 'so-be-it' },
    end: [{ take: 'saber' }],
  },
];

const LIGHTNING = [
  {
    id: 'lightning',
    type: 'timer',
    text: 'The Emperor’s lightning. Hold your guard up against it, and live.',
    time: 10,
    start: [
      { despawn: 'fury-vader' },
      ...bring('vader', 'shaft-edge', 'vader', { role: 'scripted' }),
      ...bring('emperor', 'throne-seat', 'emperor', { role: 'scripted', hostile: true }),
      say('emperor', 'Now, young Skywalker, you will die.'),
    ],
    fail: [say('emperor', 'Your feeble skills are no match for the power of the dark side.')],
  },
  {
    id: 'lightning-throw',
    type: 'scene',
    text: 'Vader turns on his master.',
    need: { scene: 'throw' },
    start: [say('you', 'Father, please. Help me.'), { scene: 'throw' }],
    // down the shaft he goes
    end: [{ despawn: 'emperor' }],
  },
];

const CARRY = [
  {
    id: 'carry',
    type: 'escort',
    text: 'The reactor is going. Get your father down the tower and across the station to the shuttle in the dock.',
    target: { spot: 'shuttle-ramp' },
    need: 'vader',
    time: 120,
    start: [
      { despawn: 'vader' },
      { companion: 'vader', follow: true },
      { flag: 'carrying' },
      { flag: 'breach' },
      { music: 'alert' },
      { intercom: { section: 'tower', text: 'All hands, abandon station. Make for the shuttles.' } },
      ...spawn('technician', 'holding-lift', 'crowd', FLEE, 3),
      ...spawn('gunner', 'firing-switch', 'crowd', FLEE, 3),
    ],
    fail: [say('you', 'Too late. The last of the shuttles has gone.')],
  },
];

const MASK = [
  {
    id: 'mask',
    type: 'scene',
    text: 'At the foot of the ramp, he asks you to stop.',
    need: { scene: 'mask' },
    // set down here, not in the carry’s end, so a save at the ramp still finds him on Luke’s shoulder
    start: [{ unflag: 'carrying' }, { companion: 'vader', follow: false }, ...bring('vader', 'mask-seat', 'vader', { role: 'scripted', script: [{ anim: 'ground' }] }), { to: 'mask-kneel' }, { scene: 'mask' }],
  },
  {
    id: 'mask-talk',
    type: 'talk',
    text: 'Your father, with his mask off.',
    need: { talk: 'unmasking' },
    end: [...bring('vader', 'mask-seat', 'vader', { role: 'scripted', script: [{ anim: 'lie' }] })],
  },
];

const ESCAPE = [
  { id: 'escape', type: 'reach', text: 'He is gone. Get aboard the shuttle before the reactor goes.', target: { spot: 'escape-board' } },
  {
    id: 'escape-flight',
    type: 'scene',
    text: 'Out of the dock as the station goes up.',
    need: { scene: 'escape2' },
    start: [{ scene: 'escape2' }],
    end: [{ achievement: 'ds-ds2-rebel' }, { end: true }],
  },
];

export const DS2_REBEL = {
  id: 'ds2-rebel',
  station: 'ds2',
  side: 'rebel',
  hero: 'luke',
  title: 'The Emperor’s Tower',
  steps: chain(BEGIN, [ESCORT, LIFT, THRONE, DUEL, LIGHTNING, CARRY, MASK, ESCAPE]),
};
