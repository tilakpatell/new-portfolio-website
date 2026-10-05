// The office's sounds, synthesised so nothing is downloaded: the room tone
// (fluorescent tubes' hum, the air handling, the far-off murmur of a phone
// ringing now and then) and the fire alarm's whoop. Through the site's
// master volume. The show's own lines come from lib/clips; the bells and
// knocks from lib/sfx.

import { audioContext, output } from '../../../lib/audio';

let noiseBuf = null;
function noise(ac) {
  if (noiseBuf) return noiseBuf;
  const n = ac.sampleRate * 2;
  noiseBuf = ac.createBuffer(1, n, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}
const ready = () => {
  const ac = audioContext();
  const out = ac ? output() : null;
  return ac && out ? [ac, out] : [null, null];
};
const silent = { stop() {} };

// the room tone: 120 Hz mains hum off the ballasts, filtered air, a phone
// trilling somewhere in the annex every so often
export function hum() {
  const [ac, out] = ready();
  if (!ac) return silent;
  const t = ac.currentTime;
  const bus = ac.createGain();
  bus.gain.setValueAtTime(0.0001, t);
  bus.gain.exponentialRampToValueAtTime(1, t + 1.2);
  bus.connect(out);
  const tone = ac.createOscillator();
  tone.type = 'sawtooth';
  tone.frequency.value = 120;
  const tf = ac.createBiquadFilter();
  tf.type = 'lowpass';
  tf.frequency.value = 400;
  const tg = ac.createGain();
  tg.gain.value = 0.006;
  tone.connect(tf).connect(tg).connect(bus);
  tone.start();
  const air = ac.createBufferSource();
  air.buffer = noise(ac);
  air.loop = true;
  const af = ac.createBiquadFilter();
  af.type = 'lowpass';
  af.frequency.value = 700;
  const ag = ac.createGain();
  ag.gain.value = 0.02;
  air.connect(af).connect(ag).connect(bus);
  air.start();
  // a far phone, every 14–30 s
  let timer = 0;
  const trill = () => {
    const now = ac.currentTime;
    for (let r = 0; r < 2; r++)
      for (let k = 0; k < 12; k++) {
        const o = ac.createOscillator();
        o.type = 'square';
        o.frequency.value = k % 2 ? 1180 : 940;
        const g = ac.createGain();
        const at = now + r * 1.6 + k * 0.05;
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(0.004, at + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.048);
        const f = ac.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 1100;
        o.connect(f).connect(g).connect(bus);
        o.start(at);
        o.stop(at + 0.06);
      }
    timer = setTimeout(trill, 14000 + Math.random() * 16000);
  };
  timer = setTimeout(trill, 6000);
  return {
    stop() {
      clearTimeout(timer);
      const now = ac.currentTime;
      bus.gain.cancelScheduledValues(now);
      bus.gain.setValueAtTime(bus.gain.value, now);
      bus.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
      tone.stop(now + 0.5);
      air.stop(now + 0.5);
    },
  };
}

// the fire alarm: a whooping two-tone horn and a strobe's tick
export function alarm() {
  const [ac, out] = ready();
  if (!ac) return silent;
  const t = ac.currentTime;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.05, t + 0.2);
  g.connect(out);
  const o = ac.createOscillator();
  o.type = 'square';
  const f = ac.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 900;
  f.Q.value = 1.2;
  o.connect(f).connect(g);
  // whoop: 600 → 1100 Hz every 0.9 s, for as long as it runs (scheduled ahead)
  for (let i = 0; i < 120; i++) {
    o.frequency.setValueAtTime(600, t + i * 0.9);
    o.frequency.linearRampToValueAtTime(1100, t + i * 0.9 + 0.7);
  }
  o.start(t);
  return {
    stop() {
      const now = ac.currentTime;
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
      o.stop(now + 0.3);
    },
  };
}
