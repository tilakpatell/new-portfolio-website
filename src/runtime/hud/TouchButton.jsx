// A round touch button in one of two sizes: 64 px for an action, 52 px for a
// secondary one. `onPress` on the touch's own event (so a sound can wake
// there); `onRelease` when it lifts or is lost, for a button that's held.
// No long-press menu, no scroll under the thumb: once, here, for every world.
export default function TouchButton({ size = 64, onPress, onRelease = null, className = '', children, ...rest }) {
  const release = onRelease ?? undefined;
  return (
    <button
      type="button"
      className={`hud-touch-btn ${className}`.trim()}
      data-size={size === 52 ? 'small' : undefined}
      onPointerDown={(e) => {
        onPress?.(e);
        if (onRelease) e.currentTarget.setPointerCapture?.(e.pointerId);
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
