// The shipyard: a ship of your own, put together from modules the way No
// Man's Sky puts its ships together. A ship there is a tree of slots, each
// a pool of parts; the game keeps one part from each pool (by a seed, more
// often the commoner ones) and goes on into the slots that part has of its
// own. Here the hull is the root: it says where everything else snaps on
// (its sockets) and where the hangar's parts bolt on (its mounts, as
// modules.js's MOUNTS); the wings have a socket of their own at the tip,
// for the running lights.
//
// A module: { id, slot, name, blurb, mass (t), power (MW), does, weight (how
// often a roll picks it), achievement, hint, … }. `does` is what it does to
// the ship as it comes, as shares added on (boost, accel, cruise, agility,
// level, as outfit.js's parts do), and a hull's power plant (plant, MW).
// Everything is in BUILT units (shipModels.js), nose −z, x to the right,
// y up; modules3d.js builds each module to these numbers.
//
// Pure data, tested in Node: build.js makes builds of it, modules3d.js draws
// them, the hangar's shipyard tab offers it.

export const BUILD_SLOTS = ['hull', 'cockpit', 'wings', 'engines', 'tail', 'extras'];
export const BUILD_SLOT_LABEL = { hull: 'Hull', cockpit: 'Cockpit', wings: 'Wings', engines: 'Engines', tail: 'Tail', extras: 'Extras' };

const mod = (slot, id, name, blurb, { mass = 0, power = 0, does = {}, weight = 1, achievement = null, hint = null, ...rest } = {}) => ({ id, slot, name, blurb, mass, power, does, weight, achievement, hint, ...rest });

// a hull's engine layouts: one in the middle, a pair, or two pairs
const engines = (z, x, y) => ({
  1: [[0, 0, z]],
  2: [
    [-x, 0, z],
    [x, 0, z],
  ],
  4: [
    [-x, y, z],
    [x, y, z],
    [-x, -y, z],
    [x, -y, z],
  ],
});

