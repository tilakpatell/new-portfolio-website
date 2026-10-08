import { forwardRef, useEffect } from 'react';
import { sayVoiced } from '../../lib/voiced';

// Who's talking, over their head: a world's frame loop moves it (through
// the ref) to the speaker's screen position; it points down at them. In
// their own voice where it's been made (`voice`: their id in lib/voiced.js):
// a new line, or the bubble going, stops it, and nothing else.
// (Moved here from the towns' HUD, where fourteen worlds shared it.)
const Bubble = forwardRef(function Bubble({ voice = null, name, line, className = '' }, ref) {
  useOwnLine(voice, line);
  return (
    <div ref={ref} className={`hud-bubble ${className}`.trim()} aria-live="polite">
      <div>
        <b>{name}</b>
        <span>{line}</span>
      </div>
    </div>
  );
});
export default Bubble;

function useOwnLine(who, text) {
  useEffect(() => {
    if (!who || !text) return undefined;
    let gone = false;
    let said = null;
    sayVoiced(who, text).then((h) => {
      said = h;
      if (gone) h?.stop();
    });
    return () => {
      gone = true;
      said?.stop();
    };
  }, [who, text]);
}
