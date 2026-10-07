import { useEffect } from 'react';
import { sayVoiced, stopVoiced } from '../../../lib/voiced';

// A game's line on the HUD in its speaker's own voice, where it's been made
// (lib/voiced.js): said as it comes up, if it's one of `lines` (a Set of the
// ones that are the same every time, as its voicelines.js lists them), and
// left to finish when the HUD moves on to one that isn't. Whatever's being
// said stops when the game closes.
export function useSays(who, text, lines) {
  useEffect(() => {
    if (lines.has(text)) sayVoiced(who, text);
  }, [who, text, lines]);
  useEffect(() => stopVoiced, []);
}
