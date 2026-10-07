// What a hero can do on G and V besides shoot or swing: the abilities, each
// a card of numbers, and which two a hero carries. Pure, so it's tested in
// Node; heroes.js names a hero's pair, scene.js plays them and HeroPanel.jsx
// and the HUD name them.
//
//   ABILITIES              by kind: { name, about, cool (seconds), hold? (held, not pressed) and the kind's own numbers }
//   abilitiesOf(spec)      the pair a party spec carries: { power, second } (their own, else the Force for a saber, else a detonator and the overcharge)
//   JET                    the jetpack's numbers; jetStep(jet, { hold, grounded, dt }) burns or refills it, and says whether it's thrusting this frame

import { FORCE } from './combatRules';

export const ABILITIES = {
  push: { name: 'Push', about: 'The Force, out: everyone in front of you off their feet.', cool: FORCE.push.cool },
  pull: { name: 'Pull', about: 'The Force, in: they come to you, and stagger.', cool: FORCE.pull.cool },
  detonator: { name: 'Detonator', about: 'A thermal detonator, lobbed in an arc. Breaks shields.', cool: 8, fuse: 2.2, speed: 15, lift: 5.5, radius: 4.5, damage: 3 },
  fulminate: { name: 'Fulminate', about: 'A crystal of fulminated mercury, thrown hard. A bigger bang, a longer wait.', cool: 14, fuse: 1.4, speed: 17, lift: 4, radius: 6, damage: 4 },
  rocket: { name: 'Wrist rocket', about: 'Straight from the gauntlet, fast and flat.', cool: 10, fuse: 1.6, speed: 30, lift: 0.4, radius: 3.5, damage: 4 },
  overcharge: { name: 'Overcharge', about: 'No heat and a harder shot for a while.', cool: 20, dur: 5 },
  jetpack: { name: 'Jetpack', about: 'Hold to fly. The tank refills on the ground.', cool: 0, hold: true },
  roar: { name: 'Roar', about: 'A Wookiee’s roar: everyone near staggers back.', cool: 12, range: 7, cone: 1.4, force: 8, lift: 2.5, stagger: 1.5 },
  medpack: { name: 'Medpack', about: 'A third of your health back.', cool: 25, heal: 35 },
  hop: { name: 'Portal hop', about: 'A portal a few metres on, and you through it.', cool: 6, reach: 7 },
  sprint: { name: 'Sprint', about: 'Half again as fast for a few seconds.', cool: 14, dur: 4, speed: 1.5 },
};
export const ABILITY_IDS = Object.keys(ABILITIES);

// the jetpack: seconds of thrust in a full tank, the push above gravity
// (m/s²), the fastest it lifts (m/s), and seconds to refill on the ground
export const JET = { tank: 2.2, thrust: 24, lift: 7.5, refill: 1.6 };

export function abilitiesOf(spec) {
  const own = spec?.abilities;
  if (own && ABILITIES[own.power] && ABILITIES[own.second]) return { power: own.power, second: own.second };
  return spec?.saber ? { power: 'push', second: 'pull' } : { power: 'detonator', second: 'overcharge' };
}

export const newJet = () => ({ fuel: JET.tank, on: false });

// one frame of the jetpack: held off the ground with fuel left, it burns and
// thrusts; on the ground it refills (never past the tank)
export function jetStep(jet, { hold, grounded, dt }, rules = JET) {
  if (grounded && !hold) {
    jet.fuel = Math.min(rules.tank, jet.fuel + (rules.tank / rules.refill) * dt);
    jet.on = false;
    return jet;
  }
  if (hold && jet.fuel > 0) {
    jet.fuel = Math.max(0, jet.fuel - dt);
    jet.on = true;
    return jet;
  }
  jet.on = false;
  return jet;
}
