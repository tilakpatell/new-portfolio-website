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
// jumpOut({ style, to, navigate, hold, delay, wait, dispatch }) → { cancel() }
// (`delay`: when to go with no jump to say, its plan's; `cancel`: the page
// has gone before its own change, so nothing more happens.)

import { handJump } from '../hyperspace3d/timeline';
import { jumpEvent } from './styles';

// ms at most a jump out waits for the jump's dark before the page goes
// anyway: long, since a jump slow to start (its first frame waits for its
// shaders, after whatever the page was busy with) still says so well before
// it; only a jump that never comes waits it out
export const JUMP_WAIT = 8000;

export function jumpOut({ style, to, navigate, hold = false, delay = 0, wait = JUMP_WAIT, dispatch = (e) => window.dispatchEvent(e) }) {
  let over = false;
  let timer = 0;
  const go = () => {
    if (over) return;
    over = true;
    clearTimeout(timer);
    if (hold) handJump();
    navigate(to);
  };
  const e = jumpEvent(style, { onPeak: go });
  dispatch(e);
  if (!over) timer = setTimeout(go, e.detail.taken ? wait : delay);
  return {
    cancel() {
      over = true;
      clearTimeout(timer);
    },
  };
}
