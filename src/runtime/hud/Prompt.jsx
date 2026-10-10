// The thing you can do now: the key first, then what it does and to what
// ("E Go in · Burger Mart"), as the guide writes its rows. On touch it's the
// button itself, so it shows no key. The kit owns the order, the button and
// the place (the HUD's foot); the look is the world's: a comic pill, a
// pixel box or a card with a line under the name, through the part classes
// (.hud-prompt, -key, -verb, -thing, -sub) and the --hud-* variables.
//
// `sub`: a line under it (where it's closed, why); `closed`: it can't be
// done yet (shown, not pressable); `alt`: a second thing to do here, as a
// node (another <Prompt>); `k`: the key, the world's own (X on Dot Matrix's
// keyboard, E everywhere else). The button's data-prompt says it whole,
// key first even on touch, for the checks that read what E promises.
export default function Prompt({ k = 'E', verb = '', thing = '', sub = null, closed = false, touch = false, onClick, alt = null, className = '' }) {
  const says = `${[k, verb].filter(Boolean).join(' ')}${thing ? ` · ${thing}` : ''}`;
  const button = (
    <button type="button" className={`hud-prompt ${alt || sub ? '' : className}`.trim()} data-prompt={says} onClick={onClick} disabled={closed} onContextMenu={(e) => e.preventDefault()}>
      {!touch && k && <kbd className="hud-prompt-key">{k}</kbd>}{!touch && k && ' '}
      {verb && <span className="hud-prompt-verb">{verb}</span>}
      {verb && thing && <span className="hud-prompt-dot" aria-hidden="true"> · </span>}
      {thing && <span className="hud-prompt-thing">{thing}</span>}
    </button>
  );
  if (!alt && !sub) return button;
  return (
    <div className={`hud-prompt-card ${className}`.trim()} data-closed={closed || undefined}>
      {sub && <p className="hud-prompt-sub">{sub}</p>}
      <div className="hud-prompt-acts">
        {button}
        {alt}
      </div>
    </div>
  );
}
