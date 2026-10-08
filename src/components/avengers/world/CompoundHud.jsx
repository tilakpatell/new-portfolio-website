import { audioContext } from '../../../lib/audio';
import { PACKS, PHOTO, SETTINGS, SETTINGS_DEFAULTS } from './rules';
import { STONES } from '../../interests/stones';
import GuideCue from '../../guide/GuideCue';
import { clock, stoneFor, stoneLine } from './labels';

// The compound's HUD, over the stage: the title and the objective, the map
// and the chips, the doors' cards, the hints, the touch controls, and the
// panels (the buildings, the settings, photo mode). ./CompoundWorld.jsx's
// frame loop writes the numbers that change every frame straight into the
// elements it holds the refs of (no re-render a frame) and draws the map.
export default function CompoundHud({ touch, gl, prog, hud, sim, enter, portal, trav, list, setList, tuning, setTuning, photo, photoMode, changePhoto, onSavePhoto, settings, changeSettings, tourMsg, pack, trick, styleRef, tourRef, map, bubble, bubbleRef, tourBest, styleBest, found, toTour, travel, onStick }) {
  const here = hud.near ? prog.places.find((p) => p.id === hud.near) : null;
  const herePortal = hud.portal && !here;
  return (
    <>
      {gl === 'loading' && <p className="cw-loading">Flying in to the compound…</p>}
      {tourMsg && (
        <p className="cw-tour-msg" aria-live="polite">
          {tourMsg}
        </p>
      )}
      {pack && (
        <div key={pack.n} className="cw-pack" role="status">
          <p className="cw-pack-n">
            Backpack {pack.n} of {PACKS.length} · {pack.where}
          </p>
          <p className="cw-pack-what">{pack.memento}</p>
          <p className="cw-pack-line">“{pack.line}”</p>
        </div>
      )}
      {trick && (
        <p key={trick.n} className={`cw-trick ${trick.cls}`} aria-live="polite">
          {trick.text}
          {trick.combo > 1 ? <b> ×{trick.combo}</b> : null}
        </p>
      )}
      <p ref={styleRef} className="cw-style" aria-live="off" />

      <div className="cw-hud cw-hud-top">
        <div className="cw-brand">
          <p className="cw-eyebrow">The Avengers compound · Upstate New York</p>
          <h1 id="cw-title" className="cw-title">
            Avengers HQ
          </h1>
          <p className="cw-objective" aria-live="polite">
            <span aria-hidden="true">▲</span> {prog.objective}
          </p>
        </div>
        <div className="cw-side">
          <canvas ref={map} className="cw-map" width="150" height="150" aria-hidden="true" />
          <p className="cw-chip cw-stones" aria-label={`${prog.stones} of 6 Infinity Stones won back`}>
            {STONES.map((st) => (
              <i key={st.id} className="stone-dot" data-on={prog.have.includes(st.id) || undefined} style={{ '--glow': st.color }} />
            ))}
            <b>{prog.stones}</b> of 6
          </p>
          <button
            type="button"
            className="cw-chip"
            onClick={() => {
              setList((v) => !v);
              setTuning(false);
            }}
            aria-expanded={list}
          >
            The buildings {!touch && <kbd>M</kbd>}
          </button>
          <button
            type="button"
            className="cw-chip"
            onClick={() => {
              setTuning((v) => !v);
              setList(false);
            }}
            aria-expanded={tuning}
            aria-controls="cw-settings"
          >
            Settings {!touch && <kbd>O</kbd>}
          </button>
          <button type="button" className="cw-chip" onClick={() => photoMode(true)} title="Stop time, put the camera anywhere round him, and save a picture">
            Photo {!touch && <kbd>P</kbd>}
          </button>
          <button type="button" className="cw-chip cw-tour" onClick={toTour} title="Rings round the compound, against the clock: through the first red ring to start">
            Swing tour {tourBest != null && <b>{clock(tourBest)}</b>}
          </button>
          {styleBest > 0 && (
            <p className="cw-chip cw-style-best" title="The most style banked in one flight: flips, twists and perfect releases, one after another, and a landing">
              Best style <b>{styleBest.toLocaleString()}</b>
            </p>
          )}
          <p ref={tourRef} className="cw-chip cw-tour-on" aria-live="off" />
          <p className="cw-chip cw-packs" title="Peter’s backpacks, webbed up round the compound: on the roofs, up the masts, under the bridge. Walk up to one." aria-label={`${found} of ${PACKS.length} backpacks found`}>
            <span aria-hidden="true">🎒</span> <b>{found}</b> of {PACKS.length}
          </p>
          <Players trav={trav} />
        </div>
      </div>

      {bubble && (
        <div ref={bubbleRef} className="cw-bubble" aria-live="polite">
          <div>
            <b>{bubble.name}</b>
            <span>{bubble.line}</span>
          </div>
        </div>
      )}

      {here && (
        <div className="cw-door" style={{ '--cw-accent': here.accent }}>
          <p className="cw-door-sub">{here.where}</p>
          <p className="cw-door-name">{here.name}</p>
          <p className="cw-door-stone" style={{ '--glow': stoneFor(here)?.color ?? here.accent }}>
            {stoneFor(here) && <i className="stone-dot" data-on={here.done || undefined} aria-hidden="true" />}
            {stoneLine(here)}
          </p>
          <button type="button" className="btn btn-primary" onClick={() => enter(here.id)}>
            {here.act} {!touch && <kbd>E</kbd>}
          </button>
        </div>
      )}
      {hud.armour && !here && (
        <div className="cw-door" style={{ '--cw-accent': '#ffb347' }}>
          <p className="cw-door-sub">By the workshop’s door</p>
          <p className="cw-door-name">An Iron Man armour</p>
          <p className="cw-door-stone">Tony left one out. It flies: {touch ? 'Up and Down to climb and come down, the stick to fly, Step out to get out' : 'Space up, Shift down, W A S D to fly, E to step out'}.</p>
          <button type="button" className="btn btn-primary" onClick={() => (sim.current.suit = true)}>
            Suit up {!touch && <kbd>E</kbd>}
          </button>
        </div>
      )}
      {herePortal && (
        <div className="cw-door cw-door-portal" style={{ '--cw-accent': '#6cc8ff' }}>
          <p className="cw-door-sub">Over the helipad</p>
          <p className="cw-door-name">The portal</p>
          <p className="cw-door-stone">Titan is on the other side, and Thanos with it.</p>
          <button type="button" className="btn btn-primary" onClick={portal}>
            Go through {!touch && <kbd>E</kbd>}
          </button>
        </div>
      )}

      {gl === 'on' && hud.suit && <p className="cw-hint">{touch ? 'Hold Up to climb, Down to come down, the stick to fly. Step out gets out of the armour.' : 'Space to climb, Shift to come down, W A S D to fly; it leans into its speed. E steps out of the armour, wherever you are.'}<GuideCue touch={touch} /></p>}
      {gl === 'on' && !hud.moved && !here && !herePortal && !hud.suit && (
        <p className="cw-hint">{touch ? 'Stick to walk. Hold Jump in the air to swing, let go to fly. Zip, Perch, Trick, and jump at walls.' : 'W A S D to walk, Shift to run, Space to jump. Hold Space in the air (or the right mouse button) to swing, let go on the upswing to fly; hold on with nothing to catch for web wings. Shift in the air zips, Q launches to a perch, T throws a flip (or a twist, with a direction held). Jump at a wall to run up it. E at a door, O for the settings.'}<GuideCue touch={touch} /></p>
      )}

      {touch && (
        <div className="cw-hud cw-hud-bottom">
          <div className="cw-stick" onPointerDown={onStick} onPointerMove={onStick} onPointerUp={onStick} onPointerCancel={onStick} onLostPointerCapture={onStick} aria-hidden="true">
            <span />
          </div>
          <button
            type="button"
            className="cw-jump"
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture?.(e.pointerId);
              audioContext();
              sim.current.jump = true;
              sim.current.touchWeb = true;
            }}
            onPointerUp={() => (sim.current.touchWeb = false)}
            onPointerCancel={() => (sim.current.touchWeb = false)}
            onLostPointerCapture={() => (sim.current.touchWeb = false)}
          >
            {hud.suit ? 'Up' : 'Jump'}
            {!hud.suit && <small>hold: swing</small>}
          </button>
          <div className="cw-acts">
            <button
              type="button"
              className="cw-jump cw-zip"
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.setPointerCapture?.(e.pointerId);
                audioContext();
                if (sim.current.h.mode === 'suit') sim.current.touchDown = true;
                else sim.current.zip = true;
              }}
              onPointerUp={() => (sim.current.touchDown = false)}
              onPointerCancel={() => (sim.current.touchDown = false)}
              onLostPointerCapture={() => (sim.current.touchDown = false)}
            >
              {hud.suit ? 'Down' : 'Zip'}
            </button>
            <button
              type="button"
              className="cw-jump cw-zip"
              onPointerDown={(e) => {
                e.preventDefault();
                audioContext();
                sim.current.perch = true;
              }}
            >
              Perch
            </button>
            <button
              type="button"
              className="cw-jump cw-zip"
              onPointerDown={(e) => {
                e.preventDefault();
                audioContext();
                if (sim.current.h.mode === 'suit') sim.current.suit = true;
                else sim.current.trick = true;
              }}
            >
              {hud.suit ? 'Step out' : 'Trick'}
            </button>
          </div>
        </div>
      )}

      {photo && <PhotoBar photo={photo} onChange={changePhoto} onSave={onSavePhoto} onClose={() => photoMode(false)} touch={touch} />}
      {tuning && <Settings id="cw-settings" settings={settings} onChange={changeSettings} onClose={() => setTuning(false)} />}
      {list && (
        <div className="cw-list" role="dialog" aria-label="The buildings on the compound">
          <div className="cw-list-head">
            <p>The compound</p>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setList(false)}>
              Close
            </button>
          </div>
          <ol>
            {prog.places.map((p, i) => (
              <li key={p.id} data-done={p.done || undefined} data-next={p.id === prog.next || undefined} style={{ '--glow': stoneFor(p)?.color ?? p.accent, '--cw-accent': p.accent }}>
                <span className="cw-list-n" aria-hidden="true">
                  {p.done ? '✓' : i + 1}
                </span>
                <div>
                  <p className="cw-list-name">{p.name}</p>
                  <p className="cw-list-sub">
                    {p.where} · {stoneLine(p)}
                  </p>
                </div>
                <div className="cw-list-acts">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => travel(p.id)}>
                    Go there
                  </button>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => enter(p.id)}>
                    {p.act}
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </>
  );
}

