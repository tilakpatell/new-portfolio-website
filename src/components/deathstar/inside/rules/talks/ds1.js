// The first Death Star’s conversations, as data for rules/talk.js. Each
// is a tree of lines (see talk.js for the shape). Only short famous lines
// are the film’s own; the rest is the site’s. Node ids the eggs and the
// stories listen for: 'aa23-officer' → 'transfer-1138', 'han-intercom' →
// 'boring' (the canon lines alone reach it), 'conference' → 'faith'. The
// game acts on each `does`: 'officer-comes', 'chewie-loose',
// 'shoot-panel', 'leia-joins', 'walls-stop', 'choke', 'trick'.
//
//   DS1_TALKS: { [id]: talk }

const SHOOT = '(Shoot the panel.)';
const TAP = '(Tap the side of your helmet.)';

// The officer up on the gantry over Bay 327 calls the trooper who should
// be guarding the freighter, and the trooper is out cold in its hold.
const ctlOfficer = {
  station: 'ds1',
  start: 'post',
  nodes: {
    post: {
      who: 'gantry',
      say: 'TK-421, why aren’t you at your post?',
      choices: [
        { say: TAP, to: 'transmitter' },
        { say: '(Say nothing.)', to: 'copy' },
      ],
    },
    copy: {
      who: 'gantry',
      say: 'TK-421, do you copy?',
      choices: [
        { say: TAP, to: 'transmitter' },
        { say: 'Copy. All quiet in the freighter, sir.', to: 'quiet' },
      ],
    },
    transmitter: { who: 'gantry', say: 'A bad transmitter, then. Stay where you are, trooper; I’ll come down and see to it myself.', end: true, does: 'officer-comes' },
    quiet: { who: 'gantry', say: 'Quiet enough that you couldn’t answer the first time? Stay put. I’m coming down.', end: true, does: 'officer-comes' },
  },
};

// The duty officer at the detention block’s horseshoe, faced with a
// trooper or two and a Wookiee in binders. The transfer is offered once
// the story has you walking him as a prisoner (the flag `transfer`).
const aa23Officer = {
  station: 'ds1',
  start: 'thing',
  nodes: {
    thing: {
      who: 'officer',
      say: 'Where are you taking this… thing?',
      choices: [
        { say: 'Prisoner transfer from cell block 1138.', to: 'transfer-1138', when: { flag: 'transfer' } },
        { say: 'Orders from the bridge, sir. Don’t ask me.', to: 'orders' },
        { say: 'Just passing through, sir.', to: 'passing' },
      ],
    },
    orders: {
      who: 'officer',
      say: 'Everyone has orders from the bridge. Whose, and for where?',
      choices: [
        { say: 'Prisoner transfer from cell block 1138.', to: 'transfer-1138', when: { flag: 'transfer' } },
        { say: 'On second thoughts, sir, I’ll take him back.', to: 'back' },
      ],
    },
    passing: { who: 'officer', say: 'Nobody passes through AA-23. Take it back wherever it came from.', end: true },
    back: { who: 'officer', say: 'Do that. And have someone hose down the lift afterwards.', end: true },
    'transfer-1138': { who: 'officer', say: 'I wasn’t notified. I’ll have to clear it.', end: true, does: 'chewie-loose' },
  },
};

