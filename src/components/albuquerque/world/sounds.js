// The Aztek's own sounds, synthesised: the engine (a low V6 burble that
// rises with the revs and the throttle) and its tyres, which squeal when
// they slide on the road and hiss when they slide on dirt or sand. Quiet,
// under the shows' lines, and through the site's master volume (lib/audio).

import { audioContext, output } from '../../../lib/audio';

let noiseBuf = null;
const noise = (ac) => {
  if (noiseBuf) return noiseBuf;
  noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
};

// carSound() → { set({ speed, throttle, slip, road }), stop() }. Made inside
// a key press or a touch (a browser starts no sound before one); where
// there's no Web Audio it's silent.
export function carSound() {
  const ac = audioContext();
  const out = output();
  if (!ac || !out) return { set() {}, stop() {} };
  const bus = ac.createGain();
  bus.gain.value = 0;
  bus.gain.setTargetAtTime(1, ac.currentTime, 0.4);
  bus.connect(out);

  // the engine: two saws a fifth of a tone apart through a low-pass that
  // opens with the throttle
  const tone = ac.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 220;
  tone.Q.value = 0.7;
  const eg = ac.createGain();
  eg.gain.value = 0.007;
  tone.connect(eg).connect(bus);
  const saws = [1, 1.012, 0.5].map((k, i) => {
    const o = ac.createOscillator();
    o.type = i === 2 ? 'square' : 'sawtooth';
    o.frequency.value = 46 * k;
    const g = ac.createGain();
    g.gain.value = i === 2 ? 0.5 : 0.35;
    o.connect(g).connect(tone);
    o.start();
    return { o, k };
  });

  // the tyres: noise through a band that sits high and narrow on the road (a
  // squeal) and low and wide off it (a hiss of grit)
  const src = ac.createBufferSource();
  src.buffer = noise(ac);
  src.loop = true;
  const band = ac.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 1500;
  band.Q.value = 5;
  const tg = ac.createGain();
  tg.gain.value = 0;
  src.connect(band).connect(tg).connect(bus);
  src.start();

  let stopped = false;
  return {
    set({ speed = 0, throttle = 0, slip = 0, road = true }) {
      // (nothing is heard while the browser has the sound held, and nothing
      // should queue up for when it lets go)
      if (stopped || ac.state !== 'running') return;
      const now = ac.currentTime;
      const v = Math.min(1, Math.abs(speed) / 24);
      // (a three-speed box: the note climbs, drops back and climbs again)
      const gear = Math.min(2.999, v * 3);
      const revs = 0.35 + 0.65 * (gear % 1) * 0.8 + 0.12 * Math.floor(gear) + 0.18 * Math.max(0, throttle);
      const hz = 42 + 62 * revs;
      for (const s of saws) s.o.frequency.setTargetAtTime(hz * s.k, now, 0.06);
      tone.frequency.setTargetAtTime(160 + 520 * Math.max(0, throttle) + 260 * v, now, 0.08);
      eg.gain.setTargetAtTime(0.007 + 0.024 * Math.max(0, throttle) + 0.009 * v, now, 0.08);
      const loud = slip > 0.12 ? Math.min(1, (slip - 0.12) / 0.6) * Math.min(1, Math.abs(speed) / 6 + slip) : 0;
      band.frequency.setTargetAtTime(road ? 1350 + 500 * slip : 520, now, 0.05);
      band.Q.setTargetAtTime(road ? 6 : 0.8, now, 0.05);
      tg.gain.setTargetAtTime(loud * (road ? 0.05 : 0.07), now, 0.04);
    },
    stop() {
      if (stopped) return;
      stopped = true;
      const now = ac.currentTime;
      bus.gain.setTargetAtTime(0, now, 0.08);
      for (const s of saws) s.o.stop(now + 0.5);
      src.stop(now + 0.5);
      setTimeout(() => bus.disconnect(), 700);
    },
  };
}
