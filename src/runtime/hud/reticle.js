// The reticle's rules (./Reticle.jsx draws them): shown whenever a gun is up
// or the sights are on, so a hip shot is never blind; tight with the sights;
// a hit flashes it for HIT_MS; a lock-on rings it. `hit` is how long ago the
// hit was, in ms, while it still shows. The same object comes back when
// nothing changed, so a frame loop can call it every frame and render only
// on a change.
export const HIT_MS = 180;

export function reticleState(prev, { gun = false, sights = false, hitAt = null, now = 0, lock = null } = {}) {
  const ago = hitAt == null ? null : now - hitAt;
  const next = {
    shown: Boolean(gun || sights),
    tight: sights ? 1 : 0,
    hit: ago != null && ago >= 0 && ago < HIT_MS ? ago : null,
    locked: Boolean(lock),
  };
  if (prev && prev.shown === next.shown && prev.tight === next.tight && prev.hit === next.hit && prev.locked === next.locked) return prev;
  return next;
}
