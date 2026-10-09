// What the rest of the crew says when you talk to them, on either station,
// as data for rules/talk.js: the officers, gunners and Death Star troopers
// to anyone who passes for one of their own, the TIE pilots in their bay,
// the Emperor's Royal Guards (nothing), and the droids, to anyone. The
// lines are the site's own.
//
//   CREW_TALKS: { [id]: talk }

const officerBark = {
  when: { passes: true },
  start: 'post',
  nodes: {
    post: {
      who: 'officer',
      say: 'You’re off your post. Is there something you need, or are you just admiring the view?',
      choices: [
        { say: 'Any orders, sir?', to: 'orders' },
        { say: 'Just passing, sir.', to: 'passing' },
      ],
    },
    orders: { who: 'officer', say: 'Keep your eyes open and your reports short. The Grand Moff reads every one.', end: true },
    passing: { who: 'officer', say: 'Then pass. Quickly.', end: true },
  },
};

const gunnerBark = {
  when: { passes: true },
  start: 'clear',
  nodes: {
    clear: {
      who: 'gunner',
      say: 'Stand clear of the firing console. Nobody touches it without the order.',
      choices: [
        { say: 'What does it feel like, firing it?', to: 'feel' },
        { say: 'Understood.', to: 'understood' },
      ],
    },
    feel: { who: 'gunner', say: 'Like nothing. A light comes on, you pull the lever, a light goes off. Somewhere a long way off, it isn’t nothing.', end: true },
    understood: { who: 'gunner', say: 'Good.', end: true },
  },
};

const dstrooperBark = {
  when: { passes: true },
  start: 'section',
  nodes: {
    section: {
      who: 'dstrooper',
      say: 'Section secure. Superlaser crews only past this point.',
      choices: [
        { say: 'Seen anything?', to: 'seen' },
        { say: 'Carry on.', to: 'carry' },
      ],
    },
    seen: { who: 'dstrooper', say: 'Stormtroopers walking into things. They can’t see a thing out of those helmets.', end: true },
    carry: { who: 'dstrooper', say: 'Sir.', end: true },
  },
};

const pilotBark = {
  when: { passes: true },
  start: 'standby',
  nodes: {
    standby: {
      who: 'tiepilot',
      say: 'On standby. Eight hours in the suit and they still haven’t said for what.',
      choices: [
        { say: 'Rebels, maybe.', to: 'rebels' },
        { say: 'Stay sharp.', to: 'sharp' },
      ],
    },
    rebels: { who: 'tiepilot', say: 'Against this station? Let them come. I could use the practice.', end: true },
    sharp: { who: 'tiepilot', say: 'Always.', end: true },
  },
};

// the Emperor's guards say nothing, to anyone
const royalGuard = { start: 'silent', nodes: { silent: { who: 'royalguard', say: '…', end: true } } };

const gonk = { start: 'gonk', nodes: { gonk: { who: 'gonk', say: 'Gonk.', next: 'again' }, again: { who: 'gonk', say: 'Gonk. Gonk.', end: true } } };

const mouse = { start: 'squeal', nodes: { squeal: { who: 'mouse', say: '(It squeals, spins on the spot, and races off the other way.)', end: true } } };

export const CREW_TALKS = {
  'officer-bark': officerBark,
  'gunner-bark': gunnerBark,
  'dstrooper-bark': dstrooperBark,
  'pilot-bark': pilotBark,
  'royalguard-silent': royalGuard,
  'gonk-gonk': gonk,
  'mouse-squeal': mouse,
};
