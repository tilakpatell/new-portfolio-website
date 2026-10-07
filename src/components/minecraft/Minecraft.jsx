import { useCallback, useEffect, useRef, useState } from 'react';
import '@fontsource/press-start-2p/400.css';
import { useMediaQuery } from '../../lib/hooks';
import { capturePointer } from '../../lib/pointer';
import { WorldHost, useWorld } from '../../runtime';
import module from './module';
import { MC } from './scene/atlasTexture';
import './minecraft.css';

// The Minecraft tribute, on the page or over the island: the world module
// (./module.js) in its box, and over it the game's HUD (the crosshair, the
// hotbar and its selection, the air bubbles under water, all the pack's own
// sprites), the title (Play, New world with a seed, Back), the game menu on
// Esc, and Pocket Edition's touch controls on a phone: a stick on the left,
// look by dragging the right, jump and sneak buttons.
//
// <Minecraft mode="page" | "overlay" onExit />

const sprite = (name) => `${MC}sprites/${name}.webp`;

// where a screen's slots sit on the pack's panel, in its pixels (the game's own layout)
const GRID = {
  2: { x: 98, y: 18, result: [154, 28] },
  3: { x: 30, y: 17, result: [124, 35] },
};
const slotAt = (i) => (i < 9 ? [8 + i * 18, 142] : [8 + ((i - 9) % 9) * 18, 84 + Math.floor((i - 9) / 9) * 18]);

// a stack as the game draws it: its picture, its count bottom right, a tool's wear under it
function Stack({ s, api }) {
  if (!s) return null;
  return (
    <span className="mc-stack">
      <img src={api()?.icon(s.item) ?? ''} alt="" />
      {s.count > 1 && <b>{s.count}</b>}
      {s.wear != null && (
        <i>
          <i style={{ width: `${Math.round(s.wear * 100)}%`, background: `hsl(${Math.round(s.wear * 120)} 100% 50%)` }} />
        </i>
      )}
    </span>
  );
}

