// What Cybertron's world sounds like: the truck's engine following its
// speed (and the servos' whine as a robot), the transformation's own sound,
// blasters, hits, booms, energon picked up, and the Decepticons' fire. All
// of it the site's own synthesised sounds (lib/sfx, games/gameAudio) and
// clips (lib/clips), nothing new to download.

import { audioContext } from '../../../lib/audio';

export function createSounds() {
  let engine = null;
  let sfx = null;
  let ga = null;
  let clips = null;
  // (loaded on the first sound, inside a click or a key, so they can play)
  const ready = () => {
    if (!audioContext()) return false;
    if (!sfx) {
      import('../../../lib/sfx').then((m) => (sfx = m));
      import('../../games/gameAudio').then((m) => {
        ga = m;
        engine = m.engine({ diesel: true });
      });
      import('../../../lib/clips').then((m) => (clips = m));
    }
    return true;
  };
  let lastFoe = 0;
  return {
    wake: ready,
    engine(state) {
      engine?.set(state);
    },
    transform() {
      if (ready()) clips?.playClip('transform');
    },
    blaster(mine) {
      if (!ready()) return;
      if (mine) sfx?.laser();
      else {
        const now = performance.now();
        if (now - lastFoe > 120) {
          lastFoe = now;
          ga?.zap();
        }
      }
    },
    hit() {
      if (ready()) sfx?.hit();
    },
    boom(big = false) {
      if (ready()) (big ? sfx?.boom : sfx?.blast)?.();
    },
    pickup() {
      if (ready()) ga?.energon();
    },
    jump() {
      if (ready()) ga?.servoJump();
    },
    bridge() {
      if (ready()) sfx?.bridge();
    },
    done() {
      if (ready()) sfx?.fanfare();
    },
    boss() {
      if (ready()) ga?.bossSting();
    },
    dispose() {
      engine?.stop();
    },
  };
}
