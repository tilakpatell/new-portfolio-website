import { useCallback, useEffect, useRef, useState } from 'react';
import { useFrameLoop, useInView, useReducedMotion } from '../lib/hooks';
import { useAchievements } from '../components/Achievements';
import { H, W, newGame, press, render, step } from './marioGame';
import './stages.css';

// A DMG-style handheld running "Super Tilak Land". The plumber runs on his own
// (attract mode); A, B, Space or ↑ jumps. START pauses. SELECT swaps between
// full colour and the original four-shade green screen.

export default function GameBoyStage({ compact = false }) {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  if (!gameRef.current) gameRef.current = newGame();
  const [viewRef, inView] = useInView({ rootMargin: '0px' });
  const reduced = useReducedMotion();
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [green, setGreen] = useState(false);
  const pressed = useRef(false);
  const { unlock } = useAchievements();

  const running = inView && !paused && (started || !reduced);

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) render(ctx, gameRef.current, { paused, hint: !pressed.current && gameRef.current.t < 14 });
  }, [paused]);

  const events = useRef({});
  events.current.coin = (n) => {
    if (n >= 10) unlock('player');
  };

  useFrameLoop((dt) => {
    step(gameRef.current, dt / 1000, events.current);
    draw();
  }, running);

  useEffect(() => {
    if (!running) draw();
  }, [running, draw, green]);

  const jump = useCallback(() => {
    setStarted(true);
    setPaused(false);
    pressed.current = true;
    press(gameRef.current);
  }, []);

  const togglePause = () => {
    setStarted(true);
    setPaused((v) => !v);
  };
  const togglePalette = () => {
    const g = gameRef.current;
    g.palette = g.palette === 'color' ? 'dmg' : 'color';
    setGreen(g.palette === 'dmg');
  };

  const onKeyDown = (e) => {
    const k = e.key.toLowerCase();
    if (k === ' ' || k === 'arrowup' || k === 'enter' || k === 'x' || k === 'z') {
      e.preventDefault();
      jump();
    } else if (k === 'p') togglePause();
    else if (k === 'g') togglePalette();
  };

  return (
    <div ref={viewRef} className={`flex flex-col items-center ${compact ? 'gap-4' : 'gap-5 py-4 sm:py-8'}`}>
      <div
        className={`gb ${compact ? 'gb-compact' : ''}`}
        tabIndex={0}
        role="application"
        aria-label="Playable Mario-style game on a Game Boy. Space or A jumps, P pauses, G toggles the green screen."
        onKeyDown={onKeyDown}
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
          <div className="gb-screen" onPointerDown={jump}>
            <canvas ref={canvasRef} width={W} height={H} />
            {reduced && !started && (
              <button type="button" className="gb-start-overlay" onClick={jump}>
                Press start
              </button>
            )}
          </div>
        </div>
        <p className="gb-brand" aria-hidden="true">
          Tilak <span>TP-01</span>
        </p>
        <div className="gb-controls">
          <div className="gb-dpad" aria-hidden="true">
            <button type="button" tabIndex={-1} className="gb-dpad-up" onPointerDown={jump} />
            <span className="gb-dpad-h" />
            <span className="gb-dpad-v" />
          </div>
          <div className="gb-ab">
            <button type="button" className="gb-btn" onPointerDown={jump} aria-label="B — jump">
              <span>B</span>
            </button>
            <button type="button" className="gb-btn gb-btn-a" onPointerDown={jump} aria-label="A — jump">
              <span>A</span>
            </button>
          </div>
        </div>
        <div className="gb-pills">
          <button type="button" onClick={togglePalette} aria-label={green ? 'Select: switch to colour' : 'Select: switch to green screen'}>
            <i />
            <span>Select</span>
          </button>
          <button type="button" onClick={togglePause} aria-label={paused ? 'Start: resume' : 'Start: pause'}>
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
      <p className="mono text-center text-xs text-muted">
        A · Space to jump · Start pauses · Select swaps colour ↔ green screen
      </p>
    </div>
  );
}
