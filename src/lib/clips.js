// Recorded clips the site plays at its big moments. They live in
// public/audio/clips/ (see the README there for where each came from), are
// decoded once, and play through the site's master volume, so the sound
// setting mutes them like everything else. Call this from a click or key press.
//
// A clip belongs to the page that played it and stops when the visitor leaves
// (App calls stopPageClips on every route change). `keep` lets one run on
// across pages: the theme switches, the jump to lightspeed, "say my name".

import { audioContext, loadBuffer, output } from './audio';

export const CLIPS = {
  vader: { src: '/audio/clips/i-am-your-father.mp3', line: 'No, I am your father.', by: 'Darth Vader' },
  starWars: { src: '/audio/clips/star-wars-theme.mp3', line: 'Main Title', by: 'John Williams' },
  binarySunset: { src: '/audio/clips/binary-sunset.mp3', line: 'Binary Sunset', by: 'John Williams' },
  hyperspaceEnter: { src: '/audio/clips/hyperspace-enter.mp3' },
  hyperspaceExit: { src: '/audio/clips/hyperspace-exit.mp3' },
  useTheForce: { src: '/audio/clips/use-the-force-luke.mp3', line: 'Use the Force, Luke.', by: 'Obi-Wan Kenobi' },
  transform: { src: '/audio/clips/transform.mp3' },
  freedom: { src: '/audio/clips/freedom.mp3', line: 'Freedom', by: 'Transformers' },
  soUnwise: { src: '/audio/clips/so-unwise.mp3', line: 'So unwise', by: 'Transformers' },
  die: { src: '/audio/clips/die.mp3', line: 'Die', by: 'Transformers' },
  sayMyName: { src: '/audio/clips/say-my-name.mp3', line: 'Say my name.', by: 'Walter White' },
  bbIntro: { src: '/audio/clips/breaking-bad-intro.mp3', line: 'Breaking Bad, the opening', by: 'Breaking Bad' },
  hectorBell: { src: '/audio/clips/hector-bell.mp3', line: 'Ding.', by: 'Hector Salamanca' },
  faceOff: { src: '/audio/clips/face-off.mp3', line: 'Face Off', by: 'Breaking Bad' },
  gusHello: { src: '/audio/clips/gus-hello.mp3', line: 'Hello, and welcome to the Los Pollos Hermanos family. My name is Gustavo, but you can call me Gus.', by: 'Gus Fring' },
  jesseRing: { src: '/audio/clips/jesse-ringtone.mp3', line: 'Yo, one four eight three to the three to the six to the nine, representin’ the ABQ.', by: 'Jesse Pinkman' },
  saulHi: { src: '/audio/clips/hi-im-saul.mp3', line: 'Hi, I’m Saul Goodman. Did you know that you have rights?', by: 'Saul Goodman' },
  tight: { src: '/audio/clips/tuco-tight.mp3', line: 'Tight, tight, tight!', by: 'Tuco Salamanca' },
  hankRing: { src: '/audio/clips/hank-ringtone.mp3', line: 'Hank’s phone', by: 'Hank Schrader' },
  callSaul: { src: '/audio/clips/better-call-saul.mp3', line: 'Better call Saul!', by: 'Saul Goodman' },
  twss: { src: '/audio/clips/thats-what-she-said.mp3', line: 'That’s what she said.', by: 'Michael Scott' },
  snap: { src: '/audio/clips/snap.mp3' },
  marvel: { src: '/audio/clips/marvel-opening.mp3', line: 'The Marvel Studios opening', by: 'Marvel Studios' },
  lotr: { src: '/audio/clips/lotr-theme.mp3', line: 'The Lord of the Rings', by: 'Howard Shore' },
  kingsArrival: { src: '/audio/clips/kings-arrival.mp3', line: 'The Return of the King', by: 'Howard Shore' },
  pirates: { src: '/audio/clips/pirates-theme.mp3', line: 'Pirates of the Caribbean, the theme', by: 'Pirates of the Caribbean' },
  officeTheme: { src: '/audio/clips/office-theme.mp3', line: 'The Office, the theme', by: 'The Office' },
  thankYou: { src: '/audio/clips/thank-you.mp3', line: 'Thank you.', by: 'Michael Scott' },
  noGod: { src: '/audio/clips/no-god.mp3', line: 'No, God! No, God, please, no!', by: 'Michael Scott' },
  tanpura: { src: '/audio/tanpura-pluck.mp3' }, // the music room's own (freely licensed, credited there)
  // the universe map's crews and ships
  wubba: { src: '/audio/clips/wubba-lubba-dub-dub.mp3', line: 'Wubba lubba dub dub!', by: 'Rick Sanchez' },
  pickleRick: { src: '/audio/clips/pickle-rick.mp3', line: 'I’m Pickle Rick!', by: 'Rick Sanchez' },
  riggity: { src: '/audio/clips/riggity-wrecked-son.mp3', line: 'Riggity riggity wrecked, son!', by: 'Rick Sanchez' },
  meeseeks: { src: '/audio/clips/im-mr-meeseeks.mp3', line: 'I’m Mr. Meeseeks! Look at me!', by: 'Mr. Meeseeks' },
  portalGun: { src: '/audio/clips/portal-gun.mp3' },
  cool: { src: '/audio/clips/cool.mp3', line: 'Coool.' },
  cantTakeIt: { src: '/audio/clips/cant-take-it-anymore.mp3', line: 'I can’t take it anymore. I just wanna die.' },
  lickLick: { src: '/audio/clips/lick-lick.mp3', line: 'Lick, lick, lick my balls! Ha ha! Yeah! Say that all the time!', by: 'Rick Sanchez' },
  chewieRoar: { src: '/audio/clips/chewie-roar.mp3' },
  chewieLaugh: { src: '/audio/clips/chewie-laugh.mp3' },
  dl44: { src: '/audio/clips/dl-44.mp3' },
  ohShit: { src: '/audio/clips/oh-shit.mp3', line: 'Oh shit, mother—' },
};

const playing = new Set();

// Stops every clip that belongs to the page being left.
export function stopPageClips() {
  playing.forEach((h) => !h.keep && h.stop());
}

// Plays a clip. `offset` skips into it, `duration` cuts it short with a fade.
// Resolves to { stop(), ended } or null if it can't play (no Web Audio, or the
// file didn't load), so callers can fall back to something else.
export async function playClip(id, { offset = 0, when = 0, duration, gain = 1, keep = false } = {}) {
  const ac = audioContext(); // first, while still inside the gesture
  const clip = CLIPS[id];
  if (!ac || !clip) return null;
  let buf;
  try {
    buf = await loadBuffer(clip.src);
  } catch {
    return null;
  }
  if (!buf) return null;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const g = ac.createGain();
  const t = ac.currentTime + when;
  g.gain.setValueAtTime(gain, t);
  if (duration) {
    g.gain.setValueAtTime(gain, t + Math.max(0, duration - 0.35));
    g.gain.linearRampToValueAtTime(0.0001, t + duration);
  }
  src.connect(g).connect(output());
  src.start(t, offset, duration);
  let handle = null;
  const ended = new Promise((resolve) => {
    src.onended = () => {
      playing.delete(handle);
      resolve();
    };
  });
  let stopped = false;
  handle = {
    ended,
    keep,
    stop() {
      if (stopped) return;
      stopped = true;
      const now = ac.currentTime;
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.linearRampToValueAtTime(0.0001, now + 0.12);
      try {
        src.stop(now + 0.14);
      } catch {
        /* already stopped */
      }
    },
  };
  playing.add(handle);
  return handle;
}
