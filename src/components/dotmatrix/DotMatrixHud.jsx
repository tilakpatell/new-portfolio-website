import { Link } from 'react-router-dom';
import GuideCue from '../guide/GuideCue';
import { capturePointer } from '../../lib/pointer';
import { PALETTES, PALETTE_ORDER } from './dither';
import { cartInfo } from './found';
import { CARTRIDGES, progress, zoomTo } from './rules';

// Dot Matrix's HUD over the island: the stats box and the chips at the top,
// the banner, the cartridge list, the first hint or the B prompt, the
// dialog box, and on a phone the D-pad and B and A. ./DotMatrixWorld.jsx
// holds the game, the keys and the frame loop and hands this what it draws
// (moved out of it whole, so the world file stays under 800 lines).

function Heart({ full }) {
  return (
    <svg viewBox="0 0 7 6" className="dm-heart" data-full={full || undefined} aria-hidden="true">
      <path d="M1 0h2v1h1V0h2v1h1v2H6v1H5v1H4v1H3V5H2V4H1V3H0V1h1z" />
    </svg>
  );
}

export default function DotMatrixHud({ touch, gl, hud, sim, palette, setPalette, musicOn, setMusicOn, trav, list, setList, banner, moved, prompt, dialog, shown, setShown, closeDialog, padRef, onPad, padUp, button }) {
  const p = progress(sim.current.g);
  return (
    <>
      <div className="dm-hud dm-hud-top">
        <div className="dm-stats">
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
        <div className="dm-chips">
          <button type="button" className="dm-chip" onClick={() => setList((v) => !v)} aria-expanded={list}>
            Cartridges <kbd>M</kbd>
          </button>
          <button type="button" className="dm-chip" onClick={() => setPalette((v) => PALETTE_ORDER[(PALETTE_ORDER.indexOf(v) + 1) % PALETTE_ORDER.length])} aria-label={`Screen: ${PALETTES[palette].name}. Change it`}>
            {PALETTES[palette].name}
          </button>
          <button type="button" className="dm-chip" onClick={() => setMusicOn((v) => !v)} aria-pressed={musicOn}>
            Music {musicOn ? 'on' : 'off'}
          </button>
          {trav.available &&
            (trav.on ? (
              <span className="dm-chip dm-chip-online" data-on="" title="Everyone else online on the island walks about as a pale ghost from another world: nothing passes between you but where each of you is">
                <b>{trav.count}</b> {trav.count === 1 ? 'player' : 'players'} here
              </span>
            ) : (
              <button type="button" className="dm-chip dm-chip-online" onClick={trav.join} title="Go online, and see everyone else on the island as a ghost from another world">
                See other players
              </button>
            ))}
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
        </div>
      </div>

      {banner && <p className="dm-banner">{banner}</p>}

      {list && (
        <div className="dm-list" role="dialog" aria-label="Cartridges">
          <p className="dm-list-head">
            Cartridges {p.found}/{p.of}
            <button type="button" className="dm-x" onClick={() => setList(false)} aria-label="Close">
              ×
            </button>
          </p>
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

      {!moved && !dialog && !prompt && gl === 'on' && (
        <p className="dm-hint">{touch ? 'Pad to walk · A jumps · B talks, reads and plays · drag to turn' : 'Arrows or WASD walk · Space jumps · X talks, reads and plays · Q E turn'}<GuideCue touch={touch} /></p>
      )}
      {prompt && !list && (
        <p className="dm-prompt">
          <b>B</b> {prompt}
        </p>
      )}

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

      {touch && gl === 'on' && (
        <div className="dm-touch">
          <div
            ref={padRef}
            className="dm-pad"
            onPointerDown={(e) => {
              capturePointer(e);
              onPad(e);
            }}
            onPointerMove={onPad} onPointerUp={padUp} onPointerCancel={padUp} onLostPointerCapture={padUp} aria-hidden="true">
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
        </div>
      )}
    </>
  );
}
