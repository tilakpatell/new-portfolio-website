import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { RiVolumeMuteLine, RiVolumeUpLine } from 'react-icons/ri';
import Readout from '../components/deathstar/Readout';
import TrenchRun from '../components/deathstar/TrenchRun';
import Hero3D from '../components/deathstar/Hero3D';
import { PLANETS, PLANET_AT as PLANET, PlanetArt, PlanetBackdrop } from '../components/deathstar/Planets';
import { BATTLE_SECONDS, CALLS, CLEARED, ENDINGS, fmtClock } from '../components/deathstar/battle';
import { INTERCOM, endingVoice } from '../components/deathstar/voicelines';
import { sayVoiced } from '../lib/voiced';
import { useVoiced } from '../lib/useVoiced';
import { AurebeshLine } from '../components/Wordmark';
import { useAchievements } from '../components/Achievements';
import { jumpTo } from '../lib/anchors';
import Hyperspace from '../components/Hyperspace';
import WorldSwitcher from '../components/worlds/WorldSwitcher';
import ClipBoard from '../components/worlds/ClipBoard';
import { useDocumentTitle, useMediaQuery, useReducedMotion } from '../lib/hooks';
import { use3D } from '../lib/gpu';
import { audioContext, onSoundChange, setSound, soundOn } from '../lib/audio';
import ScriptToggle from '../components/ScriptToggle';
import '../styles/lazy/deathstar.css';

const sfx = () => import('../lib/sfx');

// The hidden page. Reachable from the terminal ('deathstar'), the footer and the Konami code.
// The scene is 680×460: the target top left, the station bottom right, so the
// superlaser crosses it on a diagonal. Phones get a tighter crop.
const SCENE = { x: 0, y: 0, w: 680, h: 460 };
const SCENE_PHONE = { x: 96, y: 8, w: 580, h: 444 };
const DS = { x: 505, y: 292, r: 145 };
const DISH = { x: 446, y: 232, r: 38 };
const FOCUS = { x: 420, y: 217 }; // where the tributary beams meet, out along the line to the target
const BEAM = '#8dff6b';

// Luke's X-wing seen from above, nose to the right, for the victory flypast.
function XWing({ style }) {
  return (
    <svg viewBox="0 0 64 32" className="rebel-xwing" style={style} aria-hidden="true">
      <path d="M8 16 H54 L62 16" stroke="#e6e9ee" strokeWidth="3" strokeLinecap="round" />
      <path d="M14 16 L22 3 H30 L26 16 L30 29 H22 Z" fill="#cfd5dd" />
      <path d="M10 3 H40 M10 29 H40" stroke="#e6e9ee" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M22 6 H27 M22 26 H27" stroke="#c0392b" strokeWidth="2" />
      <circle cx="9" cy="12" r="2.2" fill="#ffb27a" />
      <circle cx="9" cy="20" r="2.2" fill="#ffb27a" />
    </svg>
  );
}

// The Medal of Yavin, on its ribbon.
function Medal() {
  return (
    <svg viewBox="0 0 64 88" className="rebel-medal" aria-hidden="true">
      <path d="M18 0 H30 L36 34 H24 Z" fill="#c0392b" />
      <path d="M34 0 H46 L40 34 H28 Z" fill="#2f5fa8" />
      <circle cx="32" cy="58" r="24" fill="#d9a441" stroke="#8a5a14" strokeWidth="2" />
      <circle cx="32" cy="58" r="17" fill="none" stroke="#f6dc95" strokeWidth="1.4" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return <path key={i} d={`M32 58 L${32 + Math.cos(a) * 14} ${58 + Math.sin(a) * 14}`} stroke="#8a5a14" strokeWidth="1.2" opacity="0.7" />;
      })}
      <circle cx="32" cy="58" r="5" fill="#f6dc95" />
    </svg>
  );
}