// Han, at the console after the shooting, with the duty officer’s
// superior on the intercom. The canon lines lead to “Boring conversation
// anyway.”; any other way he gives up sooner. However it goes, the panel
// gets shot.
const hanIntercom = {
  station: 'ds1',
  start: 'report',
  nodes: {
    report: {
      who: 'intercom',
      say: 'Detention block AA-23, report. We’re reading blaster fire on your level.',
      choices: [
        { say: 'Uh, everything’s under control. Situation normal.', to: 'what' },
        { say: 'Routine drill. Nothing to worry about.', to: 'drill' },
        { say: SHOOT, to: 'blast' },
      ],
    },
    drill: {
      who: 'intercom',
      say: 'There’s no drill on today’s rota. Who am I speaking to?',
      choices: [{ say: 'Uh…', to: 'blast' }],
    },
    what: {
      who: 'intercom',
      say: 'What happened?',
      choices: [
        { say: 'We had a slight weapons malfunction, but… everything’s perfectly all right now.', to: 'pause' },
        { say: 'Someone dropped a rifle. It went off.', to: 'dropped' },
      ],
    },
    dropped: {
      who: 'intercom',
      say: 'Then you won’t mind a squad coming up to collect it.',
      choices: [{ say: SHOOT, to: 'blast' }],
    },
    pause: {
      who: 'intercom',
      say: '…',
      choices: [
        { say: 'We’re fine. We’re all fine here now, thank you. How are you?', to: 'squad' },
        { say: SHOOT, to: 'blast' },
      ],
    },
    squad: {
      who: 'intercom',
      say: 'We’re sending a squad up.',
      choices: [
        { say: 'Negative, negative. We had a reactor leak here now…', to: 'who' },
        { say: SHOOT, to: 'blast' },
      ],
    },
    who: {
      who: 'intercom',
      say: 'Who is this? What’s your operating number?',
      choices: [{ say: 'Uh…', to: 'boring' }],
    },
    boring: { who: 'han', say: 'Boring conversation anyway.', end: true, does: 'shoot-panel' },
    blast: { who: 'han', say: 'Well. That’s that settled.', end: true, does: 'shoot-panel' },
  },
};

// Cell 2187. With the helmet on she sees the armour before the man in it.
const leia2187 = {
  station: 'ds1',
  start: [{ to: 'short', when: { helmet: true } }, { to: 'hello' }],
  nodes: {
    short: {
      who: 'leia',
      say: 'Aren’t you a little short for a stormtrooper?',
      choices: [
        { say: 'Huh? Oh, the uniform. I’m Luke Skywalker. I’m here to rescue you.', to: 'who', when: { hero: 'luke' } },
        { say: 'It’s a disguise. We’re getting you out of here.', to: 'go' },
      ],
    },
    hello: {
      who: 'leia',
      say: 'Well, you’re not one of theirs. Who are you, and who sent you?',
      choices: [
        { say: 'I’m Luke Skywalker. I’m here to rescue you.', to: 'who', when: { hero: 'luke' } },
        { say: 'A friend. We’re getting you out of here.', to: 'go' },
      ],
    },
    who: {
      who: 'leia',
      say: 'You’re who?',
      choices: [{ say: 'I’ve got your R2 unit. I’m here with Ben Kenobi.', to: 'ben' }],
    },
    ben: { who: 'leia', say: 'Ben Kenobi? Where is he?', choices: [{ say: 'Come on.', to: 'go' }] },
    go: { who: 'leia', say: 'Then lead the way, before they send more of you.', end: true, does: 'leia-joins' },
  },
};

// The comlink from the trash compactor, with the walls already moving.
const threepioComlink = {
  station: 'ds1',
  start: 'answer',
  nodes: {
    answer: {
      who: 'threepio',
      say: 'Master Luke? Oh, thank goodness. Artoo and I have had the most dreadful time.',
      choices: [
        { say: 'Shut down all the garbage mashers on the detention level!', to: 'mashers' },
        { say: 'Where have you been?', to: 'where' },
      ],
    },
    where: {
      who: 'threepio',
      say: 'Hiding, sir, which is what droids are for in a battle. What can we do?',
      choices: [{ say: 'Shut down all the garbage mashers on the detention level!', to: 'mashers' }],
    },
    mashers: { who: 'threepio', say: 'All of them? Artoo, quickly, every one on the detention level.', set: 'mashers-off', does: 'walls-stop', next: 'cheer' },
    cheer: { who: 'threepio', say: 'Is that screaming? Oh dear. Oh, no, I believe they’re cheering.', end: true },
  },
};

const technician = {
  station: 'ds1',
  start: 'panel',
  nodes: {
    panel: {
      who: 'technician',
      say: 'Mind the cables. This panel’s been sparking since the last inspection.',
      choices: [
        { say: 'What’s wrong with it?', to: 'fault' },
        { say: 'Seen anything odd today?', to: 'odd' },
        { say: 'Carry on.', to: 'carry' },
      ],
    },
    fault: {
      who: 'technician',
      say: 'The coolant line runs too close to the power bus. Engineering says it’s within tolerance. Engineering has never stood here.',
      end: true,
    },
    odd: { who: 'technician', say: 'Only a mouse droid doing laps of Level 5 as if somebody’s timing it.', end: true },
    carry: { who: 'technician', say: 'I would, if people stopped asking how it’s going.', end: true },
  },
};

