// Yavin 4, from the ground: the Great Temple and its hangar, the landing
// field, the lookout tower, a lesser temple in the jungle and the river.
// (sites/index.js has what a site is; forest.js has the other forest
// worlds.)

export const SITE = {
  // the look (look.js): green-grey shade under the canopy, a warm halo
  // through it; the grass on the ground map (groundPaint.js), thin under
  // the trees' crowns and thick in the clearings
  look: { shadow: '#3a4a3a', edge: [0.18, 0.85], halo: '#fff0c0' },
  grass: { h: [0.18, 0.5], w: 0.05, cover: 0.55, wind: 0.5, scale: 70, root: '#2e3a22', mid: '#4a5a30', tip: '#7a8a46', dry: '#8a8450' },
  place: 'The jungle of Yavin 4',
  line: 'Steaming jungle, ancient temples, and a gas giant filling half the sky.',
  sky: {
    zenith: '#5b8ec2',
    horizon: '#d2dac6',
    haze: 0.85,
    hazeColor: '#dfe4d2',
    suns: [{ az: -0.5, el: 0.62, color: '#fff2da', size: 0.015, glow: 1.1 }],
    clouds: { cover: 0.3, color: '#ffffff', shade: '#c4ccc4', scale: 0.6, speed: 0.004 },
    bodies: [
      // Yavin, the gas giant, rising behind the Great Temple
      { az: 3.0, el: 0.36, size: 0.3, color: '#d8763e', color2: '#f2d2a6', bands: 10, twist: 1.4 },
      { az: 2.3, el: 0.7, size: 0.012, color: '#d0ccc0' },
    ],
  },
  fog: { color: '#b8c8b0', density: 0.0022 },
  light: { sun: 3.0, sky: '#c8daea', ground: '#4a4028', ambient: 0.8 },
  water: { level: -3, color: '#5a7a5a', deep: '#22382a', kind: 'swamp', waves: 1.2 },
  dust: '#8a8a60',
  edge: 'The jungle closes in. Somewhere out there are temples nobody has seen in four thousand years.',
  ground: { detail: 'leaves', detailLook: { color: 0.8, normal: 0.7 },
    seed: 14,
    wind: 0.8,
    base: 0,
    layers: [
      { type: 'swell', scale: 380, height: 8 },
      { type: 'hills', scale: 140, height: 10 },
      { type: 'channels', scale: 700, depth: 12, width: 0.05 },
      { type: 'mountains', from: 1000, to: 3400, height: 300, scale: 1100 },
    ],
    palette: {
      // (the jungle floor as filmed: dark soil, leaf litter, moss)
      low: '#4a3a26',
      high: '#3a4228',
      rock: '#6a6450',
      accent: '#6e5644',
      deep: '#2b220e',
      hLow: -2,
      hHigh: 12,
      rockAt: 0.5,
      accentCover: 0.3,
      grain: 0.85,
      wet: { level: -3, band: 1.2, color: '#3a3a26' },
    },
  },
  weather: [{ kind: 'motes', count: 500, color: '#f0f8c0' }],
  land: { at: [0, 0], yaw: 3.0 },
  lines: {
    out: {
      xwing: [['luke', 'Yavin 4. Home, for a while. Artoo, remember the medals?'], ['r2', '(A proud, happy whistle.)']],
      falcon: [['han', 'Back where it all started. I almost didn’t come back for the kid, you know.'], ['chewie', '(A knowing, sarcastic growl.)']],
      cruiser: [['morty', 'Rick, there’s a giant orange planet in the sky!'], ['rick', 'Gas giant, Morty. We’re on its moon. Basic orbital stuff.']],
      rv: [['jesse', 'Yo, it’s hot as balls out here. Like Florida, but in space.'], ['walt', 'Humidity like this ruins equipment, Jesse.']],
    },
  },
  places: [
    {
      id: 'temple',
      name: 'The Great Temple',
      at: [0, -240],
      r: 92,
      flat: { r: 74 },
      about: 'The Great Temple of Massassi, raised for the Sith thousands of years ago and overgrown ever since: the Rebel Alliance’s base, its hangar at the foot, its war room deep inside.',
      lines: {
        xwing: [['luke', 'The Massassi temple. Every fighter we had took off from in there.'], ['r2', '(An excited, nostalgic burble.)']],
        falcon: [['han', 'I dropped the kid off here and left with the reward. Then I came back. Don’t tell anybody.'], ['chewie', '(A teasing rumble.)']],
        cruiser: [['morty', 'It’s like a Mayan pyramid, but in space!'], ['rick', 'Every civilisation builds the same stairs, Morty. Lack of imagination.']],
        rv: [['walt', 'A secret base inside a thousand-year-old temple. Clever.'], ['jesse', 'Yo, I bet there’s like, booby traps.']],
      },
      things: [
        { kind: 'massassi', at: [0, 0], yaw: 0 },
        { kind: 'lamp', at: [-24, 44], opts: { h: 5, light: '#ffe0a0' } },
        { kind: 'lamp', at: [24, 44], opts: { h: 5, light: '#ffe0a0' } },
      ],
    },
    {
      id: 'hangar',
      name: 'The hangar',
      at: [0, -218],
      r: 16,
      about: 'Under the temple, where Red and Gold squadrons waited for the Death Star to come round Yavin: X-wings, Y-wings, fuel lines, astromechs being loaded aboard. Thirty went up; three came home.',
      lines: {
        xwing: [['luke', 'This is where Biggs and I took off together. He didn’t come back.'], ['r2', '(A long, low, sad note.)']],
        falcon: [['han', 'They’re gonna need more than luck, Chewie. Come on, we’ve got our reward.'], ['chewie', '(An angry, disappointed growl.)']],
        cruiser: [['rick', 'One-man fighters versus a planet-killer. Bold strategy, Morty.'], ['morty', 'It worked though, didn’t it?']],
      },
      things: [
        { kind: 'hangarfloor', at: [0, 0], y: 0.57, solid: false }, // (just over the temple model's own floor)
        { kind: 'parked', at: [-9, -2], yaw: 0.15, opts: { kind: 'xwing', metres: 12.5 } },
        { kind: 'parked', at: [9, -4], yaw: -0.1, opts: { kind: 'xwing', metres: 12.5 } },
        { kind: 'ywing', at: [0, 12], yaw: 0.05 },
        { kind: 'yavinramp', at: [-6, -4], yaw: 1.6 },
        { kind: 'crates', at: [-14, 10] },
        { kind: 'ammocan', at: [-12.4, 8.6], yaw: 0.3 },
        { kind: 'ammocan', at: [-12.6, 7.6], yaw: 0.2 },
        { kind: 'ammocan', at: [14.6, 9.8], yaw: 1.4 },
        { kind: 'welderrack', at: [13, 13], yaw: -2.4 },
        { kind: 'yavinspeeder', at: [-15, -8], yaw: 1.4 },
      ],
    },
    {
      id: 'summit',
      name: 'The temple summit',
      at: [0, -256],
      r: 6,
      about: 'The top of the Great Temple, high over the canopy, where Rebel lookouts watched the sky for the Death Star. On a clear day, the jungle goes on forever, and Yavin fills the horizon.',
      lines: {
        xwing: [['luke', 'You can see the whole jungle from up here. And Yavin, like it’s right on top of us.']],
        falcon: [['han', 'Nice view. Shame about the stairs.'], ['chewie', '(Panting.)']],
        cruiser: [['morty', 'W-we climbed all of those, Rick?'], ['rick', 'Cardio, Morty. Even in a galaxy far, far away.']],
        rv: [['jesse', 'This is the best view I’ve ever seen, yo.'], ['walt', 'Catch your breath, Jesse.']],
      },
    },
    {
      id: 'field',
      name: 'The landing field',
      at: [0, -112],
      r: 36,
      flat: { r: 32 },
      about: 'The clearing in front of the temple, where the Falcon set down with the stolen plans, and where Rogue One’s U-wing left for Scarif without orders.',
      lines: {
        xwing: [['luke', 'The Falcon landed right here, with the princess and the plans.']],
        falcon: [['han', 'Set her down right here. Easiest money I ever almost made.'], ['chewie', '(A rumble about the money.)']],
        rv: [['jesse', 'A U-wing. Rogue One, yo. They didn’t come back either.'], ['walt', 'Some jobs you don’t come back from, Jesse.']],
      },
      things: [
        { kind: 'parked', at: [-14, 2], yaw: 0.6, opts: { kind: 'uwing', metres: 24, lift: 1.4 } },
        { kind: 'crates', at: [10, -8] },
        { kind: 'crates', at: [16, 6] },
        { kind: 'crates', at: [-4, 18] },
        { kind: 'lamp', at: [6, 14], opts: { h: 5, light: '#ffe0a0' } },
      ],
    },
    {
      id: 'lookout',
      name: 'The lookout tower',
      at: [-200, -120],
      r: 18,
      flat: { r: 10 },
      about: 'A steel tower up through the canopy, where a Rebel sentry watched the sky. He saw the Millennium Falcon coming in over the trees, with a princess and the Death Star plans aboard.',
      lines: {
        xwing: [['luke', 'The sentry up there spotted us coming in with the plans.'], ['r2', '(A cheerful whistle up at him.)']],
        falcon: [['han', 'Bet he was glad to see us. Everybody usually is.'], ['chewie', '(A doubtful huff.)']],
        cruiser: [['rick', 'One guy, a tower and a pair of binoculars. That’s the whole early-warning system, Morty.']],
      },
      things: [{ kind: 'lookout', at: [0, 0], yaw: 0.4 }],
    },
    {
      id: 'ruin',
      name: 'A lesser temple',
      at: [260, 170],
      r: 40,
      flat: { r: 28 },
      about: 'One of the Massassi’s smaller temples, swallowed by the jungle: the Sith’s slaves built dozens across Yavin 4, and the forest has taken most of them back.',
      lines: {
        xwing: [['luke', 'There are temples all over this moon. Nobody knows how many.']],
        falcon: [['han', 'Creepy. Let’s not go in.'], ['chewie', '(A nervous, agreeing whine.)']],
        cruiser: [['morty', 'Rick, should we go inside?'], ['rick', 'Sith temple, Morty. Ancient evil. Bad vibes. Absolutely not.']],
        rv: [['jesse', 'Indiana Jones, yo.'], ['walt', 'Don’t touch anything, Jesse.']],
      },
      things: [{ kind: 'ruin', at: [0, 0], yaw: 0.6 }],
    },
    {
      id: 'river',
      name: 'The river',
      at: [-290, -280],
      r: 28,
      about: 'A slow green river winding through the jungle past the temples. The Rebels drew their water from it, and kept an eye on whatever else came down to drink.',
      lines: {
        xwing: [['luke', 'More water here than on all of Tatooine.'], ['r2', '(A nervous beep: he remembers Dagobah.)']],
        falcon: [['han', 'Don’t drink that, Chewie.'], ['chewie', '(A defiant slurp.)']],
        rv: [['jesse', 'Yo, there could be alligators in there. Space alligators.'], ['walt', 'Then stay out of the water, Jesse.']],
      },
      things: [
        { kind: 'log', at: [6, 10], yaw: 1.2, opts: { len: 11, r: 0.8, bark: '#6a6250', moss: '#4e6a2c' } },
        { kind: 'log', at: [-10, -6], yaw: -0.4, opts: { len: 7, r: 0.6, bark: '#6a6250', moss: '#4e6a2c' } },
      ],
    },
  ],
  things: [
    // where you set down: Gold Squadron's dispersal on the field's edge, a
    // Y-wing under its ramp, the ground crew's gear
    { kind: 'ywing', at: [28, -22], yaw: 2.7 },
    { kind: 'yavinramp', at: [20, -14], yaw: 2.7 },
    { kind: 'ammocan', at: [12, -6], yaw: 0.3 },
    { kind: 'ammocan', at: [13.1, -5.4], yaw: 1.1 },
    { kind: 'cratecube', at: [-14, -10], yaw: 0.6 },
    { kind: 'barrel', at: [-12.6, -8.4], yaw: 0.2 },
    { kind: 'welderrack', at: [-10, -14], yaw: 2.2 },
    { kind: 'lamp', at: [-16, -2], opts: { h: 5, light: '#ffe0a0' } },
    { kind: 'lamp', at: [16, -30], opts: { h: 5, light: '#ffe0a0' } },
  ],
  scatter: [
    // the tall trees, vines hanging from them, then the built ones between
    // (the jungle's own trees close in all round, their umbrella crowns a
    // roof overhead, as the film's are: built here, in the world's own
    // light, where the photographed yavintree model stood out of it)
    { kind: 'jungletree', n: 330, within: [22, 640], scale: [0.8, 1.4], opts: { seed: 1, leaf: '#3c4a22' } },
    { kind: 'jungletree', n: 200, within: [22, 640], scale: [0.7, 1.2], opts: { seed: 2, bark: '#7a7462', leaf: '#46522a', creepers: false } },
    { kind: 'jungletree', n: 180, within: [640, 1400], scale: [1.0, 1.6], solid: false, opts: { seed: 3, lo: true, leaf: '#3c4a22' } },
    { kind: 'plant', n: 700, within: [6, 480], scale: [0.8, 2.0], solid: false, clear: -8, opts: { seed: 4, color: '#4a5a30' } },
    { kind: 'fern', n: 400, within: [6, 480], scale: [0.8, 1.7], solid: false, clear: -8, opts: { seed: 5, color: '#4a5230' } },
    // (the undergrowth near you, thick, as the jungle's floor is in the film)
    { kind: 'fern', n: 1200, within: [4, 90], scale: [0.7, 1.6], solid: false, clear: -10, opts: { seed: 15, n: 7, color: '#465030' } },
    { kind: 'plant', n: 500, within: [4, 90], scale: [0.7, 1.6], solid: false, clear: -10, opts: { seed: 16, color: '#50603a' } },
    { kind: 'rock', n: 50, within: [20, 560], scale: [0.6, 2.4], opts: { color: '#6a6656', sharp: 0.4 } },
    { kind: 'log', n: 24, within: [30, 520], scale: [0.9, 1.5], solid: false, opts: { seed: 7, bark: '#6a6250', moss: '#4e6a2c' } },
  ],
  life: [
    { kind: 'rebel', id: 'dodonna', at: [10, -100], still: true, face: 3, name: 'General Dodonna', named: true, quest: 'remotes', says: ['The battle station will be in range in thirty minutes.'] },
    { kind: 'rebelpilot', n: 1, at: [18, -16], still: true, face: 2.4, name: 'Gold Squadron pilot', says: ['Gold Leader, standing by.', 'Y-wings take the first run at the trench. Keep the fighters off us.'] },
    { kind: 'rebeltech', n: 2, at: [6, -12], spread: 8, roam: 8, speed: 0.9, name: 'Rebel technician', says: ['Proton torpedoes loaded. Both of them.', 'She’s old, but she flies.', 'Don’t stand under the ramp.'] },
    { kind: 'astromech', n: 1, at: [20, -26], roam: 5, speed: 0.6, name: 'Astromech', says: ['(A low, grumbling whistle: the Y-wing’s deflector is shot again.)'] },
    { kind: 'rebel', n: 6, at: [0, -112], spread: 18, roam: 12, speed: 1.1, name: 'Rebel trooper', says: ['They got the plans out! The princess brought them herself.', 'The Death Star’s coming round the planet. Thirty minutes, they say.', 'Massassi built this place. Who they were, nobody knows.', 'May the Force be with you.'] },
    { kind: 'pilot', n: 4, at: [0, -222], spread: 8, roam: 6, speed: 1.0, name: 'X-wing pilot', says: ['Red Five standing by.', 'Look at the size of that thing!', 'Stay on target… stay on target…', 'I used to bullseye womp rats in my T-16 back home. They’re not much bigger than two metres.'] },
    { kind: 'droid', n: 3, at: [0, -216], spread: 8, roam: 6, speed: 0.6, name: 'Astromech', says: ['(A brisk, busy whistle.)', '(It plugs into a fuel line and beeps happily.)'] },
    { kind: 'c3po', n: 1, at: [5, -208], still: true, face: 3.4, name: 'C-3PO', says: ['Hang on tight, Artoo. You’ve got to come back.', 'You wouldn’t want my life to get boring, would you?', 'Oh, I do hope they know what they’re doing.'] },
    { kind: 'rebel', n: 1, at: [-200, -120], still: true, face: 0.3, name: 'Rebel sentry', says: ['(He lowers his macrobinoculars.) Ship coming in. It’s the Falcon!', 'All quiet up here. Just the jungle, and Yavin.'] },
    { kind: 'rebel', n: 2, at: [-284, -270], spread: 6, roam: 6, speed: 0.9, name: 'Rebel scout', says: ['Fresh water, and plenty of it. Just don’t go in past your knees.', 'Something big came down to drink last night. We didn’t stay to find out what.'] },
    { kind: 'rebel', n: 2, path: [[-30, -190], [30, -190], [30, -186], [-30, -186]], speed: 1.1, name: 'Rebel guard', says: ['Halt. Who goes there? …Oh, it’s you. Go on in.', 'Keep an eye on the sky.'] },
  ],
  rides: [],

  // ── Things to do ──
  quests: [
    { id: 'remotes', name: 'Blast shield down', giver: 'dodonna', intro: [['General Dodonna', 'Pilots warm up on the remotes by the lookout. Your turn.']], steps: [{ type: 'shoot', tag: 'remote', n: 6, text: 'Hit the training remotes', spawn: { kind: 'remote', n: 6, at: [-200, -120], spread: 8, roam: 6, speed: 2, hp: 1, tag: 'remote' } }, { type: 'reach', at: [0, -256], r: 5, text: 'Climb to the throne room for the ceremony' }], done: [[null, '(The doors open. The whole Rebellion is standing there, and they’re cheering for you.)']] },
  ],
  flyovers: [
    { kind: 'xwing', n: 3, metres: 12.5, alt: 80, speed: 120, every: 45 },
    { kind: 'ywing', n: 2, metres: 16, alt: 90, speed: 100, every: 60 },
    { kind: 'freighter', n: 1, metres: 34, alt: 70, speed: 70, every: 110 },
    { kind: 'uwing', n: 1, metres: 24, alt: 110, speed: 80, every: 100 },
  ],

};
