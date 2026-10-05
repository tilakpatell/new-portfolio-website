import { useCallback, useEffect, useRef, useState } from 'react';
import { RiArrowLeftLine, RiArrowRightLine, RiRefreshLine } from 'react-icons/ri';
import { audioContext } from '../../lib/audio';
import { use3D } from '../../lib/gpu';
import { TOSS, launch, newRound, step } from './toss';
import { playToss } from './tossSounds';
import { createToss2D } from './Toss2D';
import './office.css';

// Office Olympics: paper toss, from Jim's desk across the bullpen. Drag up
// from the paper to throw (sideways to aim, further for more power), or use
// ← → to aim and hold Space to wind up. Ten balls a round; every basket
// moves the bin somewhere harder, and after two the fan comes on.
//
// Drawn in 3D (./Toss3D.js) wherever WebGL works; the same round in 2D
// (./Toss2D.js) only where there is no WebGL, or it fails or is lost.

const BEST = 'tp-toss-best';
const readBest = () => {
  try {
    return Math.max(0, Number(window.localStorage.getItem(BEST)) || 0);
  } catch {
    return 0;
  }
};
const saveBest = (n) => {
  try {
    window.localStorage.setItem(BEST, String(n));
  } catch {
    /* storage unavailable */
  }
};

// Office Olympics medals were yogurt lids. So are these.
const medalFor = (score) => (score >= 420 ? 'gold' : score >= 240 ? 'silver' : score >= 110 ? 'bronze' : null);
const MEDAL_NAME = { gold: 'Gold yogurt lid', silver: 'Silver yogurt lid', bronze: 'Bronze yogurt lid' };

const SAY = {
  swish: ['Swish.', 'Nothing but bin.', 'Clean.'],
  rimIn: ['Off the rim and in.', 'Rattled in.', 'It counts.'],
  short: ['Short.', 'Not even close. Stanley didn’t look up.'],
  long: ['Long.', 'Over the bin. And the next one.'],
  wide: ['Wide.', 'Off to the side.'],
  rimOut: ['In and out.', 'Rim. And out.'],
  fan: 'The fan’s on. Watch the ribbons.',
  moved: 'Dwight moved the bin.',
  desk: 'Dwight’s desk is in the way.',
};
const pick = (list) => (Array.isArray(list) ? list[Math.floor(Math.random() * list.length)] : list);
// Michael, from the show (lib/clips.js)
const clip = (id, when) => import('../../lib/clips').then((c) => c.playClip(id, { when }));

