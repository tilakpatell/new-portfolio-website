// A galaxy far, far away: the Star Wars galaxy as somewhere to fly, a
// universe inside the universe map (you jump to it from the Star Wars
// planet there). Pure data, so it's tested in Node: the scene, the
// holographic galaxy map, the system cards, the crews' lines and the
// mission briefings all read this.
//
// The galaxy is the films' own map: a disc with the Deep Core in the middle,
// the Core Worlds, the Colonies, the Inner Rim, the Expansion Region, the
// Mid Rim and the Outer Rim in rings out from it, and the Unknown Regions
// off to the west. Where a system is on it is `pos`, [x, z] in grid squares
// (x from the A column at the west edge to U at the east, z from row 1 at the
// north to 21 at the south), with its grid square (`grid`) where the films'
// atlas gives one. A system is its own place to fly: its planet sits in the
// middle (`body`, drawn by bodies.js; null at Alderaan, which is rubble now),
// lit by its star or stars (`suns`, the way toward each, in the system's own
// frame: +x galactic east, +z galactic south, +y galactic north), with its
// moons, the gas giant it orbits (`parent`), and the moment from the films
// it's remembered for (`moment`, the set piece the scene plays out there:
// `pieces`). `faction` is who comes after you there (galaxy/hunted.js), and
// `traffic` what flies by on its own business.
//
// Each system is from one or more of the films (`films`, FILMS' ids); its
// era is the era of the moment it's shown at. `game` is the mission you can
// fly there: most are briefings for games still to be built (status
// 'soon'), a couple go straight to one that's here already (`to`).

// ── The films, in the galaxy's own order of events ──

export const FILMS = {
  tpm: { title: 'The Phantom Menace', episode: 'I', year: -32, era: 'republic' },
  aotc: { title: 'Attack of the Clones', episode: 'II', year: -22, era: 'republic' },
  rots: { title: 'Revenge of the Sith', episode: 'III', year: -19, era: 'republic' },
  rogue: { title: 'Rogue One', episode: null, year: 0, era: 'empire' },
  anh: { title: 'A New Hope', episode: 'IV', year: 0, era: 'empire' },
  esb: { title: 'The Empire Strikes Back', episode: 'V', year: 3, era: 'empire' },
  rotj: { title: 'Return of the Jedi', episode: 'VI', year: 4, era: 'empire' },
  tfa: { title: 'The Force Awakens', episode: 'VII', year: 34, era: 'firstorder' },
  tlj: { title: 'The Last Jedi', episode: 'VIII', year: 34, era: 'firstorder' },
  tros: { title: 'The Rise of Skywalker', episode: 'IX', year: 35, era: 'firstorder' },
};
export const FILM_ORDER = Object.keys(FILMS);

// The three eras, each a trilogy (and Rogue One, the moment before A New Hope)
export const ERAS = [
  { id: 'republic', name: 'Fall of the Republic', short: 'Prequels', span: '32–19 BBY', color: '#7fc4ff', about: 'The Trade Federation, the clones and the droids, and the Jedi’s last days.' },
  { id: 'empire', name: 'Galactic Civil War', short: 'Originals', span: '0–4 ABY', color: '#ffd36a', about: 'The Rebel Alliance against the Empire and its Death Stars.' },
  { id: 'firstorder', name: 'Rise of the First Order', short: 'Sequels', span: '34–35 ABY', color: '#ff7a6a', about: 'The Resistance, the First Order, and the Sith fleet on Exegol.' },
];
export const eraById = (id) => ERAS.find((e) => e.id === id) ?? null;

// A year as the galaxy counts them: before or after the Battle of Yavin
export const yearLabel = (y) => (y < 0 ? `${-y} BBY` : `${y} ABY`);
export const filmLabel = (id) => {
  const f = FILMS[id];
  return f ? (f.episode ? `Episode ${f.episode}: ${f.title}` : f.title) : '';
};

// ── The map ──

// the middle of the galaxy, in grid squares (the Deep Core, just south and
// east of Coruscant), and how far out each region reaches from it. The
// regions aren't round: they reach further to the south (BULGE: a region's
// edge at a bearing is its r times 1 + BULGE × how far south the bearing
// points), as the atlas draws them, so Naboo is Mid Rim while Yavin, no
// further out, is Outer Rim. The Unknown Regions are the uncharted west,
// out past the Expansion Region (UNKNOWN: within `half` of due west, and
// further out than `from`).
export const CORE = [12, 9.8];
export const BULGE = 0.18;
export const REGIONS = [
  { id: 'deep', name: 'Deep Core', r: 0.5 },
  { id: 'core', name: 'Core Worlds', r: 2.1 },
  { id: 'colonies', name: 'Colonies', r: 2.6 },
  { id: 'inner', name: 'Inner Rim', r: 3.2 },
  { id: 'expansion', name: 'Expansion Region', r: 3.8 },
  { id: 'mid', name: 'Mid Rim', r: 6.25 },
  { id: 'outer', name: 'Outer Rim Territories', r: 9.7 },
];
export const UNKNOWN = { half: (35 * Math.PI) / 180, from: 7.4 };
// a region's edge at bearing `a` (radians, 0 east, π/2 south), from CORE
export const edgeAt = (r, a) => r * (1 + BULGE * Math.sin(a));
export const GRID = { cols: 21, rows: 21 }; // A to U, 1 to 21
export const RIM = 10.8; // the galaxy's disc, from CORE (round: the stars don't follow the regions' bulge)

// The great hyperspace routes, roughly as the atlas draws them, through the
// systems they pass (as points in grid squares)
export const LANES = [
  { id: 'perlemian', name: 'Perlemian Trade Route', pts: [[11.5, 8.5], [13, 7.6], [15, 6.4], [17, 5.6], [19.6, 4.5]] },
  { id: 'corellian-run', name: 'Corellian Run', pts: [[11.5, 8.5], [12.6, 10.6], [14.2, 12.6], [16, 14.2], [17.6, 15.4], [19.2, 17.2]] },
  { id: 'hydian', name: 'Hydian Way', pts: [[13.4, 1.4], [14.6, 5.5], [15.1, 9], [14.9, 13], [14, 17], [12.8, 20.4]] },
  { id: 'rimma', name: 'Rimma Trade Route', pts: [[12.4, 10.3], [11.6, 13], [10.9, 16], [10.6, 18.2], [11.4, 20.6]] },
  { id: 'spine', name: 'Corellian Trade Spine', pts: [[12.6, 10.6], [12.1, 13.6], [11.3, 16.4], [10.8, 17.7], [10.2, 19.8]] },
  { id: 'reaches', name: 'Western Reaches route', pts: [[11.5, 8.5], [9.4, 10], [7.2, 11.8], [5.4, 13.2]] },
];

// ── The systems ──
//
// id         the URL's (/galaxy/hoth) and the multiplayer room's
// name       as the films name it; `system` when the star system has another name
// region, sector, grid  where it is, as the atlas has it (grid null where it doesn't say)
// pos        [x, z] on the map, in grid squares
// films      the films it's in, in order
// moment     { film, title, text }: the scene the system is shown at
// about      a line or two for its card
// facts      [label, value] for its card
// quote      { text, by, film, clip? } (clip: lib/clips.js's, said as you arrive)
// accent     its colour on the map and the card (readable on #03040a)
// body       { look, r }: its planet (bodies.js's look), or null
// parent     { look, r, at }: the gas giant it orbits, seen in its sky
// moons      [{ look, r, orbit, speed, tilt, phase }]
// suns       [{ dir: [x, y, z], color, size }]
// pieces     the set pieces (setpieces.js reads them; sizes in map units, the ship is 0.26 long)
// faction    who hunts you here (galaxy/hunted.js), or null for nobody
// traffic    what flies through on its own business
// game       the mission: { id, objectives, title, film, role, pitch, how, status: 'soon' | 'live', to? }

