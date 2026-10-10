// The way out of an inner place or a dialog, the same button everywhere:
// the world's own verb for it ("Get up", "Back to the concourse"), or
// "Leave" when there's none, then Esc on a keyboard. The world binds Esc
// itself (it knows what else Esc does there); this only says so. Its key is
// the house HUD cap (src/index.css), in or out of the kit's frame.
export default function Exit({ label = 'Leave', onLeave, touch = false, className = 'btn btn-ghost btn-sm' }) {
  return (
    <button type="button" className={`hud-exit ${className}`.trim()} onClick={onLeave} aria-keyshortcuts="Escape">
      {label} {!touch && <kbd className="hud-cap">Esc</kbd>}
    </button>
  );
}
