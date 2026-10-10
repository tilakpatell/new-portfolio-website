// The crosshair, at the middle of the view: four ticks that close in with
// the sights (`tight`, 0…1), a flash on a hit, a ring while locked on. Its
// state comes from ./reticle.js's reticleState. Drawn, not written (nothing
// to read under 0.7 rem), and pointer-events none so a click goes through
// to the canvas. A world skins it by colour through --hud-ink, --hud-accent
// and --hud-bad, as with the rest of the kit.
export default function Reticle({ state, className = '' }) {
  if (!state?.shown) return null;
  return (
    <div className={`hud-reticle ${className}`.trim()} style={{ '--tight': state.tight ?? 0 }} data-hit={state.hit != null || undefined} data-locked={state.locked || undefined} aria-hidden="true">
      <i data-at="t" />
      <i data-at="r" />
      <i data-at="b" />
      <i data-at="l" />
      <b />
    </div>
  );
}
