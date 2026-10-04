import { useCallback, useEffect, useRef, useState } from 'react';
import { useFrameLoop, useInView, useMediaQuery, useReducedMotion } from '../lib/hooks';
import { useAchievements } from '../components/Achievements';
import { H, W } from './gb/font';
import { newConsole, renderConsole, stepConsole } from './gb/console';
import './stages.css';

// A DMG-style handheld with a cartridge of three games: Super Tilak Land (a
// Mario-style platformer), Block Drop and Snake. Every control works — the
// D-pad and A/B can be held, by touch or keyboard.

const KEYS = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
  z: 'a',
  ' ': 'a',
  k: 'a',
  x: 'b',
  j: 'b',
  Enter: 'start',
  Shift: 'select',
  Backspace: 'select',
};
const BUTTONS = ['up', 'down', 'left', 'right', 'a', 'b', 'start', 'select'];

export default function GameBoyStage({ compact = false }) {
  const canvasRef = useRef(null);
  const deviceRef = useRef(null);
  const sys = useRef(null);
  if (!sys.current) sys.current = newConsole({ start: compact ? 'attract' : 'boot' });
  const input = useRef({ pressed: new Set(), ...Object.fromEntries(BUTTONS.map((b) => [b, false])) });
  const [viewRef, inView] = useInView({ rootMargin: '0px' });
  const reduced = useReducedMotion();
  const [started, setStarted] = useState(!reduced);
  const [held, setHeld] = useState({});
  const [focused, setFocused] = useState(false);
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const { unlock } = useAchievements();
  const events = useRef({});
  events.current.coin = (n) => n >= 10 && unlock('player');

  const running = inView && started;

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) renderConsole(ctx, sys.current);
  }, []);

  useFrameLoop((dt) => {
    stepConsole(sys.current, Math.min(dt, 50) / 1000, input.current, events.current);
    input.current.pressed.clear();
    draw();
  }, running);

  useEffect(() => {
    if (!running) draw();
  }, [running, draw]);

  const press = useCallback(
    (key, down) => {
      const st = input.current;
      if (down) {
        if (!st[key]) st.pressed.add(key);
        st[key] = true;
      } else st[key] = false;
      setHeld((h) => (h[key] === down ? h : { ...h, [key]: down }));
      if (down && !started) setStarted(true);
    },
    [started],
  );

  const releaseAll = () => BUTTONS.forEach((b) => input.current[b] && press(b, false));

  const onKey = (down) => (e) => {
    const k = KEYS[e.key] || KEYS[e.key.toLowerCase?.()];
    if (!k) return;
    e.preventDefault();
    if (down && e.repeat) return;
    press(k, down);
  };

  // pointer helpers: hold while pressed, release on up/leave/cancel
  const hold = (key) => ({
    onPointerDown: (e) => {
      e.preventDefault();
      deviceRef.current?.focus({ preventScroll: true });
      e.currentTarget.setPointerCapture?.(e.pointerId);
      press(key, true);
    },
    onPointerUp: () => press(key, false),
    onPointerCancel: () => press(key, false),
    onLostPointerCapture: () => press(key, false),
    onContextMenu: (e) => e.preventDefault(),
  });

  return (
    <div ref={viewRef} className={`flex flex-col items-center ${compact ? 'gap-3' : 'gap-5 py-4 sm:py-6'}`}>
      <div
        ref={deviceRef}
        className={`gb ${compact ? 'gb-compact' : ''}`}
        tabIndex={0}
        role="application"
        aria-label="Game Boy with three playable games. Arrow keys move, Z or Space is A, X is B, Enter is Start, Shift is Select."
        onKeyDown={onKey(true)}
        onKeyUp={onKey(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          releaseAll();
        }}
        onPointerDown={() => deviceRef.current?.focus({ preventScroll: true })}
      >
        <div className="gb-grooves" aria-hidden="true" />
        <div className="gb-bezel">
          <div className="gb-bezel-label" aria-hidden="true">
            <span className="gb-rule" />
            <span>DOT MATRIX · LR35902 CORE</span>
            <span className="gb-rule" />
          </div>
          <div className="gb-led" aria-hidden="true">
            <i data-on={running ? 'true' : 'false'} />
            <span>POWER</span>
          </div>
          <div className="gb-screen">
            <canvas ref={canvasRef} width={W} height={H} />
            {!started && (
              <button type="button" className="gb-start-overlay" onClick={() => setStarted(true)}>
                Press start
              </button>
            )}
          </div>
        </div>
        <p className="gb-brand" aria-hidden="true">
          Tilak <span>TP-01</span>
        </p>
        <div className="gb-controls">
          <div className="gb-dpad" data-held={['up', 'down', 'left', 'right'].filter((d) => held[d]).join(' ')}>
            <span className="gb-dpad-h" aria-hidden="true" />
            <span className="gb-dpad-v" aria-hidden="true" />
            <button type="button" className="gb-dpad-btn gb-up" aria-label="Up" {...hold('up')} />
            <button type="button" className="gb-dpad-btn gb-down" aria-label="Down" {...hold('down')} />
            <button type="button" className="gb-dpad-btn gb-left" aria-label="Left" {...hold('left')} />
            <button type="button" className="gb-dpad-btn gb-right" aria-label="Right" {...hold('right')} />
          </div>
          <div className="gb-ab">
            <button type="button" className="gb-btn" data-held={held.b ? 'true' : 'false'} aria-label="B" {...hold('b')}>
              <span>B</span>
            </button>
            <button type="button" className="gb-btn gb-btn-a" data-held={held.a ? 'true' : 'false'} aria-label="A" {...hold('a')}>
              <span>A</span>
            </button>
          </div>
        </div>
        <div className="gb-pills">
          <button type="button" aria-label="Select" {...hold('select')}>
            <i />
            <span>Select</span>
          </button>
          <button type="button" aria-label="Start" {...hold('start')}>
            <i />
            <span>Start</span>
          </button>
        </div>
        <div className="gb-speaker" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <i key={i} />
          ))}
        </div>
      </div>
      <p className="mono max-w-sm text-center text-xs leading-relaxed text-muted">
        {touch ? (
          <>Hold the D-pad to move, A to jump and B to run. Start picks a game; Select opens the menu.</>
        ) : focused ? (
          <>← → move · Z / Space = A (jump) · X = B (run) · Enter = Start · Shift = Select (menu)</>
        ) : (
          <>Click the Game Boy to play with your keyboard, or use the buttons. Start picks a game.</>
        )}
      </p>
    </div>
  );
}
