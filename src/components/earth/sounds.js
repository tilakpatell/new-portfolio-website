// Earth's sounds, synthesised: the engines (a rumble, the fan's hum and a
// thin whine, rising with the throttle), the two-note chime a cabin plays
// when the seatbelt sign goes off, the thump of a passport stamp, and the
// rush of air on the way down from orbit. All through the site's master
// volume (lib/audio).

import { audioContext, output } from '../../lib/audio';

const ready = () => {
  const ac = audioContext();
  const out = output();
  return ac && out ? [ac, out] : [null, null];
};

let noiseBuf = null;
const noise = (ac) => {
  if (noiseBuf) return noiseBuf;
  noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  let b = 0;
  for (let i = 0; i < d.length; i++) {
    b = (b + 0.02 * (Math.random() * 2 - 1)) / 1.02; // brown: deep, like air
    d[i] = b * 3.5;
  }
  return noiseBuf;
};

export function engine() {
  const [ac, out] = ready();
  if (!ac) return { set() {}, stop() {} };
  const bus = ac.createGain();
  bus.gain.value = 0;
  bus.gain.setTargetAtTime(1, ac.currentTime, 0.6);
  bus.connect(out);
  const rumble = ac.createBufferSource();
  rumble.buffer = noise(ac);
  rumble.loop = true;
  const low = ac.createBiquadFilter();
  low.type = 'lowpass';
  low.frequency.value = 420;
  const rg = ac.createGain();
  rg.gain.value = 0.16;
  rumble.connect(low).connect(rg).connect(bus);
  const fan = ac.createOscillator();
  fan.type = 'sawtooth';
  fan.frequency.value = 96;
  const fanLp = ac.createBiquadFilter();
  fanLp.type = 'lowpass';
  fanLp.frequency.value = 300;
  const fg = ac.createGain();
  fg.gain.value = 0.018;
  fan.connect(fanLp).connect(fg).connect(bus);
  const whine = ac.createOscillator();
  whine.type = 'sine';
  whine.frequency.value = 1900;
  const wg = ac.createGain();
  wg.gain.value = 0.004;
  whine.connect(wg).connect(bus);
  rumble.start();
  fan.start();
  whine.start();
  return {
    // throttle: 0 cruising … 1 boost
    set(throttle) {
      const t = ac.currentTime;
      low.frequency.setTargetAtTime(380 + throttle * 520, t, 0.3);
      rg.gain.setTargetAtTime(0.14 + throttle * 0.1, t, 0.3);
      fan.frequency.setTargetAtTime(92 + throttle * 40, t, 0.4);
      whine.frequency.setTargetAtTime(1800 + throttle * 700, t, 0.5);
      wg.gain.setTargetAtTime(0.003 + throttle * 0.004, t, 0.4);
    },
    stop() {
      try {
        bus.gain.cancelScheduledValues(ac.currentTime);
        bus.gain.setTargetAtTime(0, ac.currentTime, 0.25);
        setTimeout(() => {
          for (const n of [rumble, fan, whine]) n.stop();
          bus.disconnect();
        }, 1200);
      } catch {
        // the context went first
      }
    },
  };
}

// the cabin chime: a high note, then one a third below, each ringing out
export function chime() {
  const [ac, out] = ready();
  if (!ac) return;
  [
    [783.99, 0],
    [659.25, 0.62],
  ].forEach(([f, at]) => {
    const t = ac.currentTime + at;
    for (const [mul, vol] of [
      [1, 0.09],
      [2, 0.025],
      [3, 0.008],
    ]) {
      const o = ac.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * mul;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 1.7);
    }
  });
}

// a rubber stamp coming down on paper
export function stamp() {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime;
  const s = ac.createBufferSource();
  s.buffer = noise(ac);
  const f = ac.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 900;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.9, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  s.connect(f).connect(g).connect(out);
  s.start(t, Math.random());
  s.stop(t + 0.14);
  const o = ac.createOscillator();
  o.frequency.setValueAtTime(130, t);
  o.frequency.exponentialRampToValueAtTime(60, t + 0.1);
  const og = ac.createGain();
  og.gain.setValueAtTime(0.25, t);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
  o.connect(og).connect(out);
  o.start(t);
  o.stop(t + 0.16);
}

// the rush of air, coming down out of space or going back up
export function rush(seconds = 2.6) {
  const [ac, out] = ready();
  if (!ac) return;
  const t = ac.currentTime;
  const s = ac.createBufferSource();
  s.buffer = noise(ac);
  s.loop = true;
  const f = ac.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 0.8;
  f.frequency.setValueAtTime(300, t);
  f.frequency.exponentialRampToValueAtTime(1800, t + seconds * 0.7);
  f.frequency.exponentialRampToValueAtTime(500, t + seconds);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.35, t + seconds * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
  s.connect(f).connect(g).connect(out);
  s.start(t);
  s.stop(t + seconds + 0.05);
}
