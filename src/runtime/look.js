// The look: how a pointer turns a world's camera. A world hands it the
// canvas and three callbacks and gets back one controller for a mouse, a
// trackpad and a phone alike:
//
//   createLook({ host, win, onTurn(dx, dy), onButton(which, down), onLock(on),
//                sensitivity, drag, mode, active }) → { attach, detach,
//                request, release, locked, refused, mode, set(mode), prompt }
//
// `active()`: whether the look is the canvas's now (the universe's map
// shares its canvas with the walk on a planet: only on foot); while it
// isn't, nothing is asked or turned, and a lock is let go at the next move.
//
// `onTurn` takes radians (positive dx: the pointer went right, positive dy:
// down); the world decides which way that turns its camera.
//
// Modes:
//   'lock'   a click on the canvas asks for pointer lock; while locked the
//            pointer's movement turns the camera and both buttons are the
//            world's (left: the shot or the stroke, right: the sights or the
//            block). Until it's locked, or where the browser refuses it (an
//            iframe, Safari in some states), a drag still turns, so a refusal
//            costs nothing. Esc releases (the browser does it).
//   'drag'   a held button turns, as the worlds always did; a click that
//            barely moves is the left button, so a trackpad can fire.
//   'touch'  nothing: the world's own look pad or the kit's Stick turns.
//
// Pointer lock's rough edges (docs/research/2026-10-08-combat-feel-and-
// offline-motion.md, §2): `unadjustedMovement` is Chromium's alone, so a
// NotSupportedError asks again plainly; the first move after locking can
// carry the jump from where the cursor was, so it's dropped; a trackpad's
// palm or inertia can send hundreds of pixels in one event, so each is
// clamped to SPIKE; the browser won't relock straight after Esc, so a click
// within RELOCK seconds isn't spent asking; movement is read from
// `pointermove` only (`pointerrawupdate` carries it unevenly).

export const SPIKE = 60; // px: the most one event may move
export const RELOCK = 1.25; // s: the browser's cool-down after a release
export const TP_LOOK = 'tp-look'; // localStorage: the visitor's pick, 'lock' or 'drag'
export const PROMPT = 'Click to look · Esc to release';
const TAP = 6; // px: a drag-mode click that moved less than this is a click
const MODES = ['lock', 'drag', 'touch'];

// The mode a device starts in: touch on a coarse pointer whatever was kept;
// else what the visitor picked in a Menu; else drag for Safari on a Mac
// (its trackpad barely moves under lock unless a button is held), lock for
// the rest.
export function defaultMode({ coarse = false, safariNoMouse = false, kept = null } = {}) {
  if (coarse) return 'touch';
  if (kept === 'lock' || kept === 'drag') return kept;
  return safariNoMouse ? 'drag' : 'lock';
}

// What the browser says about the device, for defaultMode.
export function senseLook(win = typeof window !== 'undefined' ? window : null) {
  if (!win) return { coarse: false, safariNoMouse: false, kept: null };
  const ua = win.navigator?.userAgent ?? '';
  let kept = null;
  try {
    kept = win.localStorage?.getItem(TP_LOOK) ?? null;
  } catch {
    /* storage unavailable */
  }
  return {
    coarse: win.matchMedia?.('(pointer: coarse)').matches ?? false,
    // (a Mac's Safari, not Chrome or Firefox on it, and not an iPad: the UA
    // can't tell a mouse from a trackpad, so this assumes the trackpad)
    safariNoMouse: /Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg|Firefox/.test(ua) && !(win.navigator?.maxTouchPoints > 1),
    kept,
  };
}

const clampSpike = (v) => Math.max(-SPIKE, Math.min(SPIKE, v || 0));

