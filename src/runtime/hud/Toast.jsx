// One line that comes and goes: top centre, under the HUD's top row (at
// --hud-under), clear of the prompt at the foot and of the site's own
// toasts. `toast`: { key, text, bad } (a new key shows it again); `bad` for
// the red one.
export default function Toast({ toast, className = '' }) {
  if (!toast?.text) return null;
  return (
    <p key={toast.key} className={`hud-toast ${className}`.trim()} role="status" data-bad={toast.bad || undefined}>
      {toast.text}
    </p>
  );
}
