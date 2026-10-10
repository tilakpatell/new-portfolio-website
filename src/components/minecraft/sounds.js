// The tribute’s sounds: the events the sim already emits for them
// (rules/game.js’s drain: a step, a block broken, a block placed, a hurt),
// and a splash going into the water, which the sim says as the player’s
// `inWater` turning on, played through lib/sfx.js by name. The game’s own
// sounds are samples it ships; these are the site’s synthesised ones, of
// the same shape: a soft step, a dry crunch, a knock, a grunt. Nothing is
// changed in the sim: it is heard, not told.
//
//   createSounds({ play = sfx.play, random = Math.random })
//     → { hear(events, player), groups() }   player: { inWater, vy } after
//     the frame’s ticks; groups(), the levels for the ?debug panel

import { play as sfxPlay } from '../../lib/sfx.js';

// the levels: a footstep under everything else; a splash as loud as the
// fall into the water was fast (`per` a block a tick, from `min`)
const LEVELS = { step: 0.2, place: 0.6, splash: 0.3, per: 1.6 };

export function createSounds({ play = sfxPlay, random = Math.random } = {}) {
  const o = { ...LEVELS };
  let wet = null; // in the water as of the last frame (null: not known yet)
  // a pitch a little either side of 1, so a run of the same sound isn’t a drum
  const near = (spread) => 1 - spread + random() * spread * 2;
  return {
    hear(events, player) {
      for (const e of events) {
        if (e.type === 'step') play('thunk', { gain: o.step, pitch: near(0.12) * 0.8 });
        else if (e.type === 'break') play('crunch', { gain: 1, pitch: near(0.1) });
        else if (e.type === 'place') play('thunk', { gain: o.place, pitch: near(0.06) });
        else if (e.type === 'hurt') play('oof', { gain: 1, pitch: near(0.05) });
      }
      const now = Boolean(player?.inWater);
      if (wet === false && now) play('splash', { gain: Math.min(1, o.splash + Math.abs(player.vy ?? 0) * o.per), pitch: near(0.08) });
      wet = now;
    },
    groups() {
      const item = (key, label, max) => ({ key, label, type: 'range', min: 0, max, step: 0.01, get: () => o[key], set: (v) => (o[key] = v) });
      return [{ name: 'sounds', items: [item('step', 'step', 1), item('place', 'place', 1), item('splash', 'splash from', 1), item('per', 'splash by speed', 4)] }];
    },
  };
}
