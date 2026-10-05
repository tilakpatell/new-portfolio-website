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
