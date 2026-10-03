import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Readout from '../components/deathstar/Readout';
import TrenchRun from '../components/deathstar/TrenchRun';
import { PLANETS, PLANET_AT as PLANET, PlanetArt } from '../components/deathstar/Planets';
import { AurebeshLine } from '../components/Wordmark';
import { jumpTo } from '../lib/anchors';
import Hyperspace from '../components/Hyperspace';
import { useDocumentTitle, useMediaQuery, useReducedMotion } from '../lib/hooks';
import { audioContext, onSoundChange, setSound, soundOn } from '../lib/audio';
import { PARTS } from '../components/deathstar/parts';
import Gif from '../components/Gif';
import { RiCloseLine, RiVolumeMuteLine, RiVolumeUpLine } from 'react-icons/ri';

const sfx = () => import('../lib/sfx');

// A part of the station, opened from its hotspot.
function PartPanel({ part, onClose, onAction }) {
  const close = useRef(null);
  useEffect(() => {
    close.current?.focus({ preventScroll: true });
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <section className="ds-panel" aria-labelledby="ds-part-title">
      <div className="flex items-start justify-between gap-4">
        <h2 id="ds-part-title" className="stretch-semi text-xl font-semibold text-ink">
          {part.name}
        </h2>
        <button ref={close} type="button" className="ds-panel-close" onClick={onClose} aria-label="Close">
          <RiCloseLine className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
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
    </section>
  );
}

// The hidden page. Reachable from the terminal ('deathstar'), the footer and the Konami code.
const DS = { x: 520, y: 220, r: 150 };
// The whole 680×400 scene, or on phones a tighter crop so the station is big enough to tap.
const SCENE = { x: 0, y: 0, w: 680, h: 400 };
const SCENE_PHONE = { x: 44, y: 40, w: 644, h: 350 };
const DISH = { x: 462, y: 160, r: 36 };
const FOCUS = { x: 432, y: 138 };
const BEAM = '#8dff6b';

export default function DeathStar() {
  useDocumentTitle('DS-1');
  const reduced = useReducedMotion();
  const phone = useMediaQuery('(max-width: 639px)');
  const vb = phone ? SCENE_PHONE : SCENE;
  // idle → charging → firing → boom → gone
  const [phase, setPhase] = useState('idle');
  const [shots, setShots] = useState(0);
  const [destroyed, setDestroyed] = useState(false);
  const [planet, setPlanet] = useState('alderaan');
  const [jumping, setJumping] = useState(false);
  const [arrivals, setArrivals] = useState(0);
  const [part, setPart] = useState(null);
  const [sound, setSoundState] = useState(soundOn);
  const { hash } = useLocation();
  useEffect(() => onSoundChange(setSoundState), []);

  // Set a course: the station makes the jump to lightspeed and arrives at the new planet.
  const [course, setCourse] = useState(null);
  const travel = (id) => {
    if (id === planet || jumping || destroyed || (phase !== 'idle' && phase !== 'gone')) return;
    audioContext(); // in the click, so the jump can be heard
    setPart(null);
    setCourse(id);
    setJumping(true);
  };
  const arrive = () => {
    setPlanet(course);
    setPhase('idle');
    setArrivals((n) => n + 1);
  };

  useEffect(() => {
    if (hash !== '#trench') return undefined;
    const t = setTimeout(() => document.getElementById('trench')?.scrollIntoView({ block: 'start' }), 120);
    return () => clearTimeout(t);
  }, [hash]);

  // Back to the top to watch it go, then the station explodes.
  const onWin = () => {
    setTimeout(() => {
      setPart(null);
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
      setTimeout(() => setDestroyed(true), reduced ? 0 : 750);
    }, 1200);
  };
  useEffect(() => {
    if (destroyed) sfx().then((s) => s.boom());
  }, [destroyed]);
  useEffect(() => {
    if (phase === 'boom') sfx().then((s) => s.boom());
  }, [phase]);

  useEffect(() => {
    const next = { charging: ['firing', 1100], firing: ['boom', 380], boom: ['gone', 1500] }[phase];
    if (!next) return undefined;
    const t = setTimeout(() => setPhase(next[0]), reduced ? 0 : next[1]);
    return () => clearTimeout(t);
  }, [phase, reduced]);

  const debris = useMemo(
    () =>
      Array.from({ length: 34 }, (_, i) => {
        const a = (i / 34) * Math.PI * 2 + ((i * 37) % 10) / 20;
        const d = 70 + ((i * 53) % 90);
        return { dx: Math.cos(a) * d, dy: Math.sin(a) * d * 0.8, s: 1.5 + (i % 4), c: i % 3 === 0 ? '#ffd27a' : i % 3 === 1 ? '#9bb8ff' : '#ffffff' };
      }),
    // a fresh debris field each shot
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shots],
  );

  const fire = () => {
    if (phase !== 'idle' || destroyed) return;
    audioContext();
    sfx().then((s) => s.superlaser(undefined, undefined, 0, 1.1));
    setShots((n) => n + 1);
    setPhase('charging');
  };
  const onAction = (action) => {
    setPart(null);
    if (action === 'fire') fire();
    else jumpTo(null, 'trench');
  };

  const rim = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    return { x: DISH.x + Math.cos(a) * (DISH.r - 6), y: DISH.y + Math.sin(a) * (DISH.r - 6) };
  });
  const charging = phase === 'charging' || phase === 'firing';
  const planetVisible = phase === 'idle' || phase === 'charging' || phase === 'firing';

  return (
    <div className="dark-scope relative z-10 min-h-[100svh] overflow-hidden" style={{ background: '#03040a' }}>
      <div className="ds-stars pointer-events-none absolute inset-0" aria-hidden="true" />
      {phase === 'boom' && !reduced && <div className="ds-flash pointer-events-none fixed inset-0 z-50 bg-white" aria-hidden="true" />}
      {jumping && <Hyperspace sound onPeak={arrive} onDone={() => setJumping(false)} />}
      {destroyed && !reduced && <div key="ds-flash" className="ds-flash pointer-events-none fixed inset-0 z-50 bg-white" aria-hidden="true" />}
      <div className="shell relative grid min-h-[100svh] items-center gap-10 pb-16 pt-[calc(var(--nav-h)+32px)] lg:grid-cols-[1.25fr_1fr]">
        <div className="relative">
        <div className="ds-stage">
        <svg viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} className="block h-auto w-full overflow-visible" role="img" aria-label={`The Death Star facing ${PLANETS[planet].name}`}>
          <defs>
            <radialGradient id="ds-body" cx="38%" cy="32%" r="75%">
              <stop offset="0" stopColor="#b9bec4" />
              <stop offset="0.45" stopColor="#7d838a" />
              <stop offset="0.85" stopColor="#3a3e44" />
              <stop offset="1" stopColor="#202327" />
            </radialGradient>
            <radialGradient id="ds-dish" cx="62%" cy="64%" r="70%">
              <stop offset="0" stopColor="#a6abb1" />
              <stop offset="0.7" stopColor="#5d6268" />
              <stop offset="1" stopColor="#3c4046" />
            </radialGradient>
            <clipPath id="ds-clip">
              <circle cx={DS.x} cy={DS.y} r={DS.r} />
            </clipPath>
            <filter id="ds-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" />
            </filter>
          </defs>

          {/* The planet in range */}
          {planetVisible && <PlanetArt key={planet} id={planet} className={phase === 'firing' ? 'planet-hit' : 'planet-in'} />}
          {(phase === 'boom' || phase === 'gone') && (
            <g key={shots}>
              {phase === 'boom' && (
                <>
                  <circle className="ds-core" cx={PLANET.x} cy={PLANET.y} r={PLANET.r} fill="#fff6d8" />
                  <ellipse className="ds-ring" cx={PLANET.x} cy={PLANET.y} rx={PLANET.r} ry={PLANET.r * 0.28} fill="none" stroke="#ffe7a8" strokeWidth="3" />
                </>
              )}
              {debris.map((p, i) => (
                <circle
                  key={i}
                  className="ds-debris"
                  cx={PLANET.x}
                  cy={PLANET.y}
                  r={p.s}
                  fill={p.c}
                  style={{ '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, animationDelay: `${(i % 5) * 20}ms` }}
                />
              ))}
            </g>
          )}

          {/* Death Star */}
          {destroyed && (
            <g key="boom">
              <circle className="ds-core" cx={DS.x} cy={DS.y} r={DS.r * 0.6} fill="#fff6d8" />
              <ellipse className="ds-ring ds-ring-big" cx={DS.x} cy={DS.y} rx={DS.r * 0.8} ry={DS.r * 0.16} fill="none" stroke="#ffe7a8" strokeWidth="4" />
              {debris.map((p, i) => (
                <circle
                  key={i}
                  className="ds-debris"
                  cx={DS.x}
                  cy={DS.y}
                  r={p.s * 1.4}
                  fill={p.c}
                  style={{ '--dx': `${p.dx * 2.2}px`, '--dy': `${p.dy * 2.2}px`, animationDelay: `${(i % 5) * 25}ms` }}
                />
              ))}
            </g>
          )}
          <g key={`ds-${arrivals}`} className={destroyed ? 'ds-gone' : arrivals ? 'ds-arrive' : undefined}>
          <circle cx={DS.x} cy={DS.y} r={DS.r} fill="url(#ds-body)" />
          <g clipPath="url(#ds-clip)" opacity="0.5">
            {[90, 120, 150, 260, 290, 320, 345].map((y) => (
              <path key={y} d={`M ${DS.x - DS.r} ${y} Q ${DS.x} ${y + (y < DS.y ? 14 : -14)} ${DS.x + DS.r} ${y}`} fill="none" stroke="#2a2d31" strokeWidth="1" />
            ))}
            {Array.from({ length: 44 }).map((_, i) => (
              <rect key={i} x={DS.x - 130 + ((i * 53) % 270)} y={80 + ((i * 97) % 280)} width={4 + (i % 4) * 3} height="2" fill="#2a2d31" />
            ))}
          </g>
          <path d={`M ${DS.x - DS.r + 10} ${DS.y + 4} Q ${DS.x} ${DS.y + 26} ${DS.x + DS.r - 10} ${DS.y + 4}`} fill="none" stroke="#1d1f23" strokeWidth="6" clipPath="url(#ds-clip)" />
          <circle cx={DISH.x} cy={DISH.y} r={DISH.r} fill="url(#ds-dish)" stroke="#2a2d31" strokeWidth="1.5" />
          <circle cx={DISH.x} cy={DISH.y} r={DISH.r * 0.62} fill="none" stroke="#2f3237" strokeWidth="1" />
          <circle cx={DISH.x} cy={DISH.y} r="4" fill={charging ? BEAM : '#2f3237'} />

          {charging &&
            rim.map((p, i) => (
              <line key={i} className="ds-tributary" x1={p.x} y1={p.y} x2={FOCUS.x} y2={FOCUS.y} stroke={BEAM} strokeWidth="2" strokeLinecap="round" style={{ animationDelay: `${i * 50}ms` }} />
            ))}
          {phase === 'firing' && (
            <g>
              <line x1={FOCUS.x} y1={FOCUS.y} x2={PLANET.x} y2={PLANET.y} stroke={BEAM} strokeWidth="12" filter="url(#ds-glow)" className="ds-beam" />
              <line x1={FOCUS.x} y1={FOCUS.y} x2={PLANET.x} y2={PLANET.y} stroke="#eaffdf" strokeWidth="3" className="ds-beam" />
            </g>
          )}
          {charging && <circle cx={FOCUS.x} cy={FOCUS.y} r="7" fill="#eaffdf" filter="url(#ds-glow)" />}
          </g>
          <text x={PLANET.x} y={PLANET.y + PLANET.r + 26} textAnchor="middle" fill="#9aa0a9" fontFamily="var(--font-mono)" fontSize="12" letterSpacing="2">
            {planetVisible ? PLANETS[planet].name.toUpperCase() : ''}
          </text>
        </svg>
        {!destroyed && !jumping && (
          <div className="ds-hotspots" role="group" aria-label="Parts of the station">
            {PARTS.map((pt) => {
              const left = ((pt.x - vb.x) / vb.w) * 100;
              return (
                <button
                  key={pt.id}
                  type="button"
                  className="ds-hotspot"
                  style={{ left: `${left}%`, top: `${((pt.y - vb.y) / vb.h) * 100}%` }}
                  aria-pressed={part?.id === pt.id}
                  aria-label={pt.name}
                  data-label={pt.name}
                  // labels near an edge open inwards so they stay on screen
                  data-side={left > 72 ? 'end' : left < 28 ? 'start' : undefined}
                  onClick={() => setPart(part?.id === pt.id ? null : pt)}
                />
              );
            })}
          </div>
        )}
        </div>
        {part && <PartPanel part={part} onClose={() => setPart(null)} onAction={onAction} />}
        </div>

        <div>
          <p className="eyebrow">
            <AurebeshLine>Classified</AurebeshLine> · DS-1 Orbital Battle Station
          </p>
          <h1 className="display mt-6 text-[clamp(2.8rem,1.6rem+5vw,5.2rem)]">{destroyed ? 'It was a moon after all.' : 'That’s no moon.'}</h1>
          <p className="mt-3 text-sm text-muted">Tap the glowing points on the station to look inside.</p>
          <p className="lead mt-6 max-w-xl">
            {destroyed
              ? 'The station is gone. The Rebellion thanks you, and so does Alderaan’s insurance company.'
              : `It’s a space station, and you found the hidden page. ${PLANETS[planet].name} is in range. ${PLANETS[planet].line}`}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {phase === 'gone' ? (
              <button type="button" className="btn btn-primary" onClick={() => setPhase('idle')}>
                Restore {PLANETS[planet].name} from checkpoint
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={fire} disabled={phase !== 'idle'}>
                Fire the superlaser
              </button>
            )}
            {destroyed ? (
              <button type="button" className="btn btn-ghost" onClick={() => setDestroyed(false)}>
                Rebuild the station
              </button>
            ) : (
              <a href="#trench" className="btn btn-ghost" onClick={(e) => jumpTo(e, 'trench')}>
                Fly the trench run
              </a>
            )}
            <Link to="/" className="btn btn-ghost">
              Back to the site
            </Link>
            <button
              type="button"
              className="btn btn-ghost w-11 px-0"
              aria-pressed={sound}
              aria-label={sound ? 'Sound is on. Turn it off' : 'Sound is off. Turn it on'}
              title={sound ? 'Sound on' : 'Sound off'}
              onClick={() => {
                audioContext();
                setSound(!sound);
              }}
            >
              {sound ? <RiVolumeUpLine className="h-5 w-5" aria-hidden="true" /> : <RiVolumeMuteLine className="h-5 w-5" aria-hidden="true" />}
            </button>
          </div>
          <div className="mt-8">
            <p className="label">Set course for</p>
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Planets">
              {Object.entries(PLANETS).map(([id, pl]) => (
                <button
                  key={id}
                  type="button"
                  className="place-chip"
                  aria-pressed={planet === id}
                  disabled={jumping || destroyed || (phase !== 'idle' && phase !== 'gone')}
                  onClick={() => travel(id)}
                >
                  {pl.name}
                </button>
              ))}
            </div>
          </div>
          <p className="mono mt-6 min-h-[1.5em] text-sm text-accent" role="status">
            {phase === 'charging' && 'Charging the main reactor…'}
            {phase === 'firing' && 'Fire at will.'}
            {(phase === 'boom' || phase === 'gone') && `Fully operational. ${PLANETS[planet].name} is no more.`}
            {jumping && 'Jumping to lightspeed…'}
          </p>
        </div>
      </div>
      <Readout />
      <section id="trench" className="shell relative z-10 scroll-mt-24 pb-28" aria-labelledby="trench-title">
        <h2 id="trench-title" className="title">
          Trench run
        </h2>
        <p className="lead mt-4 max-w-[54ch]">Two torpedoes, three shields, one exhaust port. Switching off the targeting computer is optional.</p>
        <div className="mt-8">
          <TrenchRun onWin={onWin} />
        </div>
      </section>
    </div>
  );
}
