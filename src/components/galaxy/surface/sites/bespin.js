// Bespin, from the ground: Cloud City's top deck and its platforms, the
// dining room, the carbon-freezing chamber, the reactor shaft and the
// weather vane under it all. (sites/index.js has what a site is; edge.js
// has Mustafar and Scarif.)

export const SITE = {
  // the look (look.js): rose shade, gold hour; the haze below the horizon
  // nearly the sky's own, so the cloud sea and the sky meet without a seam
  look: { shadow: '#c07a8a', edge: [0.1, 0.78], halo: '#ffb070', fogBelow: 0.95 },
  place: 'Cloud City',
  line: 'A city in the clouds, gold in the long sunset, and nothing underneath but sky.',
  sky: {
    zenith: '#4a5a9c',
    horizon: '#ffb488',
    below: '#e8a08a',
    haze: 0.9,
    hazeColor: '#ffc89c',
    suns: [{ az: -2.3, el: 0.13, color: '#ffd2a0', size: 0.03, glow: 1.9 }],
    clouds: { cover: 0.5, color: '#ffd6bc', shade: '#c4808a', scale: 0.55, speed: 0.003 },
    bodies: [
      { az: 1.1, el: 0.42, size: 0.03, color: '#efe0d4', color2: '#cdb8a8', bands: 0 },
      { az: 1.45, el: 0.3, size: 0.012, color: '#e6d6ca' },
    ],
  },
  fog: { color: '#f2b69c', density: 0.0007 },
  light: { sun: 2.8, sky: '#e2c4b4', ground: '#f0a888', ambient: 0.95 },
  dust: '#f4e8dc',
  edge: 'Nothing past here but cloud, a long, long way down.',
  noGround: true,
  fall: -40,
  ground: {
    seed: 1,
    layers: [],
    palette: { low: '#e8d8c8', high: '#f0e2d2', rock: '#c8b8a8' },
  },
  water: { level: -380, color: '#f6c4a6', deep: '#c27c78', kind: 'clouds' },
  weather: [{ kind: 'motes', count: 400, color: '#ffe2c8' }],
  land: { at: [0, -255], yaw: 0 },
  lines: {
    out: {
      xwing: [['luke', 'Cloud City. Han and Leia are here somewhere, Artoo. I can feel it.'], ['r2', '(A nervous warble.)']],
      falcon: [['han', 'Lando’s place. Lando! You old smoothie!'], ['chewie', '(A doubtful growl.)']],
      cruiser: [['morty', 'Rick, it’s a city! In the clouds! Like heaven but with landing pads!'], ['rick', 'It’s a gas mine, Morty. A pretty gas mine run by a guy with a cape.']],
      rv: [['jesse', 'Yo, we’re parked on a cloud. An actual cloud, Mr. White.'], ['walt', 'Tibanna gas, Jesse. They mine it from the atmosphere. Somebody here is making a fortune.']],
    },
  },
  places: [
    {
      id: 'platform327',
      name: 'Platform 327',
      at: [0, -255],
      r: 30,
      about: 'Where the Falcon set down, limping in with no hyperdrive, and Lando came out with his guards to meet his old friend.',
      lines: {
        xwing: [['luke', 'This is where they landed. Han trusted him.'], ['r2', '(A sceptical beep.)']],
        falcon: [['han', 'Why, you slimy, double-crossing, no-good swindler. You’ve got a lot of guts coming here, after what you pulled.'], ['chewie', '(A warning growl.)']],
        cruiser: [['morty', 'Th-there’s a guy in a cape coming, Rick.'], ['rick', 'Never trust a man in a cape, Morty. That’s, like, rule one.']],
        rv: [['walt', 'A welcoming committee. With guns.'], ['jesse', 'Big smile, though. I don’t trust the smile.']],
      },
    },
    {
      id: 'plaza',
      name: 'The Administrator’s plaza',
      at: [0, 20],
      r: 40,
      about: 'The heart of the city, under the Baron Administrator’s tower: Ugnaughts, gas miners, merchants and Wing Guards, and cloud cars parked on the pads.',
      lines: {
        xwing: [['luke', 'A whole city floating on gas. Nobody here knows the Empire’s already here.']],
        falcon: [['han', 'He’s done all right for himself, the old pirate.'], ['chewie', '(An unimpressed huff.)']],
        cruiser: [['morty', 'Rick, it’s so pretty up here!'], ['rick', 'Sure, Morty. A small mining colony run by a guy who sold out his best friend by lunchtime. Very pretty.']],
        rv: [['jesse', 'This is like the nicest mall I’ve ever been in.'], ['walt', 'It’s a company town, Jesse. Everything here belongs to one man.']],
      },
    },
    {
      id: 'dining',
      name: 'The dining room',
      at: [-95, 95],
      r: 18,
      about: 'Lando opened the doors and there he was, at the end of the table. “We would be honoured if you would join us.”',
      lines: {
        xwing: [['luke', 'He was waiting for them in here. My father.'], ['r2', '(A low, frightened whistle.)']],
        falcon: [['han', 'I shot first. Didn’t do a thing.'], ['chewie', '(A furious roar.)']],
        cruiser: [['morty', 'It’s a dinner party, Rick, with D-Darth Vader!'], ['rick', 'Worst dinner party in the galaxy, Morty, and I’ve been to your mom’s work thing.']],
        rv: [['jesse', 'He just… blocked the blaster? With his hand?'], ['walt', 'Never walk into a room you didn’t check first, Jesse.']],
      },
      things: [{ kind: 'diningroom', at: [0, 0], yaw: 2.356, abs: true, y: 0 }],
    },
    {
      id: 'carbon',
      name: 'The carbon-freezing chamber',
      at: [95, -85],
      r: 22,
      about: 'Built for freezing Tibanna gas, borrowed by Vader to freeze Han Solo, to see if a man could survive it. “I love you.” “I know.”',
      lines: {
        xwing: [['luke', 'They froze Han in here. To test it. For me.'], ['r2', '(A distressed squeal.)']],
        falcon: [['han', 'I don’t want to talk about it.'], ['chewie', '(A heartbroken howl.)']],
        cruiser: [['morty', 'Rick, they froze a guy! Alive!'], ['rick', 'Carbonite, Morty. Cryogenics for people who don’t read the instructions.']],
        rv: [['walt', 'Liquid carbon, flash-frozen. Remarkable. And completely insane.'], ['jesse', 'He’s alive in there? Like, aware? Yo, that’s messed up.']],
      },
      things: [
        { kind: 'carbonchamber', at: [0, 0], yaw: -0.84, abs: true, y: 0 },
        { kind: 'carbonite', at: [3, 5], yaw: 2.6, abs: true, y: 0 },
        { kind: 'crates', at: [-8, 12], abs: true, y: 0, opts: { color: '#6a625a' } },
      ],
    },
    {
      id: 'reactor',
      name: 'The reactor shaft',
      at: [-185, 0],
      r: 16,
      about: 'A gantry out over the city’s core, nothing below but the wind. Where Vader took Luke’s hand, and told him the truth.',
      lines: {
        xwing: [['luke', 'No. No. That’s not true.'], ['r2', '(A soft, sad whistle.)']],
        falcon: [['han', 'Long way down. Kid jumped, they say. Into that.'], ['chewie', '(A worried moan.)']],
        cruiser: [['morty', 'Rick, it’s the “I am your father” spot!'], ['rick', 'Spoilers, Morty. Forty-five years of spoilers.']],
        rv: [['jesse', 'He’d rather fall than join his own dad, yo.'], ['walt', 'Family business. It’s never simple.']],
      },
    },
    {
      id: 'eastplatform',
      name: 'The east platform',
      at: [255, 0],
      r: 24,
      about: 'Where Boba Fett loaded his prize aboard Slave I and was gone, the carbonite slab on its sled, Leia and Chewie and Lando too late.',
      lines: {
        xwing: [['luke', 'He took Han from here, to Jabba. We’ll get him back, Artoo.'], ['r2', '(A determined beep.)']],
        falcon: [['han', 'Fett. Next time I see him…'], ['chewie', '(A vengeful roar.)']],
        cruiser: [['morty', 'That’s Boba Fett, Rick! The cool one!'], ['rick', 'Cool guy, Morty, famously cool, falls in a hole.']],
      },
      things: [
        { kind: 'cargosled', at: [-6, 4], yaw: 1.2, abs: true, y: 0 },
        { kind: 'crates', at: [8, -10], abs: true, y: 0, opts: { color: '#7a6a5a' } },
      ],
    },
    {
      id: 'vane',
      name: 'The weather vane',
      at: [141, -141],
      r: 14,
      about: 'Look down: the long vane under the city, where Luke hung on, out of strength, and called for Leia, and she heard him.',
      lines: {
        xwing: [['luke', 'I hung on down there. I called for her. She came.'], ['r2', '(A comforting chirp.)']],
        falcon: [['han', 'Heck of a place to get picked up from.'], ['chewie', '(A long, impressed whoop.)']],
        cruiser: [['morty', 'H-how far down is that, Rick?'], ['rick', 'Far enough, Morty. Step back.']],
      },
    },
  ],
  quests: [
    {
      id: 'han',
      name: 'Too late for Han',
      about: 'Vader has Han, and Boba Fett means to take him to Jabba. Find out where they’ve taken him, and get to the east platform before Slave I lifts off.',
      intro: [['Lando Calrissian', 'I had no choice. They arrived right before you did. They’ve taken Han to the carbon-freezing chamber. Hurry!']],
      steps: [
        { type: 'reach', at: [95, -85], r: 12, text: 'Get to the carbon-freezing chamber' },
        { type: 'talk', actor: 'chewie', text: 'Find Chewbacca', lines: [['Lando Calrissian', 'Chewie’s in there somewhere. If anyone knows where Fett took him…']] },
        { type: 'race', gates: [[150, -55], [200, 0], [245, 0]], r: 9, time: 45, text: 'Run for the east platform before Slave I lifts off', lines: [['Chewbacca', '(A roar: the east platform! Fett’s ship!)']] },
      ],
      done: [['Lando Calrissian', 'He’s gone. Fett’s gone, and Han with him.'], ['Leia', 'We’ll find him. We’ll get him back.']],
      reward: 'Slave I is away, with Han aboard. Next stop: Tatooine.',
    },
  ],
  things: [
    // the city: its deck, its tower, its towers, its bridges and platforms
    { kind: 'bespindeck', at: [0, 0], abs: true, y: 0, opts: { r: 170, gaps: [Math.PI, Math.PI / 2, -Math.PI / 2, 2.356] } },
    { kind: 'cloudcity', at: [0, 0], abs: true, y: 0, scale: 2.2, model: false },
    { kind: 'bespinplatform', at: [0, -255], abs: true, y: 0, opts: { r: 28, gap: 0 } },
    { kind: 'bespinbridge', at: [0, -199], abs: true, y: 0, opts: { len: 62, w: 7 } },
    { kind: 'bespinplatform', at: [255, 0], abs: true, y: 0, opts: { r: 22, gap: -Math.PI / 2 } },
    { kind: 'bespinbridge', at: [201, 0], yaw: Math.PI / 2, abs: true, y: 0, opts: { len: 66, w: 6 } },
    { kind: 'reactorshaft', at: [-195, 0], yaw: -Math.PI / 2, abs: true, y: 0 },
    { kind: 'bespinbridge', at: [-174.5, 0], yaw: Math.PI / 2, abs: true, y: 0, opts: { len: 13, w: 6 } },
    { kind: 'bespinplatform', at: [141, -141], abs: true, y: 0, opts: { r: 12, gap: -Math.PI / 4 } },
    { kind: 'bespinbridge', at: [126.6, -126.6], yaw: 2.356, abs: true, y: 0, opts: { len: 26, w: 5 } },
    { kind: 'weathervane', at: [0, 0], abs: true, y: -250, solid: false },
    // the platform where you land: a cloud car down for a refit, its
    // crew's cargo, and the lamps round the rim
    { kind: 'cloudcar', at: [-16, -268], yaw: 2.4, abs: true, y: 1.2 },
    { kind: 'barrel', at: [16, -266], yaw: 0.3, abs: true, y: 0 },
    { kind: 'barrel', at: [17.1, -265.2], yaw: 1.2, abs: true, y: 0 },
    { kind: 'cooler', at: [18.5, -267.5], yaw: 0.8, abs: true, y: 0 },
    { kind: 'bevelcrate', at: [15, -268.5], yaw: 0.4, abs: true, y: 0 },
    { kind: 'lamp', at: [-20, -248], abs: true, y: 0, opts: { h: 4.5, light: '#ffe0b0', color: '#d8d0c4' } },
    { kind: 'lamp', at: [20, -248], abs: true, y: 0, opts: { h: 4.5, light: '#ffe0b0', color: '#d8d0c4' } },
    // cloud cars parked by the plaza, lamps along the way in
    { kind: 'cloudcar', at: [-26, 30], yaw: 0.5, abs: true, y: 1.2 },
    { kind: 'cloudcar', at: [-34, 18], yaw: 0.8, abs: true, y: 1.2 },
    { kind: 'lamp', at: [-8, -150], abs: true, y: 0, opts: { h: 4.5, light: '#ffe0b0', color: '#d8d0c4' } },
    { kind: 'lamp', at: [8, -150], abs: true, y: 0, opts: { h: 4.5, light: '#ffe0b0', color: '#d8d0c4' } },
    { kind: 'lamp', at: [-8, -110], abs: true, y: 0, opts: { h: 4.5, light: '#ffe0b0', color: '#d8d0c4' } },
    { kind: 'lamp', at: [8, -110], abs: true, y: 0, opts: { h: 4.5, light: '#ffe0b0', color: '#d8d0c4' } },
    { kind: 'lamp', at: [150, -8], abs: true, y: 0, opts: { h: 4.5, light: '#ffe0b0', color: '#d8d0c4' } },
    { kind: 'lamp', at: [150, 8], abs: true, y: 0, opts: { h: 4.5, light: '#ffe0b0', color: '#d8d0c4' } },
  ],
  scatter: [
    // the skyline: towers stood on the deck (lifted from the fall to it)
    { kind: 'cloudcity', n: 46, within: [52, 158], scale: [0.45, 1.25], sink: -40, clear: 18 },
    { kind: 'cloudblock', n: 40, within: [36, 150], scale: [0.6, 1.3], sink: -40, clear: 12 },
    { kind: 'lamp', n: 50, within: [24, 160], scale: [1, 1], sink: -40, clear: 6, opts: { h: 4.5, light: '#ffe0b0', color: '#d8d0c4', radius: 0.2 } },
  ],
  life: [
    { kind: 'lando', id: 'lando', quest: 'han', at: [2, -233], face: 3.1, still: true, name: 'Lando Calrissian', named: true, says: ['Hello, what have we here? Welcome. I’m Lando Calrissian. I’m the administrator of this facility.', 'You look absolutely beautiful. You truly belong here with us among the clouds.', 'This deal is getting worse all the time.', 'I had no choice. They arrived right before you did. I’m sorry.'] },
    { kind: 'lobot', at: [5, -235], face: 3.1, still: true, name: 'Lobot', named: true, says: ['(He says nothing. He never does. The lights on his headband blink.)'] },
    { kind: 'wingguard', n: 3, path: [[-2.5, -236], [-2.5, -172], [2.5, -172], [2.5, -236]], speed: 1.3, name: 'Wing Guard', says: ['Welcome to Cloud City.', 'Keep to the walkways, please. It’s a long way down.', 'The Baron Administrator will see you now.'] },
    { kind: 'wingguard', n: 2, at: [0, 40], spread: 20, roam: 20, speed: 1.1, name: 'Wing Guard', says: ['Move along, citizen.', 'Imperial business. Don’t ask.'] },
    { kind: 'villager', n: 6, at: [10, 40], spread: 45, roam: 30, speed: 1.0, name: 'Cloud City citizen', says: ['Tibanna gas prices are up again. Good for us.', 'Have you seen the sunsets from the east platform?', 'Imperials? Here? The Baron says it’s just business.', 'Mind the edges. They never did put rails on the platforms.'] },
    { kind: 'ugnaught', n: 2, at: [-14, -264], spread: 4, roam: 5, speed: 0.8, name: 'Ugnaught mechanic', says: ['(It squeals at the cloud car’s open engine, and then at you.)', '(It hands you a part, takes it back, and grunts.)'] },
    { kind: 'astromech', n: 1, at: [14, -262], roam: 5, speed: 0.6, name: 'Astromech', says: ['(A tidy beep. The platform is its responsibility.)'] },
    { kind: 'ugnaught', n: 4, at: [95, -85], spread: 10, roam: 9, speed: 0.8, name: 'Ugnaught', says: ['(It squeals at you and waves you away from the pit.)', '(Grumbling, it shovels carbonite flakes off the platform.)', '(It snorts, and points at the slab, and laughs.)'] },
    { kind: 'ugnaught', n: 3, at: [-20, 60], spread: 20, roam: 14, speed: 0.8, name: 'Ugnaught', says: ['(It is very busy, and would like you to know it.)', '(It offers to sell you a slightly used protocol droid head.)'] },
    { kind: 'wookiee', id: 'chewie', at: [100, -72], roam: 6, speed: 1, name: 'Chewbacca', named: true, says: ['(A furious, heartbroken roar at the Ugnaughts and the stormtroopers.)', '(He has C-3PO strapped to his back, in pieces. Threepio is complaining.)'] },
    { kind: 'stormtrooper', n: 4, path: [[-70, 70], [-110, 70], [-110, 110], [-70, 110]], speed: 1.3, name: 'Stormtrooper', says: ['Move along.', 'This area is off limits.', 'Lord Vader has ordered this section sealed.'] },
    { kind: 'bobafett', at: [262, 2], face: -1.6, still: true, name: 'Boba Fett', named: true, says: ['He’s no good to me dead.', 'What if he doesn’t survive? He’s worth a lot to me.', '(The helmet turns, slowly, to follow you. He says nothing.)'] },
    { kind: 'stormtrooper', n: 2, at: [250, -6], spread: 6, roam: 5, speed: 1, name: 'Stormtrooper', says: ['Put Captain Solo in the cargo hold.', 'Stand clear of the sled.'] },
    { kind: 'vader', at: [-183.5, 0], face: -1.5708, still: true, name: 'Darth Vader', named: true, says: ['Luke, you do not yet realise your importance.', 'Obi-Wan never told you what happened to your father.', 'No. I am your father.', 'Search your feelings. You know it to be true.', 'Join me, and together we can rule the galaxy as father and son.'] },
    { kind: 'luke', at: [-191, 0], face: 1.5708, still: true, name: 'Luke Skywalker', named: true, says: ['He told me enough! He told me you killed him.', 'No. No. That’s not true. That’s impossible!', 'I’ll never join you!'] },
    { kind: 'c3po', at: [-84, 120], roam: 5, speed: 0.6, name: 'C-3PO', named: true, says: ['Oh! Stormtroopers? Here? We’re in danger. I must tell the others.', 'Oh, no! I’ve been shot!', 'If only you’d attached my legs, I wouldn’t be in this ridiculous position.'] },
    { kind: 'cloudcar', n: 2, path: [[300, 0], [212, 212], [0, 300], [-212, 212], [-300, 0], [-212, -212], [0, -300], [212, -212]], pause: 0, speed: 16, y: 72, solid: false },
    { kind: 'cloudcar', n: 1, path: [[0, -360], [-255, -255], [-360, 0], [-255, 255], [0, 360], [255, 255], [360, 0], [255, -255]], pause: 0, speed: 18, y: 55, solid: false },
  ],
  flyovers: [
    { kind: 'cloudcar', n: 2, metres: 7, alt: 30, speed: 60, every: 40 },
    { kind: 'shuttle', n: 1, metres: 20, alt: 80, speed: 60, every: 120 },
  ],
  skyships: [
    { kind: 'destroyer', metres: 1600, at: [2600, 3200, 5200], yaw: -2.4 },
    // another of Bespin's floating mines, far off over the clouds
    { kind: 'cloudcity', metres: 900, at: [-5200, -300, -4200], yaw: 0.6 },
  ],

};
