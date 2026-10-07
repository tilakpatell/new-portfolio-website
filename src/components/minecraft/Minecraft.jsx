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
    document.addEventListener('mousemove', onMove);
    document.addEventListener('pointerlockchange', onChange);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('pointerlockchange', onChange);
      if (el && document.pointerLockElement === el) document.exitPointerLock?.();
    };
  }, [api, host]);

  // Esc at the title leaves
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Escape' && ui.mode === 'title' && onExit) onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ui.mode, onExit]);

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
  const lookDown = (e) => {
    if (!touch || !playing || lookId.current !== null) return;
    lookId.current = e.pointerId;
    lookAt.current = { x: e.clientX, y: e.clientY };
  };
  const lookMove = (e) => {
    if (e.pointerId !== lookId.current) return;
    api()?.look((e.clientX - lookAt.current.x) * 1.6, (e.clientY - lookAt.current.y) * 1.6);
    lookAt.current = { x: e.clientX, y: e.clientY };
  };
  const lookUp = (e) => {
    if (e.pointerId === lookId.current) lookId.current = null;
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

        {(playing || paused) && hud && (
          <div className="mc-hud" aria-hidden="true">
            <img className="mc-crosshair" src={sprite('crosshair')} alt="" />
            <div className="mc-bar">
              {hud.air != null && (
                <div className="mc-air">
                  {Array.from({ length: Math.max(0, Math.ceil((hud.air * 10) / 300)) }, (_, i) => (
                    <img key={i} src={sprite('air')} alt="" />
                  ))}
                </div>
              )}
              <div className="mc-hotbar" style={{ backgroundImage: `url(${sprite('hotbar')})` }}>
                <img className="mc-selection" src={sprite('hotbar_selection')} alt="" style={{ '--slot': hud.selected }} />
              </div>
            </div>
          </div>
        )}

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
            <button type="button" className="mc-key mc-pause-key" aria-label="Pause" onPointerDown={(e) => e.stopPropagation()} onClick={() => api()?.pause(true)}>
              ❚❚
            </button>
          </div>
        )}
      </WorldHost>
    </div>
  );
}
