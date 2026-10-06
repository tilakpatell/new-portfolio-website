// A module's sounds on the site's one Web Audio context (lib/audio): a gain
// of its own into the master, faded out and disconnected when the module
// goes, so nothing clicks at a handover and no engine runs on under the
// next world.
//
// createAudioBus({ context, output, now }) → { context(), output, bus(), fadeOut(ms) }

import { audioContext, output as masterOut } from '../lib/audio';

export function createAudioBus({ context = audioContext, output = masterOut, later = (fn, ms) => setTimeout(fn, ms) } = {}) {
  let current = null;
  return {
    context,
    output,
    bus() {
      if (current) return current;
      const ctx = context();
      const master = output();
      if (!ctx || !master) return null;
      current = ctx.createGain();
      current.connect(master);
      return current;
    },
    fadeOut(ms = 150) {
      const g = current;
      current = null;
      if (!g) return;
      const ctx = context();
      if (ctx) g.gain.setTargetAtTime(0, ctx.currentTime, ms / 1000 / 4);
      later(() => {
        try {
          g.disconnect();
        } catch {
          /* already gone */
        }
      }, ms + 50);
    },
  };
}
