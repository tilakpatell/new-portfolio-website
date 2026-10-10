// The second Death Star’s conversations, as data for rules/talk.js (see
// it for the shape). Jerjerrod is “Commander” on screen and a Moff in
// canon; his nameplate says Moff, and he would rather you didn’t mention
// it. Only short famous lines are the film’s own; the rest is the site’s.
// All but Jerjerrod’s own are the stories’: none is any person’s tag, so
// none is offered by walking up to someone, and each opens when its step
// does (rules/stories/ds2Rebel.js and ds2Imperial.js). The game acts on one
// `does`: 'pull-saber', the Force pull that takes Luke’s saber off the
// throne’s armrest before the Emperor offers it (eggs.js hears the pull).
//
//   DS2_TALKS: { [id]: talk }

const PULL = '(Pull the saber from the armrest with the Force.)';
const CHECK = '(Check the code against the day’s clearances.)';
const STRIKE = '(Take the saber and strike at him.)';
const THROW = '(Throw your saber away.)';
const LIFT = '(Lift the mask away.)';

const jerjerrod = {
  station: 'ds2',
  start: 'greet',
  nodes: {
    greet: {
      who: 'jerjerrod',
      say: 'Commander Jerjerrod. If Lord Vader sent you, the answer is yes, my men are working as fast as they can.',
      choices: [
        { say: 'Your nameplate says Moff, sir.', to: 'nameplate' },
        { say: 'The Emperor is coming, sir.', to: 'emperor' },
        { say: 'Carry on, Commander.', to: 'carry' },
      ],
    },
    nameplate: {
      who: 'jerjerrod',
      say: 'The nameplate was made for the day this station is finished. Facilities got ahead of themselves. Again.',
      end: true,
    },
    emperor: { who: 'jerjerrod', say: 'We shall double our efforts.', end: true },
    carry: { who: 'jerjerrod', say: 'I always do. It’s the station that doesn’t.', end: true },
  },
};

// ST 321 calling the command station’s shuttle console, with the shuttle
// controller at your shoulder: the code is checked before the shield
// comes down, whoever is aboard.
const st321 = {
  station: 'ds2',
  start: 'call',
  nodes: {
    call: {
      who: 'shuttle',
      say: 'Command station, ST 321 on approach. Code Clearance Blue.',
      choices: [
        { say: CHECK, to: 'checks' },
        { say: 'ST 321, who do you have aboard?', to: 'aboard' },
      ],
    },
    aboard: { who: 'shuttle', say: 'One passenger, Command. I wouldn’t keep him waiting on the shield.', choices: [{ say: CHECK, to: 'checks' }] },
    checks: { who: 'controller', say: 'Blue is today’s, and it’s his shuttle. Take the shield down for them.', choices: [{ say: '(Lower the shield.)', to: 'clear' }] },
    clear: { who: 'you', say: 'ST 321, the shield is down. You are clear to proceed.', end: true },
  },
};

// Jerjerrod at the foot of ST 321’s ramp, meeting a passenger he was
// given no warning of; the trooper hears it from the command centre.
const jerjerrodVader = {
  station: 'ds2',
  start: 'honour',
  nodes: {
    honour: { who: 'jerjerrod', say: 'Lord Vader. The station is honoured; we had no word you were coming.', next: 'pleasantries' },
    pleasantries: { who: 'vader', say: 'You may dispense with the pleasantries, Commander. I’m here to put you back on schedule.', next: 'crews' },
    crews: { who: 'jerjerrod', say: 'My lord, the crews are on double shifts already. Give me more of them and you’ll have your station.', next: 'coming' },
    coming: { who: 'vader', say: 'You will have no more. The Emperor is coming to see it for himself.', next: 'ready' },
    ready: { who: 'jerjerrod', say: 'Then it will be ready for him, my lord. I’ll see to it myself.', end: true },
  },
};

// In the tower lift with his father, on the way up to the throne room.
const vaderLift = {
  station: 'ds2',
  start: 'expecting',
  nodes: {
    expecting: {
      who: 'vader',
      say: 'The Emperor has been expecting you.',
      choices: [
        { say: 'I know, Father.', to: 'truth' },
        { say: '(Say nothing.)', to: 'silence' },
      ],
    },
    truth: {
      who: 'vader',
      say: 'So. You have accepted the truth.',
      choices: [
        { say: 'I know there is good in you.', to: 'late' },
        { say: 'Then come away with me. Leave him.', to: 'master' },
      ],
    },
    silence: { who: 'vader', say: 'Keep your silence. He will hear what you don’t say.', choices: [{ say: 'I know there is good in you.', to: 'late' }] },
    master: { who: 'vader', say: 'You don’t know the power of the dark side. I must obey my master.', end: true },
    late: { who: 'vader', say: 'It is too late for me, son.', end: true },
  },
};

