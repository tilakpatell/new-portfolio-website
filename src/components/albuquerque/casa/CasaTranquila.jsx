import { useEffect, useRef, useState } from 'react';
import { audioContext } from '../../../lib/audio';
import { use3D } from '../../../lib/gpu';
import { local, useFrameLoop, useInView } from '../../../lib/hooks';
import HectorBell from '../HectorBell';
import HectorBoard from '../HectorBoard';
import { newGame, ring as ringBell, score, stepGame } from './rules';

// Face Off at Casa Tranquila, in 3D: spell Hector's three words on the
// nurse's letter board with his bell, then Gus comes to visit. Ring with the
// button, Space or Enter, or a tap on the room. Without 3D (no WebGL, 3D
// switched off, or the room couldn't start) the two 2D games stand in.

const sfx = () => import('../../../lib/sfx');
const clip = (id, opts) => import('../../../lib/clips').then((c) => c.playClip(id, opts));
const BEST = 'tp-hector-best';
const idle = { ...newGame(() => 0.5), phase: 'idle' }; // the room before a game

const LINE = {
  gus: 'Gus walks in.',
  bell: 'Ring it three times.',
  boom: '',
  after: 'The smoke clears. Gus walks out and straightens his tie.',
};

export default function CasaTranquila() {
  const three = use3D();
  const [box, inView] = useInView({ rootMargin: '0px' });
  const canvas = useRef(null);
  const api = useRef(null);
  const [gl, setGl] = useState('loading'); // loading | on | failed | lost
  const [glKey, setGlKey] = useState(0);
  const game = useRef(null);
  if (import.meta.env.DEV) window.__CASA__ = game; // the game, for the QA scripts
  const [view, setView] = useState(null); // the game, as the HUD shows it
  const [final, setFinal] = useState(null); // the score, once the words are spelled
  const [best, setBest] = useState(() => local.get(BEST, null));
  const bestRef = useRef(best);
  bestRef.current = best;
  const shownKey = useRef('');
  const afterAt = useRef(0); // when the smoke cleared, so the last card waits for Gus to walk out

  // the room: made when 3D is on, and given back when it goes
  useEffect(() => {
    if (!three.on) return undefined;
    let dead = false;
    setGl('loading');
    const fit = () => {
      const c = canvas.current;
      if (!c || !api.current) return;
      const r = c.getBoundingClientRect();
      api.current.resize(Math.round(r.width), Math.round(r.height));
    };
    import('./scene')
      .then(({ createCasa3D }) => createCasa3D(canvas.current, { onLost: () => !dead && setGl('lost') }))
      .then((a) => {
        if (dead) return a.dispose();
        api.current = a;
        if (import.meta.env.DEV) window.__CASA_GL__ = a; // renderer counts for the QA scripts
        fit();
        setGl('on');
      })
      .catch(() => !dead && setGl('failed'));
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    if (canvas.current) ro?.observe(canvas.current);
    window.addEventListener('resize', fit);
    return () => {
      dead = true;
      ro?.disconnect();
      window.removeEventListener('resize', fit);
      api.current?.dispose();
      api.current = null;
    };
  }, [three.on, glKey]);

  const playing = gl === 'on';
  useFrameLoop(
    (ms) => {
      const a = api.current;
      if (!a || a.lost) return;
      if (game.current) {
        const was = game.current.phase;
        game.current = stepGame(game.current, Math.min(0.05, ms / 1000));
        if (game.current.phase === 'after' && was !== 'after') afterAt.current = 0;
        if (game.current.phase === 'after') afterAt.current += Math.min(0.05, ms / 1000);
      }
      const s = game.current ?? idle;
      try {
        a.render(s, ms);
      } catch {
        a.dispose();
        api.current = null;
        setGl('failed');
        return;
      }
      // the HUD, when something it shows has changed
      const gone = s.phase === 'after' && afterAt.current > 4.6;
      const key = `${s.phase}|${s.w}|${s.typed}|${s.misses}|${s.rings}|${Math.floor(s.seconds)}|${gone}`;
      if (key !== shownKey.current) {
        shownKey.current = key;
        setView(game.current ? { ...s, gone } : null);
      }
    },
    playing && inView,
  );

  const start = () => {
    game.current = newGame();
    setFinal(null);
    setView({ ...game.current });
  };

  const ring = () => {
    if (!playing) return;
    audioContext(); // in the gesture, so it can be heard
    const g = game.current;
    if (!g || (g.phase === 'after' && view?.gone)) return start();
    const { state, event } = ringBell(g);
    game.current = state;
    if (event === 'ignored') return;
    api.current?.ring();
    clip('hectorBell').then((h) => !h && sfx().then((s) => s.ding()));
    if (event === 'miss') sfx().then((s) => s.buzz());
    if (event === 'word') sfx().then((s) => s.coin());
    if (event === 'gus') {
      const sc = score(state);
      setFinal({ score: sc, seconds: Math.round(state.seconds), misses: state.misses });
      if (bestRef.current == null || sc < bestRef.current) {
        setBest(sc);
        local.set(BEST, sc);
      }
      clip('gusHello', { when: 0.6 });
    }
    if (event === 'boom')
      clip('faceOff', { offset: 3.2 }).then(
        (h) =>
          !h &&
          sfx().then((s) => {
            s.boom();
            s.crumble(undefined, undefined, 0.2);
          }),
      );
    setView({ ...state });
  };
  const ringRef = useRef(ring);
  ringRef.current = ring;

  // Space or Enter rings while the room is on screen and a game is on
  useEffect(() => {
    if (!playing || !inView || !view) return undefined;
    const onKey = (e) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      const t = e.target;
      if (t instanceof HTMLElement && (t.closest('button, a, input, textarea, select, [contenteditable]') || t.isContentEditable)) return;
      e.preventDefault();
      if (!e.repeat) ringRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playing, inView, view]);

  // no 3D: the two 2D games
  if (!three.can || !three.on || gl === 'failed' || gl === 'lost') {
    return (
      <div className="grid gap-10">
        {three.can && (
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
            {gl === 'lost' ? 'The graphics chip reset, so here it is in 2D.' : gl === 'failed' ? 'The 3D room couldn’t start here, so here it is in 2D.' : '3D is switched off, so here it is in 2D.'}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                if (!three.on) three.set('auto');
                setGl('loading'); // the room's canvas first, then the scene on it
                setGlKey((k) => k + 1);
              }}
            >
              {three.on ? 'Try 3D again' : 'Turn 3D on'}
            </button>
          </div>
        )}
        <HectorBoard />
        <HectorBell />
      </div>
    );
  }

  const s = view;
  const word = s ? s.words[s.w] : '';
  const spelling = s && (s.phase === 'rows' || s.phase === 'letters');
  return (
    <div ref={box} className="wm" data-place="casa">
      <header className="wm-bar">
        <span className="wm-day">Casa Tranquila</span>
        {spelling ? (
          <>
            <span>
              Word {s.w + 1} of 3: <b className="ct-word">{word}</b>
            </span>
            <span className={s.misses ? 'ct-miss' : undefined}>
              {s.misses} {s.misses === 1 ? 'miss' : 'misses'}
            </span>
            <span>{Math.floor(s.seconds)} s</span>
          </>
        ) : (
          <span>{final ? `Spelled in ${final.seconds} s, ${final.misses} ${final.misses === 1 ? 'miss' : 'misses'}: ${final.score}` : 'Hector has something to say'}</span>
        )}
        <span className="wm-place">{best != null ? `Best ${best}` : 'No best yet'}</span>
      </header>
      <div
        className="wm-stage"
        onPointerDown={(e) => {
          if (e.target === e.currentTarget || e.target === canvas.current) ring();
        }}
      >
        <canvas key={glKey} ref={canvas} className="wm-canvas" data-on={gl === 'on' || undefined} aria-hidden="true" />
        {gl === 'loading' && <p className="wm-loading">Visiting Casa Tranquila…</p>}
        {gl === 'on' && !s && (
          <div className="wm-card">
            <p className="wm-card-title">Face Off</p>
            <p className="wm-card-text">The nurse runs her finger along the letter board. Ring Hector’s bell to pick the row, then again on the letter. Three words, as fast as you can; every wrong ring costs five seconds. Then he has a visitor.</p>
            <div className="wm-row">
              <button type="button" className="btn btn-primary wm-big" onClick={ring}>
                Ring the bell
              </button>
            </div>
          </div>
        )}
        {gl === 'on' && s?.phase === 'after' && s.gone && (
          <div className="wm-card">
            <p className="wm-card-title">{LINE.after}</p>
            {final && (
              <p className="wm-card-text">
                Hector spelled it in {final.seconds} seconds with {final.misses} {final.misses === 1 ? 'miss' : 'misses'}: {final.score}.{best === final.score ? ' Your best.' : ` Your best is ${best}.`}
              </p>
            )}
            <div className="wm-row">
              <button type="button" className="btn btn-primary wm-big" onClick={start}>
                Again
              </button>
            </div>
          </div>
        )}
      </div>
      {gl === 'on' && s && !(s.phase === 'after' && s.gone) && (
        <div className="wm-panel">
          <div className="wm-row">
            <button type="button" className="btn btn-primary wm-big ct-ding" onClick={ring} disabled={s.phase === 'gus' || s.phase === 'boom' || s.phase === 'after'}>
              Ding <kbd>Space</kbd>
            </button>
          </div>
          <p className="wm-hint" role="status">
            {spelling ? (s.phase === 'rows' ? `Ring when her finger is on the row with ${word[s.typed.length]}.` : `Ring on ${word[s.typed.length]}.`) : s.phase === 'bell' ? `${LINE.bell}${s.rings ? ` ${'Ding. '.repeat(s.rings).trim()}` : ''}` : LINE[s.phase]}
          </p>
        </div>
      )}
    </div>
  );
}
