// The kinds of objective a galaxy battle's plan is made of (battlePlan.js
// picks them, battleDirector.js runs them, battleStages.js puts them in the
// sim, battleScene.js draws and marks them). Pure, tested. For each kind:
// - its scope: a stage of the attacker's chain (`stage`), the runners an
//   evacuation or a blockade is decided by (`runners`), or something either
//   side can do on the way (`side`: a bomber wave, an ace);
// - its verbs: what the attacker's told to do about it and what the
//   defender is ('Destroy' and 'Defend', 'Hold' and 'Contest');
// - the crew's line when it comes up (battleLines.js's keys), if it has one;
// - the tally keys the pilots' part in it is kept under, and how much of the
//   objective's hp (the AI's measure of it) that part is.
//
// The kinds: destroy (a target to shoot down: a subsystem, an ion cannon, a
// relay); group (one of a stage's k of n: turbolaser batteries,
// shield-projector satellites, orbital defence platforms, gravity wells);
// zone (somewhere to hold: a comms relay, a data beacon being sliced, a ship
// being boarded), its hp the seconds the attackers have held it, net of
// the defenders', at hp/hold a second; escort and intercept (the runners,
// as whoever attacks sees them: their own to escort, the other side's to
// stop); wave (a bomber wave, the defender's to intercept); board (disable a
// ship's engines, then hold beside it while a shuttle docks: the Tantive
// IV's capture); ace (an ace in the fight from its time, its hull the
// pilots' to share); run (a reactor run: the set pieces', each shot worth
// `unit` of the stage).
//
// TYPES; typeOf(o) → its kind (a destroy, for one it doesn't know); keysOf(o)
// → its tally keys; progressOf(o, value) → the pilots' part in it, in its
// hp; titleOf(o, attack) → 'Verb: its name' (its own verbs, if it has them).

const shots = (o, v) => (o.unit ?? 1) * v(o.id);
const held = (o, v) => (o.hp / (o.hold ?? 30)) * Math.max(0, v(`${o.id}:a`) - v(`${o.id}:d`));
const none = () => 0;
const byId = (o) => [o.id];

export const TYPES = {
  destroy: { scope: 'stage', verbs: ['Destroy', 'Defend'], crew: null, keys: byId, progress: shots, shoot: true },
  group: { scope: 'stage', verbs: ['Destroy', 'Defend'], crew: 'group', keys: byId, progress: shots, shoot: true },
  zone: { scope: 'stage', verbs: ['Hold', 'Contest'], crew: 'zone', keys: (o) => [`${o.id}:a`, `${o.id}:d`], progress: held, hold: true },
  board: { scope: 'stage', verbs: ['Board', 'Repel'], crew: 'board', keys: () => [], progress: none },
  run: { scope: 'stage', verbs: ['Destroy', 'Defend'], crew: null, keys: byId, progress: shots, shoot: true },
  escort: { scope: 'runners', verbs: ['Escort', 'Stop'], crew: 'escort', keys: () => [], progress: none },
  intercept: { scope: 'runners', verbs: ['Stop', 'Escort'], crew: 'runners', keys: () => [], progress: none },
  wave: { scope: 'side', verbs: ['Escort', 'Intercept'], crew: 'wave', keys: byId, progress: none },
  ace: { scope: 'side', verbs: ['Protect', 'Hunt'], crew: 'hunt', keys: (o) => [`ace:${o.team}`], progress: none },
};

export const typeOf = (o) => TYPES[o?.type] ?? TYPES.destroy;
export const keysOf = (o) => typeOf(o).keys(o);
export const progressOf = (o, value) => typeOf(o).progress(o, value);
export const titleOf = (o, attack) => `${(o.verbs ?? typeOf(o).verbs)[attack ? 0 : 1]}: ${o.name}`;
