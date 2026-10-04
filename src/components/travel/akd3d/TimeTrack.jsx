import { useEffect, useRef, useState } from 'react';
import { CUT_MS, clockAt, easeOut, settleEase, settleMs, valueText } from './day';
import './akd3d.css';

// The day as a line under the photo: a tick for each photo, a sun (☉) for
// where the photo on screen sits in the day, and the clock beside it. It is a
// native range input underneath, so the keyboard, screen readers and touch
// all work: dragging scrubs through the day (the photo follows, part way
// between two stops), letting go settles on the nearest photo, a click on
// the line jumps there, and the arrow keys step photo to photo. The sun
// glides with each cut; while the day plays, the line ahead of it fills
// toward the next photo.
export default function TimeTrack({ day, index, playing, still, stepMs, onScrub, onPick }) {
  const n = day.length;
  const max = Math.max(1, n - 1);
  const [drag, setDrag] = useState(null); // the position while dragging
  const [sun, setSun] = useState(index); // where the sun is drawn
  const sunAt = useRef(index);
  sunAt.current = sun;
  const input = useRef(null);
  const grab = useRef(null); // { x, moved, v } from pointer down to up
  const settling = useRef(false);
  const latest = useRef(null);
  latest.current = { index, onScrub, onPick };

  // the sun glides to a new stop with the photo (or settles after a drag)
  useEffect(() => {
    if (drag != null) return undefined;
    const from = sunAt.current;
    const after = settling.current;
    settling.current = false;
    if (still || from === index) {
      setSun(index);
      return undefined;
    }
    const dur = after ? settleMs(index - from) : CUT_MS;
    const ease = after ? settleEase : easeOut;
    const start = performance.now();
    let raf = 0;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      setSun(from + (index - from) * ease(t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [index, drag, still]);

  const scrub = (v) => {
    setDrag(v);
    setSun(v);
    latest.current.onScrub(v);
    const k = Math.round(v);
    if (k !== latest.current.index) latest.current.onPick(k);
  };

  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // fine steps before the browser moves the value, so the drag isn't
    // snapped to whole stops
    e.currentTarget.step = 'any';
    grab.current = { x: e.clientX, moved: false, v: null };
    // a few pixels of travel before it counts as a drag, so a click on the
    // line is a jump (with a proper cut), not a scrub
    const move = (ev) => {
      const g = grab.current;
      if (!g || g.moved || Math.abs(ev.clientX - g.x) < 4) return;
      g.moved = true;
      if (g.v != null) scrub(g.v);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      const g = grab.current;
      grab.current = null;
      if (input.current) input.current.step = '1';
      if (!g || g.v == null) return;
      const k = Math.round(g.v);
      if (g.moved) settling.current = true;
      if (k !== latest.current.index) latest.current.onPick(k);
      if (g.moved) {
        latest.current.onScrub(null);
        setDrag(null);
      }
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const onChange = (e) => {
    const v = Number(e.target.value);
    const g = grab.current;
    if (g) {
      g.v = v;
      if (g.moved) scrub(v);
      return;
    }
    // the keyboard: whole stops
    const k = Math.round(v);
    if (k !== index) onPick(k);
  };

  const shown = drag ?? sun;
  const { time, label } = clockAt(day, shown);
  return (
    <div className="akd-track">
      <p className="akd-clock" aria-hidden="true">
        {time && (
          <>
            <span className="akd-clock-time">{time}</span>
            {' · '}
          </>
        )}
        {label}
      </p>
      <div className="akd-rail">
        <input
          ref={input}
          type="range"
          className="akd-range"
          min={0}
          max={max}
          step={drag != null ? 'any' : 1}
          value={drag ?? index}
          aria-label="Time of day"
          aria-valuetext={valueText(day, drag ?? index)}
          onPointerDown={onPointerDown}
          onChange={onChange}
        />
        <div className="akd-rail-draw" aria-hidden="true" style={{ '--t': shown / max }}>
          <span className="akd-line" />
          <span className="akd-line-past" />
          {playing && !still && drag == null && index < n - 1 && (
            <span key={index} className="akd-wait" style={{ '--from': index / max, '--to': (index + 1) / max, '--delay': `${CUT_MS}ms`, '--d': `${Math.max(0, stepMs - CUT_MS)}ms` }} />
          )}
          {day.map((d, k) => (
            <span key={d.id} className="akd-tick" style={{ '--k': k / max }} data-past={k <= shown + 0.001 || undefined} />
          ))}
          <span className="akd-sun" />
        </div>
      </div>
    </div>
  );
}
