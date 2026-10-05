// The forest worlds, from the ground: Endor, Kashyyyk, Dagobah and Yavin 4.
// (sites/index.js has what a site is.)

// Endor's sun, for its sky and the light slanting through its trees
const ENDOR_SUN = { az: 0.9, el: 1.02 };

// the Ewok village: five trees round a clearing, a deck up each, rope
// bridges between, huts on the decks (all relative to the village)
const VILLAGE = (() => {
  const trees = [
    { a: 0.3, d: 22, h: 9, h2: 16, stair: 0.3 },
    { a: 1.55, d: 24, h: 11 },
    { a: 2.8, d: 21, h: 8.5, h2: 15 },
    { a: 4.0, d: 23, h: 10.5, stair: 4.0 },
    { a: 5.2, d: 22, h: 12 },
  ].map((t, i) => ({ ...t, at: [Math.sin(t.a) * t.d, Math.cos(t.a) * t.d], seed: 50 + i }));
  const deck = 7;
  const things = [];
  trees.forEach((t, i) => {
    const next = trees[(i + 1) % trees.length];
    const prev = trees[(i + trees.length - 1) % trees.length];
    const bearing = (to) => Math.atan2(to.at[0] - t.at[0], to.at[1] - t.at[1]);
    things.push({ kind: 'ewoktree', at: t.at, model: false, opts: { h: t.h, h2: t.h2, deck, stair: t.stair ?? null, seed: t.seed, gaps: [bearing(next), bearing(prev)] } });
    // its bridge to the next tree
    const dx = next.at[0] - t.at[0];
    const dz = next.at[1] - t.at[1];
    const d = Math.hypot(dx, dz);
    const len = d - deck * 2 + 1.6;
    things.push({ kind: 'ropebridge', at: [t.at[0] + dx / 2, t.at[1] + dz / 2], yaw: Math.atan2(dx, dz), opts: { len, h0: t.h, h1: next.h, sag: 0.45 } });
    // a hut on its deck, its door to the clearing, and one up top
    const out = Math.atan2(-t.at[0], -t.at[1]) + 0.9;
    things.push({ kind: 'ewokhut', at: [t.at[0] + Math.sin(out + Math.PI) * 4.9, t.at[1] + Math.cos(out + Math.PI) * 4.9], y: t.h, yaw: out + Math.PI, solid: false, opts: { r: 1.7 } });
    if (t.h2) things.push({ kind: 'ewokhut', at: [t.at[0] + Math.sin(out) * 2.6, t.at[1] + Math.cos(out) * 2.6], y: t.h2, yaw: out, solid: false, opts: { r: 1.5 } });
  });
  // Ewoks pacing their decks: an arc on the far side from the hut
  const walks = trees.map((t) => {
    const out = Math.atan2(-t.at[0], -t.at[1]) + 0.9;
    const arc = [-0.9, -0.3, 0.3, 0.9].map((da) => [t.at[0] + Math.sin(out + da) * 5.4, t.at[1] + Math.cos(out + da) * 5.4]);
    return [...arc, arc[2], arc[1]];
  });
  return { trees, things, walks };
})();
const at = (o, [x, z]) => [o[0] + x, o[1] + z];
const V = [-210, 150]; // the village

