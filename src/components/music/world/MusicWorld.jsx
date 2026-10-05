import { useCallback, useEffect, useRef, useState } from 'react';
import { audioContext } from '../../../lib/audio';
import { use3D } from '../../../lib/gpu';
import { useFrameLoop, useInView, useMediaQuery } from '../../../lib/hooks';
import { capturePointer } from '../../../lib/pointer';
import { keyDown, keyUp } from '../../middleearth/towns/keys';
import { SWARA_NAME, bolLabel, onHarmoniumNote, onSitarChikari, onSitarPluck, onTablaBol, onTanpuraPluck, swaraOf } from '../engine';
import { INSTRUMENTS, PITCH, START, moveFor, nearInstrument, standFor, stickMove, walker } from './layout';
import './world.css';

// The music planet: land in a courtyard at dusk and walk about it, first
// person. The instruments lie on a rug before a sandstone chhatri; walk up to
// one and it opens to play (`panel(id)` is what plays it: the page's own
// sitar, tabla, harmonium and tanpura), and the camera comes to sit before it.
// Whatever sounds glows, and its notes float up as sargam. The courtyard is
// in ./layout.js, the drawing in ./scene.js. Without 3D, a card says what's
// missing and the page's instruments below play as ever.
//
// Keys: W S (or ↑ ↓) to walk, A D to step aside, ← → to turn, Shift to hurry;
// drag to look. E (or Enter) plays the instrument before you, Esc goes back.

const label = (ratio) => SWARA_NAME[swaraOf(ratio).s];
const TURN = 1.9; // radians a second, from the arrow keys

