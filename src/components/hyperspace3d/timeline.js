// The jump's timeline in ms, shared by the 2D and 3D versions so either can
// stand in for the other without App noticing (see Hyperspace.jsx).
export const T = { drift: 450, jump: 1150, flash: 1300, tunnel: 1950, end: 2450 };

export const ease = (t) => t * t * (3 - 2 * t);
export const clamp = (t) => Math.max(0, Math.min(1, t));

// How fast the ship is going: a slow drift, a hard acceleration, cruise in
// the tunnel, then a quick stop. The same curve as the 2D version.
export function speedAt(t) {
  if (t < T.drift) return 0.12 + 0.25 * (t / T.drift);
  if (t < T.jump) return 0.37 + 9 * Math.pow((t - T.drift) / (T.jump - T.drift), 2.6);
  if (t < T.tunnel) return 6.5;
  return 6.5 * Math.pow(1 - clamp((t - T.tunnel) / (T.end - T.tunnel)), 3);
}

// How long the eye holds a star's light (its streak), in seconds of travel:
// a dot at first, snapping long at the jump, shrinking back on the exit.
export function exposureAt(t) {
  let s;
  if (t < T.drift) s = 1;
  else if (t < T.jump) s = 1 + 26 * ease(clamp((t - T.drift) / (T.jump - T.drift)));
  else if (t < T.tunnel) s = 18;
  else s = 1 + 17 * Math.pow(1 - clamp((t - T.tunnel) / (T.end - T.tunnel)), 2);
  return s * 0.016;
}

// How dark the view is: the page darkens, the tunnel is fully dark, then it clears.
export const darkAt = (t) => (t < T.drift ? ease(t / T.drift) * 0.92 : t < T.tunnel ? 1 : 1 - ease(clamp((t - T.tunnel) / (T.end - T.tunnel))));

// The white flash on entry: up fast, then away by the end of the flash.
export function flashAt(t) {
  if (t <= T.jump - 60 || t >= T.flash + 60) return 0;
  if (t < T.jump + 40) return clamp((t - (T.jump - 60)) / 100);
  return 1 - ease(clamp((t - (T.jump + 40)) / (T.flash + 60 - (T.jump + 40))));
}

// A jump held in its tunnel: the galaxy (galaxy/scene.js) jumps between
// star systems through this same jump, and the next system is built behind
// it, so it holds the tunnel until that's done and the light-years are
// flown (or the Empire's Interdictor pulls it out short), then lets it go on
// to its exit. holdJump(most) → let go (call it once; again is harmless):
// held all the while any hold is, and let go on its own after `most` ms so
// the screen is never stuck (long: the galaxy lets go itself once out, or six
// seconds past the tunnel's length at the latest, on its own clock, which on
// a slow machine runs slower than the wall's). holdStart(now, start) → the start a running
// jump's clock should have now: past HOLD_AT (in the tunnel, after the
// flash) while held, it stays there.
export const HOLD_AT = T.tunnel - 150;
let holds = 0;
export const jumpHeld = () => holds > 0;
export function holdJump(most = 60000) {
  holds++;
  let held = true;
  const timer = setTimeout(() => letGo(), most);
  function letGo() {
    if (!held) return;
    held = false;
    clearTimeout(timer);
    holds--;
  }
  return letGo;
}
export const holdStart = (now, start) => (holds > 0 && now - start > HOLD_AT ? now - HOLD_AT : start);
