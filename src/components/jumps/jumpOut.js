// A page leaving through a jump (pages/Universe.jsx, flying into a place):
// the jump is asked for (App's Lightspeed plays it), and the page changes
// under its dark, at its flash (the event's onPeak), not on a clock from
// the click: a jump that started late showed the change through it, the
// light page's body with it. The clock is for a jump that never says.
//
// `hold`: the place behind it keeps the jump's tunnel until it has drawn
// (the galaxy: hyperspace3d/timeline.js's handJump, let go by
// galaxy/GalaxyView.jsx). The hold is taken as the page changes, not at
// the click, so its limit runs from the change, and it always belongs to
// the page that will let it go: one taken at the click had no owner when
// the visitor left for another page first, and held a dark tunnel over
// that page for the rest of its eight seconds.
//
// The clock for a jump that never says runs from the jump's first frame
// (timeline.js's onJumpStart), not from the click: a jump whose first
// frame came five seconds late had the page change three seconds into it,
// before it was dark. From the click it runs only until that frame, for a
// jump that never draws.
//
// jumpOut({ style, to, navigate, hold, delay, wait, dispatch }) → { cancel() }
// (`delay`: when to go with no jump to say, its plan's; `cancel`: the page
// has gone before its own change, so nothing more happens.)

import { handJump, onJumpStart } from '../hyperspace3d/timeline';
import { jumpEvent } from './styles';

// ms at most a jump out waits for the jump's dark before the page goes
// anyway: long, since a jump reaches its flash 1.17 s in on its own clock,
// which a slow machine runs slower than the wall's; only a jump that never
// says waits it out
export const JUMP_WAIT = 8000;

export function jumpOut({ style, to, navigate, hold = false, delay = 0, wait = JUMP_WAIT, dispatch = (e) => window.dispatchEvent(e) }) {
  let over = false;
  let timer = 0;
  let unhear = () => {};
  const end = () => {
    over = true;
    clearTimeout(timer);
    unhear();
  };
  const go = () => {
    if (over) return;
    end();
    if (hold) handJump();
    navigate(to);
  };
  const e = jumpEvent(style, { onPeak: go });
  dispatch(e);
  if (over) return { cancel: end };
  timer = setTimeout(go, e.detail.taken ? wait : delay);
  if (e.detail.taken) {
    unhear = onJumpStart(() => {
      unhear();
      clearTimeout(timer);
      timer = setTimeout(go, wait);
    });
  }
  return { cancel: end };
}
