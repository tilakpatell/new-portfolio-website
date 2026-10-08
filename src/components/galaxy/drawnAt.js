// What the galaxy sizes in screen pixels (the sky's stars and beacons, the
// dust, the planets' point layers: gl_PointSize, counted in the pixels of
// whatever they're drawn into) follows the pixel ratio the scene is drawn
// at: the post chain's (universe/post.js's `ratio`). The runtime's quality
// softens that a step at a time over a canvas that keeps its size
// (module.js's `sharpness: 'own'`), so the canvas's own ratio no longer changes. Sized
// by it, the points came out bigger on screen at each step: 1.39x at
// level 2, 2x at the floor.
//
// followRatio(post, apply) → follow() → the ratio now (apply(ratio) the
// first time, and again whenever it has moved since)

export function followRatio(post, apply) {
  let seen = null;
  return () => {
    const r = post.ratio;
    if (r !== seen) {
      seen = r;
      apply(r);
    }
    return r;
  };
}
