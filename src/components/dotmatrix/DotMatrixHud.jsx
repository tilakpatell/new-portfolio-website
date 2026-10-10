import { useLayoutEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import GuideCue from '../guide/GuideCue';
import { capturePointer } from '../../lib/pointer';
import { GAP, Hud, Menu, MenuItem, Prompt } from '../../runtime/hud';
import { wayOut } from '../worlds/worlds';
import { PALETTES, PALETTE_ORDER } from './dither';
import { cartInfo } from './found';
import { CARTRIDGES, progress, zoomTo } from './rules';

// Dot Matrix's HUD over the island, on the runtime's HUD kit
// (src/runtime/hud) in the screen's own four shades and pixel lettering: the
// stats box top left; the camera chips and the one Menu (the screen, the
// music, the cartridges, Controls, the other players, the way out) top
// right; the cartridge list under them; the first hint or the prompt at the
// foot; on a phone the D-pad and B and A under it. The frame measures the
// rows, so the prompt sits over the thumbs however tall they are.
// ./DotMatrixWorld.jsx holds the game, the keys and the frame loop and hands
// this what it draws; the keys are the site's guide's (Controls opens it).

const LORE = {
  off: 'Go online, and see everyone else on the island as a ghost from another world',
  on: 'Everyone else online on the island walks about as a pale ghost from another world: nothing passes between you but where each of you is',
};

function Heart({ full }) {
  return (
    <svg viewBox="0 0 7 6" className="dm-heart" data-full={full || undefined} aria-hidden="true">
      <path d="M1 0h2v1h1V0h2v1h1v2H6v1H5v1H4v1H3V5H2V4H1V3H0V1h1z" />
    </svg>
  );
}

export default function DotMatrixHud({ touch, gl, hud, sim, palette, setPalette, musicOn, setMusicOn, trav, list, setList, banner, moved, prompt, act, dialog, shown, setShown, closeDialog, padRef, onPad, padUp, button }) {
  const { pathname } = useLocation();
  const p = progress(sim.current.g);
  // where the stats box ends, measured (the frame's --hud-under is the
  // right-hand buttons' foot): on a phone the list is as wide as the screen
  // and hangs under both
  const stats = useRef(null);
  useLayoutEffect(() => {
    const el = stats.current;
    const frame = el?.closest('.hud');
    if (!el || !frame) return undefined;
    const fit = () => frame.style.setProperty('--dm-stats-b', `${Math.round(el.getBoundingClientRect().bottom - frame.getBoundingClientRect().top + GAP)}px`);
    fit();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
    ro?.observe(el);
    ro?.observe(frame);
    return () => ro?.disconnect();
  }, []);
  const screen = PALETTES[palette].name;
  return (
    <>
      <Hud
        className="dm-hud"
        touch={touch}
        brand={
          <div className="dm-stats" ref={stats}>
            <h1 id="dm-title" className="dm-title">
              Dot Matrix
            </h1>
            <p className="dm-row" aria-label={`${hud.hearts} hearts`}>
              {[0, 1, 2].map((i) => (
                <Heart key={i} full={i < hud.hearts} />
              ))}
            </p>
            <p className="dm-row">
              <span className="dm-coin" aria-hidden="true" /> × {String(hud.coins).padStart(2, '0')}
            </p>
            <p className="dm-row">
              <span className="dm-cart" aria-hidden="true" /> {hud.found}/{CARTRIDGES.length}
            </p>
          </div>
        }
        tools={
          <>
            {/* (turning and zooming are play, not settings: they stay on the screen) */}
            <span className="dm-turn">
              <button type="button" className="dm-chip" aria-label="Turn the camera left" onClick={() => (sim.current.yawTo -= Math.PI / 4)}>
                ⟲
              </button>
              <button type="button" className="dm-chip" aria-label="Turn the camera right" onClick={() => (sim.current.yawTo += Math.PI / 4)}>
                ⟳
              </button>
              <button type="button" className="dm-chip" aria-label="Zoom in" onClick={() => (sim.current.distTo = zoomTo(sim.current.distTo, 0.8))}>
                +
              </button>
              <button type="button" className="dm-chip" aria-label="Zoom out" onClick={() => (sim.current.distTo = zoomTo(sim.current.distTo, 1.25))}>
                −
              </button>
            </span>
            <Menu className="dm-menu" todo={{ label: 'Cartridges', done: p.found, total: p.of, onOpen: () => setList(true) }} players={{ available: trav.available, on: trav.on, count: trav.count, onJoin: trav.join }} lore={LORE} way={wayOut(pathname)}>
              <MenuItem keep onClick={() => setPalette((v) => PALETTE_ORDER[(PALETTE_ORDER.indexOf(v) + 1) % PALETTE_ORDER.length])} aria-label={`Screen: ${screen}. Change it`}>
                Screen: <b>{screen}</b>
              </MenuItem>
              <MenuItem keep onClick={() => setMusicOn((v) => !v)} aria-pressed={musicOn}>
                Music {musicOn ? 'on' : 'off'}
              </MenuItem>
            </Menu>
          </>
        }
        foot={
          <>
            {!moved && !dialog && !prompt && gl === 'on' && (
              <p className="dm-hint">
                {touch ? 'Pad to walk · A jumps · B talks, reads and plays · drag to turn' : 'Arrows or WASD walk · Space jumps · X talks, reads and plays · Q E turn'}
                <GuideCue touch={touch} />
              </p>
            )}
            {/* The key is the console's: X on a keyboard, B under the thumb on
                a phone, so it shows on touch too (the kit hides it there,
                where the prompt is the only button) */}
            {prompt && !list && <Prompt className="dm-prompt" k={touch ? 'B' : 'X'} verb={prompt} touch={false} onClick={act} />}
          </>
        }
        thumbs={
          gl === 'on' && (
            <>
              <div
                ref={padRef}
                className="dm-pad"
                onPointerDown={(e) => {
                  capturePointer(e);
                  onPad(e);
                }}
                onPointerMove={onPad}
                onPointerUp={padUp}
                onPointerCancel={padUp}
                onLostPointerCapture={padUp}
                aria-hidden="true"
              >
                <span />
                <span />
              </div>
              <div className="dm-ab">
                <button type="button" className="dm-btn" {...button('b')}>
                  B
                </button>
                <button type="button" className="dm-btn dm-btn-a" {...button('a')}>
                  A
                </button>
              </div>
            </>
          )
        }
      >
        {banner && <p className="dm-banner">{banner}</p>}

        {list && (
          <div className="dm-list" role="dialog" aria-label="Cartridges">
            <div className="dm-list-head">
              <p>
                Cartridges · {p.found}/{p.of}
              </p>
              {/* (M shuts it as it opened it: the key beside the ×) */}
              <button type="button" className="dm-x" onClick={() => setList(false)} aria-label="Close the cartridges" aria-keyshortcuts="M Escape">
                {!touch && <kbd>M</kbd>}
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <ol>
              {CARTRIDGES.map((c) => {
                const got = sim.current.g.found.has(c.id);
                const info = cartInfo(c.id);
                return (
                  <li key={c.id} data-got={got || undefined}>
                    {got ? (
                      <Link to={info.link}>{info.title}</Link>
                    ) : (
                      <span>
                        <b>???</b> {c.where}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </Hud>

      {dialog && (
        <div className="dm-dialog" role="dialog" aria-live="polite" aria-label={dialog.title}>
          {dialog.kicker && <p className="dm-dialog-kicker">{dialog.kicker}</p>}
          <p className="dm-dialog-title">{dialog.title}</p>
          <p className="dm-dialog-text">
            {dialog.text.slice(0, shown)}
            <span className="dm-ghost">{dialog.text.slice(shown)}</span>
          </p>
          <div className="dm-dialog-foot">
            {dialog.link && shown >= dialog.text.length && (
              <Link className="dm-dialog-link" to={dialog.link}>
                Open the project ▸
              </Link>
            )}
            <button type="button" className="dm-dialog-next" onClick={() => (shown < dialog.text.length ? setShown(dialog.text.length) : closeDialog())}>
              {shown < dialog.text.length ? '…' : '▼'}
              <span className="sr-only">{shown < dialog.text.length ? 'Show it all' : 'Next'}</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
