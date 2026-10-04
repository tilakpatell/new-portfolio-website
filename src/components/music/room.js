// The music room's shared mix: every instrument goes through here, with a
// little air around it (a short, dark room), to the site's master volume.

import { output } from '../../lib/audio';

let bus = null;

export function mix(ac) {
  if (bus) return bus;
  const dry = ac.createGain();
  dry.gain.value = 0.9;
  const room = ac.createConvolver();
  room.buffer = roomImpulse(ac, 1.5);
  const wet = ac.createGain();
  wet.gain.value = 0.16;
  const sum = ac.createGain();
  sum.gain.value = 0.85;
  dry.connect(sum);
  dry.connect(room).connect(wet).connect(sum);
  sum.connect(output());
  bus = dry;
  return bus;
}

function roomImpulse(ac, seconds) {
  const n = Math.floor(ac.sampleRate * seconds);
  const ir = ac.createBuffer(2, n, ac.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      lp = lp * 0.6 + (Math.random() * 2 - 1) * 0.4;
      d[i] = lp * Math.pow(1 - i / n, 2.6);
    }
  }
  return ir;
}

// Decode an audio file's bytes. Works before the visitor has clicked anything
// (an offline context decodes without a gesture), so a sample set can be ready
// before its first note; falls back to the live context where offline
// decoding isn't there. AudioBuffers play in any context.
export function decode(bytes, ac = null) {
  const copy = bytes.slice(0); // decoding detaches the buffer it is given
  const OAC = typeof window !== 'undefined' && (window.OfflineAudioContext || window.webkitOfflineAudioContext);
  const ctx = ac || (OAC ? new OAC(1, 1, 44100) : null);
  if (!ctx) return Promise.reject(new Error('no audio'));
  return new Promise((resolve, reject) => {
    const p = ctx.decodeAudioData(copy, resolve, reject);
    if (p && typeof p.then === 'function') p.then(resolve, reject);
  });
}