export const SYSTEMS = [
  {
    id: 'tatooine',
    name: 'Tatooine',
    region: 'Outer Rim Territories',
    sector: 'Arkanis sector',
    grid: 'R-16',
    pos: [17.6, 15.4],
    films: ['tpm', 'aotc', 'anh', 'rotj', 'tros'],
    moment: { film: 'anh', title: 'The Tantive IV is taken', text: 'A Rebel blockade runner flees the Star Destroyer Devastator over the desert world, carrying the stolen Death Star plans.' },
    about: 'A desert world under two suns, run by the Hutts and a long way from anywhere: moisture farms, Jawas, Tusken Raiders, Mos Eisley and the Boonta Eve podrace. Both Skywalkers grew up here.',
    facts: [
      ['Suns', 'Tatoo I and Tatoo II'],
      ['Moons', 'Ghomrassen, Guermessa, Chenini'],
      ['Terrain', 'Dune seas, canyons, mesas'],
      ['Natives', 'Jawas, Tusken Raiders'],
    ],
    quote: { text: 'If there’s a bright center to the universe, you’re on the planet that it’s farthest from.', by: 'Luke Skywalker', film: 'anh' },
    accent: '#f0c27a',
    body: { look: 'tatooine', r: 40 },
    moons: [
      { look: 'moon-dust', r: 3.2, orbit: 92, speed: 0.012, tilt: 0.12, phase: 0.4 },
      { look: 'moon-grey', r: 2.2, orbit: 120, speed: 0.008, tilt: -0.2, phase: 2.6 },
      { look: 'moon-dust', r: 1.6, orbit: 150, speed: 0.006, tilt: 0.3, phase: 4.4 },
    ],
    suns: [
      { dir: [-0.62, 0.34, 0.7], color: '#fff1d2', size: 1 },
      { dir: [-0.5, 0.42, 0.76], color: '#ffc285', size: 0.72 },
    ],
    pieces: [{ type: 'chase', runner: { kind: 'corvette', size: 3.2 }, hunter: { kind: 'destroyer', size: 32 }, radius: 95, height: 22, tilt: 0.28, speed: 0.016 }],
    faction: 'empire',
    traffic: ['freighter', 'shuttle', 'slave1', 'xwing'],
    game: {
      id: 'podrace',
      objectives: ['Qualify on the Mos Espa grid, right behind Sebulba', 'Survive Beggar’s Canyon, the Arch Canyon and the Tusken Raiders’ potshots for three laps', 'Cross the line first, and win Anakin his freedom'],
      title: 'The Boonta Eve Classic',
      film: 'tpm',
      role: 'Anakin Skywalker, in his podracer',
      pitch: 'Three laps of the Mos Espa circuit: Beggar’s Canyon, the Arch Canyon, the Dune Sea and Tusken Raiders taking potshots, with Sebulba playing dirty all the way.',
      how: 'Two engines on cables: steer each side, boost when the energy binder’s hot, don’t clip the arches.',
      status: 'soon',
    },
  },
  {
    id: 'hoth',
    name: 'Hoth',
    region: 'Outer Rim Territories',
    sector: 'Anoat sector',
    grid: 'K-18',
    pos: [10.4, 17.4],
    films: ['esb'],
    moment: { film: 'esb', title: 'Death Squadron arrives', text: 'Vader’s fleet drops out of lightspeed too close to the system; the Rebels’ ion cannon fires to cover the transports as they run.' },
    about: 'An ice world at the edge of nowhere, where the Rebellion hid Echo Base until a probe droid found it. Wampas, tauntauns, and colder every night.',
    facts: [
      ['Moons', 'Three'],
      ['Terrain', 'Ice plains, glaciers, mountains'],
      ['Natives', 'Wampas, tauntauns'],
      ['Base', 'Echo Base'],
    ],
    quote: { text: 'Never tell me the odds.', by: 'Han Solo', film: 'esb', clip: 'neverTellOdds' },
    accent: '#bfe1ff',
    body: { look: 'hoth', r: 36 },
    moons: [
      { look: 'moon-ice', r: 3, orbit: 84, speed: 0.011, tilt: 0.18, phase: 1.2 },
      { look: 'moon-grey', r: 2.1, orbit: 112, speed: 0.008, tilt: -0.1, phase: 3.3 },
      { look: 'moon-ice', r: 1.4, orbit: 140, speed: 0.006, tilt: 0.25, phase: 5.1 },
    ],
    suns: [{ dir: [0.5, 0.28, 0.82], color: '#e8f1ff', size: 0.9 }],
    pieces: [
      {
        type: 'fleet',
        side: 'empire',
        ships: [
          { kind: 'executor', at: [-40, 58, -150], yaw: 0.5, size: 110 },
          { kind: 'destroyer', at: [-110, 40, -96], yaw: 0.62, size: 30 },
          { kind: 'destroyer', at: [24, 66, -132], yaw: 0.4, size: 30 },
          { kind: 'destroyer', at: [-72, 82, -188], yaw: 0.55, size: 30 },
          { kind: 'destroyer', at: [60, 34, -96], yaw: 0.3, size: 30 },
        ],
      },
      { type: 'escape', kind: 'transport', escort: 'xwing', from: [0, 28, -14], to: [140, 90, 200], size: 3.6, every: 26 },
      { type: 'cannon', from: [-10, 35.5, 12], color: '#ff5a4a', target: 1, every: 9 },
      { type: 'rocks', kind: 'field', at: [230, 30, 150], radius: 80, count: 420, seed: 7 },
    ],
    faction: 'empire',
    traffic: ['transport', 'xwing', 'tie'],
    game: {
      id: 'hoth',
      objectives: ['Hold the line in front of the shield generator', 'Trip every AT-AT with a tow cable before it gets there', 'Cover the last transports till they’re away'],
      title: 'The Battle of Hoth',
      film: 'esb',
      role: 'Rogue Group, in a snowspeeder',
      pitch: 'The walkers are coming for the shield generator. Blasters won’t get through that armour: harpoon a leg, fly rings round it, and bring them down one by one.',
      how: 'Fly low and fast, fire the tow cable as you pass a walker, then circle its legs till it trips.',
      status: 'soon',
    },
  },
  {
    id: 'endor',
    name: 'Endor',
    system: 'the forest moon of Endor',
    region: 'Outer Rim Territories',
    sector: 'Moddell sector',
    grid: 'H-16',
    pos: [7.5, 15.5],
    films: ['rotj'],
    moment: { film: 'rotj', title: 'The Battle of Endor', text: 'The Rebel fleet drops out of hyperspace to find the second Death Star’s shield still up, and the Emperor’s fleet waiting for them.' },
    about: 'The forest moon of the gas giant Endor, home of the Ewoks, where a shield generator guarded the second Death Star. The Emperor’s trap, and his end.',
    facts: [
      ['Orbits', 'Endor, a gas giant'],
      ['Terrain', 'Forests, mountains, savanna'],
      ['Natives', 'Ewoks'],
      ['Overhead', 'The second Death Star'],
    ],
    quote: { text: 'It’s a trap!', by: 'Admiral Ackbar', film: 'rotj', clip: 'itsATrap' },
    accent: '#8fd27a',
    body: { look: 'endor', r: 30 },
    parent: { look: 'endor-giant', r: 260, at: [-1350, 240, -1650] },
    moons: [],
    suns: [{ dir: [0.68, 0.36, 0.64], color: '#fff4e2', size: 0.95 }],
    pieces: [
      { type: 'station', kind: 'deathstar2', at: [150, 46, -190], size: 140, spin: 0.004, shield: true },
      {
        type: 'battle',
        at: [70, 30, -60],
        radius: 130,
        sides: {
          rebel: [
            { kind: 'moncal', at: [-10, 20, 90], yaw: 2.5, size: 26 },
            { kind: 'moncal', at: [60, 6, 120], yaw: 2.7, size: 22 },
            { kind: 'nebulon', at: [-20, 12, 46], yaw: 2.4, size: 7 },
            { kind: 'corvette', at: [30, 30, 60], yaw: 2.6, size: 3.2 },
            { kind: 'corvette', at: [-30, -12, 110], yaw: 2.3, size: 3.2 },
          ],
          empire: [
            { kind: 'executor', at: [40, 50, -150], yaw: -0.5, size: 110 },
            { kind: 'destroyer', at: [-60, 20, -110], yaw: -0.7, size: 30 },
            { kind: 'destroyer', at: [110, 10, -90], yaw: -0.3, size: 30 },
            { kind: 'destroyer', at: [0, -20, -140], yaw: -0.5, size: 30 },
          ],
        },
        fighters: { rebel: ['xwing', 'awing', 'ywing', 'bwing'], empire: ['tie', 'interceptor'] },
        count: 18,
      },
    ],
    faction: 'empire',
    traffic: ['shuttle', 'xwing', 'awing'],
    game: {
      id: 'endor',
      objectives: ['Catch the scout troopers before they reach the bunker', 'Keep off the trees', 'Get the strike team to the shield generator'],
      title: 'The Speeder Bike Chase',
      film: 'rotj',
      role: 'Luke and Leia, on stolen speeder bikes',
      pitch: 'Scout troopers are racing for the bunker to raise the alarm. Chase them through the giant trees at full throttle before they get there.',
      how: 'Lean into the turns, brake to let one overshoot, and fire when you’ve got them; the trees don’t move.',
      status: 'soon',
    },
  },
  {
    id: 'yavin',
    name: 'Yavin 4',
    system: 'Yavin',
    region: 'Outer Rim Territories',
    sector: 'Gordian Reach',
    grid: 'P-6',
    pos: [15.5, 5.5],
    films: ['rogue', 'anh'],
    moment: { film: 'anh', title: 'The Death Star rounds Yavin', text: 'The battle station comes round the gas giant to fire on the Rebel base, and every fighter the Alliance has goes up to meet it.' },
    about: 'A jungle moon of the gas giant Yavin, where the Rebellion hid in the Massassi temples and launched the attack that destroyed the first Death Star.',
    facts: [
      ['Orbits', 'Yavin, a gas giant'],
      ['Terrain', 'Jungle, rivers'],
      ['Base', 'The Great Temple'],
      ['Battle', 'Battle of Yavin, 0 BBY'],
    ],
    quote: { text: 'Stay on target.', by: 'Gold Five', film: 'anh', clip: 'stayOnTarget' },
    accent: '#9fe07a',
    body: { look: 'yavin4', r: 26 },
    parent: { look: 'yavin', r: 240, at: [1250, -150, 1500] },
    moons: [],
    suns: [{ dir: [-0.42, 0.42, -0.8], color: '#fff2dc', size: 0.95 }],
    pieces: [
      { type: 'deathstar', at: [170, 26, 150], r: 34, trench: true, board: '/deathstar' },
      { type: 'stream', kinds: ['xwing', 'ywing'], from: [0, 0, 0], to: [170, 26, 150], size: 0.28, every: 1.6 },
      { type: 'patrol', kind: 'tie', count: 6, at: [170, 26, 150], radius: 46, height: 12, speed: 0.22, size: 0.3 },
    ],
    faction: 'empire',
    traffic: ['xwing', 'ywing', 'corvette'],
    game: {
      id: 'trench',
      objectives: ['Get past the TIE fighters over the surface', 'Fly the trench with Vader on your tail', 'Put two proton torpedoes down the exhaust port'],
      title: 'The Trench Run',
      film: 'anh',
      role: 'Red Five',
      pitch: 'Down into the Death Star’s trench with Vader on your tail: two proton torpedoes, one exhaust port, and the clock running out on Yavin 4.',
      how: 'Already flying: on the Death Star’s own page.',
      status: 'live',
      to: '/deathstar#trench',
    },
  },
  {
    id: 'alderaan',
    name: 'Alderaan',
    system: 'what’s left of Alderaan',
    region: 'Core Worlds',
    sector: 'Alderaan sector',
    grid: 'M-10',
    pos: [12.5, 9.5],
    films: ['rots', 'anh'],
    moment: { film: 'anh', title: 'That’s no moon', text: 'The Falcon drops out of hyperspace into a field of rubble where a planet should be, and a small moon catches it in a tractor beam.' },
    about: 'Princess Leia’s homeworld: peaceful, beautiful and unarmed, until Tarkin chose it to show the galaxy what the Death Star could do. Only rubble is left.',
    facts: [
      ['Was', 'A peaceful world, with no weapons'],
      ['Destroyed', 'By the Death Star, 0 BBY'],
      ['Now', 'An asteroid field'],
      ['Survivor', 'Princess Leia Organa'],
    ],
    quote: { text: 'That’s no moon. It’s a space station.', by: 'Obi-Wan Kenobi', film: 'anh', clip: 'noMoon' },
    accent: '#8fc3ff',
    body: null,
    moons: [],
    suns: [{ dir: [0.3, 0.4, -0.86], color: '#fff8ee', size: 1 }],
    pieces: [
      { type: 'rocks', kind: 'debris', at: [0, 0, 0], radius: 70, count: 520, seed: 3 },
      { type: 'deathstar', at: [-150, 18, -110], r: 34, trench: false, tractor: true, board: '/deathstar' },
    ],
    faction: 'empire',
    traffic: ['tie'],
    game: {
      id: 'board',
      objectives: ['Get pulled in by the tractor beam', 'Fire the superlaser, or don’t', 'Set course for Yavin, and fly the trench when it gets there'],
      title: 'That’s No Moon',
      film: 'anh',
      role: 'Aboard the Death Star',
      pitch: 'Caught in its tractor beam: you’re aboard the battle station. Fire the superlaser, set course for Yavin, and fly the trench run when it gets there.',
      how: 'Already here: the Death Star’s own page.',
      status: 'live',
      to: '/deathstar',
    },
  },
  {
    id: 'bespin',
    name: 'Bespin',
    region: 'Outer Rim Territories',
    sector: 'Anoat sector',
    grid: 'K-18',
    pos: [10.8, 17.8],
    films: ['esb'],
    moment: { film: 'esb', title: 'Cloud City, at sunset', text: 'Slave I lifts off from Cloud City with Han Solo frozen in carbonite, while Vader waits below for Luke.' },
    about: 'A gas giant with a breathable layer, where Lando Calrissian ran Cloud City and its tibanna gas mines, and where Vader was waiting.',
    facts: [
      ['Type', 'Gas giant'],
      ['City', 'Cloud City'],
      ['Exports', 'Tibanna gas'],
      ['Administrator', 'Lando Calrissian'],
    ],
    quote: { text: 'No. I am your father.', by: 'Darth Vader', film: 'esb', clip: 'vader' },
    accent: '#ffb79a',
    body: { look: 'bespin', r: 110 },
    moons: [{ look: 'moon-grey', r: 4, orbit: 260, speed: 0.004, tilt: 0.1, phase: 2 }],
    suns: [{ dir: [-0.7, 0.22, 0.68], color: '#ffe0c0', size: 1 }],
    pieces: [
      { type: 'station', kind: 'cloudcity', at: [0, 111.5, 0], size: 28, surface: true, spin: 0.01 },
      { type: 'patrol', kind: 'cloudcar', count: 4, at: [0, 116, 0], radius: 30, height: 4, speed: 0.12, size: 0.3 },
      { type: 'depart', kind: 'slave1', from: [0, 118, 0], to: [-220, 200, 260], size: 0.6, every: 40 },
    ],
    faction: 'empire',
    traffic: ['shuttle', 'freighter'],
    game: {
      id: 'cloudcity',
      objectives: ['Get the Falcon off the landing platform', 'Lose the TIEs in the cloud layers', 'Catch Luke under the city, and make the jump'],
      title: 'Escape from Cloud City',
      film: 'esb',
      role: 'Lando and Chewie, flying the Falcon',
      pitch: 'Get the Falcon off Cloud City and up through the clouds with TIEs on your tail, swing back for Luke under the city, and make the jump. If the hyperdrive works.',
      how: 'Through the cloud layers, under the city’s vane to catch Luke, then up and out to the jump point.',
      status: 'soon',
    },
  },
  {
    id: 'dagobah',
    name: 'Dagobah',
    region: 'Outer Rim Territories',
    sector: 'Sluis sector',
    grid: 'M-19',
    pos: [12.5, 18.5],
    films: ['rots', 'esb', 'rotj'],
    moment: { film: 'esb', title: 'Yoda’s exile', text: 'Luke crash-lands his X-wing in the swamp, looking for a great warrior, and finds a small green one.' },
    about: 'A swamp world thick with mist and life, too strong in the Force to find a Jedi in, where Yoda hid in exile and trained Luke Skywalker.',
    facts: [
      ['Terrain', 'Swamps, bayous, gnarltrees'],
      ['Wildlife', 'Dragonsnakes, swamp slugs'],
      ['Resident', 'Yoda'],
      ['Visitors', 'One X-wing, half sunk'],
    ],
    quote: { text: 'Do. Or do not. There is no try.', by: 'Yoda', film: 'esb', clip: 'doOrDoNot' },
    accent: '#a8c48a',
    body: { look: 'dagobah', r: 28 },
    moons: [],
    suns: [{ dir: [0.2, 0.5, 0.84], color: '#f4f0dc', size: 0.85 }],
    pieces: [],
    faction: null,
    traffic: [],
    game: {
      id: 'dagobah',
      objectives: ['Run the swamp with Yoda on your back', 'Keep calm: fear is the path to the dark side', 'Raise the X-wing out of the bog'],
      title: 'Do or Do Not',
      film: 'esb',
      role: 'Luke Skywalker, in training',
      pitch: 'Run the swamp with Yoda on your back, then raise your X-wing out of the bog with the Force. Size matters not.',
      how: 'Hold steady to lift: the more you doubt (the more you wobble), the deeper it sinks.',
      status: 'soon',
    },
  },
  {
    id: 'mustafar',
    name: 'Mustafar',
    region: 'Outer Rim Territories',
    sector: 'Atravis sector',
    grid: 'L-19',
    pos: [11.5, 18.5],
    films: ['rots', 'rogue'],
    moment: { film: 'rots', title: 'The high ground', text: 'The Separatist council’s last hiding place, where Anakin Skywalker fell; later, the site of Fortress Vader.' },
    about: 'A volcanic world of lava rivers and mining platforms, where Obi-Wan and Anakin fought, and where Darth Vader later built his fortress.',
    facts: [
      ['Terrain', 'Volcanic, lava rivers'],
      ['Industry', 'Lava mining'],
      ['Landmark', 'Fortress Vader'],
      ['Duel', 'Kenobi and Skywalker, 19 BBY'],
    ],
    quote: { text: 'It’s over, Anakin. I have the high ground.', by: 'Obi-Wan Kenobi', film: 'rots' },
    accent: '#ff8a4a',
    body: { look: 'mustafar', r: 28 },
    moons: [],
    suns: [{ dir: [0.6, 0.2, -0.77], color: '#ffd9b0', size: 1.1 }],
    pieces: [
      { type: 'fleet', side: 'empire', ships: [{ kind: 'destroyer', at: [70, 40, -80], yaw: 2.2, size: 30 }] },
      { type: 'depart', kind: 'shuttle', from: [70, 40, -80], to: [0, 28, 0], size: 0.5, every: 22 },
    ],
    faction: 'empire',
    traffic: ['shuttle', 'nubian'],
    game: {
      id: 'mustafar',
      objectives: ['Ride the collector arm down the lava river', 'Win every exchange of the duel', 'Take the high ground'],
      title: 'The High Ground',
      film: 'rots',
      role: 'Obi-Wan Kenobi',
      pitch: 'Down the lava river on a collapsing mining platform, then a droid platform, duelling all the way to the riverbank.',
      how: 'Ride the platforms, parry and strike in time, and keep to higher ground than him.',
      status: 'soon',
    },
  },
  {
    id: 'coruscant',
    name: 'Coruscant',
    region: 'Core Worlds',
    sector: 'Corusca sector',
    grid: 'L-9',
    pos: [11.5, 8.5],
    films: ['tpm', 'aotc', 'rots', 'rotj'],
    moment: { film: 'rots', title: 'The Battle of Coruscant', text: 'The Republic fleet fights General Grievous over the capital, and two Jedi fly in to rescue the Chancellor.' },
    about: 'The capital of the Republic and then of the Empire: a planet that is all one city, the Senate, the Jedi Temple and a trillion people. Its coordinates are zero, zero, zero.',
    facts: [
      ['Type', 'City-planet'],
      ['Population', 'Over a trillion'],
      ['Landmarks', 'The Senate, the Jedi Temple'],
      ['Coordinates', '0, 0, 0'],
    ],
    quote: { text: 'This is where the fun begins.', by: 'Anakin Skywalker', film: 'rots' },
    accent: '#ffd08a',
    body: { look: 'coruscant', r: 46 },
    moons: [
      { look: 'moon-grey', r: 3, orbit: 110, speed: 0.01, tilt: 0.1, phase: 0.8 },
      { look: 'moon-dust', r: 2, orbit: 140, speed: 0.007, tilt: -0.14, phase: 3.9 },
    ],
    suns: [{ dir: [0.74, 0.3, 0.6], color: '#fff3e0', size: 1 }],
    pieces: [
      { type: 'lanes', count: 520, radius: 49, size: 0.12 },
      {
        type: 'battle',
        at: [30, 60, 110],
        radius: 120,
        sides: {
          republic: [
            { kind: 'venator', at: [-60, 10, 40], yaw: 0.8, size: 24 },
            { kind: 'venator', at: [10, -20, 70], yaw: 0.6, size: 24 },
            { kind: 'acclamator', at: [-90, 30, -10], yaw: 1, size: 16 },
          ],
          separatist: [
            { kind: 'munificent', at: [60, 20, -50], yaw: -2.4, size: 17 },
            { kind: 'munificent', at: [90, -10, 10], yaw: -2.6, size: 17 },
            { kind: 'lucrehulk', at: [40, 40, -110], yaw: -2.5, size: 60 },
          ],
        },
        fighters: { republic: ['arc170', 'delta7'], separatist: ['vulture', 'trifighter'] },
        count: 16,
      },
    ],
    faction: 'separatists',
    traffic: ['shuttle', 'nubian', 'venator', 'freighter'],
    game: {
      id: 'coruscant',
      objectives: ['Follow the assassin’s airspeeder through the skylanes', 'Don’t lose her in the traffic', 'Corner her before she gets to ground'],
      title: 'Chase Through Coruscant',
      film: 'aotc',
      role: 'Anakin and Obi-Wan, in a borrowed airspeeder',
      pitch: 'An assassin just tried to kill Senator Amidala. Chase her airspeeder down through the traffic lanes and the canyons between the towers before she gets away.',
      how: 'Drop between the lanes, cut through the power couplings, and don’t lose her in the traffic. Pull up!',
      status: 'soon',
    },
  },
  {
    id: 'naboo',
    name: 'Naboo',
    region: 'Mid Rim',
    sector: 'Chommell sector',
    grid: 'O-17',
    pos: [14.5, 16.5],
    films: ['tpm', 'aotc', 'rots', 'rotj'],
    moment: { film: 'tpm', title: 'The blockade', text: 'The Trade Federation’s battleships ring the planet, and the Queen’s ship makes a run through them.' },
    about: 'A lush world of plains, lakes and waterfalls, home of Padmé Amidala, the Gungans under their lakes, and a senator called Palpatine.',
    facts: [
      ['Terrain', 'Plains, swamps, lakes'],
      ['Natives', 'Naboo, Gungans'],
      ['Capital', 'Theed'],
      ['Moons', 'Ohma-D’un, Rori'],
    ],
    quote: { text: 'I’ll try spinning. That’s a good trick!', by: 'Anakin Skywalker', film: 'tpm' },
    accent: '#7fd8a8',
    body: { look: 'naboo', r: 34 },
    moons: [
      { look: 'moon-grey', r: 2.6, orbit: 90, speed: 0.01, tilt: 0.2, phase: 1.6 },
      { look: 'moon-dust', r: 2, orbit: 118, speed: 0.007, tilt: -0.1, phase: 4.2 },
    ],
    suns: [{ dir: [-0.5, 0.36, 0.79], color: '#fff6e6', size: 1 }],
    pieces: [
      {
        type: 'fleet',
        side: 'separatist',
        ships: [
          { kind: 'lucrehulk', at: [-20, 42, -96], yaw: 0.3, size: 60, spin: 0.01 },
          { kind: 'lucrehulk', at: [96, 18, -40], yaw: 1.6, size: 60, spin: -0.008 },
          { kind: 'lucrehulk', at: [-90, -16, 50], yaw: 2.4, size: 60, spin: 0.006 },
        ],
      },
      { type: 'escape', kind: 'nubian', escort: 'n1', from: [0, 36, 0], to: [180, 120, 220], size: 1.4, every: 34 },
      { type: 'patrol', kind: 'vulture', count: 6, at: [-20, 42, -96], radius: 45, height: 8, speed: 0.3, size: 0.26 },
    ],
    faction: 'separatists',
    traffic: ['n1', 'nubian', 'freighter'],
    game: {
      id: 'naboo',
      objectives: ['Survive the dogfight round the droid control ship', 'Slip into its hangar', 'Torpedo the reactor, and get out before it blows'],
      title: 'Into the Droid Control Ship',
      film: 'tpm',
      role: 'Anakin Skywalker, in an N-1 starfighter',
      pitch: 'Stuck on autopilot and into the battle: fly into the droid control ship’s hangar, put two torpedoes into its reactor, and get out before it blows.',
      how: 'Dodge the vultures, slip through the hangar’s shield, aim for the reactor, and spin. That’s a good trick.',
      status: 'soon',
    },
  },
  {
    id: 'kashyyyk',
    name: 'Kashyyyk',
    region: 'Mid Rim',
    sector: 'Mytaranor sector',
    grid: 'P-9',
    pos: [15.5, 8.5],
    films: ['rots'],
    moment: { film: 'rots', title: 'The Battle of Kashyyyk', text: 'Clones and Wookiees hold the shore at Kachirho as the droid army comes across the lagoon; then Order 66.' },
    about: 'The Wookiee homeworld, its forests of wroshyr trees kilometres tall: home of Chewbacca, and of Tarfful, who got Yoda off the planet.',
    facts: [
      ['Terrain', 'Wroshyr forests, lagoons'],
      ['Natives', 'Wookiees'],
      ['City', 'Kachirho'],
      ['Famous son', 'Chewbacca'],
    ],
    quote: { text: 'Rrraaaaaaaaghhh!', by: 'Chewbacca', film: 'rots', clip: 'chewieRoar' },
    accent: '#b5d97a',
    body: { look: 'kashyyyk', r: 38 },
    moons: [{ look: 'moon-grey', r: 2.6, orbit: 100, speed: 0.009, tilt: 0.14, phase: 2.2 }],
    suns: [{ dir: [0.6, 0.42, -0.68], color: '#fff2da', size: 1 }],
    pieces: [
      { type: 'fleet', side: 'republic', ships: [{ kind: 'venator', at: [-60, 36, 70], yaw: 2.4, size: 24 }, { kind: 'acclamator', at: [-90, 20, 30], yaw: 2.2, size: 16 }] },
      { type: 'fleet', side: 'separatist', ships: [{ kind: 'munificent', at: [80, 30, -60], yaw: -0.8, size: 17 }] },
      { type: 'patrol', kind: 'vulture', count: 5, at: [80, 30, -60], radius: 30, height: 6, speed: 0.3, size: 0.26 },
    ],
    faction: 'separatists',
    traffic: ['arc170', 'freighter'],
    game: {
      id: 'kashyyyk',
      objectives: ['Sink the droid boats crossing the lagoon', 'Hold the beach at Kachirho', 'Get Yoda to Tarfful and away'],
      title: 'The Battle of Kashyyyk',
      film: 'rots',
      role: 'A Wookiee catamaran gunner, and Yoda',
      pitch: 'The droid army is coming across the lagoon. Hold the beach at Kachirho against tanks and spider droids alongside the clones and the Wookiees.',
      how: 'Skim the lagoon, sink the droid boats and tanks before they land, and watch the clones. Something’s not right about them.',
      status: 'soon',
    },
  },
  {
    id: 'kamino',
    name: 'Kamino',
    region: 'Wild Space',
    sector: 'Abrion sector',
    grid: 'S-15',
    pos: [18.5, 14.5],
    films: ['aotc'],
    moment: { film: 'aotc', title: 'The storm over Tipoca City', text: 'Obi-Wan finds the clone army no one ordered, and Jango Fett’s Slave I lifts off into the rain.' },
    about: 'An ocean world of endless storms, erased from the Jedi Archives, where the Kaminoans grew a clone army for the Republic out of a bounty hunter called Jango Fett.',
    facts: [
      ['Terrain', 'Ocean, everywhere'],
      ['Capital', 'Tipoca City'],
      ['Natives', 'Kaminoans'],
      ['Industry', 'Cloning'],
    ],
    quote: { text: 'Lost a planet, Master Obi-Wan has. How embarrassing.', by: 'Yoda', film: 'aotc' },
    accent: '#8ec7e8',
    body: { look: 'kamino', r: 32 },
    moons: [],
    suns: [{ dir: [-0.3, 0.6, 0.74], color: '#eaf2ff', size: 0.85 }],
    pieces: [
      { type: 'fleet', side: 'republic', ships: [{ kind: 'acclamator', at: [-50, 40, -70], yaw: 0.5, size: 16 }, { kind: 'acclamator', at: [-80, 30, -30], yaw: 0.6, size: 16 }] },
      { type: 'chase', runner: { kind: 'slave1', size: 0.6 }, hunter: { kind: 'delta7', size: 0.3 }, radius: 52, height: 6, tilt: -0.2, speed: 0.05, fire: 'small' },
    ],
    faction: null,
    traffic: ['acclamator', 'delta7'],
    game: {
      id: 'kamino',
      objectives: ['Fight Jango Fett on the landing platform in the storm', 'Put a tracker on Slave I', 'Follow him out to Geonosis'],
      title: 'Storm over Tipoca',
      film: 'aotc',
      role: 'Obi-Wan Kenobi',
      pitch: 'Out on the landing platform in the rain with Jango Fett: then after Slave I, and into Geonosis’s rings with seismic charges going off behind you.',
      how: 'Weave through the rocks, cut your engines to hide, and don’t be anywhere near the charges when they go.',
      status: 'soon',
    },
  },
  {
    id: 'geonosis',
    name: 'Geonosis',
    region: 'Outer Rim Territories',
    sector: 'Arkanis sector',
    grid: 'R-16',
    pos: [17.2, 15.9],
    films: ['aotc', 'rogue'],
    moment: { film: 'aotc', title: 'The Clone Wars begin', text: 'Republic gunships come down on the arena, and the Separatists’ core ships lift off to flee the planet.' },
    about: 'A ringed red desert world of hive spires and droid foundries, where Count Dooku gathered the Separatists, and where the Clone Wars began.',
    facts: [
      ['Terrain', 'Rocky desert, hive spires'],
      ['Natives', 'Geonosians'],
      ['Rings', 'An asteroid ring'],
      ['Industry', 'Droid foundries'],
    ],
    quote: { text: 'Begun, the Clone War has.', by: 'Yoda', film: 'aotc' },
    accent: '#ff9a6a',
    body: { look: 'geonosis', r: 34 },
    moons: [],
    suns: [{ dir: [-0.7, 0.26, -0.66], color: '#ffe2c0', size: 1.05 }],
    pieces: [
      { type: 'rocks', kind: 'ring', at: [0, 0, 0], inner: 54, outer: 88, thickness: 5, tilt: [0.22, 0.08], count: 900, seed: 11 },
      { type: 'liftoff', kind: 'coreship', count: 4, size: 6, every: 18 },
      { type: 'fleet', side: 'republic', ships: [{ kind: 'acclamator', at: [-40, 70, 100], yaw: 2.6, size: 16 }, { kind: 'acclamator', at: [20, 60, 120], yaw: 2.9, size: 16 }, { kind: 'venator', at: [-90, 90, 60], yaw: 2.3, size: 24 }] },
    ],
    faction: 'separatists',
    traffic: ['slave1', 'acclamator'],
    game: {
      id: 'geonosis',
      objectives: ['Stay on Jango Fett’s tail into the rings', 'Dodge the seismic charges', 'Hide behind an asteroid and make him think you’re gone'],
      title: 'Seismic Charges',
      film: 'aotc',
      role: 'Obi-Wan Kenobi, in his Jedi starfighter',
      pitch: 'Jango Fett leads you into the asteroid ring and starts dropping seismic charges. Stay on him, use the rocks, and make him think he got you.',
      how: 'Weave between the asteroids, kill your engines behind a big one, then come out on his tail.',
      status: 'soon',
    },
  },
  {
    id: 'scarif',
    name: 'Scarif',
    region: 'Outer Rim Territories',
    sector: 'Abrion sector',
    grid: null,
    pos: [18.6, 5.8],
    films: ['rogue'],
    moment: { film: 'rogue', title: 'The Battle of Scarif', text: 'Rogue One lands inside the shield; the Rebel fleet hammers at the gate, and the Death Star arrives to end it.' },
    about: 'A tropical world of islands and lagoons behind a planetary shield, where the Empire kept its secrets in the Citadel, among them the Death Star’s plans.',
    facts: [
      ['Terrain', 'Tropical islands, lagoons'],
      ['Defence', 'A planetary shield and its gate'],
      ['Landmark', 'The Citadel'],
      ['Stolen', 'The Death Star plans, 0 BBY'],
    ],
    quote: { text: 'Rebellions are built on hope.', by: 'Jyn Erso', film: 'rogue' },
    accent: '#6fe0d8',
    body: { look: 'scarif', r: 32 },
    moons: [],
    suns: [{ dir: [0.5, 0.5, 0.71], color: '#fff6e0', size: 1.05 }],
    pieces: [
      { type: 'station', kind: 'gate', at: [0, 62, -14], size: 46, face: [0, -1, 0.2], spin: 0.003 },
      { type: 'shield', r: 36 },
      {
        type: 'battle',
        at: [10, 70, 20],
        radius: 110,
        sides: {
          rebel: [
            { kind: 'moncal', at: [-40, 40, 110], yaw: 2.9, size: 24 },
            { kind: 'hammerhead', at: [10, 10, 70], yaw: 3.0, size: 6.5 },
            { kind: 'corvette', at: [-70, 30, 80], yaw: 2.7, size: 3.2 },
            { kind: 'corvette', at: [50, 30, 90], yaw: 3.2, size: 3.2 },
          ],
          empire: [
            { kind: 'destroyer', at: [-30, 30, -60], yaw: 0.1, size: 30 },
            { kind: 'destroyer', at: [50, 10, -40], yaw: -0.2, size: 30 },
          ],
        },
        fighters: { rebel: ['xwing', 'uwing', 'ywing'], empire: ['tie', 'interceptor'] },
        count: 14,
      },
      { type: 'superlaser', from: [-260, 120, -320], at: [8, 22, 22], every: 150 },
    ],
    faction: 'empire',
    traffic: ['uwing', 'shuttle'],
    game: {
      id: 'scarif',
      objectives: ['Get through the Shield Gate before it closes', 'Hold the beach against the AT-ACTs', 'Climb the Citadel tower and send the plans'],
      title: 'Rogue One',
      film: 'rogue',
      role: 'Blue Squadron, then Jyn Erso',
      pitch: 'Through the shield gate before it closes, down to the beaches to hold off the walkers, then up the Citadel tower to send the plans to the fleet before the Death Star fires.',
      how: 'Squadron flying above, AT-ACTs on the sand, and a climb against the clock at the end.',
      status: 'soon',
    },
  },
  {
    id: 'jakku',
    name: 'Jakku',
    region: 'Western Reaches',
    sector: 'Western Reaches',
    grid: null,
    pos: [5.4, 13.2],
    films: ['tfa'],
    moment: { film: 'tfa', title: 'The starship graveyard', text: 'Rey and Finn take off in a garbage ship that turns out to be the Millennium Falcon, with TIEs right behind them.' },
    about: 'A desert junkyard of a world, littered with wrecks from the Empire’s last great battle, where a scavenger called Rey waited for a family that never came back.',
    facts: [
      ['Terrain', 'Desert, the Starship Graveyard'],
      ['Settlement', 'Niima Outpost'],
      ['Last battle', 'The Battle of Jakku, 5 ABY'],
      ['Scavenger', 'Rey'],
    ],
    quote: { text: 'The garbage will do!', by: 'Rey', film: 'tfa' },
    accent: '#e8cf9a',
    body: { look: 'jakku', r: 32 },
    moons: [{ look: 'moon-dust', r: 2.4, orbit: 96, speed: 0.009, tilt: 0.2, phase: 0.6 }],
    suns: [{ dir: [-0.56, 0.4, 0.73], color: '#fff0d6', size: 1.05 }],
    pieces: [
      {
        type: 'wrecks',
        ships: [
          { kind: 'destroyer', at: [-60, 30, -40], yaw: 0.6, pitch: 0.5, roll: 1.2, size: 30 },
          { kind: 'destroyer', at: [70, -20, -70], yaw: 2.1, pitch: -0.3, roll: -0.6, size: 30 },
          { kind: 'moncal', at: [40, 44, 60], yaw: 1.2, pitch: 0.6, roll: 2.2, size: 22 },
        ],
      },
    ],
    faction: 'firstorder',
    traffic: ['freighter', 'tiefo'],
    game: {
      id: 'jakku',
      objectives: ['Get the Falcon off the ground', 'Lose the TIEs in the Starship Graveyard', 'Fly through the downed Star Destroyer'],
      title: 'The Garbage Will Do',
      film: 'tfa',
      role: 'Rey at the controls, Finn on the gun',
      pitch: 'Two TIEs on your tail and a ship that hasn’t flown in years: dive into the graveyard and thread the Falcon through a dead Star Destroyer.',
      how: 'Fly low and tight through the wreck; spin the Falcon so the gunner can line up the shot.',
      status: 'soon',
    },
  },
  {
    id: 'crait',
    name: 'Crait',
    region: 'Outer Rim Territories',
    sector: null,
    grid: null,
    pos: [6.4, 18.8],
    films: ['tlj'],
    moment: { film: 'tlj', title: 'The last stand', text: 'The last of the Resistance hide in an old Rebel mine while the First Order brings walkers and a battering ram cannon across the salt.' },
    about: 'A small mineral world of white salt over red soil, where the Resistance made its last stand in an old Rebel base, and Luke Skywalker came back.',
    facts: [
      ['Terrain', 'Salt flats over red soil'],
      ['Natives', 'Vulptices, the crystal foxes'],
      ['Base', 'An old Rebel outpost'],
      ['Battle', 'Battle of Crait, 34 ABY'],
    ],
    quote: { text: 'Amazing. Every word of what you just said was wrong.', by: 'Luke Skywalker', film: 'tlj' },
    accent: '#ff8f8a',
    body: { look: 'crait', r: 28 },
    moons: [],
    suns: [{ dir: [0.44, 0.3, -0.85], color: '#fff4ee', size: 1 }],
    pieces: [{ type: 'fleet', side: 'firstorder', ships: [{ kind: 'destroyer', at: [-60, 40, -60], yaw: 0.8, size: 44, tint: '#5a5f68' }, { kind: 'destroyer', at: [20, 50, -90], yaw: 0.6, size: 44, tint: '#5a5f68' }] }],
    faction: 'firstorder',
    traffic: ['tiefo', 'upsilon'],
    game: {
      id: 'crait',
      objectives: ['Kick up the salt and draw the walkers’ fire', 'Knock out the battering ram cannon', 'Buy Luke the time he needs'],
      title: 'The Salt Flats',
      film: 'tlj',
      role: 'Poe Dameron, in a ski speeder',
      pitch: 'Old speeders against AT-M6 walkers and a cannon that can break the mine door. Kick up red salt and buy Luke the time he needs.',
      how: 'Skim the salt (the red trail shows where you’ve been), dodge the walkers’ fire, and go for the cannon.',
      status: 'soon',
    },
  },
  {
    id: 'starkiller',
    name: 'Starkiller Base',
    system: 'Ilum',
    region: 'Unknown Regions',
    sector: null,
    grid: null,
    pos: [2.4, 6],
    films: ['tfa'],
    moment: { film: 'tfa', title: 'It drinks the sun', text: 'The First Order’s weapon drains its star, then fires through hyperspace to destroy the Hosnian system light-years away.' },
    about: 'Once Ilum, the world the Jedi took their kyber crystals from; the First Order hollowed it into a weapon that drinks a sun to destroy whole star systems.',
    facts: [
      ['Formerly', 'Ilum, the kyber world'],
      ['Weapon', 'Drains its star, fires through hyperspace'],
      ['Target', 'The Hosnian system'],
      ['Fate', 'Destroyed by the Resistance'],
    ],
    quote: { text: 'So, it’s big.', by: 'Han Solo', film: 'tfa' },
    accent: '#ff6a5a',
    body: { look: 'starkiller', r: 40 },
    moons: [],
    suns: [{ dir: [-0.5, 0.18, -0.85], color: '#ffe6d0', size: 1.15 }],
    pieces: [
      { type: 'starkiller', every: 120 },
      { type: 'fleet', side: 'firstorder', ships: [{ kind: 'destroyer', at: [70, 40, 80], yaw: 2.6, size: 44, tint: '#5a5f68' }] },
    ],
    faction: 'firstorder',
    traffic: ['tiefo', 'upsilon'],
    game: {
      id: 'starkiller',
      objectives: ['Get in under the shield', 'Fly the trench to the thermal oscillator', 'Hit it before the sun’s gone'],
      title: 'The Oscillator',
      film: 'tfa',
      role: 'Poe Dameron, Black Leader',
      pitch: 'The weapon’s charging. Get in under the shield, down into the trench round the thermal oscillator, and hit it before the sun’s gone.',
      how: 'A trench run, the sequel way: TIEs on your tail, the light draining from the sky, one target.',
      status: 'soon',
    },
  },
  {
    id: 'exegol',
    name: 'Exegol',
    region: 'Unknown Regions',
    sector: null,
    grid: null,
    pos: [1.2, 9.2],
    films: ['tros'],
    moment: { film: 'tros', title: 'The Final Order rises', text: 'The Sith fleet climbs out of the storms with planet-killing cannons, and then the galaxy’s ordinary people come out of lightspeed to stop it.' },
    about: 'The hidden world of the Sith, found only with a wayfinder, where Palpatine waited in the dark and built a fleet of Star Destroyers with planet-killing guns.',
    facts: [
      ['Reached by', 'A Sith wayfinder'],
      ['Fleet', 'The Final Order'],
      ['Weather', 'Endless lightning'],
      ['Returned', 'Somehow, Palpatine'],
    ],
    quote: { text: 'Somehow, Palpatine returned.', by: 'Poe Dameron', film: 'tros' },
    accent: '#c48aff',
    body: { look: 'exegol', r: 34 },
    moons: [],
    suns: [{ dir: [0.3, 0.7, 0.64], color: '#c9c2ff', size: 0.55 }],
    pieces: [
      { type: 'armada', kind: 'xyston', count: 14, at: [0, 46, 0], radius: 110, size: 34, rise: 0.4 },
      { type: 'lightning', every: 5 },
    ],
    faction: 'sith',
    traffic: ['tiefo', 'upsilon'],
    game: {
      id: 'exegol',
      objectives: ['Find the Steadfast in the storm', 'Knock out its navigation tower', 'Hold on till the citizens’ fleet arrives'],
      title: 'The Navigation Tower',
      film: 'tros',
      role: 'Poe Dameron, leading the Resistance',
      pitch: 'The Sith fleet can’t find its way out of the atmosphere without the Steadfast’s navigation signal. Knock out its tower, and hold on till the cavalry arrives.',
      how: 'Run the gauntlet of the fleet’s guns in the lightning, light up the tower, then turn on the cannons.',
      status: 'soon',
    },
  },
  {
    id: 'ahchto',
    name: 'Ahch-To',
    region: 'Unknown Regions',
    sector: null,
    grid: null,
    pos: [2, 13.4],
    films: ['tfa', 'tlj'],
    moment: { film: 'tlj', title: 'The first Jedi temple', text: 'Rey holds out a lightsaber to an old man on an island, and he throws it over his shoulder.' },
    about: 'An ocean world of rocky islands and the first Jedi Temple, where Luke Skywalker went to die, and where Rey found him. Mind the porgs.',
    facts: [
      ['Terrain', 'Oceans, rocky islands'],
      ['Natives', 'Porgs, the Lanai caretakers'],
      ['Landmark', 'The first Jedi Temple'],
      ['Hermit', 'Luke Skywalker'],
    ],
    quote: { text: 'This is not going to go the way you think.', by: 'Luke Skywalker', film: 'tlj' },
    accent: '#9fd0c0',
    body: { look: 'ahchto', r: 28 },
    moons: [{ look: 'moon-grey', r: 3, orbit: 86, speed: 0.008, tilt: 0.3, phase: 1 }],
    suns: [{ dir: [-0.36, 0.3, 0.88], color: '#fff5e8', size: 0.95 }],
    pieces: [{ type: 'patrol', kind: 'falcon', count: 1, at: [0, 0, 0], radius: 40, height: 6, speed: 0.06, size: 0.6 }],
    faction: null,
    traffic: [],
    game: {
      id: 'ahchto',
      objectives: ['Climb the island to the first Jedi temple', 'Learn the three lessons', 'Face the cave under the island'],
      title: 'The Last Lesson',
      film: 'tlj',
      role: 'Rey',
      pitch: 'Three lessons from a grumpy old Jedi on a windy island: the Force, the tree, and the cave under the sea, with porgs in the way at every step.',
      how: 'Explore the island on foot, feel the Force in its rocks and waves, and don’t touch the sacred texts. Or do.',
      status: 'soon',
    },
  },
];

