// A world's page waiting on its prepare (lib/stagePrepare, or a scene's own
// on lib/three/gpuWork) behind its loading veil, for PREPARE_WAIT at most.
// When the wait is up the prepare is told to stop (its alive() turns false,
// so it ends at its next slice and its frames are drawn again) and the page
// goes on as if it had finished. No three.js here, so pages can use it.
//
// capPrepare(run, { onProgress, alive, cap }) → Promise<void>, never rejects:
//   run(onProgress, alive) is the prepare; alive() is the page's own (the
//   world not let go) and false too once `cap` ms have passed
// showPrepared(run, { setGl, setPrep, alive, cap }) → Promise<void>: a world
//   page's whole step: gl 'preparing', the veil's progress in setPrep
//   ({ value, step }), the prepare capped, then gl 'on' (unless something
//   else, a lost context, came first)

export const PREPARE_WAIT = 30000; // ms at most a world's prepare holds back its first frame

export function capPrepare(run, { onProgress, alive = () => true, cap = PREPARE_WAIT } = {}) {
  let gaveUp = false;
  const going = () => {
    if (gaveUp) return false;
    try {
      return Boolean(alive());
    } catch {
      return false;
    }
  };
  let timer = 0;
  const work = Promise.resolve()
    .then(() => run?.((value, step) => going() && onProgress?.(value, step), going))
    .catch((err) => {
      if (import.meta.env?.DEV) console.warn('prepare failed', err);
    });
  const out = new Promise((resolve) => {
    timer = setTimeout(resolve, cap);
  });
  return Promise.race([work, out]).then(() => {
    clearTimeout(timer);
    gaveUp = true; // (one still going stops at its next slice)
  });
}

export function showPrepared(run, { setGl, setPrep, alive = () => true, cap = PREPARE_WAIT } = {}) {
  setGl('preparing');
  return capPrepare(run, { onProgress: (value, step) => setPrep?.({ value, step }), alive, cap }).then(() => {
    if (alive()) setGl((g) => (g === 'preparing' ? 'on' : g));
  });
}
