// Each place’s attention on the hub, from 0 (at rest) to 1 (looked at), so
// the places answer the pointer: the one under it, or the one being flown
// to, rises to 1; one the pointer is merely near rises to 0.6; the rest
// settle back. It rises quicker than it falls, so a pass of the pointer
// lights a place at once and lets it fade gently. Pure: the scene reads the
// values each frame and draws them however it likes.
const UP = 1 / 0.4; // per second, so rest to full in 0.4 s
const DOWN = 1 / 0.8; // per second, so full to rest in 0.8 s
const NEAR = 0.6;

export function createAttention(ids) {
  const values = Object.fromEntries(ids.map((id) => [id, 0]));
  // `instant` is for reduced motion: each place is at its target at once
  const step = (dt, { hover = null, near = null, flying = null, instant = false } = {}) => {
    for (const id of Object.keys(values)) {
      const target = id === hover || id === flying ? 1 : id === near ? NEAR : 0;
      const v = values[id];
      if (instant) values[id] = target;
      else if (v < target) values[id] = Math.min(target, v + UP * dt);
      else values[id] = Math.max(target, v - DOWN * dt);
    }
    return values;
  };
  return { values, step };
}
