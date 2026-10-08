// How hard the fight is: the flight setting (controls.js's `difficulty`),
// turned into the numbers the rest read. Both maps use it (the universe's
// scene.js and the galaxy's), so it's one setting for both.
// - skill: the tier the hunters fly at (hunterRules.js's SKILLS): how true
//   their aim, how quick their guns, how hard they break when you line up
//   on them
// - promote: how likely a pack is to come a tier better than that, the
//   more so the hotter things are (packSkill)
// - damage: what their shots take off your shields, of the usual
// - size: more of them in a pack (or fewer)
// - search: how long the law looks for you once it has lost you (wanted.js)
// - regen: how quickly your shields come back
// - pace: how soon the next thing comes (director.js's wait, divided)
// Pure (no three.js), so it's tested in Node.

export const TIERS = ['rookie', 'regular', 'veteran', 'elite'];
export const LEVELS = ['story', 'normal', 'hard', 'outlaw'];
export const DEFAULT = 'normal';

export const DIFFICULTY = {
  story: { label: 'Story', hint: 'Rookie pilots, light hits: for the sights', skill: 'rookie', promote: 0, damage: 0.7, size: -1, search: 0.6, regen: 1.3, pace: 0.8 },
  normal: { label: 'Normal', hint: 'Real pilots: veterans in the hot spots', skill: 'regular', promote: 0.25, damage: 1.1, size: 0, search: 1, regen: 1, pace: 1 },
  hard: { label: 'Hard', hint: 'Veterans who break when you line up, and hit harder', skill: 'veteran', promote: 0.35, damage: 1.35, size: 1, search: 1.4, regen: 0.85, pace: 1.2 },
  outlaw: { label: 'Outlaw', hint: 'Elite everywhere. It is meant to kill you', skill: 'elite', promote: 0.5, damage: 1.65, size: 2, search: 1.8, regen: 0.7, pace: 1.45 },
};

export const readDifficulty = (v) => (typeof v === 'string' && Object.hasOwn(DIFFICULTY, v) ? v : DEFAULT);
export const difficultyOf = (id) => DIFFICULTY[readDifficulty(id)];

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// The tier a pack flies at: the level's own, a tier better now and then
// (`promote`, and more of the time the hotter it is: heat 0–5), now and then
// two when it's very hot; never past the best
export function packSkill(base, { heat = 0, promote = 0, rand = Math.random } = {}) {
  const at = Math.max(0, TIERS.indexOf(base));
  const hot = clamp(heat, 0, 5) / 5;
  let up = 0;
  if (rand() < promote + hot * 0.45) up += 1;
  if (rand() < hot * 0.2 * (promote > 0 ? 1 : 0.5)) up += 1;
  return TIERS[Math.min(TIERS.length - 1, at + up)];
}