export default function PaperToss() {
  const three = use3D();
  // 3D first: on wherever WebGL works, unless the visitor turned it off
  const want3D = three.on;
  const wrap = useRef(null);
  const glCanvas = useRef(null);
  const flatCanvas = useRef(null);
  const view = useRef(null);
  const game = useRef(null);
  const aim = useRef({ yaw: 0, power: 0.45, active: false, charging: false, t0: 0 });
  const drag = useRef(null);
  const raf = useRef(0);
  const visible = useRef(true);
  const [glState, setGlState] = useState('off'); // off | loading | on | failed | lost
  const [ui, setUi] = useState({ phase: 'ready', score: 0, throws: 0, made: 0, streak: 0, swishes: 0, bestStreak: 0, wind: { x: 0, z: 0 }, dist: 0, desk: false });
  const [best, setBest] = useState(readBest);
  const [say, setSay] = useState({ text: '', n: 0, good: false });
  const [power, setPower] = useState(null); // while aiming: 0..1
  const [guide, setGuide] = useState(true);
  const guideRef = useRef(guide);
  guideRef.current = guide;

  // before the first round, the room waits with the first bin in place
  const idle = useRef(null);
  if (!idle.current) idle.current = newRound({ seed: 7 });

  const speak = useCallback((text, good = false) => setSay((s) => ({ text, n: s.n + 1, good })), []);

  // the round's numbers, for the HUD, only when they change
  const sync = useCallback(() => {
    const g = game.current;
    if (!g) return;
    const dist = Math.hypot(g.bin.x - TOSS.release.x, g.bin.z - TOSS.release.z);
    setUi((u) => {
      const next = { phase: g.phase, score: g.score, throws: g.throws, made: g.made, streak: g.streak, swishes: g.swishes, bestStreak: g.bestStreak, wind: g.wind, dist, desk: Boolean(g.desk) };
      return Object.keys(next).every((k) => next[k] === u[k]) ? u : next;
    });
  }, []);

  // ── the views: 3D if it will start, the 2D canvas otherwise ──
  useEffect(() => {
    let dead = false;
    const flat = createToss2D(flatCanvas.current);
    const size = () => {
      const r = wrap.current?.getBoundingClientRect();
      if (!r) return;
      flat.resize(r.width, r.height);
      view.current?.resize?.(r.width, r.height);
    };
    view.current = flat;
    size();
    const drop = (why) => {
      if (view.current && view.current !== flat) view.current.dispose();
      view.current = flat;
      size();
      if (!dead) setGlState(why);
    };
    if (want3D) {
      setGlState('loading');
      import('./Toss3D')
        .then(({ createToss3D }) => createToss3D(glCanvas.current, { onLost: () => drop('lost') }))
        .then((v) => {
          if (dead) {
            v.dispose();
            return;
          }
          view.current = v;
          if (import.meta.env.DEV) window.__TOSS_VIEW__ = v; // for the browser tests
          size();
          setGlState('on');
        })
        .catch(() => drop('failed'));
    } else setGlState('off');
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(size) : null;
    ro?.observe(wrap.current);
    return () => {
      dead = true;
      ro?.disconnect();
      if (view.current && view.current !== flat) view.current.dispose();
      view.current = null;
    };
  }, [want3D]);

  // ── what the rules said happened: sounds, words, the bin's burst ──
  const handle = useCallback(
    (events) => {
      const g = game.current;
      for (const e of events) {
        if (e.type === 'rim') playToss('rim', e.speed);
        else if (e.type === 'floor') playToss('floor', e.speed);
        else if (e.type === 'desk' || e.type === 'bin' || e.type === 'wall') playToss('knock');
        else if (e.type === 'in') {
          playToss('swish');
          if (e.swish) clip('boomRoasted', 0.3); // nothing but net
          view.current?.celebrate?.(e.swish);
          speak(`${pick(e.swish ? SAY.swish : SAY.rimIn)} +${e.points}${e.streak > 1 ? `  ×${Math.min(3, 1 + 0.5 * (e.streak - 1))}` : ''}`, true);
        } else if (e.type === 'miss') {
          speak(pick(e.rim ? SAY.rimOut : e.short ? SAY.short : e.long ? SAY.long : SAY.wide));
        } else if (e.type === 'fan') {
          playToss('fan');
          clip('fireDrill', 0.4);
          setTimeout(() => speak(SAY.fan), 900);
        } else if (e.type === 'moved' && g?.desk) setTimeout(() => speak(SAY.desk), 900);
        else if (e.type === 'over') {
          const b = readBest();
          if (e.score > b) {
            saveBest(e.score);
            setBest(e.score);
          }
          if (medalFor(e.score)) import('../../lib/sfx').then((s) => s.applause());
        }
      }
      if (events.length) sync();
    },
    [speak, sync],
  );

  // ── the frame loop: runs while the game is on screen ──
  useEffect(() => {
    let last = 0;
    const frame = (now) => {
      raf.current = 0;
      if (!visible.current) return;
      const ms = last ? Math.min(250, now - last) : 16; // the rules step it in slices
      last = now;
      const dt = ms / 1000;
      const g = game.current || idle.current;
      const a = aim.current;
      if (a.charging) {
        // winding up: the power swings up and back while Space is held
        const t = ((now - a.t0) / 1600) % 1;
        a.power = t < 0.5 ? t * 2 : 2 - t * 2;
        setPower(a.power);
      }
      if (game.current && g.phase === 'flying') handle(step(g, dt));
      const showGuide = guideRef.current && g.phase === 'aim' && g.throws < 3;
      view.current?.render(g, { dt, ms, aim: a.active || a.charging || g.phase === 'aim' ? a : null, guide: showGuide && (a.active || a.charging) });
      raf.current = requestAnimationFrame(frame);
    };
    raf.current = requestAnimationFrame(frame);
    const io =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(([en]) => {
            visible.current = en.isIntersecting && document.visibilityState === 'visible';
            if (visible.current && !raf.current) {
              last = 0;
              raf.current = requestAnimationFrame(frame);
            }
          })
        : null;
    io?.observe(wrap.current);
    const onVis = () => {
      visible.current = document.visibilityState === 'visible';
      if (visible.current && !raf.current) {
        last = 0;
        raf.current = requestAnimationFrame(frame);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
      io?.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [handle]);

  const start = () => {
    audioContext(); // in the click, so the round can be heard
    game.current = newRound({ seed: (Date.now() & 0xffffff) || 1 });
    if (import.meta.env.DEV) window.__TOSS__ = game.current; // for the browser tests
    view.current?.clear?.();
    aim.current = { yaw: 0, power: 0.45, active: false, charging: false, t0: 0 };
    setPower(null);
    sync();
    speak('Office Olympics. Paper toss. Ten balls.');
    playToss('crumple');
    wrap.current?.focus({ preventScroll: true });
  };

  const fire = (yaw, pw) => {
    const g = game.current;
    if (!g || g.phase !== 'aim') return;
    if (launch(g, { yaw, power: pw })) {
      playToss('throw', pw);
      sync();
      // the next sheet gets crumpled once this one is away
      if (g.throws < TOSS.balls) setTimeout(() => game.current === g && g.phase !== 'over' && playToss('crumple'), 900);
    }
  };

  // ── pointer: drag up from the paper to throw ──
  const onDown = (e) => {
    const g = game.current;
    if (!g || g.phase !== 'aim') return;
    audioContext();
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY };
    aim.current.active = true;
    aim.current.power = 0;
    setPower(0);
  };
  const onMove = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const r = wrap.current.getBoundingClientRect();
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    aim.current.yaw = Math.max(-1, Math.min(1, dx / (r.width * 0.42))) * TOSS.maxYaw;
    // a gentle curve: short drags are fine for the close bins, long ones reach the far
    const f = Math.max(0, Math.min(1, -dy / (r.height * 0.78)));
    aim.current.power = f ** 1.45;
    setPower(aim.current.power);
  };
  const onUp = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    const a = aim.current;
    a.active = false;
    setPower(null);
    if (a.power > 0.03) fire(a.yaw, a.power);
  };

  // ── keys: ← → aim, hold Space to wind up, Enter throws at the set power ──
  const onKey = (e) => {
    const g = game.current;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if ((!g || g.phase === 'over') && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      if (!e.repeat) start();
      return;
    }
    if (!g || g.phase !== 'aim') return;
    const a = aim.current;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      a.yaw = Math.max(-TOSS.maxYaw, Math.min(TOSS.maxYaw, a.yaw + (e.key === 'ArrowRight' ? 0.02 : -0.02)));
      a.active = true;
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      a.power = Math.max(0, Math.min(1, a.power + (e.key === 'ArrowUp' ? 0.03 : -0.03)));
      a.active = true;
      setPower(a.power);
    } else if (e.key === ' ' && !e.repeat) {
      e.preventDefault();
      audioContext();
      a.charging = true;
      a.t0 = performance.now();
    } else if (e.key === 'Enter' && !e.repeat) {
      e.preventDefault();
      fire(a.yaw, a.power);
    }
  };
  const onKeyUp = (e) => {
    const a = aim.current;
    if (e.key === ' ' && a.charging) {
      e.preventDefault();
      a.charging = false;
      setPower(null);
      fire(a.yaw, a.power);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      setTimeout(() => {
        if (!aim.current.charging && !drag.current) aim.current.active = false;
      }, 600);
    }
  };

  const windSpeed = Math.hypot(ui.wind.x, ui.wind.z);
  // the wind arrow: + x is to your right, + z away from you
  const windAngle = (Math.atan2(-ui.wind.z, ui.wind.x) * 180) / Math.PI;
  const playing = ui.phase === 'aim' || ui.phase === 'flying';
  const medal = ui.phase === 'over' ? medalFor(ui.score) : null;
  const ballsLeft = TOSS.balls - ui.throws;

  return (
    <div className="toss">
      <div
        ref={wrap}
        className="toss-stage"
        tabIndex={0}
        role="application"
        aria-label="Paper toss. Drag up from the paper to throw: sideways to aim, further for more power. Or use the left and right arrows to aim and hold Space to wind up."
        onKeyDown={onKey}
        onKeyUp={onKeyUp}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        data-3d={glState === 'on' || undefined}
      >
        <canvas ref={flatCanvas} className="toss-canvas toss-flat" aria-hidden="true" />
        {want3D && <canvas ref={glCanvas} className="toss-canvas toss-gl" aria-hidden="true" />}
        {glState === 'loading' && <p className="toss-loading">Setting up the bullpen…</p>}

        {/* the HUD */}
        <div className="toss-hud" aria-hidden={!playing} hidden={ui.phase === 'ready'}>
          <div className="toss-hud-left">
            <div className="toss-balls" aria-label={`${ballsLeft} of ${TOSS.balls} balls left`}>
              {Array.from({ length: TOSS.balls }, (_, i) => (
                <span key={i} className="toss-ball-icon" data-used={i >= ballsLeft || undefined} />
              ))}
            </div>
            <p className="toss-score">
              <span className="toss-score-n">{ui.score}</span>
              {ui.streak > 1 && <span className="toss-streak">×{Math.min(3, 1 + 0.5 * (ui.streak - 1))}</span>}
            </p>
          </div>
          <div className="toss-hud-right">
            <p className="toss-dist">{ui.dist.toFixed(1)} m</p>
            <p className="toss-wind" data-calm={windSpeed < 0.01 || undefined}>
              {windSpeed < 0.01 ? (
                'No wind'
              ) : (
                <>
                  <span className="toss-wind-arrow" style={{ transform: `rotate(${windAngle}deg)` }} aria-hidden="true">
                    ➜
                  </span>
                  Fan {windSpeed.toFixed(1)} m/s
                </>
              )}
            </p>
          </div>
        </div>
        {say.text && playing && (
          <p key={say.n} className="toss-say" data-good={say.good || undefined} role="status">
            {say.text}
          </p>
        )}
        {power !== null && playing && (
          <div className="toss-power" aria-hidden="true">
            <span style={{ transform: `scaleX(${power})` }} />
          </div>
        )}
        {ui.phase === 'aim' && ui.throws === 0 && power === null && (
          <p className="toss-hint" aria-hidden="true">
            Drag up from the paper to throw
          </p>
        )}

        {/* before the first round, and after the last ball */}
        {ui.phase === 'ready' && (
          <div className="toss-card">
            <p className="toss-card-kicker">Office Olympics</p>
            <h3 className="toss-card-title">Paper toss</h3>
            <p className="toss-card-body">Ten sheets of Dunder Mifflin’s finest, one wastebasket. Every basket moves the bin; after two, someone turns the fan on.</p>
            <button type="button" className="btn btn-primary" onClick={start}>
              Start
            </button>
            {best > 0 && <p className="toss-card-best">Best: {best}</p>}
          </div>
        )}
        {ui.phase === 'over' && (
          <div className="toss-card">
            {medal ? <span className={`toss-medal toss-medal-${medal}`} aria-hidden="true" /> : null}
            <p className="toss-card-kicker">{medal ? MEDAL_NAME[medal] : 'No medal. Michael is disappointed.'}</p>
            <h3 className="toss-card-title">{ui.score}</h3>
            <p className="toss-card-body">
              {ui.made} of {TOSS.balls} in, {ui.swishes} {ui.swishes === 1 ? 'swish' : 'swishes'}, best streak {ui.bestStreak}.{ui.score >= best && ui.score > 0 ? ' A new best.' : ` Best: ${best}.`}
            </p>
            <button type="button" className="btn btn-primary" onClick={start}>
              <RiRefreshLine className="h-4 w-4" aria-hidden="true" /> Again
            </button>
          </div>
        )}
      </div>

      <div className="toss-bar">
        <div className="toss-keys" aria-hidden="true">
          <kbd className="palette-kbd">
            <RiArrowLeftLine />
          </kbd>
          <kbd className="palette-kbd">
            <RiArrowRightLine />
          </kbd>
          <span>aim</span>
          <kbd className="palette-kbd">Space</kbd>
          <span>hold to wind up</span>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" aria-pressed={guide} onClick={() => setGuide((v) => !v)}>
          Aim guide: {guide ? 'first three' : 'off'}
        </button>
        {three.can && (
          <button type="button" className="btn btn-ghost btn-sm" aria-pressed={want3D} onClick={() => three.set(want3D ? 'off' : 'on')}>
            3D: {want3D ? 'on' : 'off'}
          </button>
        )}
        {glState === 'failed' && <span className="text-sm text-muted">3D couldn’t start here, so this is the 2D version.</span>}
        {glState === 'lost' && <span className="text-sm text-muted">The graphics chip let go, so this is the 2D version.</span>}
      </div>
    </div>
  );
}
