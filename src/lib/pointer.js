// Keep a press on the element it started on, so a finger that drifts off a
// hold button doesn't let go of it. The browser throws if that pointer has
// already lifted (a very quick tap, or a pen leaving range), so it's guarded.
export function capturePointer(e, el = e.currentTarget) {
  try {
    el?.setPointerCapture?.(e.pointerId);
  } catch {
    /* the pointer is already gone; the press still counts */
  }
}
