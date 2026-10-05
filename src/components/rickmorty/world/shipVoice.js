// The cruiser's voice: the browser's own speech (no files), calm, low and a
// little slow, saying what ./ship.js picks. Quiet with the site's sound off,
// or with the ship's voice switched off in the things-to-do list (kept in
// tp-c137-shipvoice); the captions show either way. Without speech in the
// browser, it just doesn't speak.

import { soundOn } from '../../../lib/audio';
import { local } from '../../../lib/hooks';

const KEY = 'tp-c137-shipvoice';
export const shipVoiceOn = () => local.get(KEY, true) !== false;
export const setShipVoice = (on) => local.set(KEY, !!on);

const can = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';

// a calm English voice if there is one: a British one first, a woman's if it says
const LIKED = [/Google UK English Female/i, /Serena|Kate|Martha|Stephanie|Fiona/i, /en-GB/i, /Samantha|Karen|Moira|Tessa|Victoria/i, /Female/i, /^en/i];
let chosen = null;
function voice() {
  if (chosen) return chosen;
  const all = window.speechSynthesis.getVoices?.() ?? [];
  if (!all.length) return null;
  for (const want of LIKED) {
    const v = all.find((o) => want.test(o.name) || want.test(o.lang));
    if (v) return (chosen = v);
  }
  return (chosen = all[0]);
}

export function speak(line) {
  if (!can() || !soundOn() || !shipVoiceOn()) return;
  try {
    const s = window.speechSynthesis;
    s.cancel();
    const u = new window.SpeechSynthesisUtterance(line);
    const v = voice();
    if (v) u.voice = v;
    u.lang = v?.lang ?? 'en-GB';
    u.rate = 0.92;
    u.pitch = 0.72;
    u.volume = 0.9;
    s.speak(u);
  } catch {
    /* no voice, then */
  }
}

export function stopSpeaking() {
  if (!can()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* nothing to stop */
  }
}