export function createLook({
  host,
  win = typeof window !== 'undefined' ? window : null,
  onTurn = () => {},
  onButton = () => {},
  onLock = () => {},
  sensitivity = { yaw: 0.0022, pitch: 0.0018 },
  drag: dragSense = { yaw: 0.0055, pitch: 0.0045 },
  mode: start = null,
  active = () => true,
  now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000,
} = {}) {
  const doc = win?.document ?? null;
  let mode = MODES.includes(start) ? start : defaultMode(senseLook(win));
  let locked = false;
  let skip = false; // the next locked move is dropped
  let released = -Infinity; // when the last lock ended
  let dragging = null; // { id, x, y, sx, sy, moved }
  let refused = false; // the browser said no: a still click is the left button, as in drag
  let attached = false;

  const isLocked = () => Boolean(doc && host && doc.pointerLockElement === host);

  function request() {
    if (mode !== 'lock' || locked || !host?.requestPointerLock) return Promise.resolve(false);
    if (now() - released < RELOCK) return Promise.resolve(false);
    const ask = (opts) => {
      try {
        // (an older browser returns nothing; wrap it so both read the same)
        return Promise.resolve(opts ? host.requestPointerLock(opts) : host.requestPointerLock());
      } catch (err) {
        return Promise.reject(err);
      }
    };
    return ask({ unadjustedMovement: true })
      .catch((err) => (err?.name === 'NotSupportedError' ? ask() : Promise.reject(err)))
      .then(
        () => {
          refused = false;
          return true;
        },
        // (refused: the drag goes on turning, the prompt stays; nothing thrown)
        () => {
          refused = true;
          return false;
        },
      );
  }

  function release() {
    if (isLocked()) doc.exitPointerLock?.();
  }

  const change = () => {
    const on = isLocked();
    if (on === locked) return;
    locked = on;
    if (on) {
      skip = true;
      dragging = null;
    } else released = now();
    onLock(on);
  };
  const error = () => {
    if (locked) return;
    onLock(false);
  };

  const down = (e) => {
    if (mode === 'touch' || e.pointerType === 'touch' || !active()) return;
    if (locked) {
      if (e.button === 0 || e.button === 2) onButton(e.button, true);
      return;
    }
    if (mode === 'drag' && e.button === 2) {
      onButton(2, true);
      return;
    }
    if (e.button !== 0) return;
    dragging = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false };
    host.setPointerCapture?.(e.pointerId);
    if (mode === 'lock') request();
  };
  const move = (e) => {
    if (mode === 'touch') return;
    if (!active()) {
      dragging = null;
      release();
      return;
    }
    if (locked) {
      if (skip) {
        skip = false;
        return;
      }
      const dx = clampSpike(e.movementX);
      const dy = clampSpike(e.movementY);
      if (dx || dy) onTurn(dx * sensitivity.yaw, dy * sensitivity.pitch);
      return;
    }
    if (!dragging || e.pointerId !== dragging.id) return;
    const dx = e.clientX - dragging.x;
    const dy = e.clientY - dragging.y;
    dragging.x = e.clientX;
    dragging.y = e.clientY;
    if (Math.hypot(e.clientX - dragging.sx, e.clientY - dragging.sy) >= TAP) dragging.moved = true;
    if (dx || dy) onTurn(dx * dragSense.yaw, dy * dragSense.pitch);
  };
  const up = (e) => {
    if (mode === 'touch' || e.pointerType === 'touch') return;
    if (locked) {
      if (e.button === 0 || e.button === 2) onButton(e.button, false);
      return;
    }
    if (mode === 'drag' && e.button === 2) {
      onButton(2, false);
      return;
    }
    if (!dragging || e.pointerId !== dragging.id) return;
    const d = dragging;
    dragging = null;
    // (drag mode, or a lock the browser refused: a click that stayed put is
    // the left button, down and up)
    if ((mode === 'drag' || refused) && !d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < TAP) {
      onButton(0, true);
      onButton(0, false);
    }
  };

  function set(next) {
    if (!MODES.includes(next) || next === mode) return;
    if (next !== 'lock') release();
    mode = next;
    dragging = null;
    if (next !== 'touch') {
      try {
        win?.localStorage?.setItem(TP_LOOK, next);
      } catch {
        /* storage unavailable: kept for the visit */
      }
    }
  }

  return {
    attach() {
      if (attached || !host) return;
      attached = true;
      host.addEventListener('pointerdown', down);
      win?.addEventListener('pointermove', move);
      win?.addEventListener('pointerup', up);
      doc?.addEventListener('pointerlockchange', change);
      doc?.addEventListener('pointerlockerror', error);
      locked = isLocked();
    },
    detach() {
      if (!attached) return;
      attached = false;
      release();
      host.removeEventListener('pointerdown', down);
      win?.removeEventListener('pointermove', move);
      win?.removeEventListener('pointerup', up);
      doc?.removeEventListener('pointerlockchange', change);
      doc?.removeEventListener('pointerlockerror', error);
      locked = false;
      dragging = null;
    },
    request,
    release,
    set,
    get locked() {
      return locked;
    },
    get refused() {
      return refused;
    },
    get mode() {
      return mode;
    },
    get prompt() {
      return mode === 'lock' && !locked && active() ? PROMPT : null;
    },
  };
}
