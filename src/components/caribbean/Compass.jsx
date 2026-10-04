import { useEffect, useRef, useState } from 'react';

// The compass that doesn't point north: it points at the thing you want
// most. Each want is something on this page; the needle finds it wherever it
// has scrolled to. Press the compass to want something else.
const WANTS = [
  { label: 'to sink the navy', target: '#tide' },
  { label: 'the gold', target: '#cb-voyage' },
  { label: 'an argument about the code', target: '#cb-code' },
  { label: 'to go home', target: '.cb-home' },
];

const TICKS = Array.from({ length: 32 }, (_, i) => i);

export default function Compass({ className = '' }) {
  const [want, setWant] = useState(0);
  const dial = useRef(null);
  const needle = useRef(null);
  const turn = useRef(0);

  useEffect(() => {
    let raf = 0;
    const point = () => {
      raf = 0;
      const el = dial.current;
      const to = document.querySelector(WANTS[want].target);
      if (!el || !to || !needle.current) return;
      const a = el.getBoundingClientRect();
      const b = to.getBoundingClientRect();
      const deg = (Math.atan2(b.top + Math.min(b.height, 240) / 2 - (a.top + a.height / 2), b.left + b.width / 2 - (a.left + a.width / 2)) * 180) / Math.PI + 90;
      // the short way round from where it points now
      turn.current += ((((deg - turn.current) % 360) + 540) % 360) - 180;
      needle.current.style.transform = `rotate(${turn.current.toFixed(1)}deg)`;
    };
    const ask = () => {
      if (!raf) raf = requestAnimationFrame(point);
    };
    point();
    window.addEventListener('scroll', ask, { passive: true });
    window.addEventListener('resize', ask);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', ask);
      window.removeEventListener('resize', ask);
    };
  }, [want]);

  return (
    <figure className={`cb-compass ${className}`}>
      <button type="button" ref={dial} className="cb-compass-dial" onClick={() => setWant((w) => (w + 1) % WANTS.length)} aria-label={`The compass points at what you want most: ${WANTS[want].label}. Press to want something else.`}>
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <defs>
            <radialGradient id="cb-brass" cx="35%" cy="28%" r="80%">
              <stop offset="0" stopColor="#f6dfa0" />
              <stop offset="0.45" stopColor="#c9983c" />
              <stop offset="1" stopColor="#6b4a14" />
            </radialGradient>
            <radialGradient id="cb-face" cx="50%" cy="45%" r="60%">
              <stop offset="0" stopColor="#f7edd2" />
              <stop offset="1" stopColor="#d9c493" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="98" fill="url(#cb-brass)" />
          <circle cx="100" cy="100" r="86" fill="#3a2a10" />
          <circle cx="100" cy="100" r="83" fill="url(#cb-face)" />
          {TICKS.map((i) => (
            <line key={i} x1="100" y1="21" x2="100" y2={i % 8 === 0 ? 36 : i % 4 === 0 ? 31 : 26} stroke="#4a3716" strokeWidth={i % 8 === 0 ? 2 : 1} transform={`rotate(${i * 11.25} 100 100)`} />
          ))}
          {/* the rose: eight points, long and short */}
          {[0, 90, 180, 270].map((r) => (
            <path key={r} d="M100 100 L93 78 L100 40 L107 78 Z" fill="#8a6a2c" stroke="#4a3716" strokeWidth="0.8" transform={`rotate(${r} 100 100)`} />
          ))}
          {[45, 135, 225, 315].map((r) => (
            <path key={r} d="M100 100 L95 84 L100 60 L105 84 Z" fill="#c9b27a" stroke="#4a3716" strokeWidth="0.8" transform={`rotate(${r} 100 100)`} />
          ))}
          <g ref={needle} className="cb-compass-needle">
            <path d="M100 26 L109 100 L100 112 L91 100 Z" fill="#b3261c" stroke="#4a0d08" strokeWidth="1" />
            <path d="M100 174 L107 100 L100 112 L93 100 Z" fill="#23303a" stroke="#0c1216" strokeWidth="1" />
          </g>
          <circle cx="100" cy="100" r="7" fill="url(#cb-brass)" stroke="#3a2a10" strokeWidth="1.5" />
        </svg>
      </button>
      <figcaption className="cb-compass-caption" aria-live="polite">
        <span>It doesn’t point north. Right now you want</span>
        <strong>{WANTS[want].label}</strong>
      </figcaption>
    </figure>
  );
}
