// One chain of animation frames, however often it's asked for.
//
// A scene asks for frames (kick) from anywhere, including from inside a frame
// it's drawing: a shot fired with the trigger held, a part easing in. A kick
// then must not start a second chain beside the one that's drawing (each
// would draw the whole scene again, every frame, from then on: hold the
// trigger for a few seconds and a dozen chains are drawing the same frame).
// So a kick while drawing is only noted, and the frame that's drawing asks
// for its next one once, whatever it returns.
//
// createLoop(step, { raf, caf, can }) → { kick(), stop(), running }
// step(now) → true for another frame; can() → whether a frame may be asked for.

export function createLoop(step, { raf = (f) => requestAnimationFrame(f), caf = (id) => cancelAnimationFrame(id), can = () => true } = {}) {
  let id = 0;
  let drawing = false;
  let again = false;
  const frame = (now) => {
    id = 0;
    drawing = true;
    again = false;
    let more = false;
    try {
      more = step(now);
    } finally {
      drawing = false;
    }
    if ((more || again) && !id && can()) id = raf(frame);
    again = false;
  };
  return {
    kick() {
      if (drawing) again = true;
      else if (!id && can()) id = raf(frame);
    },
    stop() {
      if (id) caf(id);
      id = 0;
      again = false;
    },
    get running() {
      return id !== 0 || drawing;
    },
  };
}