// The settings (rules.js's SETTINGS), from the Settings chip (or O): how the
// view turns, how far back the camera sits, how much a swing helps you
// round, how the camera follows, how much it kicks. Every change is live and
// kept between visits. Not modal: the compound stays playable behind it.
const shown = (r, v) => (r.toggle ? (v ? 'On' : 'Off') : v === 0 ? 'Off' : `${Math.round(v * 100)}%`);
function Settings({ id, settings, onChange, onClose }) {
  return (
    <section id={id} className="cw-list cw-set" role="dialog" aria-label="Settings">
      <div className="cw-list-head">
        <p>Settings</p>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="cw-set-rows">
        {Object.entries(SETTINGS).map(([k, r]) => {
          const v = settings[k];
          return (
            <label key={k} className="cw-set-row">
              <span className="cw-set-top">
                <span className="cw-list-name">{r.label}</span>
                <output>{shown(r, v)}</output>
              </span>
              {r.toggle ? (
                <input type="checkbox" checked={Boolean(v)} onChange={(e) => onChange({ ...settings, [k]: e.target.checked ? 1 : 0 })} aria-describedby={`${id}-${k}`} />
              ) : (
                <input
                  type="range"
                  min={r.min}
                  max={r.max}
                  step={r.step}
                  value={v}
                  style={{ '--fill': `${((v - r.min) / (r.max - r.min)) * 100}%` }}
                  onChange={(e) => onChange({ ...settings, [k]: Number(e.target.value) })}
                  // (dragged with a mouse or a thumb, it lets go of the arrow keys again)
                  onPointerUp={(e) => e.currentTarget.blur()}
                  aria-describedby={`${id}-${k}`}
                />
              )}
              <span id={`${id}-${k}`} className="cw-list-sub">
                {r.hint}
              </span>
            </label>
          );
        })}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange({ ...SETTINGS_DEFAULTS })}>
          Back to how it came
        </button>
      </div>
    </section>
  );
}