// the inventory (2 × 2) or the crafting table (3 × 3), on the pack's panel
function Screen({ screen, api }) {
  const [at, setAt] = useState(null);
  const panel = useRef(null);
  const grid = GRID[screen.size];
  const press = (area, index) => (e) => {
    e.preventDefault();
    api()?.click({ area, index, button: e.button === 2 ? 'right' : 'left', shift: e.shiftKey });
  };
  const slot = (area, index, [x, y], s) => (
    <button key={`${area}${index}`} type="button" className="mc-slot" style={{ '--x': x, '--y': y }} onMouseDown={press(area, index)} onContextMenu={(e) => e.preventDefault()} aria-label={s ? `${s.count} ${s.item.replace(/_/g, ' ')}` : 'Empty'}>
      <Stack s={s} api={api} />
    </button>
  );
  return (
    <div
      className="mc-screen mc-dim"
      role="dialog"
      aria-label={screen.size === 3 ? 'Crafting table' : 'Inventory'}
      onMouseMove={(e) => {
        const r = panel.current?.getBoundingClientRect();
        if (r) setAt({ x: e.clientX - r.left, y: e.clientY - r.top });
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <button type="button" className="mc-key mc-close-key" aria-label="Close" onClick={() => api()?.press('inventory', true) || api()?.press('inventory', false)}>
        ×
      </button>
      <div ref={panel} className="mc-panel" style={{ backgroundImage: `url(${sprite(screen.size === 3 ? 'crafting_table' : 'inventory')})` }}>
        {screen.grid.map((s, i) => slot('grid', i, [grid.x + (i % screen.size) * 18, grid.y + Math.floor(i / screen.size) * 18], s))}
        {slot('result', 0, grid.result, screen.result && { ...screen.result, wear: null })}
        {screen.slots.map((s, i) => slot('inv', i, slotAt(i), s))}
        {screen.cursor && at && (
          <span className="mc-held" style={{ left: at.x, top: at.y }}>
            <Stack s={screen.cursor} api={api} />
          </span>
        )}
      </div>
    </div>
  );
}

export default function Minecraft({ mode = 'page', onExit = null }) {
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const [ui, setUi] = useState({ mode: 'loading' });
  const [hud, setHud] = useState(null);
  const [seed, setSeed] = useState('');
  const [props] = useState(() => ({}));
  const onEvent = useCallback((e) => {
    if (e.type === 'ui') setUi(e);
    else if (e.type === 'hud') setHud(e);
  }, []);
  const { host, status, rt } = useWorld(module, { props, onEvent });
  const api = useCallback(() => (rt?.current?.module === module ? rt.current.world : null), [rt]);
  const playing = ui.mode === 'play';
  const paused = ui.mode === 'pause';
  const screenOpen = ui.mode === 'inventory' || ui.mode === 'table';

  // ── the pointer held while playing: its moves turn the head ──
  const lock = () => {
    const el = host.current;
    if (!touch && el && document.pointerLockElement !== el) el.requestPointerLock?.()?.catch?.(() => {});
  };
  useEffect(() => {
    const el = host.current;
    const onMove = (e) => {
      if (document.pointerLockElement && document.pointerLockElement === host.current) api()?.look(e.movementX, e.movementY);
    };
    // the browser lets go of the pointer on Esc: that's the pause
    const onChange = () => {
      if (!document.pointerLockElement) api()?.pause(true);
    };
    // the buttons, while the pointer is held: left digs, right builds and uses
    const button = (down) => (e) => {
      if (document.pointerLockElement !== host.current) return;
      const name = e.button === 0 ? 'attack' : e.button === 2 ? 'use' : null;
      if (name) api()?.press(name, down);
    };
    const onDown = button(true);
    const onUp = button(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('pointerlockchange', onChange);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('pointerlockchange', onChange);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('mouseup', onUp);
      if (el && document.pointerLockElement === el) document.exitPointerLock?.();
    };
  }, [api, host]);

  // a screen frees the pointer, and lets go of the buttons
  useEffect(() => {
    if (!screenOpen) return;
    api()?.press('attack', false);
    api()?.press('use', false);
    if (document.pointerLockElement) document.exitPointerLock?.();
  }, [screenOpen, api]);

  // Esc at the title leaves; E or Esc on a screen takes the pointer back as the world closes it
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Escape' && ui.mode === 'title' && onExit) onExit();
      // (the world closes the screen on the same key; the pointer can only be taken back from here)
      if ((e.code === 'KeyE' || e.code === 'Escape') && (ui.mode === 'inventory' || ui.mode === 'table')) lock();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ui.mode, onExit, api]); // eslint-disable-line react-hooks/exhaustive-deps

  const play = () => {
    api()?.start();
    lock();
  };
  const resume = () => {
    api()?.pause(false);
    lock();
  };
  const fresh = () => {
    api()?.newWorld(seed.trim() || undefined);
    setSeed('');
    lock();
  };

  // ── touch: the stick, looking by dragging, the buttons ──
  const stickRef = useRef(null);
  const stickId = useRef(null);
  const lookId = useRef(null);
  const lookAt = useRef({ x: 0, y: 0 });
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const moveStick = (e) => {
    const el = stickRef.current;
    if (!el || e.pointerId !== stickId.current) return;
    const r = el.getBoundingClientRect();
    let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    let y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const m = Math.hypot(x, y);
    if (m > 1) {
      x /= m;
      y /= m;
    }
    setKnob({ x, y });
    api()?.stick(x, -y);
  };
  const stickDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    stickId.current = e.pointerId;
    capturePointer(e);
    moveStick(e);
  };
  const stickUp = (e) => {
    if (e.pointerId !== stickId.current) return;
    stickId.current = null;
    setKnob({ x: 0, y: 0 });
    api()?.stick(0, 0);
  };
  // Pocket Edition's touch: drag to look; hold still to dig; a quick tap places or uses
  const gesture = useRef(null);
  const lookDown = (e) => {
    if (!touch || !playing || lookId.current !== null) return;
    lookId.current = e.pointerId;
    lookAt.current = { x: e.clientX, y: e.clientY };
    const g = { at: performance.now(), x: e.clientX, y: e.clientY, moved: false, digging: false };
    g.timer = setTimeout(() => {
      if (g.moved) return;
      g.digging = true;
      api()?.press('attack', true);
    }, 280);
    gesture.current = g;
  };
  const lookMove = (e) => {
    if (e.pointerId !== lookId.current) return;
    api()?.look((e.clientX - lookAt.current.x) * 1.6, (e.clientY - lookAt.current.y) * 1.6);
    lookAt.current = { x: e.clientX, y: e.clientY };
    const g = gesture.current;
    if (g && !g.digging && Math.hypot(e.clientX - g.x, e.clientY - g.y) > 10) g.moved = true;
  };
  const lookUp = (e) => {
    if (e.pointerId !== lookId.current) return;
    lookId.current = null;
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    clearTimeout(g.timer);
    if (g.digging) api()?.press('attack', false);
    else if (!g.moved && performance.now() - g.at < 280) {
      api()?.press('use', true);
      setTimeout(() => api()?.press('use', false), 60);
    }
  };
  const button = (name) => ({
    onPointerDown: (e) => {
      e.preventDefault();
      e.stopPropagation();
      capturePointer(e);
      api()?.press(name, true);
    },
    onPointerUp: () => api()?.press(name, false),
    onPointerCancel: () => api()?.press(name, false),
    onLostPointerCapture: () => api()?.press(name, false),
    onContextMenu: (e) => e.preventDefault(),
  });

  const onWheel = (e) => {
    if (playing && Math.abs(e.deltaY) > 2) api()?.scroll(e.deltaY);
  };

  const loading = status === 'on' && playing && !ui.ready;
  return (
    <div className="mc" data-mode={mode}>
      <WorldHost world={{ host }} className="mc-stage" onWheel={onWheel} onClick={() => playing && lock()} onPointerDown={lookDown} onPointerMove={lookMove} onPointerUp={lookUp} onPointerCancel={lookUp}>
        {status !== 'on' && status !== 'failed' && status !== 'lost' && (
          <div className="mc-screen mc-dirt" role="status">
            <p className="mc-text">Loading the world…</p>
          </div>
        )}
        {(status === 'failed' || status === 'lost') && (
          <div className="mc-screen mc-dirt" role="alert">
            <p className="mc-text">{status === 'lost' ? 'The graphics chip reset.' : 'The game couldn’t start its 3D here.'}</p>
            {onExit && (
              <button type="button" className="mc-btn" onClick={onExit}>
                Back
              </button>
            )}
          </div>
        )}

        {loading && (
          <div className="mc-screen mc-dirt" role="status">
            <p className="mc-text">Building terrain</p>
            <p className="mc-text mc-small">
              {ui.loaded} / {ui.wanted}
            </p>
          </div>
        )}

        {(playing || paused || screenOpen) && hud && (
          <div className="mc-hud" aria-hidden="true">
            {!screenOpen && <img className="mc-crosshair" src={sprite('crosshair')} alt="" />}
            <div className="mc-bar">
              {hud.air != null && (
                <div className="mc-air">
                  {Array.from({ length: Math.max(0, Math.ceil((hud.air * 10) / 300)) }, (_, i) => (
                    <img key={i} src={sprite('air')} alt="" />
                  ))}
                </div>
              )}
              <div className="mc-hotbar" style={{ backgroundImage: `url(${sprite('hotbar')})` }}>
                {hud.hotbar?.map((s, i) => (
                  <span key={i} className="mc-hotslot" style={{ '--slot': i }} onPointerDown={(e) => {
                    e.stopPropagation();
                    api()?.select(i);
                  }}>
                    <Stack s={s} api={api} />
                  </span>
                ))}
                <img className="mc-selection" src={sprite('hotbar_selection')} alt="" style={{ '--slot': hud.selected }} />
              </div>
            </div>
          </div>
        )}

        {screenOpen && ui.screen && <Screen screen={ui.screen} api={api} />}

        {ui.mode === 'title' && status === 'on' && (
          <div className="mc-screen mc-title">
            <h1 className="mc-logo">Minecraft</h1>
            <p className="mc-splash">A fan tribute!</p>
            <div className="mc-menu">
              <button type="button" className="mc-btn" onClick={play} autoFocus>
                Play
              </button>
              <form
                className="mc-seed"
                onSubmit={(e) => {
                  e.preventDefault();
                  fresh();
                }}
              >
                <input className="mc-input" value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="Seed for a new world" aria-label="Seed for a new world" maxLength={32} />
                <button type="submit" className="mc-btn mc-btn-half">
                  New world
                </button>
              </form>
              {onExit && (
                <button type="button" className="mc-btn" onClick={onExit}>
                  Back to the island
                </button>
              )}
            </div>
            <p className="mc-disclaimer">Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft. Textures: Pixel Perfection (XSSheep, Nova_Wostra), CC BY-SA 4.0.</p>
          </div>
        )}

        {paused && (
          <div className="mc-screen mc-dim" role="dialog" aria-modal="true" aria-label="Game menu">
            <p className="mc-text">Game menu</p>
            <div className="mc-menu">
              <button type="button" className="mc-btn" onClick={resume} autoFocus>
                Back to game
              </button>
              <button type="button" className="mc-btn" onClick={() => api()?.toTitle()}>
                Save and quit to title
              </button>
              {onExit && (
                <button type="button" className="mc-btn" onClick={onExit}>
                  Back to the island
                </button>
              )}
            </div>
            <p className="mc-text mc-small">Seed: {ui.seed}</p>
          </div>
        )}

        {touch && playing && (
          <div className="mc-pad">
            <div ref={stickRef} className="mc-stick" onPointerDown={stickDown} onPointerMove={moveStick} onPointerUp={stickUp} onPointerCancel={stickUp}>
              <span style={{ transform: `translate(${knob.x * 34}px, ${knob.y * 34}px)` }} />
            </div>
            <div className="mc-keys">
              <button type="button" className="mc-key" aria-label="Sneak" {...button('sneak')}>
                ⇩
              </button>
              <button type="button" className="mc-key" aria-label="Jump" {...button('jump')}>
                ⇧
              </button>
            </div>
            <button type="button" className="mc-key mc-inv-key" aria-label="Inventory" {...button('inventory')}>
              ⋯
            </button>
            <button type="button" className="mc-key mc-pause-key" aria-label="Pause" onPointerDown={(e) => e.stopPropagation()} onClick={() => api()?.pause(true)}>
              ❚❚
            </button>
          </div>
        )}
      </WorldHost>
    </div>
  );
}
