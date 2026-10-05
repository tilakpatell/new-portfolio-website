// `promise`, or nothing after `ms`, whichever comes first, and never a
// failure: for waiting on something that only makes things nicer (a 3D
// scene's shaders compiling before its first frame) without ever hanging on
// it. No three.js here, so the pages' own code can use it.
export const settle = (promise, ms = 4000) =>
  new Promise((resolve) => {
    if (!promise) return resolve();
    const t = setTimeout(resolve, ms);
    Promise.resolve(promise)
      .catch(() => {})
      .then(() => {
        clearTimeout(t);
        resolve();
      });
  });

// Several things made at once, all of them or none: their values, in
// order, each one noted in `made` as it comes; if any fails, the first
// failure, once every one has finished, so the caller can undo what was
// made (a 3D world whose rooms load but whose cast doesn't).
export async function allOrUndo(promises, made) {
  const done = await Promise.allSettled(promises);
  for (const d of done) if (d.status === 'fulfilled') made.push(d.value);
  const bad = done.find((d) => d.status === 'rejected');
  if (bad) throw bad.reason;
  return done.map((d) => d.value);
}
