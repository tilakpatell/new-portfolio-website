// One shared Web Audio context for every sound on the site, and the visitor's
// sound setting. Browsers only let audio start after a click or key press, so
// call `audioContext()` at the very start of an event handler, before any
// `await`: on iOS a context resumed later than that stays silent.

const KEY = 'tp-sound';
let ctx = null;
let master = null;
const listeners = new Set();

export function soundOn() {
  try {
    return window.localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setSound(on) {
  try {
    window.localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    /* storage unavailable */
  }
  if (master) master.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.05);
  listeners.forEach((fn) => fn(on));
}

export function onSoundChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// The context, created and resumed on demand. Returns null where Web Audio is
// missing (very old browsers) so callers can quietly skip the sound.
export function audioContext() {
  if (!ctx) {
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return null;
    ctx = new AC({ latencyHint: 'interactive' });
    master = ctx.createGain();
    master.gain.value = soundOn() ? 1 : 0;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.2;
    master.connect(limiter).connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// Where every sound should connect: the master volume, which mutes with the setting.
export const output = () => (audioContext() ? master : null);

// Download a file's bytes ahead of time (on hover, say). This creates no audio
// context, so it is safe before the visitor has clicked anything.
const bytes = new Map();
export function prefetch(url) {
  if (!bytes.has(url)) {
    bytes.set(
      url,
      fetch(url).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${r.status} ${url}`)))),
    );
    bytes.get(url).catch(() => bytes.delete(url));
  }
  return bytes.get(url);
}

// Fetch and decode an audio file once.
const decoded = new Map();
export function loadBuffer(url) {
  const ac = audioContext();
  if (!ac) return Promise.resolve(null);
  if (!decoded.has(url)) {
    decoded.set(
      url,
      prefetch(url)
        // decoding detaches the buffer it is given, so decode a copy
        .then((data) => new Promise((resolve, reject) => ac.decodeAudioData(data.slice(0), resolve, reject)))
        .catch((e) => {
          decoded.delete(url);
          throw e;
        }),
    );
  }
  return decoded.get(url);
}