// the soundboard: the films' lines, then their sounds
const BOARD = [
  'vader',
  'lackOfFaith',
  'forceIsStrong',
  'fireWhenReady',
  'noMoon',
  'shortStormtrooper',
  'helpMeObiWan',
  'notTheDroids',
  'useTheForce',
  'forceAlways',
  'mayTheForce',
  'stayOnTarget',
  'almostThere',
  'dontGetCocky',
  'neverTellOdds',
  'badFeelingLuke',
  'badFeelingHan',
  'itsATrap',
  'doOrDoNot',
  ['chewieRoar', 'Chewie roars'],
  ['r2Whistle', 'Artoo whistles'],
  ['r2Scream', 'Artoo screams'],
  ['saberOn', 'A lightsaber'],
  ['dl44', 'Han’s blaster'],
  ['tieScream', 'A TIE fighter'],
  'imperialMarch',
];

export default function DeathStar() {
  useDocumentTitle('DS-1');
  const reduced = useReducedMotion();
  const phone = useMediaQuery('(max-width: 639px)');
  const vb = phone ? SCENE_PHONE : SCENE;
  const { unlock } = useAchievements();
  // the superlaser: idle → charging → firing → boom → gone
  const [phase, setPhase] = useState('idle');
  // in WebGL where there's a graphics chip for it, the SVG otherwise
  const three = use3D();
  const [gl, setGl] = useState('off');
  const stageSvg = useRef(null);
  const [shots, setShots] = useState(0);
  const [destroyed, setDestroyed] = useState(false); // the station itself
  const [planet, setPlanet] = useState('alderaan');
  const [jumping, setJumping] = useState(false);
  const [course, setCourse] = useState(null);
  const [arrivals, setArrivals] = useState(0);
  // the Battle of Yavin: a clock, and how it ended
  const [battle, setBattle] = useState(false);
  const [clock, setClock] = useState(BATTLE_SECONDS);
  const [outcome, setOutcome] = useState(null); // 'empire' | 'rebels'
  const [hanSaid, setHanSaid] = useState(false); // (his last word, in the trench: onWin)
  const [call, setCall] = useState('');
  const [sound, setSoundState] = useState(soundOn);
  const deadline = useRef(0);
  // the score playing now (the Binary Sunset, the Rebels' main title), so it can end with its moment
  const music = useRef(null);
  const { hash } = useLocation();
  useEffect(() => onSoundChange(setSoundState), []);

  const startBattle = useCallback(() => {
    deadline.current = Date.now() + BATTLE_SECONDS * 1000;
    setClock(BATTLE_SECONDS);
    setBattle(true);
    setOutcome(null);
    setCall('The Death Star has reached Yavin. Fly the trench run before Yavin 4 is in range.');
  }, []);

  // Set a course: the station makes the jump to lightspeed and arrives at the new planet.
  const travel = (id) => {
    if (id === planet || jumping || destroyed || (phase !== 'idle' && phase !== 'gone')) return;
    audioContext(); // in the click, so the jump can be heard
    music.current?.stop();
    // dropping out of lightspeed as the tunnel ends
    import('../lib/clips').then((c) => c.playClip('hyperspaceExit', { when: 1.47 }));
    setBattle(false);
    setOutcome(null);
    setCall('');
    setCourse(id);
    setJumping(true);
  };
  const arrive = () => {
    setPlanet(course);
    setPhase('idle');
    setArrivals((n) => n + 1);
    if (course === 'yavin') startBattle();
    // two suns over Tatooine: the binary sunset
    if (course === 'tatooine')
      import('../lib/clips').then(async (c) => {
        music.current = await c.playClip('binarySunset', { when: 0.6, duration: 14 });
      });
  };

  const fire = () => {
    if (phase !== 'idle' || destroyed || jumping) return;
    audioContext();
    import('../lib/clips').then((c) => c.playClip('fireWhenReady'));
    sfx().then((s) => s.superlaser(undefined, undefined, 0, 1.1));
    setShots((n) => n + 1);
    setPhase('charging');
    if (planet === 'yavin' && battle) {
      setBattle(false);
      setOutcome('empire');
      setCall('');
    }
  };
  const fireRef = useRef(fire);
  useEffect(() => {
    fireRef.current = fire;
  });

  // The clock counts from a deadline, so a background tab can't slow it down.
  useEffect(() => {
    if (!battle) return undefined;
    const id = setInterval(() => setClock(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000))), 250);
    return () => clearInterval(id);
  }, [battle]);
  // The base's intercom reads each call out (in its own voice, where it's been made: lib/voiced.js).
  useEffect(() => {
    if (!battle) return undefined;
    if (CALLS[clock]) {
      setCall(CALLS[clock]);
      sayVoiced(INTERCOM, CALLS[clock]);
    }
    if (clock > 0) return undefined;
    // Time's up: the station has cleared the planet. Back to the top to watch
    // it fire, once the intercom has said so.
    setCall(CLEARED);
    const said = sayVoiced(INTERCOM, CLEARED).catch(() => null);
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    let live = true;
    const t = setTimeout(async () => {
      // (but not for ever: the line can be slow to come, or the sound asleep)
      await Promise.race([said.then((h) => h?.ended), new Promise((done) => setTimeout(done, 6000))]);
      if (live) fireRef.current();
    }, reduced ? 0 : 800);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [battle, clock, reduced]);

  useEffect(() => {
    if (hash !== '#trench' && hash !== '#readout') return undefined;
    const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' }), 120);
    return () => clearTimeout(t);
  }, [hash]);

  // The Rebels win: back to the top to watch the station go. (With the
  // computer on, Han has his say down in the trench; with the Force, at the top.)
  const onWin = ({ force = false } = {}) => {
    const savedYavin = battle && planet === 'yavin';
    setBattle(false);
    setCall('');
    setHanSaid(!force);
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
      setTimeout(() => {
        setDestroyed(true);
        setOutcome('rebels');
        if (savedYavin) unlock('rebels');
      }, reduced ? 0 : 750);
      // after the torpedoes, the flash and the shockwave in the trench
    }, reduced ? 1200 : 3400);
  };

  // The sounds of each ending. A ref per shot so a re-render can't play them twice.
  const boomed = useRef(-1);
  useEffect(() => {
    if (phase !== 'boom' || boomed.current === shots) return undefined;
    boomed.current = shots;
    sfx().then((s) => s.boom());
    if (outcome !== 'empire') return undefined;
    unlock('empire');
    // the Imperial March, or the synthesised one if it can't play
    const t = setTimeout(
      () =>
        import('../lib/clips').then(async (c) => {
          music.current = await c.playClip('imperialMarch');
          if (!music.current) sfx().then((s) => s.imperial());
        }),
      650,
    );
    return () => clearTimeout(t);
  }, [phase, shots, outcome, unlock]);
  useEffect(() => {
    if (!destroyed) return undefined;
    sfx().then((s) => s.boom());
    // the main title for the Rebels, or the synthesised fanfare if it can't play
    const t = setTimeout(
      () =>
        import('../lib/clips').then(async (c) => {
          music.current = await c.playClip('starWars', { duration: 16 });
          if (!music.current) sfx().then((s) => s.victory());
        }),
      1500,
    );
    return () => clearTimeout(t);
  }, [destroyed]);
  // The last word, said while it's up: Han's as the station goes, unless he
  // said it in the trench; Tarkin's once Yavin 4 has gone, after the film's
  // own "You may fire when ready."
  const ending = (outcome === 'rebels' && !hanSaid) || (outcome === 'empire' && phase === 'gone') ? outcome : null;
  useVoiced(endingVoice(ending), ENDINGS[ending]?.line);

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

  const onAction = (action) => {
    if (action === 'fire') {
      audioContext();
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
      setTimeout(() => fireRef.current(), reduced ? 0 : 650);
    } else jumpTo(null, 'trench');
  };
  const rebuild = () => {
    music.current?.stop();
    setDestroyed(false);
    setOutcome(null);
    setPhase('idle');
    if (planet === 'yavin') startBattle();
  };
  const fightAgain = () => {
    music.current?.stop();
    setPhase('idle');
    startBattle();
  };

  const rim = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    return { x: DISH.x + Math.cos(a) * (DISH.r - 6), y: DISH.y + Math.sin(a) * (DISH.r - 6) };
  });
  const charging = phase === 'charging' || phase === 'firing';
  const planetVisible = phase === 'idle' || phase === 'charging' || phase === 'firing';
  const planetGone = phase === 'boom' || phase === 'gone';
  const p = PLANETS[planet];
  const busy = jumping || (phase !== 'idle' && phase !== 'gone');

  let title = 'That’s no moon.';
  let lead = `It’s a space station, and you found the hidden page. ${p.name} is in range. ${p.line}`;
  if (outcome === 'empire') {
    title = 'The Empire wins.';
    lead = planetGone ? 'Yavin 4 is gone, and the Rebel base with it.' : 'The superlaser is charging on Yavin 4.';
  } else if (outcome === 'rebels') {
    title = 'The Rebels win.';
    lead = planetGone ? `The Death Star is gone. Too late for ${p.name}, but the Rebellion lives on.` : `The Death Star is gone, and ${p.name} is safe.`;
  } else if (planetGone) lead = `${p.name} is no more. The station is fully operational.`;

  return (
    <div className="dark-scope relative z-10 min-h-[100svh] overflow-hidden" style={{ background: '#03040a' }} data-outcome={outcome || undefined}>
      <div className="ds-stars pointer-events-none absolute inset-0" aria-hidden="true" />
      {phase === 'boom' && !reduced && <div className="ds-flash pointer-events-none fixed inset-0 z-50 bg-white" aria-hidden="true" />}
      {phase === 'boom' && outcome === 'empire' && !reduced && <div className="empire-shade pointer-events-none fixed inset-0 z-40" aria-hidden="true" />}
      {jumping && <Hyperspace sound onPeak={arrive} onDone={() => setJumping(false)} />}
      {destroyed && !reduced && <div key="ds-flash" className="ds-flash pointer-events-none fixed inset-0 z-50 bg-white" aria-hidden="true" />}
      {destroyed && outcome === 'rebels' && !reduced && (
        <div className="rebel-flypast pointer-events-none fixed inset-x-0 top-[18%] z-40" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <XWing key={i} style={{ '--i': i }} />
          ))}
        </div>
      )}
      <div className="ds-hero shell relative grid min-h-[100svh] items-center gap-10 pb-16 pt-[calc(var(--nav-h)+32px)] lg:grid-cols-[1.25fr_1fr]" data-gl={(three.on && gl === 'on') || undefined}>
        {three.on && gl !== 'failed' && gl !== 'lost' && <Hero3D svgRef={stageSvg} planet={planet} phase={phase} destroyed={destroyed} arrivals={arrivals} shots={shots} vb={vb} reduced={reduced} onState={setGl} />}
        <div className="ds-stage" data-gl={three.on && gl !== 'failed' && gl !== 'lost' ? gl : undefined}>
          <svg ref={stageSvg} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} className="block h-auto w-full overflow-visible" role="img" aria-label={`The Death Star facing ${p.name}`}>
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

            {/* what surrounds the target stays put: Yavin's gas giant, Tatooine's suns */}
            <PlanetBackdrop id={planet} />
            {planetVisible && <PlanetArt key={planet} id={planet} className={phase === 'firing' ? 'planet-hit' : 'planet-in'} />}
            {planetGone && (
              <g key={shots}>
                {phase === 'boom' && (
                  <>
                    <circle className="ds-core" cx={PLANET.x} cy={PLANET.y} r={PLANET.r} fill="#fff6d8" />
                    <ellipse className="ds-ring" cx={PLANET.x} cy={PLANET.y} rx={PLANET.r} ry={PLANET.r * 0.28} fill="none" stroke="#ffe7a8" strokeWidth="3" />
                  </>
                )}
                {debris.map((d, i) => (
                  <circle
                    key={i}
                    className="ds-debris"
                    cx={PLANET.x}
                    cy={PLANET.y}
                    r={d.s}
                    fill={d.c}
                    style={{ '--dx': `${d.dx}px`, '--dy': `${d.dy}px`, animationDelay: `${(i % 5) * 20}ms` }}
                  />
                ))}
              </g>
            )}

            {/* the station going up */}
            {destroyed && (
              <g key="boom">
                <circle className="ds-core" cx={DS.x} cy={DS.y} r={DS.r * 0.6} fill="#fff6d8" />
                <ellipse className="ds-ring ds-ring-big" cx={DS.x} cy={DS.y} rx={DS.r * 0.8} ry={DS.r * 0.16} fill="none" stroke="#ffe7a8" strokeWidth="4" />
                {debris.map((d, i) => (
                  <circle
                    key={i}
                    className="ds-debris"
                    cx={DS.x}
                    cy={DS.y}
                    r={d.s * 1.4}
                    fill={d.c}
                    style={{ '--dx': `${d.dx * 2.2}px`, '--dy': `${d.dy * 2.2}px`, animationDelay: `${(i % 5) * 25}ms` }}
                  />
                ))}
              </g>
            )}
            <g key={`ds-${arrivals}`} className={destroyed ? 'ds-gone' : arrivals ? 'ds-arrive' : undefined}>
              <circle cx={DS.x} cy={DS.y} r={DS.r} fill="url(#ds-body)" />
              <g clipPath="url(#ds-clip)" opacity="0.5">
                {[-128, -100, -70, 40, 70, 100, 124].map((dy) => (
                  <path key={dy} d={`M ${DS.x - DS.r} ${DS.y + dy} Q ${DS.x} ${DS.y + dy + (dy < 0 ? 14 : -14)} ${DS.x + DS.r} ${DS.y + dy}`} fill="none" stroke="#2a2d31" strokeWidth="1" />
                ))}
                {Array.from({ length: 44 }).map((_, i) => (
                  <rect key={i} x={DS.x - 130 + ((i * 53) % 270)} y={DS.y - 138 + ((i * 97) % 280)} width={4 + (i % 4) * 3} height="2" fill="#2a2d31" />
                ))}
              </g>
              <path d={`M ${DS.x - DS.r + 10} ${DS.y + 4} Q ${DS.x} ${DS.y + 26} ${DS.x + DS.r - 10} ${DS.y + 4}`} fill="none" stroke="#1d1f23" strokeWidth="6" clipPath="url(#ds-clip)" />
              <circle cx={DISH.x} cy={DISH.y} r={DISH.r} fill="url(#ds-dish)" stroke="#2a2d31" strokeWidth="1.5" />
              <circle cx={DISH.x} cy={DISH.y} r={DISH.r * 0.62} fill="none" stroke="#2f3237" strokeWidth="1" />
              <circle cx={DISH.x} cy={DISH.y} r="4" fill={charging ? BEAM : '#2f3237'} />

              {charging &&
                rim.map((pt, i) => (
                  <line key={i} className="ds-tributary" x1={pt.x} y1={pt.y} x2={FOCUS.x} y2={FOCUS.y} stroke={BEAM} strokeWidth="2" strokeLinecap="round" style={{ animationDelay: `${i * 50}ms` }} />
                ))}
              {phase === 'firing' && (
                <g>
                  <line x1={FOCUS.x} y1={FOCUS.y} x2={PLANET.x} y2={PLANET.y} stroke={BEAM} strokeWidth="12" filter="url(#ds-glow)" className="ds-beam" />
                  <line x1={FOCUS.x} y1={FOCUS.y} x2={PLANET.x} y2={PLANET.y} stroke="#eaffdf" strokeWidth="3" className="ds-beam" />
                </g>
              )}
              {charging && <circle cx={FOCUS.x} cy={FOCUS.y} r="7" fill="#eaffdf" filter="url(#ds-glow)" />}
            </g>
            <text x={PLANET.x} y={PLANET.y + PLANET.r + 22} textAnchor="middle" fill="#9aa0a9" fontFamily="var(--font-mono)" fontSize="12" letterSpacing="2">
              {planetVisible ? p.name.toUpperCase() : ''}
            </text>
          </svg>
        </div>

        <div>
          <p className="eyebrow">
            <AurebeshLine>Classified</AurebeshLine> · DS-1 Orbital Battle Station
          </p>
          <h1 className="display mt-6 text-[clamp(2.8rem,1.6rem+5vw,5.2rem)]">{title}</h1>
          <p className="lead mt-6 max-w-xl">{lead}</p>

          {outcome && (
            <figure className={`ds-ending ds-ending-${outcome}`}>
              {outcome === 'rebels' && <Medal />}
              <div>
                <blockquote className="text-lg text-ink">“{ENDINGS[outcome].line}”</blockquote>
                <figcaption className="mt-1 text-sm text-muted">{ENDINGS[outcome].by}</figcaption>
              </div>
            </figure>
          )}

          {battle && (
            <div className="battle-card">
              <div className="flex items-baseline justify-between gap-4">
                <p className="label">Battle of Yavin</p>
                <p className="battle-clock" aria-hidden="true">
                  {fmtClock(clock)}
                </p>
              </div>
              <div className="battle-bar" aria-hidden="true">
                <span style={{ transform: `scaleX(${clock / BATTLE_SECONDS})` }} />
              </div>
              <p className="mt-3 text-sm text-body">Once the station clears the gas giant, Yavin 4 is in range. Fly the trench run before it is.</p>
            </div>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            {outcome === 'empire' ? (
              <button type="button" className="btn btn-primary" onClick={fightAgain} disabled={busy}>
                Fight the battle again
              </button>
            ) : outcome === 'rebels' ? (
              <button type="button" className="btn btn-primary" onClick={rebuild}>
                Rebuild the station
              </button>
            ) : phase === 'gone' ? (
              <button type="button" className="btn btn-primary" onClick={() => setPhase('idle')}>
                Restore {p.name} from checkpoint
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={fire} disabled={busy || destroyed}>
                Fire the superlaser
              </button>
            )}
            {!destroyed && (
              <a href="#trench" className="btn btn-ghost" onClick={(e) => jumpTo(e, 'trench')}>
                Fly the trench run
              </a>
            )}
            {!destroyed && (
              <Link to="/deathstar/inside" className="btn btn-ghost">
                Go aboard
              </Link>
            )}
            <ScriptToggle id="aurebesh" />
            <Link to="/galaxy/yavin" className="btn btn-ghost">
              Out into the galaxy
            </Link>
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
                <button key={id} type="button" className="place-chip" aria-pressed={planet === id} disabled={busy || destroyed} onClick={() => travel(id)}>
                  {pl.name}
                </button>
              ))}
            </div>
            {planet !== 'yavin' && !outcome && <p className="mt-3 text-sm text-muted">Set course for Yavin 4 to fight the Battle of Yavin.</p>}
          </div>
          <p className="mono mt-6 min-h-[1.5em] text-sm text-accent" role="status">
            {jumping ? 'Jumping to lightspeed…' : phase === 'charging' ? 'Charging the main reactor…' : phase === 'firing' ? 'Fire at will.' : call}
          </p>
          <WorldSwitcher className="mt-6" />
        </div>
      </div>
      <Readout onAction={onAction} />
      <section id="trench" className="shell relative z-10 scroll-mt-24 pb-14 md:pb-20" aria-labelledby="trench-title">
        <h2 id="trench-title" className="title">
          Trench run
        </h2>
        <p className="lead mt-4 max-w-[58ch]">TIE fighters over the surface, then the trench: catwalks, turrets, Vader on your tail, two torpedoes and one exhaust port. Switching off the targeting computer is optional, and worth it.</p>
        <div className="mt-8">
          <TrenchRun onWin={onWin} clock={battle ? clock : null} over={outcome === 'empire' ? 'Too late. The Death Star cleared Yavin and fired on the moon.' : null} />
        </div>
      </section>
      <section className="shell relative z-10 pb-28" aria-labelledby="ds-board-title">
        <h2 id="ds-board-title" className="title">
          Soundboard
        </h2>
        <p className="lead mt-4 max-w-[54ch]">From the films, a line at a time.</p>
        <ClipBoard className="mt-8" clips={BOARD} />
      </section>
    </div>
  );
}
