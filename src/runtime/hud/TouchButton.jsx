import { useEffect, useRef } from 'react';

// A round touch button in one of three sizes (--touch-primary 76 px, for a
// world's one main action at most; --touch-action 64; --touch-secondary 52).
// `onPress` on the touch's own event (so a sound can wake there);
// `onRelease`, once, when that finger lifts or is lost, or the button goes,
// for a button that's held. No long-press menu, no scroll under the thumb:
// once, here, for every world.
export default function TouchButton({ size = 64, onPress, onRelease = null, className = '', children, ...rest }) {
  const held = useRef(null);
  const released = useRef(onRelease);
  released.current = onRelease;
  useEffect(
    () => () => {
      if (held.current != null) released.current?.();
    },
    [],
  );
  const release = (e) => {
    if (held.current == null || e.pointerId !== held.current) return;
    held.current = null;
    released.current?.(e);
  };
  return (
    <button
      type="button"
      className={`hud-touch-btn ${className}`.trim()}
      data-size={size === 76 ? 'primary' : size === 52 ? 'small' : undefined}
      onPointerDown={(e) => {
        onPress?.(e);
        if (!onRelease || held.current != null) return;
        held.current = e.pointerId;
        e.currentTarget.setPointerCapture?.(e.pointerId);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(e) => e.preventDefault()}
      {...rest}
    >
      {children}
    </button>
  );
}
