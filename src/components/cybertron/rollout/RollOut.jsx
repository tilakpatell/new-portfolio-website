import { useCallback, useEffect, useRef, useState } from 'react';
import { RiFullscreenExitLine, RiFullscreenLine, RiPauseLine } from 'react-icons/ri';
import GpuGate from '../../games/GpuGate';
import { edges, readPad, typing } from '../../games/pad';
import { useAchievements } from '../../Achievements';
import AutobotMark from '../../AutobotMark';
import { audioContext } from '../../../lib/audio';
import { local, prefersReducedMotion, useMediaQuery } from '../../../lib/hooks';
import { ROLL, jump, newRun, nextWall, stepRun, transform } from './rules';
import { autopilot } from './pilot';
import './rollout.css';

// Roll out: the Transformers highway game, in WebGL only (behind the
// hardware acceleration gate). The rules are in ./rules.js, the drawing in
// ./RollOut3D.js; this is the screen, the controls and the HUD.

const sfx = () => import('../../../lib/sfx');
const cue = () => import('../../games/gameAudio');
const play = (name) => sfx().then((s) => s[name]?.());
const playCue = (name) => cue().then((s) => s[name]?.());
const buzz = (ms) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* no vibration */
  }
};

const BEST = 'tp-rollout-best';
const PREFS = 'tp-rollout-prefs';
const REACHED = 'tp-rollout-reached';
const LEVELS = Object.keys(ROLL.levels);
const BOTS = Object.keys(ROLL.bots);

const KEYS = {
  left: ['ArrowLeft', 'a', 'A'],
  right: ['ArrowRight', 'd', 'D'],
  action: [' ', 'ArrowUp', 'w', 'W'],
  transform: ['Shift', 't', 'T', 'e', 'E', 'ArrowDown', 's', 'S'],
  pause: ['p', 'P', 'Escape'],
};
const is = (k, key) => KEYS[k].includes(key);

const hint = (wall, mode) => {
  if (!wall || wall.dist > 160 || wall.dist < 3) return '';
  const m = Math.max(0, Math.round(wall.dist));
  if (wall.kind === 'barricade') return mode === 'robot' ? `Roadblock in ${m} m · jump it` : `Roadblock in ${m} m · transform and jump`;
  return mode === 'vehicle' ? `Bridge out in ${m} m · floor it off the ramp` : `Bridge out in ${m} m · back into vehicle mode`;
};

export default function RollOut() {
  return <GpuGate className="ro-gate">{({ soft, fail }) => <Game soft={soft} fail={fail} />}</GpuGate>;
}