export const SITES = {
  endor: {
    place: 'The forest moon',
    line: 'Redwoods older than the Empire, and something small watching you from the ferns.',
    sky: {
      zenith: '#5d8ec4',
      horizon: '#b2c6b8',
      haze: 0.8,
      hazeColor: '#9fb4a4',
      suns: [{ ...ENDOR_SUN, color: '#fff1d4', size: 0.014, glow: 1.1 }],
      clouds: { cover: 0.28, color: '#ffffff', shade: '#b4c2c4', scale: 0.6, speed: 0.004 },
      bodies: [
        // Endor itself, the gas giant the moon goes round
        { az: -2.3, el: 0.42, size: 0.26, color: '#7ea6aa', color2: '#4a6a7a', bands: 9, twist: 1.2 },
        { az: -1.7, el: 0.62, size: 0.018, color: '#d8d4c8' },
      ],
    },
    fog: { color: '#8fa595', density: 0.005 },
    light: { sun: 2.7, sky: '#d2e2d8', ground: '#4a5634', ambient: 0.8 },
    dust: '#7a6a4c',
    edge: 'The forest goes on, and on. Best not to get lost in it.',
    ground: {
      seed: 7,
      wind: 0.3,
      layers: [
        { type: 'swell', scale: 420, height: 14 },
        { type: 'hills', scale: 150, height: 7 },
        { type: 'mountains', from: 900, to: 3200, height: 320, scale: 1300 },
      ],
      palette: {
        low: '#33361f',
        high: '#3e4824',
        rock: '#5a5040',
        accent: '#54402a',
        deep: '#262a18',
        hLow: -8,
        hHigh: 12,
        rockAt: 0.48,
        accentCover: 0.5,
        grain: 0.9,
        patch: 0.8,
      },
    },
    weather: [{ kind: 'motes', count: 700 }],
    land: { at: [0, 0], yaw: 0.6 },
    lines: {
      out: {
        xwing: [['luke', 'Endor. Quiet, Artoo. There could be scout troopers anywhere.'], ['r2', '(A very quiet beep.)']],
        falcon: [['han', 'Trees. Big trees. Chewie, you’re gonna love it here.'], ['chewie', '(A happy, homesick moan.)']],
        cruiser: [['morty', 'Rick, these trees are huge! Like, Redwood-National-Park huge!'], ['rick', 'They filmed it in one, Morty. Don’t think about it too hard.']],
        rv: [['jesse', 'Yo, it smells like… Christmas trees. Like, a billion of them.'], ['walt', 'Stay close to the RV, Jesse. Something’s watching us.']],
      },
    },
    places: [
      {
        id: 'village',
        name: 'Bright Tree Village',
        at: V,
        r: 46,
        flat: { r: 40 },
        about: 'The Ewoks’ home, high in the trees: huts on decks round the trunks, rope bridges between, and a fire in the middle where they nearly roasted Han Solo. Then they made Threepio a god.',
        lines: {
          xwing: [['luke', 'Bright Tree Village. They were going to cook Han, Chewie and me for Threepio’s feast.'], ['r2', '(A gleeful burble.)']],
          falcon: [['han', 'I was the main course here, once. Long story.'], ['chewie', '(A laugh that goes on a bit too long.)']],
          cruiser: [['morty', 'Th-they’re like teddy bears, Rick! Murder teddy bears!'], ['rick', 'Spears and catapults, Morty. They took down the Empire. Respect the bears.']],
          rv: [['jesse', 'Little bear dudes living in treehouses. This is the best day of my life.'], ['walt', 'They’re armed, Jesse.']],
        },
        things: [
          ...VILLAGE.things,
          { kind: 'fire', at: [0, 0], scale: 1.8 },
          { kind: 'drums', at: [6, -4], yaw: 0.6 },
          { kind: 'log', at: [-4.5, 3], yaw: 0.9, opts: { len: 4, r: 0.35 } },
          { kind: 'log', at: [4.5, 4], yaw: -0.8, opts: { len: 4, r: 0.35 } },
          { kind: 'lightshafts', at: [0, 0], opts: { ...ENDOR_SUN, n: 7, spread: 26, seed: 11 } },
        ],
      },
      {
        id: 'bunker',
        name: 'The bunker',
        at: [250, -40],
        r: 34,
        flat: { r: 28 },
        about: 'The back door to the shield generator: an armoured entrance dug into the hillside, where the strike team went in and a stolen AT-ST came back out with an Ewok at the controls.',
        lines: {
          xwing: [['luke', 'The bunker. If Han’s team hadn’t blown it, the fleet would’ve been wiped out.']],
          falcon: [['han', 'Jabba’s palace was easier to get into than this.'], ['chewie', '(A grumble of agreement.)']],
          cruiser: [['rick', 'One back door, Morty, guarded by guys who can’t aim. Evil empire. Sure.'], ['morty', 'Rick, there’s a guy in white right there!']],
          rv: [['walt', 'One entrance. Armoured. Out in the middle of nowhere.'], ['jesse', 'Yo, it’s like a superlab for space Nazis.']],
        },
        things: [
          { kind: 'bunker', at: [0, -6], yaw: 0 },
          { kind: 'crates', at: [-10, 4] },
          { kind: 'crates', at: [9, 6] },
          { kind: 'lamp', at: [-7, 6], opts: { h: 3.2, light: '#ffe0a0' } },
          { kind: 'lamp', at: [7, 6], opts: { h: 3.2, light: '#ffe0a0' } },
        ],
      },
      {
        id: 'generator',
        name: 'The shield generator',
        at: [400, -230],
        r: 64,
        flat: { r: 58 },
        about: 'The great dish projecting the deflector shield round the second Death Star overhead, beside the landing platform where the stolen shuttle Tydirium set down.',
        lines: {
          xwing: [['luke', 'The generator. While that was up, nothing could touch the Death Star.'], ['r2', '(An anxious whistle.)']],
          falcon: [['han', 'That’s the shuttle we stole. Tydirium. It’s an older code, sir, but it checks out.'], ['chewie', '(A nervous rumble.)']],
          cruiser: [['morty', 'That’s a big dish, Rick.'], ['rick', 'It’s a space umbrella for a space ball, Morty. Very fragile, very load-bearing.']],
          rv: [['jesse', 'Yo, that’s the biggest satellite dish I ever saw.'], ['walt', 'And they guarded it with a dozen men and some walkers. Sloppy.']],
        },
        things: [
          { kind: 'shieldgen', at: [0, -10], yaw: 0.2 },
          { kind: 'pad', at: [-10, 42], opts: { r: 14, color: '#6a6c68', light: '#ffd070' } },
          { kind: 'lambda', at: [-10, 41], yaw: -0.4 },
          { kind: 'crates', at: [-30, 26] },
          { kind: 'crates', at: [24, 30] },
          { kind: 'lamp', at: [4, 30], opts: { h: 5, light: '#ffe0a0' } },
          { kind: 'lamp', at: [-24, 32], opts: { h: 5, light: '#ffe0a0' } },
        ],
      },
      {
        id: 'scoutcamp',
        name: 'The scout troopers’ camp',
        at: [60, 250],
        r: 26,
        flat: { r: 18 },
        about: 'Where the strike team crept up on two scout troopers by their speeder bikes; Han stepped on a twig, and the chase through the trees began.',
        lines: {
          xwing: [['luke', 'This is where Leia and I took the bikes. Seventy kilometres an hour through the trees.'], ['r2', '(An alarmed whistle.)']],
          falcon: [['han', 'Go around? Chewie and me’ll take care of this. Quietly.'], ['chewie', '(A muffled snort.)']],
          rv: [['jesse', 'Hover bikes! Mr. White, I am riding one of these.'], ['walt', 'Jesse, they’re government property.']],
        },
        things: [
          { kind: 'fire', at: [0, 0] },
          { kind: 'crates', at: [-6, -5] },
          { kind: 'log', at: [3, -3], yaw: 0.4, opts: { len: 5, r: 0.4 } },
        ],
      },
      {
        id: 'nettrap',
        name: 'The net trap',
        at: [-140, -170],
        r: 20,
        flat: { r: 10 },
        about: 'A dead animal on a stake, and a net in the branches above. Chewbacca grabbed the bait, and Ewoks came out of the ferns.',
        lines: {
          xwing: [['luke', 'Chewie, don’t! Wait… too late.'], ['r2', '(A smug little whistle.)']],
          falcon: [['han', 'Great, Chewie. Great. Always thinking with your stomach.'], ['chewie', '(A sheepish whine.)']],
          cruiser: [['morty', 'Is— is that meat on a stick? Rick, don’t touch it!'], ['rick', 'I wasn’t gonna, Morty. *burp* Okay, I was.']],
        },
        things: [{ kind: 'nettrap', at: [-8.5, 3], yaw: 0 }],
      },
      {
        id: 'logtrap',
        name: 'The log trap',
        at: [140, 110],
        r: 22,
        flat: { r: 14 },
        about: 'Two logs swung from the trees, and an AT-ST’s head caught between them: the Ewoks’ own way of fighting the Empire’s war machines.',
        lines: {
          xwing: [['luke', 'Stones and logs against walkers. And they won.']],
          falcon: [['han', 'Remind me never to get on the wrong side of an Ewok.'], ['chewie', '(An impressed whoop.)']],
          cruiser: [['rick', 'Primitive tech beats military-industrial complex, Morty. Write that down.'], ['morty', 'Rick, I don’t have a pen.']],
        },
        things: [
          { kind: 'logtrap', at: [0, 0], yaw: 0.5 },
          { kind: 'atst', at: [5, -5], yaw: 2.2, roll: 1.42, y: 1.1, solid: { r: 3 } },
        ],
      },
      {
        id: 'pyre',
        name: 'Vader’s pyre',
        at: [-330, -80],
        r: 16,
        flat: { r: 12 },
        about: 'Where Luke burned his father’s armour, alone in the forest, while the fireworks went up over the village: the end of Darth Vader, and of Anakin Skywalker.',
        lines: {
          xwing: [['luke', 'I burned his armour here. He was Anakin Skywalker again, at the end.'], ['r2', '(A soft, low whistle.)']],
          falcon: [['han', 'The kid never said much about it. I never asked.'], ['chewie', '(A quiet, respectful rumble.)']],
          rv: [['walt', 'A man’s whole legacy, up in smoke.'], ['jesse', 'That’s deep, Mr. White.']],
        },
        things: [{ kind: 'pyre', at: [0, 0], yaw: 0.4 }],
      },
    ],
    things: [
      { kind: 'lightshafts', at: [0, 0], opts: { ...ENDOR_SUN, n: 8, spread: 40, seed: 5 } },
      { kind: 'lightshafts', at: [130, -110], opts: { ...ENDOR_SUN, n: 8, spread: 46, seed: 7 } },
      { kind: 'lightshafts', at: [-90, 60], opts: { ...ENDOR_SUN, n: 8, spread: 46, seed: 9 } },
    ],
    scatter: [
      { kind: 'redwood', n: 300, within: [24, 640], scale: [0.75, 1.35], opts: { seed: 1 } },
      { kind: 'redwood', n: 160, within: [24, 640], scale: [0.6, 1.2], opts: { seed: 2, h: 58, r: 2.0, bark: '#7a4a32' } },
      { kind: 'redwood', n: 120, within: [600, 1300], scale: [1.0, 1.5], solid: false, opts: { seed: 3 } },
      { kind: 'spruce', n: 140, within: [20, 620], scale: [0.7, 1.3], opts: { seed: 4 } },
      { kind: 'fern', n: 900, within: [6, 560], scale: [0.8, 1.9], solid: false, clear: -12, opts: { seed: 5 } },
      { kind: 'fern', n: 400, within: [6, 560], scale: [0.6, 1.3], solid: false, clear: -14, opts: { seed: 6, color: '#5c8036', n: 7, len: 1.0 } },
      { kind: 'log', n: 40, within: [30, 560], scale: [0.8, 1.4], solid: false, opts: { seed: 7 } },
      { kind: 'rock', n: 50, within: [20, 560], scale: [0.6, 2.2], opts: { color: '#6a6a5a', sharp: 0.4 } },
    ],
    life: [
      { kind: 'ewok', n: 7, at: V, spread: 6, roam: 6, speed: 0.9, name: 'Ewok', says: ['Yub nub!', 'Ee chee wa maa!', '(It dances round the fire, banging a stick on a helmet.)', '(It looks at you, then at the fire, then back at you. Thoughtfully.)', 'Gunda!'] },
      ...VILLAGE.walks.map((path, i) => ({ kind: 'ewok', n: 1, path, speed: 0.7, pause: 2.5 + i, name: 'Ewok', says: ['(It waves its spear at you from the deck.)', 'Yub yub!', '(A long, suspicious sniff.)'] })),
      { kind: 'c3po', n: 1, at: at(V, [4, -5]), still: true, face: -0.7, name: 'C-3PO', says: ['Oh my! I seem to have become something of a deity here.', '(He tells the Ewoks the whole story of the Rebellion: the Death Star, Cloud City, Han frozen in carbonite. With sound effects.)', 'It’s against my programming to impersonate a deity.', 'Oh dear. I’m afraid you’re to be the guest of honour at the banquet.'] },
      { kind: 'ewok', n: 1, at: [18, -16], roam: 6, speed: 0.8, name: 'Wicket', says: ['Yub nub!', '(He pokes you with his spear, then sniffs your boots.)', '(He offers you half a strange fruit. The bitten half.)'] },
      { kind: 'ewok', n: 3, at: [-140, -164], spread: 5, roam: 6, speed: 0.9, name: 'Ewok hunter', says: ['(It points at the net, very proud of it.)', 'Ee chee wa maa!'] },
      { kind: 'ewok', n: 2, at: [148, 100], spread: 5, roam: 6, speed: 0.9, name: 'Ewok', says: ['(It mimes a log swinging, and a walker going over.)', 'Yub nub!'] },
      { kind: 'scouttrooper', n: 2, path: [[236, -30], [264, -30], [264, -12], [236, -12]], speed: 1.3, name: 'Scout trooper', says: ['Hey! You there! Freeze!', 'Go for help! Go!', 'Nobody gets in without authorisation.', 'Quiet out here. Too quiet.'] },
      { kind: 'stormtrooper', n: 1, at: [245, -38], still: true, face: 0, name: 'Stormtrooper', says: ['This area is off limits.', 'Move along.'] },
      { kind: 'stormtrooper', n: 1, at: [255, -38], still: true, face: 0, name: 'Stormtrooper', says: ['Freeze! Don’t move!', 'There’s nothing to see here.'] },
      { kind: 'rebel', n: 3, at: [214, -12], spread: 4, roam: 3, speed: 0.8, name: 'Rebel commando', says: ['Quiet. There’s a scout trooper right over there.', 'We go in on General Solo’s signal.', 'I hope the fleet’s on time.'] },
      { kind: 'scouttrooper', n: 2, at: [60, 250], spread: 4, roam: 5, speed: 0.8, name: 'Scout trooper', says: ['Hey, did you hear something?', 'Stay with the bikes. I’ll check the perimeter.'] },
      { kind: 'atst', n: 1, path: [[400, -282], [430, -270], [442, -240], [430, -210], [400, -198], [370, -210], [358, -240], [370, -270]], speed: 1.4, r: 1.6, name: 'AT-ST', says: ['(The walker stops, its head turning toward you with a hiss of hydraulics.)', '(Its chin guns track you. Then it stalks on.)'] },
      { kind: 'scouttrooper', n: 2, path: [[380, -192], [420, -192], [420, -186], [380, -186]], speed: 1.2, name: 'Scout trooper', says: ['The shield must stay up. Lord Vader’s orders.', 'Back to the platform. Now.'] },
    ],
    rides: [
      { kind: 'speederbike', at: [-14, 10], yaw: 0.3 },
      { kind: 'speederbike', at: [66, 244], yaw: 2.4 },
      { kind: 'speederbike', at: [54, 256], yaw: 2.0 },
    ],
    flyovers: [
      { kind: 'shuttle', n: 1, metres: 20, alt: 120, speed: 60, every: 70 },
      { kind: 'tie', n: 2, metres: 7, alt: 110, speed: 120, every: 60 },
    ],
    skyships: [
      { kind: 'deathstar2', metres: 640, at: [2880, 2614, -3143], yaw: 0.6 },
      { kind: 'executor', metres: 260, at: [-1800, 2200, -3600], yaw: 1.2 },
    ],
  },
};
