// The Quinjet's engines, as a sound that follows the throttle: the fans'
// roar (noise, opened up as they spool) under a turbine's whine (two
// detuned saws through a band-pass). Quiet at idle, never harsh; it goes
// through the site's master volume, so the sound setting mutes it.

import { audioContext, output } from '../../../lib/audio';

export function createHum() {
  const ac = audioContext();
  const out = output();
  if (!ac || !out) return null;
  const level = ac.createGain();
  level.gain.value = 0;
  level.connect(out);

  // the roar: two seconds of noise, looped, through a low-pass
  const len = ac.sampleRate * 2;
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    // brownish: each sample a step from the last
    last = (last + (Math.random() * 2 - 1) * 0.08) * 0.985;
    d[i] = last * 3;
  }
  const noise = ac.createBufferSource();
  noise.buffer = buf;
  noise.loop = true;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 500;
  lp.Q.value = 0.7;
  const roar = ac.createGain();
  roar.gain.value = 0.7;
  noise.connect(lp).connect(roar).connect(level);

  // the whine
  const o1 = ac.createOscillator();
  const o2 = ac.createOscillator();
  o1.type = o2.type = 'sawtooth';
  o1.frequency.value = 180;
  o2.frequency.value = 182.5;
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1400;
  bp.Q.value = 6;
  const whine = ac.createGain();
  whine.gain.value = 0.018;
  o1.connect(bp);
  o2.connect(bp);
  bp.connect(whine).connect(level);

  noise.start();
  o1.start();
  o2.start();
  let dead = false;
  return {
    // spool 0–1; on: whether it should be heard at all
    set(spool, on = true) {
      if (dead) return;
      const t = ac.currentTime;
      level.gain.setTargetAtTime(on ? 0.05 + spool * 0.16 : 0, t, on ? 0.12 : 0.05);
      lp.frequency.setTargetAtTime(380 + spool * 1500, t, 0.12);
      o1.frequency.setTargetAtTime(150 + spool * 170, t, 0.15);
      o2.frequency.setTargetAtTime(152.5 + spool * 172, t, 0.15);
      bp.frequency.setTargetAtTime(1100 + spool * 1300, t, 0.15);
    },
    stop() {
      if (dead) return;
      dead = true;
      level.gain.setTargetAtTime(0, ac.currentTime, 0.05);
      setTimeout(() => {
        try {
          noise.stop();
          o1.stop();
          o2.stop();
        } catch {
          /* already stopped */
        }
        level.disconnect();
      }, 400);
    },
  };
}
