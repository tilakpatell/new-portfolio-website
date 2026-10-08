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

// How far the tunnel's streaks have wound, dt s on at t ms in: on through
// the tunnel, but not while the jump is held there. Each turn wraps the
// streaks further round and covers more of the screen, so a tunnel held
// for the galaxy for seconds kept brightening (its mean light 81 to 140 out
// of 255 from two to seven seconds held), and its exit then dropped it at once.
export const swirlOn = (swirl, t, dt) => (t >= T.flash && t < T.tunnel && holds === 0 ? swirl + dt * 0.9 : swirl);

// A hold one page takes and the next lets go: the universe map's jump into
// the galaxy holds the tunnel until the galaxy has drawn its first frame,
// so the jump clears onto the galaxy and not onto its loading line. It's
// taken as the page changes (jumps/jumpOut.js), and galaxy/GalaxyView.jsx
// lets it go then, or as soon as the galaxy won't draw, or when its page
// goes; it lets go on its own after `most` ms if nothing does. handJump(most) holds it (a second takes the
// place of the first); letHandedGo() lets it go, harmless with none held.
let handed = null;
export function handJump(most = 8000) {
  handed?.();
  handed = holdJump(most);
}
export function letHandedGo() {
  const go = handed;
  handed = null;
  go?.();
}

// A jump's first frame, drawn: each version calls jumpStarted() as it
// draws it, and onJumpStart(fn) → undo hears it. A page waiting on a
// jump's dark times its fallback from there (jumps/jumpOut.js): timed from
// the click, a jump slow to start (its first frame five seconds late in a
// slow browser) had the page change before it was dark.
const starts = new Set();
export function onJumpStart(fn) {
  starts.add(fn);
  return () => starts.delete(fn);
}
export function jumpStarted() {
  for (const fn of [...starts]) fn();
}

// A running jump's start, so a stall (a frame more than STALL ms after the
// last, where lib/three/pace stops judging frames too) moves its clock on
// by `most` ms only: starved of frames (the page busy building what comes
// next), a jump on the wall's clock skipped its tunnel and cleared out at
// once; this way it waits where it was. Slower frames than that keep the
// wall's time: clamped at 50 ms, every jump below 20 frames a second
// played in slow motion, and its sound, on the wall's clock, landed its
// boom well before the flash. (A long stall can still put it a little off.)
export const STALL = 250;
export const clampStart = (start, lastNow, now, most = 50) => (now - lastNow > STALL ? start + (now - lastNow - most) : start);

// Whether a jump is at its peak, t ms in: under its flash, or anywhere in
// its tunnel after that (where a held jump waits), so a clock moving on
// whole frames up to a stall can't step over it. Not at the tunnel's end,
// where the intro skips to.
export const atPeak = (t) => t >= T.jump + 20 && t < T.tunnel;