// Photo mode's bar: the lens and the distance (the drag turns the camera,
// the wheel brings it in), a picture saved, and the way back.
function PhotoBar({ photo, onChange, onSave, onClose, touch }) {
  const row = (label, k, [min, max], step, shown) => (
    <label className="cw-photo-row">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={photo[k]} style={{ '--fill': `${((photo[k] - min) / (max - min)) * 100}%` }} onChange={(e) => onChange({ [k]: Number(e.target.value) })} onPointerUp={(e) => e.currentTarget.blur()} />
      <output>{shown}</output>
    </label>
  );
  return (
    <section className="cw-photo cw-set" role="dialog" aria-label="Photo mode">
      <p className="cw-photo-title">Photo mode</p>
      <p className="cw-photo-hint">{touch ? 'Drag to move the camera round him.' : 'Drag to move the camera round him, scroll to bring it in, [ and ] for the lens.'}</p>
      {row('Lens', 'fov', PHOTO.fov, 1, `${Math.round(photo.fov)}°`)}
      {row('Distance', 'dist', PHOTO.dist, 0.1, `${photo.dist.toFixed(1)} m`)}
      <div className="cw-photo-acts">
        <button type="button" className="btn btn-primary btn-sm" onClick={onSave}>
          Save the picture
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
          Back {!touch && <kbd>P</kbd>}
        </button>
      </div>
    </section>
  );
}

// Other players online here: how many, or a way to see them (going online
// is the site's own switch, with your callsign, as the universe's map has it).
function Players({ trav }) {
  if (!trav.available) return null;
  if (!trav.on)
    return (
      <button type="button" className="cw-chip" onClick={trav.join} title="Go online, and see everyone else walking the compound as a hologram">
        See other players
      </button>
    );
  return (
    <span className="cw-chip cw-players" data-on="" title="Everyone else online here shows as a hologram: they can’t touch your games, nor you theirs">
      <b>{trav.count}</b> {trav.count === 1 ? 'player' : 'players'} here
    </span>
  );
}