function Game({ soft, fail }) {
  const { unlock } = useAchievements();
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const wrap = useRef(null);
  const canvas = useRef(null);
  const gl = useRef(null);
  const game = useRef(null);
  const demo = useRef(null);
  const keys = useRef({ left: false, right: false, boost: false });
  const padPrev = useRef(null);
  const drag = useRef(null);
  const hud = useRef({});
  const engineRef = useRef(null);
  const endText = useRef('');
  const prefs0 = local.get(PREFS, {}) ?? {};
  const [bot, setBot] = useState(BOTS.includes(prefs0.bot) ? prefs0.bot : 'optimus');
  const [level, setLevel] = useState(LEVELS.includes(prefs0.level) ? prefs0.level : 'autobot');
  const [startStage, setStartStage] = useState(0);
  const [reached, setReached] = useState(() => Math.min(2, Math.max(0, Number(local.get(REACHED, 0)) || 0)));
  const [best, setBest] = useState(() => {
    const b = local.get(BEST, {});
    return b && typeof b === 'object' ? b : {};
  });
  const [phase, setPhase] = useState('loading'); // loading | ready | running | paused | won | lost
  const [load, setLoad] = useState({ k: 0, label: 'Starting the renderer' });
  const [ui, setUi] = useState({ shields: 4, maxShields: 4, stage: 0, mode: 'vehicle', boss: null, result: null });
  const [callout, setCallout] = useState(null);
  const [full, setFull] = useState(false);
  const [quality, setQuality] = useState('');
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const calm = prefersReducedMotion();

  useEffect(() => {
    local.set(PREFS, { bot, level });
  }, [bot, level]);

  // ── the renderer ──
  // Each mount draws on a canvas of its own: two renderers sharing one
  // canvas would share one GL context, and step on each other's state.
  useEffect(() => {
    let dead = false;
    const el = wrap.current;
    const c = document.createElement('canvas');
    c.className = 'g3-canvas';
    el.prepend(c);
    canvas.current = c;
    let made = null;
    import('./RollOut3D')
      .then(({ createRollOut3D }) =>
        createRollOut3D(c, {
          // in development, tp-gl-force=hard draws the full pipeline even on
          // software WebGL (for checking the picture in a headless browser)
          soft: soft && !(import.meta.env.DEV && localStorage.getItem('tp-gl-force') === 'hard'),
          bot,
          alive: () => !dead,
          onLost: () => !dead && fail('lost'),
          onSlow: () => setQuality('low'),
          onProgress: (k, label) => !dead && setLoad({ k, label }),
        }),
      )
      .then((r) => {
        made = r;
        if (dead) {
          r.dispose();
          return;
        }
        gl.current = r;
        if (import.meta.env.DEV) window.__RO3D__ = r; // for the browser tests
        r.resize(el.clientWidth, el.clientHeight);
        setPhase('ready');
      })
      .catch(() => !dead && fail('failed'));
    return () => {
      dead = true;
      made?.dispose();
      if (gl.current === made) gl.current = null;
      c.remove();
    };
    // built once per mount; the bot changes through setBot
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    gl.current?.setBot(bot);
    demo.current = null;
  }, [bot]);

  // ── the HUD's words for what just happened ──
  const say = useCallback((text, tone = 'info') => setCallout({ text, tone, key: Math.random() }), []);

  const finish = useCallback(
    (g) => {
      const won = g.status === 'won';
      const prev = best[g.level] ?? 0;
      const isBest = g.score > prev;
      if (isBest) {
        const next = { ...best, [g.level]: g.score };
        setBest(next);
        local.set(BEST, next);
      }
      engineRef.current?.set({ on: false });
      setUi((u) => ({ ...u, result: { won, score: g.score, isBest, prev, stage: g.stage, kills: g.kills, cubes: g.taken, nears: g.nears, clears: g.clears, stunts: g.stunts, text: endText.current } }));
      setPhase(won ? 'won' : 'lost');
    },
    [best],
  );

  const drain = useCallback(
    (g) => {
      for (const e of g.events) {
        switch (e.type) {
          case 'transform':
            play('transform');
            break;
          case 'shot':
            play('laser');
            break;
          case 'kill':
            play(e.kind === 'debris' ? 'pop' : 'boom');
            buzz(20);
            if (e.combo > 1) say(`${e.combo}× combo`, 'good');
            break;
          case 'hit':
            play('hit');
            buzz(120);
            hud.current.flash?.removeAttribute('data-on');
            void hud.current.flash?.offsetWidth;
            hud.current.flash?.setAttribute('data-on', '');
            setUi((u) => ({ ...u, shields: g.shields }));
            if (g.shields === 1) say('Shields failing', 'bad');
            break;
          case 'cube':
            playCue('energon');
            break;
          case 'near':
            playCue('nearMiss');
            say('Close call +40', 'good');
            break;
          case 'cleared': {
            const what = e.kind === 'gap' ? 'Bridge jumped' : 'Roadblock cleared';
            const pts = e.points * Math.min(5, e.combo);
            if (e.clutch) play('ding');
            say(`${e.clutch ? 'Just in time! ' : ''}${what} +${pts}`, 'good');
            break;
          }
          case 'stunt':
            play('oneUp');
            say(`Mid-air transform +${e.points}`, 'good');
            break;
          case 'stagger':
            play('clang');
            buzz(60);
            say(`${e.name} staggered: double damage`, 'boss');
            break;
          case 'jump':
            playCue('servoJump');
            break;
          case 'leap':
            play('zip');
            say('Transform leap', 'good');
            break;
          case 'launch':
            play('zip');
            break;
          case 'fell':
            play('bridge');
            say('Ratchet bridged you out', 'bad');
            break;
          case 'empty':
            playCue('powerDown');
            say('Out of energon', 'bad');
            break;
          case 'low':
            say('Not enough energon to stand', 'bad');
            break;
          case 'spark':
            play('repulsor');
            say('Allspark shard: invincible', 'good');
            break;
          case 'vehicons':
            say('Vehicons behind you', 'bad');
            break;
          case 'jet':
            play('flyby');
            break;
          case 'boss':
            playCue('bossSting');
            say(e.name, 'boss');
            setUi((u) => ({ ...u, boss: e.name }));
            break;
          case 'bossPhase':
            say(e.phase === 3 ? `${e.name} is furious` : `${e.name} is rattled`, 'boss');
            break;
          case 'fusion':
            play('fusion');
            break;
          case 'wave':
            play('thunder');
            break;
          case 'bossDown':
            play('boom');
            setTimeout(() => play('victory'), 600);
            say(`${e.name} is down`, 'good');
            if (e.name === 'Starscream') unlock('grounded');
            if (e.name === 'Megatron') unlock('onestand');
            setUi((u) => ({ ...u, boss: null }));
            break;
          case 'clear':
            play('bridge');
            break;
          case 'won':
          case 'lost':
            endText.current = e.text;
            break;
          case 'stage': {
            setUi((u) => ({ ...u, stage: e.index, shields: g.shields }));
            if (g === game.current) {
              say(e.name, 'stage');
              if (e.index > reached) {
                setReached(e.index);
                local.set(REACHED, e.index);
              }
            }
            break;
          }
          default:
        }
      }
      g.events.length = 0;
      if (g.mode !== ui.mode) setUi((u) => (u.mode === g.mode ? u : { ...u, mode: g.mode }));
    },
    [reached, say, ui.mode, unlock],
  );
  const drainRef = useRef(drain);
  drainRef.current = drain;
  const finishRef = useRef(finish);
  finishRef.current = finish;

  // ── start, pause ──
  const start = useCallback(() => {
    audioContext(); // in the click, so the run can be heard
    const g = newRun({ seed: (Date.now() & 0xffffff) || 1, level, bot, stage: startStage });
    game.current = g;
    if (import.meta.env.DEV) window.__ROLLOUT__ = g; // for the browser tests
    keys.current = { left: false, right: false, boost: false };
    setUi({ shields: g.shields, maxShields: g.maxShields, stage: g.stage, mode: 'vehicle', boss: null, result: null });
    setCallout(null);
    engineRef.current?.stop();
    cue().then((c) => {
      if (game.current === g) engineRef.current = c.engine({ diesel: bot === 'optimus' });
    });
    setPhase('running');
    say(bot === 'optimus' ? 'Autobots, roll out' : 'Bumblebee, roll out', 'stage');
    wrap.current?.focus({ preventScroll: true });
  }, [bot, level, say, startStage]);

  const pause = useCallback((on) => {
    if (on && phaseRef.current === 'running') {
      setPhase('paused');
      engineRef.current?.set({ on: false });
      keys.current = { left: false, right: false, boost: false };
    } else if (!on && phaseRef.current === 'paused') {
      audioContext();
      if (game.current) game.current.last = 0;
      setPhase('running');
      wrap.current?.focus({ preventScroll: true });
    }
  }, []);

  useEffect(() => () => engineRef.current?.stop(), []);

  // ── the loop ──
  useEffect(() => {
    if (phase === 'loading') return undefined;
    let raf = 0;
    let last = 0;
    let visible = true;
    let lastWallText = '';
    const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (!visible) pause(true);
    }) : null;
    io?.observe(wrap.current);
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      const ms = last ? Math.min(100, now - last) : 16;
      last = now;
      if (!visible || document.hidden || !gl.current) return;
      const running = phaseRef.current === 'running';
      let g = game.current;
      if (running && g) {
        // the controls: keys, a stick, or a finger
        const pad = readPad();
        const pe = edges(pad, padPrev.current);
        padPrev.current = pad;
        let steer = (keys.current.right ? 1 : 0) - (keys.current.left ? 1 : 0);
        if (pad) {
          steer = steer || pad.lx || (pad.right ? 1 : 0) - (pad.left ? 1 : 0);
          if (pe.x || pe.b || pe.rb || pe.y) transform(g);
          if (pe.a && g.mode === 'robot') jump(g);
          if (pe.start) pause(true);
        }
        g.input = { steer: drag.current ? 0 : steer, boost: keys.current.boost || Boolean(pad?.a && g.mode === 'vehicle') };
        stepRun(g, ms / 1000);
        drainRef.current(g);
        engineRef.current?.set({ speed: g.speed, robot: g.morph, boost: g.boosting, on: true });
        if (g.status !== 'running') finishRef.current(g);
      } else if (!g || phaseRef.current === 'ready') {
        // the ready screen: the autopilot drives
        if (!demo.current || demo.current.status !== 'running' || demo.current.z > 1150) {
          demo.current = newRun({ seed: (Math.random() * 1e6) | 0, level: 'recruit', bot });
          demo.current.speed = demo.current.vehicleSpeed;
        }
        g = demo.current;
        autopilot(g);
        stepRun(g, ms / 1000);
        g.events.length = 0;
      }
      try {
        gl.current.render(g, ms, { calm });
      } catch (err) {
        if (import.meta.env.DEV) console.error(err);
        fail('failed');
        return;
      }
      // the HUD's moving parts, straight into the DOM
      const h = hud.current;
      if (h.energon) h.energon.style.transform = `scaleX(${(g.energon / ROLL.energon.max).toFixed(3)})`;
      if (h.score) h.score.textContent = g.score.toLocaleString();
      if (h.progress) {
        const k = Math.max(0, Math.min(1, (g.z - g.stageStart) / (g.stageLen - g.stageStart)));
        h.progress.style.transform = `scaleX(${k.toFixed(3)})`;
      }
      if (h.bossBar && g.boss) h.bossBar.style.transform = `scaleX(${Math.max(0, g.boss.hp / g.boss.max).toFixed(3)})`;
      if (h.speed) h.speed.textContent = `${Math.round(g.speed * 3.6)} km/h`;
      if (h.wall) {
        const text = running ? hint(nextWall(g, 170), g.mode) : '';
        if (text !== lastWallText) {
          lastWallText = text;
          h.wall.textContent = text;
          h.wall.dataset.kind = text.startsWith('Road') ? 'block' : 'gap';
          h.wall.hidden = !text;
        }
      }
      if (wrap.current) {
        // the green wash peaks as the stage changes, halfway through the bridge
        const b = g.bridge > 0 ? Math.min(1, Math.sin((1 - g.bridge / ROLL.bridgeTime) * Math.PI) * 1.4) : 0;
        wrap.current.dataset.bridge = b > 0 ? '1' : '';
        wrap.current.style.setProperty('--b', b.toFixed(2));
      }
    };
    raf = requestAnimationFrame(loop);
    const onVis = () => document.hidden && pause(true);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [phase, bot, calm, fail, pause]);

  // ── keys, anywhere on the page while a run is on ──
  useEffect(() => {
    if (phase !== 'running' && phase !== 'paused') return undefined;
    const down = (e) => {
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const g = game.current;
      if (!g) return;
      if (is('pause', e.key)) {
        e.preventDefault();
        pause(phaseRef.current === 'running');
        return;
      }
      if (phaseRef.current !== 'running') return;
      if (e.target instanceof HTMLButtonElement && e.target.dataset.ro == null && (e.key === ' ' || e.key === 'Enter')) return;
      if (is('left', e.key)) keys.current.left = true;
      else if (is('right', e.key)) keys.current.right = true;
      else if (is('action', e.key)) {
        if (g.mode === 'robot') {
          if (!e.repeat) jump(g);
        } else {
          if (!keys.current.boost) playCue('boost');
          keys.current.boost = true;
        }
      } else if (is('transform', e.key)) {
        if (!e.repeat) transform(g);
      } else return;
      e.preventDefault();
    };
    const up = (e) => {
      if (is('left', e.key)) keys.current.left = false;
      if (is('right', e.key)) keys.current.right = false;
      if (is('action', e.key)) keys.current.boost = false;
    };
    const blur = () => {
      keys.current = { left: false, right: false, boost: false };
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [phase, pause]);

  // ── a finger (or a mouse) drags to steer ──
  const onPointerDown = (e) => {
    const g = game.current;
    if (phase !== 'running' || !g || e.target.closest('button')) return;
    drag.current = { id: e.pointerId, x: e.clientX, tx: g.tx };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    const g = game.current;
    if (!d || d.id !== e.pointerId || !g) return;
    const w = wrap.current.clientWidth;
    g.tx = Math.max(-ROLL.bounds, Math.min(ROLL.bounds, d.tx + ((e.clientX - d.x) / w) * 16));
  };
  const endDrag = (e) => {
    if (drag.current?.id === e.pointerId) drag.current = null;
  };
  const action = (on) => {
    const g = game.current;
    if (!g || phase !== 'running') return;
    if (g.mode === 'robot') {
      if (on) jump(g);
    } else {
      if (on && !keys.current.boost) playCue('boost');
      keys.current.boost = on;
    }
  };
  const holdAction = {
    onPointerDown: (e) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      action(true);
    },
    onPointerUp: () => action(false),
    onPointerCancel: () => action(false),
    onLostPointerCapture: () => action(false),
    onContextMenu: (e) => e.preventDefault(),
  };

  // ── fullscreen ──
  useEffect(() => {
    const on = () => setFull(document.fullscreenElement === wrap.current);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else wrap.current?.requestFullscreen?.().catch(() => {});
  };

  // the canvas follows the frame's size
  useEffect(() => {
    const el = wrap.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => gl.current?.resize(el.clientWidth, el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const running = phase === 'running';
  const over = phase === 'won' || phase === 'lost';
  const r = ui.result;
  const stageName = ROLL.stages[ui.stage]?.name ?? '';
  return (
    <div className="ro">
      <div
        ref={wrap}
        className="g3 ro-screen"
        tabIndex={0}
        role="group"
        aria-label="Roll out. Left and right (or A and D) steer. Space or up jumps as a robot and boosts as a vehicle; keep it held as you transform to leap. Shift, T or down transforms. P pauses. On a touch screen, drag to steer."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={(e) => {
          if (e.target === e.currentTarget && (phase === 'ready' || over) && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            start();
          }
        }}
        style={{ touchAction: running ? 'none' : 'auto' }}
        data-phase={phase}
      >

        {phase === 'loading' && (
          <div className="g3-loading">
            <div className="grid justify-items-center">
              <span>{load.label}…</span>
              <div className="g3-loading-bar" style={{ '--k': load.k }} />
            </div>
          </div>
        )}

        <div ref={(n) => (hud.current.root = n)} className="g3-hud ro-hud" hidden={!running && phase !== 'paused'}>
          <div className="ro-hud-left">
            <div className="ro-shields" aria-label={`${ui.shields} of ${ui.maxShields} shields`}>
              {Array.from({ length: ui.maxShields }, (_, i) => (
                <span key={i} data-on={i < ui.shields || undefined}>
                  <AutobotMark />
                </span>
              ))}
            </div>
            <div className="ro-energon">
              <span>Energon</span>
              <div className="g3-meter" style={{ '--meter': 'linear-gradient(90deg,#c2187a,#ff5fc8)' }}>
                <i ref={(n) => (hud.current.energon = n)} />
              </div>
            </div>
            <div className="ro-mode" data-mode={ui.mode}>
              {ui.mode === 'robot' ? 'Robot' : 'Vehicle'}
              <small ref={(n) => (hud.current.speed = n)} />
            </div>
          </div>
          <div className="ro-hud-centre">
            {ui.boss ? (
              <div className="ro-boss">
                <span>{ui.boss}</span>
                <div className="g3-meter" style={{ '--meter': 'linear-gradient(90deg,#7a2fb8,#ff3a5a)' }}>
                  <i ref={(n) => (hud.current.bossBar = n)} />
                </div>
              </div>
            ) : (
              <div className="ro-stage">
                <span>{stageName}</span>
                <div className="g3-meter" style={{ '--meter': '#ffd28c' }}>
                  <i ref={(n) => (hud.current.progress = n)} />
                </div>
              </div>
            )}
            <p ref={(n) => (hud.current.wall = n)} className="ro-wall" hidden />
          </div>
          <div className="ro-hud-right">
            <span className="ro-score" ref={(n) => (hud.current.score = n)}>
              0
            </span>
            <small>score</small>
          </div>
          {callout && (
            <p key={callout.key} className="g3-callout" data-tone={callout.tone} onAnimationEnd={() => setCallout(null)}>
              {callout.text}
            </p>
          )}
        </div>
        <div ref={(n) => (hud.current.flash = n)} className="g3-flash" />
        <div className="ro-bridge" aria-hidden="true" />

        {(running || phase === 'paused') && (
          <div className="g3-tools">
            <button type="button" className="g3-tool" onClick={() => pause(phase === 'running')} aria-label={phase === 'paused' ? 'Resume' : 'Pause'}>
              <RiPauseLine />
            </button>
            <button type="button" className="g3-tool" onClick={toggleFull} aria-label={full ? 'Leave full screen' : 'Full screen'}>
              {full ? <RiFullscreenExitLine /> : <RiFullscreenLine />}
            </button>
          </div>
        )}

        {running && touch && (
          <>
            <div className="g3-touch ro-touch-left" onPointerDown={(e) => e.stopPropagation()}>
              <button type="button" data-ro className="g3-touch-btn ro-action" {...holdAction}>
                {ui.mode === 'robot' ? 'Jump' : 'Boost'}
              </button>
            </div>
            <div className="g3-touch ro-touch-right" onPointerDown={(e) => e.stopPropagation()}>
              <button type="button" data-ro className="g3-touch-btn ro-transform" onPointerDown={(e) => { e.stopPropagation(); transform(game.current); }}>
                Trans&shy;form
              </button>
            </div>
          </>
        )}

        {phase === 'paused' && (
          <div className="g3-overlay">
            <p className="ro-title">Paused</p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <button type="button" className="btn btn-primary" onClick={() => pause(false)}>
                Resume
              </button>
              <button type="button" className="btn btn-ghost ro-ghost" onClick={() => { engineRef.current?.set({ on: false }); setPhase('ready'); }}>
                Quit to the garage
              </button>
            </div>
          </div>
        )}

        {(phase === 'ready' || over) && (
          <div className="g3-overlay" data-soft>
            <div className="ro-card">
              {over && r ? (
                <>
                  <p className="ro-title">{r.won ? 'Till all are one.' : 'Autobot down.'}</p>
                  <p className="ro-sub">{r.text}</p>
                  <dl className="ro-stats">
                    <div>
                      <dt>Score</dt>
                      <dd>{r.score.toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt>{r.isBest ? 'New best' : 'Best'}</dt>
                      <dd>{(r.isBest ? r.score : r.prev).toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt>Reached</dt>
                      <dd>{ROLL.stages[r.stage].name}</dd>
                    </div>
                    <div>
                      <dt>Decepticons</dt>
                      <dd>{(r.kills.vehicon ?? 0) + (r.kills.jet ?? 0) + (r.kills.boss ?? 0)}</dd>
                    </div>
                    <div>
                      <dt>Energon</dt>
                      <dd>{r.cubes}</dd>
                    </div>
                    <div>
                      <dt>Close calls</dt>
                      <dd>{r.nears}</dd>
                    </div>
                    <div>
                      <dt>Cleared</dt>
                      <dd>{r.clears}</dd>
                    </div>
                    <div>
                      <dt>Stunts</dt>
                      <dd>{r.stunts}</dd>
                    </div>
                  </dl>
                </>
              ) : (
                <>
                  <p className="ro-title">Roll out</p>
                  <p className="ro-sub">Drive fast as a vehicle, fight as a robot. Transform in time: jump the roadblocks, take the ramps over the broken bridges, and get past Starscream, Shockwave and Megatron. The later you change, the more it pays; shoot a boss while it charges up to stagger it.</p>
                </>
              )}
              <div className="ro-pick" role="group" aria-label="Autobot">
                {BOTS.map((id) => (
                  <button key={id} type="button" aria-pressed={bot === id} onClick={() => setBot(id)} data-bot={id}>
                    <span className="ro-pick-mark">
                      <AutobotMark />
                    </span>
                    {ROLL.bots[id].name}
                    <small>{ROLL.bots[id].shields} shields · {id === 'optimus' ? 'heavy blaster' : 'rapid fire, quicker'}</small>
                  </button>
                ))}
              </div>
              <div className="g3-seg mt-3" role="group" aria-label="Difficulty">
                {LEVELS.map((id) => (
                  <button key={id} type="button" aria-pressed={level === id} onClick={() => setLevel(id)}>
                    {ROLL.levels[id].label}
                    {best[id] ? <small>{best[id].toLocaleString()}</small> : null}
                  </button>
                ))}
              </div>
              <div className="g3-seg mt-3" role="group" aria-label="Start from">
                {ROLL.stages.map((s, i) => (
                  <button key={s.id} type="button" aria-pressed={startStage === i} disabled={i > reached} onClick={() => setStartStage(i)} title={i > reached ? 'Reach it first' : undefined}>
                    {s.name.split(',')[0]}
                  </button>
                ))}
              </div>
              <button type="button" className="btn btn-primary mt-4" onClick={start}>
                {over ? 'Roll out again' : 'Roll out'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="g3-below">
        <div className="g3-keys" aria-hidden={touch || undefined}>
          {touch ? (
            <span>Drag to steer · Boost or Jump · Transform</span>
          ) : (
            <>
              <span>
                <kbd>←</kbd>
                <kbd>→</kbd> steer
              </span>
              <span>
                <kbd>Space</kbd> boost / jump
              </span>
              <span>
                <kbd>Shift</kbd> transform
              </span>
              <span>
                <kbd>Space</kbd> held through <kbd>Shift</kbd> leaps
              </span>
              <span>
                <kbd>P</kbd> pause
              </span>
              <span>A gamepad works too</span>
            </>
          )}
        </div>
        {quality && <p className="text-xs text-muted">Running at lower quality to keep it smooth.</p>}
      </div>
    </div>
  );
}