export default function MusicWorld({ panel }) {
  const three = use3D();
  const touch = useMediaQuery('(pointer: coarse)');
  const [gl, setGl] = useState('loading'); // loading | on | failed | lost
  const [models, setModels] = useState(false);
  const [near, setNear] = useState(null);
  const [open, setOpen] = useState(null);
  const [opened, setOpened] = useState([]); // panels made so far: they stay, so a theka plays on as you walk
  const [moved, setMoved] = useState(false);
  const canvas = useRef(null);
  const api = useRef(null);
  const wrap = useRef(null);
  const [viewRef, inView] = useInView({ rootMargin: '200px 0px' });
  const sim = useRef({ h: { x: START.x, z: START.z, face: 0, vx: 0, vz: 0 }, yaw: START.yaw, pitch: -0.06, held: new Set(), stick: null, drag: null, bob: 0, step: 0, near: null, open: null });
  const want = three.on && gl !== 'failed' && gl !== 'lost';

  // the world: made once 3D is on
  useEffect(() => {
    if (!want) return undefined;
    let dead = false;
    const fit = () => {
      const c = canvas.current;
      if (!c || !api.current) return;
      const r = c.getBoundingClientRect();
      api.current.resize(Math.round(r.width), Math.round(r.height));
    };
    import('./scene')
      .then(({ createMusicWorld }) => (dead || !canvas.current ? null : createMusicWorld(canvas.current, { onLost: () => !dead && setGl('lost') })))
      .then((a) => {
        if (!a) return;
        if (dead) {
          a.dispose();
          return;
        }
        api.current = a;
        if (import.meta.env.DEV) window.__MUSIC_WORLD__ = { api: a, sim: sim.current }; // for the QA scripts
        fit();
        setGl('on');
        a.loaded.then(() => !dead && setModels(true));
      })
      .catch((e) => {
        if (import.meta.env.DEV) console.error(e);
        if (!dead) setGl('failed');
      });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    if (canvas.current) ro?.observe(canvas.current);
    return () => {
      dead = true;
      ro?.disconnect();
      api.current?.dispose();
      api.current = null;
    };
    // made once; `want` turning false (3D off, a lost GPU) takes it down
  }, [want]);

  const live = gl === 'on' && inView;

  // whatever sounds, the courtyard shows: the instrument glows, its notes float up
  useEffect(() => {
    if (gl !== 'on') return undefined;
    const show = (id, text, k) => api.current && inView && api.current.sound(id, text, k);
    const offs = [
      onSitarPluck((r) => show('sitar', label(r), 0.6)),
      onSitarChikari(() => show('sitar', null, 0.22)),
      onHarmoniumNote((r) => show('harmonium', label(r), 0.5)),
      onTablaBol((bol) => show('tabla', bolLabel(bol), 0.45)),
      onTanpuraPluck((i, str) => show('tanpura', str?.label ?? null, 0.4)),
    ];
    return () => offs.forEach((off) => off());
  }, [gl, inView]);

  // ── playing an instrument ──
  const openPanel = useCallback((id) => {
    if (!id) return;
    audioContext(); // inside the press, so it can sound at once
    sim.current.open = id;
    sim.current.held.clear();
    setOpen(id);
    setOpened((o) => (o.includes(id) ? o : [...o, id]));
  }, []);
  const closePanel = useCallback(() => {
    sim.current.open = null;
    setOpen(null);
    wrap.current?.focus({ preventScroll: true });
  }, []);
  // focus comes to the panel as it opens
  useEffect(() => {
    if (!open) return;
    const el = document.getElementById(`mw-panel-${open}`);
    el?.querySelector('h3')?.focus({ preventScroll: true });
  }, [open]);

  // ── each frame ──
  useFrameLoop((ms) => {
    const s = sim.current;
    const a = api.current;
    if (!a) return;
    const dt = Math.min(0.05, ms / 1000);
    if (s.open) {
      // come to sit before the instrument, looking down at it
      const st = standFor(s.open);
      const k = 1 - Math.exp(-dt * 3.2);
      s.h = { ...s.h, x: s.h.x + (st.x - s.h.x) * k, z: s.h.z + (st.z - s.h.z) * k, vx: 0, vz: 0 };
      const dyaw = Math.atan2(Math.sin(st.yaw - s.yaw), Math.cos(st.yaw - s.yaw));
      s.yaw += dyaw * k;
      s.pitch += (-0.42 - s.pitch) * k;
      s.bob *= 1 - k;
    } else {
      const turn = (s.held.has('turnR') ? 1 : 0) - (s.held.has('turnL') ? 1 : 0);
      s.yaw -= turn * TURN * dt;
      const move = s.stick ? stickMove(s.stick.x, -s.stick.y, s.yaw, Math.hypot(s.stick.x, s.stick.y) > 0.92) : moveFor(s.held, s.yaw);
      const h = walker.step(s.h, move, dt);
      const speed = Math.hypot(h.vx, h.vz);
      s.step += speed * dt * 3.1;
      s.bob = Math.sin(s.step) * 0.03 * Math.min(1, speed / 2);
      s.h = h;
      if (speed > 0.3 && !moved) setMoved(true);
    }
    const n = s.open ? null : nearInstrument(s.h.x, s.h.z, s.yaw);
    if (n !== s.near) {
      s.near = n;
      setNear(n);
    }
    a.render({ x: s.h.x, z: s.h.z, yaw: s.yaw, pitch: s.pitch, bob: s.bob }, ms);
  }, live);

  // ── keys ──
  const onKeyDown = (e) => {
    const s = sim.current;
    if (s.open) return; // the panel's own keys
    if (e.key === 'e' || e.key === 'E' || e.key === 'Enter') {
      if (s.near && !e.repeat) {
        e.preventDefault();
        openPanel(s.near);
      }
      return;
    }
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
      e.preventDefault();
      s.held.add(e.code === 'ArrowLeft' ? 'turnL' : 'turnR');
      return;
    }
    const m = keyDown(s.held, e);
    if (m && m !== 'space') e.preventDefault();
  };
  const onKeyUp = (e) => {
    const s = sim.current;
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
      s.held.delete(e.code === 'ArrowLeft' ? 'turnL' : 'turnR');
      return;
    }
    keyUp(s.held, e);
  };
  const letGo = () => {
    sim.current.held.clear();
    sim.current.stick = null;
  };

  // ── looking: drag across the courtyard ──
  const onDown = (e) => {
    if (sim.current.open) return;
    wrap.current?.focus({ preventScroll: true });
    sim.current.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, touch: e.pointerType === 'touch' };
    if (e.pointerType !== 'touch') capturePointer(e);
  };
  const onMove = (e) => {
    const d = sim.current.drag;
    if (!d || d.id !== e.pointerId) return;
    const s = sim.current;
    s.yaw -= (e.clientX - d.x) * 0.0042;
    // on a touch screen an up-and-down swipe scrolls the page instead
    if (!d.touch) s.pitch = Math.max(PITCH.min, Math.min(PITCH.max, s.pitch - (e.clientY - d.y) * 0.0034));
    d.x = e.clientX;
    d.y = e.clientY;
  };
  const onUp = (e) => {
    if (sim.current.drag?.id === e.pointerId) sim.current.drag = null;
  };

  // ── the thumb stick, on a touch screen ──
  const stickEl = useRef(null);
  const onStick = (e) => {
    const s = sim.current;
    if (e.type === 'pointerdown') {
      capturePointer(e);
      const r = e.currentTarget.getBoundingClientRect();
      s.stickAt = { id: e.pointerId, cx: r.left + r.width / 2, cy: r.top + r.height / 2, r: r.width / 2 };
    }
    const at = s.stickAt;
    if (!at || at.id !== e.pointerId) return;
    if (e.type === 'pointerup' || e.type === 'pointercancel' || e.type === 'lostpointercapture') {
      s.stick = null;
      s.stickAt = null;
      if (stickEl.current) stickEl.current.style.transform = '';
      return;
    }
    let x = (e.clientX - at.cx) / at.r;
    let y = (e.clientY - at.cy) / at.r;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    s.stick = { x, y };
    if (stickEl.current) stickEl.current.style.transform = `translate(${x * 34}px, ${y * 34}px)`;
  };

  const toRoom = () => document.getElementById('music-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (!want)
    return (
      <div className="mw-off shell" ref={viewRef}>
        <div className="mw-off-card card">
          <p className="eyebrow">The music planet</p>
          <p className="mt-2 text-body">
            {three.held
              ? 'A courtyard at dusk to walk about in 3D, the instruments laid out on a rug for you to play. It downloads about 6 MB.'
              : gl === 'failed' || gl === 'lost'
                ? 'The courtyard’s 3D couldn’t start on this device. Every instrument plays below, as ever.'
                : 'A courtyard at dusk to walk about in 3D, the instruments laid out on a rug for you to play. It needs 3D, which is off.'}
          </p>
          {(three.held || (!three.on && three.can)) && (
            <button type="button" className="btn btn-primary mt-4" onClick={() => three.set('on')}>
              {three.held ? 'Load the courtyard' : 'Turn 3D on'}
            </button>
          )}
        </div>
      </div>
    );

  return (
    <div className="mw" ref={viewRef}>
      <div
        className="mw-stage"
        ref={wrap}
        tabIndex={0}
        role="application"
        aria-label="The music planet: a courtyard to walk about. W and S walk, A and D step aside, the arrows turn, drag to look; E plays the instrument in front of you."
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onBlur={(e) => {
          if (!wrap.current?.contains(e.relatedTarget)) letGo();
        }}
      >
        <canvas ref={canvas} className="mw-canvas" data-on={gl === 'on' || undefined} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
        {gl !== 'on' && <p className="mw-loading">Landing on the music planet…</p>}

        <div className="mw-hud mw-hud-top">
          <div>
            <p className="mw-eyebrow">The music planet</p>
            <h2 className="mw-title">A courtyard at dusk</h2>
            {gl === 'on' && !moved && !open && (
              <p className="mw-help">{touch ? 'The stick walks, a swipe across turns. Walk up to an instrument to play it.' : 'Click the courtyard, then W A S D to walk, ← → to turn, drag to look. Walk up to an instrument and press E.'}</p>
            )}
            {gl === 'on' && !models && <p className="mw-help">Bringing in the instruments…</p>}
          </div>
          <button type="button" className="mw-chip" onClick={toRoom}>
            The music room ↓
          </button>
        </div>

        {near && !open && (
          <div className="mw-hud mw-hud-bottom">
            <button type="button" className="mw-prompt" onClick={() => openPanel(near)}>
              Play the {INSTRUMENTS[near].name.toLowerCase()} {!touch && <kbd>E</kbd>}
            </button>
          </div>
        )}

        {touch && !open && gl === 'on' && (
          <div className="mw-stick" onPointerDown={onStick} onPointerMove={onStick} onPointerUp={onStick} onPointerCancel={onStick} onLostPointerCapture={onStick} aria-hidden="true">
            <span ref={stickEl} />
          </div>
        )}

        {opened.map((id) => (
          <section
            key={id}
            id={`mw-panel-${id}`}
            className="mw-panel"
            hidden={open !== id}
            aria-labelledby={`mw-panel-${id}-title`}
            onKeyDown={(e) => {
              // Esc goes back to the courtyard, except where an instrument uses it (the sitar's neck stops its string)
              if (e.key === 'Escape' && !e.target.closest?.('.sitar-neck-svg')) {
                e.stopPropagation();
                closePanel();
              }
            }}
          >
            <header className="mw-panel-head">
              <h3 id={`mw-panel-${id}-title`} tabIndex={-1}>
                {INSTRUMENTS[id].name}
              </h3>
              <button type="button" className="btn btn-ghost" onClick={closePanel}>
                Back to the courtyard
              </button>
            </header>
            <div className="mw-panel-body">{panel(id)}</div>
          </section>
        ))}
      </div>
    </div>
  );
}
