import { useRef } from 'react';
import { stickRead } from './hud';

// The touch stick, 116 px with a 46 px knob (./hud.js STICK): it reads from
// where the thumb went down, one finger at a time (a second finger landing
// on it, or lifting off it, leaves the first in charge). `onMove(x, y)`
// gets each axis -1..1 (y down), and (0, 0) when the thumb lifts; `onStart`
// runs on the first touch (a world wakes its sound there: iOS wants it in
// the touch's own event). The knob is moved here, not by a re-render.
export default function Stick({ onMove, onStart = null, className = '', label = 'Move' }) {
  const drag = useRef(null);
  const knob = useRef(null);
  const down = (e) => {
    if (drag.current) return;
    onStart?.(e);
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const move = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const r = stickRead(d.x, d.y, e.clientX, e.clientY);
    onMove(r.x, r.y);
    if (knob.current) knob.current.style.transform = `translate(${r.knob[0]}px, ${r.knob[1]}px)`;
  };
  const up = (e) => {
    if (drag.current?.id !== e.pointerId) return;
    drag.current = null;
    onMove(0, 0);
    if (knob.current) knob.current.style.transform = '';
  };
  return (
    <div className={`hud-stick ${className}`.trim()} role="presentation" aria-label={label} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up} onContextMenu={(e) => e.preventDefault()}>
      <span ref={knob} />
    </div>
  );
}