// Each hull's sockets: cockpit, wing (the right one's root, and how far it
// sweeps back; the left is its mirror), engine (by how many), tail and top
// (the extras' spot), as [x, y, z]; and its mounts for the hangar's parts.
export const MODULES = [
  // ── hulls ──
  mod('hull', 'dart', 'Dart', 'A fighter’s fuselage, fine at the nose and broad at the back. Quick to turn.', {
    does: { agility: 0.1, plant: 7 },
    scale: 1, // (how big its cockpit, tail and extras are on it)
    length: [-0.17, 0.12],
    sockets: {
      cockpit: [0, 0.019, -0.07],
      wing: [0.028, -0.004, 0.02, 0],
      engine: engines(0.12, 0.02, 0.012),
      tail: [0, 0.019, 0.085],
      top: [0, 0.022, 0.0],
      mounts: {
        pod: [0.07, -0.03, 0.04, 0.12, 0.013],
        corner: [
          [0.022, 0.012, -0.09],
          [0.033, 0.016, 0.09],
        ],
        pipe: [
          [0.022, -0.016, 0.09],
          [0.028, -0.022, 0.15],
        ],
        gun: [0.024, -0.02, -0.08],
        belly: [0, -0.03, -0.02],
        plate: [0.037, 0.0, 0.02, 0.1],
        emitter: [0.022, 0.021, 0.05],
        badge: [0, 0.023, 0.05, 0.018, 0.2],
        fin: [0.026, 0.018, 0.1],
        ring: 0.016,
      },
    },
  }),
  mod('hull', 'saucer', 'Saucer', 'A flying saucer’s round hull, like Rick’s: steady, and it rights itself.', {
    does: { level: 0.25, plant: 8 },
    weight: 0.6,
    achievement: 'offthegrid',
    hint: 'Take Roy off the grid at Blips and Chitz',
    scale: 1.2, // (how big its cockpit, tail and extras are on it)
    length: [-0.12, 0.12],
    sockets: {
      cockpit: [0, 0.024, -0.025],
      wing: [0.104, -0.004, 0.02, 0],
      engine: engines(0.106, 0.05, 0.012),
      tail: [0, 0.02, 0.075],
      top: [0, 0.03, 0.03],
      mounts: {
        pod: [0.14, -0.022, 0.02, 0.12, 0.015],
        corner: [
          [0.1, 0.008, -0.06],
          [0.1, 0.008, 0.06],
        ],
        pipe: [
          [0.04, -0.02, 0.1],
          [0.046, -0.026, 0.15],
        ],
        gun: [0.05, -0.022, -0.1],
        belly: [0, -0.03, -0.02],
        belt: [0.121, 0, 0.016, Math.PI / 2, 0.5],
        emitter: [0.08, 0.016, 0.05],
        badge: [0, 0.027, 0.06, 0.026, 0.5],
        fin: [0.07, 0.016, 0.09],
        ring: 0.018,
      },
    },
  }),
  mod('hull', 'hauler', 'Hauler', 'A freighter’s box of a hull. Slow to turn, but its plant runs anything.', {
    does: { agility: -0.15, cruise: -0.05, plant: 10 },
    scale: 1.35, // (how big its cockpit, tail and extras are on it)
    length: [-0.15, 0.13],
    sockets: {
      cockpit: [0, 0.04, -0.095],
      wing: [0.054, -0.012, 0.03, 0],
      engine: engines(0.13, 0.03, 0.02),
      tail: [0, 0.04, 0.1],
      top: [0, 0.042, -0.01],
      mounts: {
        pod: [0.09, -0.032, 0.02, 0.13, 0.016],
        corner: [
          [0.05, 0.034, -0.12],
          [0.052, 0.034, 0.11],
        ],
        pipe: [
          [0.03, -0.035, 0.12],
          [0.036, -0.042, 0.17],
        ],
        gun: [0.04, -0.042, -0.1],
        belly: [0, -0.05, -0.03],
        plate: [0.057, 0.0, 0.0, 0.16],
        emitter: [0.04, 0.042, 0.06],
        badge: [0, 0.042, 0.04, 0.03, 0],
        fin: [0.045, 0.04, 0.11],
        ring: 0.022,
      },
    },
  }),
  mod('hull', 'needle', 'Needle', 'A racer’s long thin hull. The fastest cruise of any, if not the nimblest.', {
    does: { cruise: 0.15, agility: -0.05, plant: 6 },
    scale: 0.85, // (how big its cockpit, tail and extras are on it)
    length: [-0.19, 0.13],
    sockets: {
      cockpit: [0, 0.016, -0.085],
      wing: [0.018, -0.003, 0.04, 0],
      engine: engines(0.13, 0.014, 0.01),
      tail: [0, 0.016, 0.1],
      top: [0, 0.018, -0.01],
      mounts: {
        pod: [0.05, -0.024, 0.05, 0.11, 0.011],
        corner: [
          [0.017, 0.01, -0.1],
          [0.021, 0.012, 0.1],
        ],
        pipe: [
          [0.014, -0.014, 0.1],
          [0.018, -0.02, 0.15],
        ],
        gun: [0.018, -0.016, -0.1],
        belly: [0, -0.024, -0.03],
        plate: [0.021, 0.0, 0.0, 0.12],
        emitter: [0.015, 0.016, 0.07],
        badge: [0, 0.018, 0.05, 0.015, 0.2],
        fin: [0.018, 0.015, 0.11],
        ring: 0.012,
      },
    },
  }),
  // ── cockpits ──
  mod('cockpit', 'bubble', 'Bubble', 'A round glass bubble, all the way round: you can see everything.', { mass: 0.5, does: { level: 0.1 } }),
  mod('cockpit', 'canopy', 'Canopy', 'A fighter’s long teardrop canopy on a raised spine.', { mass: 0.5, does: { agility: 0.05 } }),
  mod('cockpit', 'visor', 'Visor', 'A low armoured hump with a slit of glass across it.', { mass: 0.8, does: { cruise: 0.05 } }),
  // ── wings (the right one; the left's its mirror) ──
  mod('wings', 'swept', 'Swept', 'Wings swept back from the root to a narrow tip.', { mass: 1, does: { agility: 0.15 }, sockets: { tip: [0.13, 0.004, 0.06] } }),
  mod('wings', 'delta', 'Delta', 'One broad triangle each side: steady at speed.', { mass: 1.5, does: { level: 0.2, agility: 0.05 }, sockets: { tip: [0.1, 0.0, 0.07] } }),
  mod('wings', 'twinboom', 'Twin-boom', 'Straight wings with a boom at each tip, running back past the tail.', { mass: 2, does: { agility: 0.1, level: 0.1 }, sockets: { tip: [0.12, 0.0, -0.02] } }),
  mod('wings', 'stub', 'Stub', 'Short thick stubs, each with a pod at its end. Light.', { mass: 0.5, does: { cruise: 0.05 }, sockets: { tip: [0.064, 0.0, 0.0] } }),
  // ── engines (count: how many, on the hull's layout for that many) ──
  mod('engines', 'twincans', 'Twin cans', 'A pair of big exhaust cans.', { mass: 1, power: 1, count: 2, does: { boost: 0.1 } }),
  mod('engines', 'quad', 'Quad', 'Four smaller nozzles in a block: off the mark quickest.', { mass: 2, power: 2, count: 4, does: { accel: 0.3, boost: 0.05 } }),
  mod('engines', 'ring', 'Ring drive', 'One great ring of portal fluid round a burning core. The fastest boost there is.', {
    mass: 2,
    power: 2,
    count: 1,
    does: { boost: 0.3, accel: 0.15 },
    weight: 0.6,
    achievement: 'showmewhatyougot',
    hint: 'Beat the Cromulon in Portal panic',
  }),
  // ── tails ──
  mod('tail', 'fin', 'Fin', 'A single tall fin: it rolls back upright quicker.', { mass: 0.3, does: { level: 0.15 } }),
  mod('tail', 'twinfin', 'Twin fins', 'Two fins canted out: turns a touch tighter.', { mass: 0.5, does: { level: 0.1, agility: 0.08 } }),
  mod('tail', 'none', 'None', 'A clean back, nothing on it.'),
  // ── extras ──
  mod('extras', 'none', 'None', 'Nothing more.'),
  mod('extras', 'antenna', 'Antenna', 'A whip antenna on its back, with a light at the top.', { mass: 0.1 }),
  mod('extras', 'lights', 'Running lights', 'Red and green lights at the wingtips, blinking.', { mass: 0.1 }),
  mod('extras', 'dish', 'Radar dish', 'A dish on its back, turning: the Falcon’s, more or less.', { mass: 0.5, weight: 0.6, achievement: 'trench', hint: 'Hit the exhaust port in the trench run' }),
];

const BY_SLOT = Object.fromEntries(BUILD_SLOTS.map((slot) => [slot, new Map()]));
for (const m of MODULES) BY_SLOT[m.slot].set(m.id, m);

export const modulesFor = (slot) => [...(BY_SLOT[slot]?.values() ?? [])];
export const moduleById = (slot, id) => BY_SLOT[slot]?.get(id) ?? null;

// Whether a module's there to fit, with these achievements unlocked.
export const isModuleOpen = (m, unlocked = []) => !m.achievement || unlocked.includes(m.achievement);