// Before the throne. Luke’s saber lies on the armrest at the Emperor’s
// side, and every line until he offers it lets you reach for it first.
const throne = {
  station: 'ds2',
  start: 'welcome',
  nodes: {
    welcome: {
      who: 'emperor',
      say: 'Welcome, young Skywalker. I have been expecting you.',
      choices: [
        { say: 'I came for my father, not for you.', to: 'father' },
        { say: 'Your overconfidence is your weakness.', to: 'faith' },
        { say: PULL, to: 'armrest' },
      ],
    },
    father: {
      who: 'emperor',
      say: 'Your father is mine. He has been for longer than you have been alive.',
      choices: [
        { say: 'Your overconfidence is your weakness.', to: 'faith' },
        { say: PULL, to: 'armrest' },
      ],
    },
    faith: {
      who: 'emperor',
      say: 'Your faith in your friends is yours.',
      choices: [
        { say: 'My friends will have your shield down within the hour.', to: 'trap' },
        { say: PULL, to: 'armrest' },
      ],
    },
    trap: {
      who: 'emperor',
      say: 'The shield will be up when your fleet arrives. Look out of the window, and watch them come.',
      choices: [
        { say: '(Look out at the fleet.)', to: 'weapon' },
        { say: PULL, to: 'armrest' },
      ],
    },
    weapon: {
      who: 'emperor',
      say: 'You want this, don’t you? Take your Jedi weapon. Use it.',
      choices: [
        { say: STRIKE, to: 'strike' },
        { say: '(Leave it where it lies.)', to: 'wait' },
      ],
    },
    wait: { who: 'emperor', say: 'Your fleet is dying out there while you stand here. Take it.', choices: [{ say: STRIKE, to: 'strike' }] },
    strike: { who: 'emperor', say: 'Good. Let the hate flow through you.', end: true },
    armrest: { who: 'emperor', say: 'So soon? Good. Use your aggressive feelings, boy.', end: true, does: 'pull-saber' },
  },
};

// On the catwalk, Vader beaten and his hand gone. Striking him down stops
// short, as it did; every way through ends with the saber thrown away.
const strikeDown = {
  station: 'ds2',
  start: 'powerful',
  nodes: {
    powerful: {
      who: 'emperor',
      say: 'Good. Your hate has made you powerful. Now take your father’s place at my side.',
      choices: [
        { say: '(Strike him down.)', to: 'finish' },
        { say: THROW, to: 'never' },
      ],
    },
    finish: { who: 'emperor', say: 'Yes. Finish it. What are you waiting for?', choices: [{ say: '(Look at his cut hand, then at your own black glove.)', to: 'destiny' }] },
    destiny: { who: 'emperor', say: 'Fulfil your destiny.', choices: [{ say: THROW, to: 'never' }] },
    never: { who: 'you', say: 'Never. I’ll never turn to the dark side.', next: 'jedi' },
    jedi: { who: 'you', say: 'I am a Jedi, like my father before me.', next: 'so-be-it' },
    'so-be-it': { who: 'emperor', say: 'So be it, Jedi.', end: true },
  },
};

// At the foot of the shuttle’s ramp, the station coming down round them.
// With the mask off he is Anakin again, and the subtitles say so.
const unmasking = {
  station: 'ds2',
  start: 'mask',
  nodes: {
    mask: {
      who: 'vader',
      say: 'Luke, help me take this mask off.',
      choices: [
        { say: 'But you’ll die.', to: 'nothing' },
        { say: LIFT, to: 'eyes' },
      ],
    },
    nothing: { who: 'vader', say: 'Nothing can stop that now.', choices: [{ say: LIFT, to: 'eyes' }] },
    eyes: {
      who: 'anakin',
      say: 'Just for once, let me look on you with my own eyes.',
      choices: [
        { say: 'I’ve got to save you.', to: 'already' },
        { say: '(Say nothing.)', to: 'sister' },
      ],
    },
    already: { who: 'anakin', say: 'You already have, Luke.', next: 'sister' },
    sister: { who: 'anakin', say: 'Tell your sister… you were right.', end: true },
  },
};

export const DS2_TALKS = {
  jerjerrod,
  st321,
  'jerjerrod-vader': jerjerrodVader,
  'vader-lift': vaderLift,
  throne,
  'strike-down': strikeDown,
  unmasking,
};