// Small talk for anyone who passes for one of the garrison.
const trooperBark = {
  when: { passes: true },
  start: 'shift',
  nodes: {
    shift: {
      who: 'trooper',
      say: 'Quiet shift. Too quiet, if you ask me, and nobody does.',
      choices: [
        { say: 'Heard anything?', to: 'rumour' },
        { say: 'How’s the armour treating you?', to: 'armour' },
        { say: 'Move along.', to: 'move' },
      ],
    },
    rumour: { who: 'trooper', say: 'They say the Senate’s been dissolved for good. Doesn’t change our rota.', next: 'bonk' },
    bonk: { who: 'trooper', say: 'And somebody in Docking Control keeps walking into the door frame. Every shift.', end: true },
    armour: { who: 'trooper', say: 'The left knee pinches. Requisitions says they all pinch, and to stop asking.', end: true },
    move: { who: 'trooper', say: 'Moving, moving.', end: true },
  },
};

// The conference room: Motti’s boast, Vader’s warning, and Tarkin
// turning to you. Talking back gets you what it got Motti.
const conference = {
  station: 'ds1',
  start: 'ultimate-power',
  nodes: {
    'ultimate-power': { who: 'motti', say: 'This station is now the ultimate power in the universe.', next: 'terror' },
    terror: { who: 'vader', say: 'Don’t be too proud of this technological terror you’ve constructed.', next: 'tarkin' },
    tarkin: {
      who: 'tarkin',
      say: 'The plans will be found, and the Rebels with them. You have something to add?',
      choices: [
        { say: 'Nothing to add, Governor.', to: 'quiet' },
        { say: 'With respect, Lord Vader, conjuring tricks haven’t found the plans so far.', to: 'faith' },
        { say: 'The station could find them for us, sir.', to: 'station' },
      ],
    },
    quiet: { who: 'tarkin', say: 'Good. Then we’re done here.', end: true },
    station: { who: 'motti', say: 'Precisely what I’ve been saying.', end: true },
    faith: { who: 'vader', say: 'I find your lack of faith disturbing.', end: true, does: 'choke' },
  },
};

// The archive’s keeper, who prefers the security feeds to the tapes.
const librarian = {
  station: 'ds1',
  start: 'quiet',
  nodes: {
    quiet: {
      who: 'librarian',
      say: 'Archive. Quietly, please. These tapes will outlast all of us if nobody breathes on them.',
      choices: [
        { say: 'What are you watching?', to: 'feeds' },
        { say: 'I need a technical readout.', to: 'readout' },
        { say: 'Sorry to disturb you.', to: 'sorry' },
      ],
    },
    feeds: { who: 'librarian', say: 'The security feeds. The catalogue hasn’t changed since the station was laid down; the corridors are better company.', end: true },
    readout: { who: 'librarian', say: 'Restricted. Everything worth reading is. The terminal by the stacks will tell you the same, more slowly.', end: true },
    sorry: { who: 'librarian', say: 'You haven’t. That’s rather the trouble with this posting.', end: true },
  },
};

// Ben at a checkpoint, and two guards who repeat whatever he tells them.
const droidsTrick = {
  when: { hero: 'obiwan' },
  start: 'papers',
  nodes: {
    papers: {
      who: 'trooper',
      say: 'Let me see your identification.',
      choices: [
        { say: 'These aren’t the droids you’re looking for.', to: 'droids' },
        { say: '(Hand over your papers.)', to: 'dated' },
      ],
    },
    droids: { who: 'trooper', say: 'These aren’t the droids we’re looking for.', choices: [{ say: 'Move along.', to: 'move' }] },
    move: { who: 'trooper', say: 'Move along. Move along.', end: true, does: 'trick' },
    dated: { who: 'trooper', say: 'These are a week out of date. Wait here while I check them.', end: true },
  },
};

export const DS1_TALKS = {
  'ctl-officer': ctlOfficer,
  'aa23-officer': aa23Officer,
  'han-intercom': hanIntercom,
  'leia-2187': leia2187,
  'threepio-comlink': threepioComlink,
  technician,
  'trooper-bark': trooperBark,
  conference,
  librarian,
  'droids-trick': droidsTrick,
};
