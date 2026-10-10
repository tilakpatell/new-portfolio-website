// The galaxy surface's look (runtime/look.js), beside scene.js, which is past
// its size: a click locks the pointer and the mouse or the trackpad turns the
// camera, Esc lets go; a drag where the lock's refused or Drag is picked in
// the Menu; a phone keeps the page's look pad. Its buttons are F and C's:
// left a shot or a stroke (held, the heavy one), right the sights with a gun
// or the block with a saber. The page hears a 'look' event when the mode or
// the lock changes (its prompt and its Menu read it).
//
//   surfaceLook({ canvas, state, me, wake, turn, emit, invalidate })
//     → createLook's controller, plus send() (the 'look' event if changed)

import { createLook } from '../../../runtime/look';

// What a button does to scene.js's state: the same flags F, C and the touch
// buttons set, so the frame finds them where it always has. Pure but for
// `state`, for the test.
export function pressLook(state, saber, which, down) {
  if (which === 2 && !saber) state.ads = down;
  else if (which === 2) {
    state.buttons.block = down;
    if (down) state.blockAt = state.t;
  } else {
    // (a click can come down and up in one go, a drag-mode tap: the shot is
    // queued, and a saber's press noted, for the frame to find; the stroke
    // goes on the release, the touch Swing's path)
    state.buttons.fire = down;
    if (down && saber) {
      state.pressAt = state.t;
      state.touchPress = true;
    } else if (down) state.fireQueued = true;
  }
}

export function surfaceLook({ canvas, state, me, wake, turn, emit, invalidate, mode = null }) {
  let sent = '';
  const looker = createLook({
    host: canvas,
    mode,
    onTurn: turn,
    onButton(which, down) {
      if (down) wake();
      pressLook(state, Boolean(me().saber), which, down);
      invalidate();
    },
    onLock: () => send(),
  });
  function send() {
    const now = `${looker.mode}:${looker.locked}`;
    if (now === sent) return;
    sent = now;
    emit({ type: 'look', mode: looker.mode, locked: looker.locked, prompt: looker.prompt });
  }
  looker.attach();
  return Object.assign(looker, { send });
}