const BY_ID = new Map(SYSTEMS.map((s) => [s.id, s]));
export const systemById = (id) => BY_ID.get(id) ?? null;
export const parseSystem = (raw) => (typeof raw === 'string' && BY_ID.has(raw) ? raw : null);

// the era a system is shown at (its moment's), and every era it's in
export const eraOf = (s) => FILMS[s.moment.film].era;
export const erasOf = (s) => [...new Set(s.films.map((f) => FILMS[f].era))];
// the films it's in, in story order
export const filmsOf = (s) => FILM_ORDER.filter((f) => s.films.includes(f)).map((id) => ({ id, ...FILMS[id] }));
// the systems with a moment, or a film, in an era
export const inEra = (era) => SYSTEMS.filter((s) => erasOf(s).includes(era));

// where a first visit comes out, unless a system's asked for: Tatooine, as the films begin (A New Hope's)
export const FIRST = 'tatooine';

// ── The map, in numbers ──

// which grid square a point is in ('R-16'), for the map's readout
export function gridAt([x, z]) {
  const col = Math.min(GRID.cols - 1, Math.max(0, Math.floor(x)));
  const row = Math.min(GRID.rows, Math.max(1, Math.floor(z) + 1));
  return `${String.fromCharCode(65 + col)}-${row}`;
}

