import { useEffect, useRef, useState } from 'react';
import { RiArrowLeftLine } from 'react-icons/ri';
import Gif from '../Gif';
import { PARTS } from './parts';

// The stolen plans: a cutaway of the station. Every numbered part opens what
// happened there in the film. The numbers sit in a layer the same size as the
// drawing, and the details open beside it (below it on a phone), so nothing on
// the blueprint moves when you open one.

const C = 200; // centre of the 400×400 drawing
const R = 168;

function Blueprint() {
  return (
    <svg viewBox="0 0 400 400" className="block h-auto w-full" aria-hidden="true">
      <defs>
        <pattern id="bp-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" fill="none" stroke="rgba(120,170,255,0.12)" strokeWidth="1" />
        </pattern>
        <clipPath id="bp-inside">
          <circle cx={C} cy={C} r={R} />
        </clipPath>
      </defs>
      <rect width="400" height="400" fill="url(#bp-grid)" />
      <g fill="none" stroke="rgba(150,195,255,0.8)" strokeWidth="1.2">
        {/* decks, seen in section */}
        <g clipPath="url(#bp-inside)" strokeWidth="0.8" opacity="0.22">
          {Array.from({ length: 27 }, (_, i) => (
            <path key={i} d={`M0 ${C - R + 12 * i} H400`} />
          ))}
        </g>
        <circle cx={C} cy={C} r={R} strokeWidth="1.6" />
        {/* the equatorial trench, all the way round */}
        <path d={`M${C - R} ${C - 4} H${C + R} M${C - R} ${C + 4} H${C + R}`} />
        <ellipse cx={C} cy={C} rx={R} ry="22" strokeDasharray="4 4" opacity="0.5" />
        {/* the superlaser dish and its tributary beams */}
        <circle cx="138" cy="136" r="34" />
        <circle cx="138" cy="136" r="20" opacity="0.6" />
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return <path key={i} d={`M${138 + Math.cos(a) * 34} ${136 + Math.sin(a) * 34} L118 116`} opacity="0.45" />;
        })}
        <path d="M138 136 L200 200" strokeDasharray="5 4" opacity="0.7" />
        {/* the hypermatter reactor at the core */}
        <circle cx={C} cy={C} r="26" />
        <circle cx={C} cy={C} r="14" opacity="0.6" />
        <circle cx={C} cy={C} r="5" fill="rgba(255,179,71,0.85)" stroke="none" />
        {/* the exhaust shaft: straight down to the reactor */}
        <path d="M286 58 L214 182" stroke="#ffb347" strokeDasharray="3 3" opacity="0.9" />
        <path d="M280 54 h12" stroke="#ffb347" />
        {/* tractor beam power coupling, in its deep shaft */}
        <path d="M120 236 V286 M112 286 H128 M114 262 h12" />
        {/* docking bay 327 */}
        <path d="M290 228 h34 v20 h-34 z" />
        <path d="M296 238 h22" opacity="0.5" />
        {/* detention block cells */}
        <path d="M70 168 h32 v18 h-32 z M78 168 v18 M86 168 v18 M94 168 v18" />
        {/* trash compactor, walls closing in */}
        <path d="M156 308 h28 v20 h-28 z M162 312 v12 M178 312 v12" />
        {/* conference room and its table */}
        <rect x="238" y="114" width="28" height="20" rx="3" />
        <ellipse cx="252" cy="124" rx="8" ry="3" opacity="0.6" />
      </g>
    </svg>
  );
}

function PartDetails({ part, onBack, onAction }) {
  const back = useRef(null);
  useEffect(() => {
    back.current?.focus({ preventScroll: true });
  }, [part.id]);
  return (
    <div className="readout-panel" aria-labelledby="readout-part-title">
      <button ref={back} type="button" className="readout-back" onClick={onBack}>
        <RiArrowLeftLine className="h-4 w-4" aria-hidden="true" /> All parts
      </button>
      <p className="aurebesh mt-4 text-xl text-ink" aria-hidden="true">
        {part.name}
      </p>
      <h3 id="readout-part-title" className="stretch-semi mt-1 text-2xl font-semibold text-ink">
        {part.name}
      </h3>
      <p className="mt-2 text-[0.95rem] leading-relaxed text-body">{part.text}</p>
      {part.gif && <Gif key={part.gif} name={part.gif} size="medium" eager className="mt-4" />}
      <figure className="mt-4">
        <blockquote className="text-lg text-ink">“{part.quote[0]}”</blockquote>
        <figcaption className="mt-1 text-sm text-muted">{part.quote[1]}</figcaption>
      </figure>
      {part.action && (
        <button type="button" className="btn btn-primary btn-sm mt-5" onClick={() => onAction(part.action)}>
          {part.action === 'fire' ? 'Fire the superlaser' : 'Fly the trench run'}
        </button>
      )}
    </div>
  );
}

export default function Readout({ onAction }) {
  const [open, setOpen] = useState(null);
  const side = useRef(null);
  const part = PARTS.find((p) => p.id === open);

  // On a phone the details open below the drawing: bring them into view.
  const choose = (id) => {
    setOpen((cur) => (cur === id ? null : id));
    requestAnimationFrame(() => {
      const el = side.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.top > window.innerHeight - 120) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  return (
    <section id="readout" className="shell relative z-10 scroll-mt-24 py-16 md:py-24" aria-labelledby="readout-title">
      <h2 id="readout-title" className="title">
        Technical readout
      </h2>
      <p className="lead mt-4 max-w-[52ch]">The plans, recovered. Open any numbered part to see inside the station.</p>
      <div className="mt-10 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="readout-drawing">
          <Blueprint />
          <div className="readout-marks" role="group" aria-label="Parts of the station">
            {PARTS.map((p, i) => (
              <button
                key={p.id}
                type="button"
                className="readout-mark"
                style={{ left: `${(p.bx / 400) * 100}%`, top: `${(p.by / 400) * 100}%` }}
                aria-pressed={open === p.id}
                aria-label={`${i + 1}. ${p.name}`}
                onClick={() => choose(p.id)}
              >
                <span aria-hidden="true">{i + 1}</span>
              </button>
            ))}
          </div>
        </div>
        <div ref={side} className="scroll-mt-24">
          {part ? (
            <PartDetails part={part} onBack={() => setOpen(null)} onAction={onAction} />
          ) : (
            <ol className="readout-list">
              {PARTS.map((p, i) => (
                <li key={p.id}>
                  <button type="button" className="readout-item" onClick={() => choose(p.id)}>
                    <span className="readout-num-chip" aria-hidden="true">
                      {i + 1}
                    </span>
                    <span className="min-w-0">
                      {/* the English name follows, so the Aurebesh is decoration */}
                      <span className="aurebesh block text-lg text-ink" aria-hidden="true">
                        {p.name}
                      </span>
                      <span className="mt-0.5 block text-sm text-muted">{p.name}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}
