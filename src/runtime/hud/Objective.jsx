import { forwardRef } from 'react';

// The objective line: what to do next, and how far (./hud.js objectiveText).
// A frame loop that changes it every frame writes the text through the ref
// (no re-render a frame); a world that sets it now and then passes `text`.
// Hidden while empty. `glyph`: the world's own mark before it (◆, ▲, ✦),
// in its accent; none by default. (With a glyph, a frame loop writes into
// the ref's .hud-objective-text child.)
const Objective = forwardRef(function Objective({ text = null, glyph = null, className = '', ...rest }, ref) {
  return (
    <p ref={glyph ? undefined : ref} className={`hud-objective ${className}`.trim()} aria-live="polite" {...rest}>
      {glyph ? (
        <>
          <span className="hud-objective-glyph" aria-hidden="true">
            {glyph}
          </span>{' '}
          <span className="hud-objective-text" ref={ref}>
            {text}
          </span>
        </>
      ) : (
        text
      )}
    </p>
  );
});
export default Objective;