// how far out from the middle a point is, as a share of the regions' own
// reach that way (so 1 is the edge of anything with r 1), and the region
// it's in
export function reachAt([x, z]) {
  const dx = x - CORE[0];
  const dz = z - CORE[1];
  const d = Math.hypot(dx, dz);
  return d / (1 + BULGE * (d ? dz / d : 0));
}
export function regionAt([x, z]) {
  const d = reachAt([x, z]);
  const west = Math.abs(Math.atan2(z - CORE[1], -(x - CORE[0])));
  if (west < UNKNOWN.half && d > UNKNOWN.from) return 'Unknown Regions';
  const r = REGIONS.find((g) => d <= g.r);
  return r ? r.name : 'Wild Space';
}

// light-years across the map, roughly (the galaxy is 120,000 across)
export const LY_PER_SQUARE = 120000 / (RIM * 2);
export const distance = (a, b) => Math.hypot(b.pos[0] - a.pos[0], b.pos[1] - a.pos[1]);
export const lightYears = (a, b) => Math.round((distance(a, b) * LY_PER_SQUARE) / 100) * 100;

// The way from one system to another, as the system you're in sees it (its
// own frame lines up with the map: +x east, +z south): a unit vector on the
// galactic plane. The way to the galaxy's middle the same, from anywhere.
export function bearing(from, to) {
  const dx = to.pos[0] - from.pos[0];
  const dz = to.pos[1] - from.pos[1];
  const l = Math.hypot(dx, dz) || 1;
  return [dx / l, 0, dz / l];
}
export function coreBearing(s) {
  const dx = CORE[0] - s.pos[0];
  const dz = CORE[1] - s.pos[1];
  const l = Math.hypot(dx, dz) || 1;
  return { dir: [dx / l, 0, dz / l], d: l };
}

