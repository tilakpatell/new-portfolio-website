// The air going past him, synthesised: a low rush that rises and brightens
// with his speed, a high whistle flat out, and a city's hum under it when
// he's down near the streets. Quiet, under everything else, and through the
// site's master volume (lib/audio).

import { audioContext, output } from '../../../lib/audio';

let noiseBuf = null;
const noise = (ac) => {
  if (noiseBuf) return noiseBuf;
  noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
};

// windSound() → { set({ speed, alt }), stop() }. Made inside a key press or a
// touch (a browser starts no sound before one); without Web Audio, silent.
export function windSound() {
  const ac = audioContext();
  const out = output();
  if (!ac || !out) return { set() {}, stop() {} };
  const bus = ac.createGain();
  bus.gain.value = 0;
  bus.gain.setTargetAtTime(1, ac.currentTime, 0.5);
  bus.connect(out);

  const loop = (rate = 1) => {
    const s = ac.createBufferSource();
    s.buffer = noise(ac);
    s.loop = true;
    s.playbackRate.value = rate;
    s.start();
    return s;
  };
  // the rush: noise through a low-pass that opens with speed
  const rushSrc = loop();
  const rush = ac.createBiquadFilter();
  rush.type = 'lowpass';
  rush.frequency.value = 300;
  rush.Q.value = 0.6;
  const rushG = ac.createGain();
  rushG.gain.value = 0;
  rushSrc.connect(rush).connect(rushG).connect(bus);
  // the whistle: a narrow band high up, only flat out
  const whSrc = loop(0.8);
  const wh = ac.createBiquadFilter();
  wh.type = 'bandpass';
  wh.frequency.value = 2400;
  wh.Q.value = 9;
  const whG = ac.createGain();
  whG.gain.value = 0;
  whSrc.connect(wh).connect(whG).connect(bus);
  // the city: a low band of traffic, near the ground
  const cSrc = loop(0.5);
  const c = ac.createBiquadFilter();
  c.type = 'bandpass';
  c.frequency.value = 160;
  c.Q.value = 0.8;
  const cG = ac.createGain();
  cG.gain.value = 0;
  cSrc.connect(c).connect(cG).connect(bus);

  return {
    set({ speed = 0, alt = 0 }) {
      const t = ac.currentTime;
      const k = Math.min(1, speed / 260);
      rush.frequency.setTargetAtTime(260 + k * 2600, t, 0.12);
      rushG.gain.setTargetAtTime(0.004 + k * 0.05, t, 0.12);
      whG.gain.setTargetAtTime(Math.max(0, k - 0.45) * 0.03, t, 0.2);
      wh.frequency.setTargetAtTime(1800 + k * 1600, t, 0.2);
      cG.gain.setTargetAtTime(0.02 * Math.max(0, 1 - alt / 120), t, 0.4);
    },
    stop() {
      const t = ac.currentTime;
      bus.gain.setTargetAtTime(0, t, 0.2);
      setTimeout(() => {
        for (const s of [rushSrc, whSrc, cSrc])
          try {
            s.stop();
          } catch {
            /* already stopped */
          }
        bus.disconnect();
      }, 800);
    },
  };
}
