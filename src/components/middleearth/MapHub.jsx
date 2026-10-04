import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAchievements } from '../Achievements';
import WorldSwitcher from '../worlds/WorldSwitcher';
import { CHAPTERS } from './chapters';

// how far from a place on the sheet (800 across) a click still means it
const REACH = 75;

// A wax seal, for a place whose trials are won.
function Seal({ title }) {
  return (
    <svg viewBox="-12 -12 24 24" className="me-seal" role="img" aria-label={title}>
      <path d="M0 -10.5 C3 -11 5 -9 7.4 -7.4 C9.6 -5.5 11 -3 10.6 0.4 C10.9 3.6 9 6 6.8 8 C4.4 10 2 11 -0.6 10.6 C-3.7 11 -6 9.5 -8 7.4 C-10 5.2 -11 2.6 -10.6 -0.6 C-10.8 -3.8 -9 -6.4 -6.8 -8.2 C-4.6 -10 -2.6 -10.8 0 -10.5 Z" />
      <circle r="6.6" className="me-seal-ring" />
      <path d="M-3.4 -2.4 L0 3.6 L3.4 -2.4 M-1.8 -2.4 L0 0.8 L1.8 -2.4" className="me-seal-mark" />
    </svg>
  );
}

// The places on the map, as buttons that sit on the map wherever the camera
// puts them (`api.current.project`), and the same places as a list along
// the road, for the keyboard and for small screens. `onFrame` is handed to
// the map so the markers move with it.
export default function MapHub({ api, hover, onHover, onGo, leaving, hidden, frameRef }) {
  const { unlocked } = useAchievements();
  const pins = useRef({});

  const place = useCallback(() => {
    const a = api.current;
    if (!a?.project) return;
    for (const c of CHAPTERS) {
      const el = pins.current[c.id];
      if (!el) continue;
      const p = a.project(...c.at);
      el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
      el.style.visibility = p.on ? '' : 'hidden';
    }
  }, [api]);

  useEffect(() => {
    frameRef.current = place;
    place();
    const t = setInterval(place, 500); // until the map is up, and after a resize
    window.addEventListener('resize', place);
    return () => {
      frameRef.current = null;
      clearInterval(t);
      window.removeEventListener('resize', place);
    };
  }, [place, frameRef]);

  // The map itself is clickable, not just the pins: whichever place is
  // nearest the pointer (within a reach of the sheet) lights up, and a click
  // goes there.
  const nearest = (e) => {
    const p = api.current?.unproject?.(e.clientX, e.clientY);
    if (!p) return null;
    let best = null;
    let d = REACH;
    for (const c of CHAPTERS) {
      const k = Math.hypot(c.at[0] - p.x, c.at[1] - p.y);
      if (k < d) {
        d = k;
        best = c.id;
      }
    }
    return best;
  };
  const [area, setArea] = useState(null);

  const won = (c) => c.seals.length > 0 && c.seals.every((s) => unlocked.includes(s));

  return (
    <div className="me-hub" data-leaving={leaving || undefined} data-hidden={hidden || undefined}>
      {/* the map's areas, for the pointer; the pins below are the same places for the keyboard */}
      <div
        className="me-areas"
        data-area={area || undefined}
        aria-hidden="true"
        onPointerMove={(e) => {
          const id = nearest(e);
          if (id !== area) {
            setArea(id);
            onHover(id);
          }
        }}
        onPointerLeave={() => {
          setArea(null);
          onHover(null);
        }}
        onClick={(e) => {
          const id = nearest(e);
          if (id) onGo(id);
        }}
      />
      <div className="me-pins" role="group" aria-label="Places on the map">
        {CHAPTERS.map((c, i) => (
          <button
            key={c.id}
            ref={(el) => {
              pins.current[c.id] = el;
            }}
            type="button"
            className="me-pin"
            data-place={c.id}
            data-hover={hover === c.id || undefined}
            data-won={won(c) || undefined}
            style={{ '--i': i }}
            onPointerEnter={() => onHover(c.id)}
            onPointerLeave={() => onHover(null)}
            onFocus={() => onHover(c.id)}
            onBlur={() => onHover(null)}
            onClick={() => onGo(c.id)}
            aria-label={`${c.name}: ${c.title}`}
          >
            <span className="me-pin-dot" aria-hidden="true" />
            <span className="me-pin-label" aria-hidden="true">
              <b>{c.name}</b>
              <em>{c.title}</em>
              <small>{c.blurb}</small>
            </span>
            {won(c) && <Seal title={`${c.name}: won`} />}
          </button>
        ))}
      </div>

      <div className="me-hub-head shell">
        <p className="eyebrow">Middle-earth · The Third Age</p>
        <h1 id="me-title" className="display me-hub-title">
          Where will you go?
        </h1>
        <p className="me-hub-lead">The map of the Ring’s road. Pick a place on it, and go there.</p>
      </div>

      <nav className="me-hub-foot shell" aria-label="The road">
        <ol className="me-route">
          {CHAPTERS.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => onGo(c.id)} onPointerEnter={() => onHover(c.id)} onPointerLeave={() => onHover(null)} data-won={won(c) || undefined}>
                {c.name}
              </button>
            </li>
          ))}
        </ol>
        <div className="me-hub-links">
          <WorldSwitcher />
          <Link to="/" className="btn btn-ghost btn-sm">
            Back to the site
          </Link>
        </div>
      </nav>
    </div>
  );
}