// How long a jump takes, in seconds of hyperspace: longer the further it
// goes, never so short it isn't a jump nor so long it drags
export const jumpSeconds = (a, b) => (a && b ? Math.min(4.2, 1.8 + distance(a, b) * 0.16) : 2.4);

// What a system's planet is as a solid, and how close counts as being at it:
// its radius and its reach (its moons and what orbits it count as being there)
export function reachOf(s) {
  const r = s.body?.r ?? 40;
  return Math.max(r * 2.1, r + 30);
}

// Where you come out of hyperspace at a system, arriving from `from` (a
// system, or null for a first visit): off its planet on the side you came in
// from, swung round toward its sun so the planet's lit side is ahead of you,
// far enough out to see the whole of it, a little above its equator;
// facing it. { x, y, z, heading }. `rand` spreads arrivals, so pilots
// jumping in together don't arrive on top of each other.
export function arrival(s, from = null, rand = Math.random) {
  const r = s.body?.r ?? 40;
  const back = from ? bearing(from, s).map((v) => -v) : [0.3, 0, 1];
  const sun = s.suns[0].dir;
  // between the way you came and the sun's side (so the planet's lit ahead)
  let ax = back[0] + sun[0] * 0.9;
  let az = back[2] + sun[2] * 0.9;
  const al = Math.hypot(ax, az) || 1;
  ax /= al;
  az /= al;
  // spread round a little either way
  const spread = (rand() - 0.5) * 0.7;
  const c = Math.cos(spread);
  const n = Math.sin(spread);
  const dx = ax * c - az * n;
  const dz = ax * n + az * c;
  const d = r * 3.2 + 26 + rand() * 12;
  const x = dx * d;
  const z = dz * d;
  const y = r * 0.35 + (rand() - 0.5) * r * 0.3;
  return { x, y, z, heading: Math.atan2(x, z) };
}

// The places in a system the autopilot can take you to (and the map names):
// its planet (at Alderaan, where it was), and its great stations.
export const STATION_NAMES = { deathstar: 'The Death Star', deathstar2: 'The second Death Star', cloudcity: 'Cloud City', gate: 'The Shield Gate' };
export function goalsOf(s) {
  const out = [{ id: 'planet', name: s.body ? s.name : `Where ${s.name} was`, kind: 'planet' }];
  for (const p of s.pieces) {
    if (p.type === 'deathstar') out.push({ id: 'deathstar', name: STATION_NAMES.deathstar, kind: 'station', board: p.board ?? null });
    else if (p.type === 'station' && STATION_NAMES[p.kind]) out.push({ id: p.kind, name: STATION_NAMES[p.kind], kind: 'station' });
  }
  return out;
}
