import { useId } from 'react';
import { splitWord } from '../elements';
import { CRYSTALS, DRIVING, DRIVING_DEFAULTS } from './rules';
import GuideCue from '../../guide/GuideCue';

// The world's HUD over the town (moved here from ./AbqWorld.jsx, which keeps
// the wheel, the frame loop and the doors): the title and the objective, the
// chips, the map and Hank's meter, the delivery's clock and the toasts, the
// door card, the first hint, the buttons along the foot and, on a phone,
// the stick and the handbrake; the Places list and the Driving panel.
// ./AbqWorld.jsx's frame loop writes the speed straight into `speedo` and
// draws the map on `map` (./map.js).

const clockText = (s) => `${Math.floor(s / 60)}:${String(Math.ceil(s) % 60).padStart(2, '0')}`;

export default function AbqHud({ touch, gl, prog, snap, rank, blue, speedo, map, trav, hud, toast, here, inside, enter, throwPizza, washCar, runDelivery, nextTime, clock, tuning, setTuning, list, setList, onStick, onHand, driving, changeDriving, travel }) {
  const tuneId = useId();
  return (
    <>
      <div className="abq-hud abq-hud-top">
        <div className="abq-hud-brand">
          <Title />
          <p className="abq-hud-objective" aria-live="polite">
            <span aria-hidden="true">◆</span> {prog.objective}
          </p>
        </div>
        <div className="abq-hud-side">
          <p className="abq-hud-chip">
            <b>${snap.money}</b> · {rank.title}
          </p>
          <p className="abq-hud-chip abq-hud-speed" aria-hidden="true">
            <b ref={speedo}>0</b> mph
          </p>
          <p className="abq-hud-chip abq-hud-blue" title="Blue Sky crystals found in the desert">
            <span aria-hidden="true">◆</span> Blue Sky <b>{blue}</b>/{CRYSTALS.length}
          </p>
          {trav.available &&
            (trav.on ? (
              <p className="abq-hud-chip abq-hud-online" data-on="" title="Everyone else online in Albuquerque drives about as a ghost Aztek from another world: they can’t touch your career, nor you theirs">
                <b>{trav.count}</b> {trav.count === 1 ? 'other driver' : 'other drivers'} in town
              </p>
            ) : (
              <button type="button" className="abq-hud-chip abq-hud-online" onClick={trav.join} title="Go online, and see everyone else driving Albuquerque as a ghost from another world">
                See other drivers
              </button>
            ))}
          <canvas ref={map} className="abq-map" width="150" height="150" aria-hidden="true" />
          {(hud.heat > 0 || hud.hankNear) && (
            <div className="abq-heat" role="meter" aria-label="Hank’s on you" aria-valuemin={0} aria-valuemax={1} aria-valuenow={hud.heat}>
              <span className="abq-heat-label">DEA</span>
              <span className="abq-heat-bar">
                <span style={{ transform: `scaleX(${hud.heat})` }} />
              </span>
            </div>
          )}
        </div>
      </div>

      {hud.run && (
        <p className="abq-run" role="timer" aria-label={`Delivery to ${hud.run.name}`}>
          <span aria-hidden="true">▣</span> {hud.run.name} · <b>{clockText(hud.run.left)}</b> · {hud.run.away} m
        </p>
      )}

      {toast && (
        <p className="abq-toast" data-bad={toast.bad || undefined} role="status" key={toast.at}>
          {toast.text}
        </p>
      )}

      {here && !inside && (
        <div className="abq-door" data-open={here.open || undefined}>
          <p className="abq-door-name">{here.name}</p>
          <p className="abq-door-sub">{here.open ? here.sub : here.hint}</p>
          {here.open && (
            <div className="abq-door-acts">
              <button type="button" className="btn btn-primary" onClick={() => enter(here.id)}>
                Go in {!touch && <kbd>E</kbd>}
              </button>
              {here.id === 'home' && (
                <button type="button" className="btn btn-ghost abq-door-alt" onClick={throwPizza}>
                  Throw a pizza {!touch && <kbd>P</kbd>}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {hud.wash && !here && !inside && (
        <div className="abq-door" data-open>
          <p className="abq-door-name">A1A Car Wash</p>
          <p className="abq-door-sub">Have an A1 day</p>
          <button type="button" className="btn btn-primary" onClick={washCar}>
            Wash the Aztek {!touch && <kbd>E</kbd>}
          </button>
        </div>
      )}

      {gl === 'on' && !hud.moved && !here && <p className="abq-hint">{touch ? 'Drag the stick to drive. Hold Slide into a turn: it’s the handbrake, and the tail swings round. Hank’s SUV is the flashing dot: don’t race past him, or carry near him.' : 'W A S D or the arrows to drive: S brakes, Space slides you round a turn. E goes in, R runs a delivery, H is the horn. Hank’s SUV is the flashing dot: don’t race past him, or carry near him.'}<GuideCue touch={touch} /></p>}

      <div className="abq-hud abq-hud-bottom">
        {touch && (
          <div className="abq-pads">
            <div className="abq-stick" onPointerDown={onStick} onPointerMove={onStick} onPointerUp={onStick} onPointerCancel={onStick} aria-hidden="true">
              <span />
            </div>
            <button type="button" className="abq-hand" onPointerDown={onHand} onPointerUp={onHand} onPointerCancel={onHand} onContextMenu={(e) => e.preventDefault()} aria-label="Handbrake: hold it into a corner to slide">
              Slide
            </button>
          </div>
        )}
        <button
          type="button"
          className="btn btn-ghost abq-places-btn abq-clock-btn"
          onClick={() => {
            setTuning((v) => !v);
            setList(false);
          }}
          aria-expanded={tuning}
          aria-controls={tuneId}
        >
          Driving {!touch && <kbd>O</kbd>}
        </button>
        <button type="button" className="btn btn-ghost abq-places-btn" onClick={runDelivery} disabled={!!hud.run}>
          {hud.run ? 'On a run' : 'Run a delivery'} {!touch && !hud.run && <kbd>R</kbd>}
        </button>
        <button type="button" className="btn btn-ghost abq-places-btn" onClick={nextTime} aria-label={`Time of day: ${clock.name}. Change it`}>
          {clock.name} {!touch && <kbd>T</kbd>}
        </button>
        <button
          type="button"
          className="btn btn-ghost abq-places-btn"
          onClick={() => {
            setList((v) => !v);
            setTuning(false);
          }}
          aria-expanded={list}
        >
          Places {!touch && <kbd>M</kbd>}
        </button>
      </div>

      {tuning && <Driving id={tuneId} driving={driving} onChange={changeDriving} onClose={() => setTuning(false)} touch={touch} />}

      {list && (
        <div className="abq-list" role="dialog" aria-label="Places in Albuquerque">
          <div className="abq-list-head">
            <p>Places</p>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setList(false)}>
              Close
            </button>
          </div>
          <ul>
            {prog.places.map((p) => (
              <li key={p.id} data-open={p.open || undefined} data-next={p.id === prog.next || undefined}>
                <div>
                  <p className="abq-list-name">{p.name}</p>
                  <p className="abq-list-sub">{p.open ? p.sub : p.hint}</p>
                </div>
                {p.open ? (
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => travel(p)}>
                    Drive there
                  </button>
                ) : (
                  <span className="abq-lock">Locked</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

// The title, as the title cards have it: Al, aluminium.
export function Title() {
  const { before, el, after } = splitWord('Albuquerque');
  return (
    <h1 id="abq-title" className="abq-world-title" aria-label="Albuquerque">
      <span aria-hidden="true">
        {before}
        {el && (
          <span className="abq-world-tile">
            <small>{el.n}</small>
            {el.sym}
          </span>
        )}
        {after}
      </span>
    </h1>
  );
}

// The driving settings (rules.js's DRIVING), from the Driving button (or O):
// how quickly the wheel goes over, how much the car straightens itself out of
// a slide, how tightly the camera follows. Every change is live and kept
// between visits. Not modal: the town stays drivable behind it.
const pct = (k, v) => (k === 'assist' && v === 0 ? 'Off' : `${Math.round(v * 100)}%`);
function Driving({ id, driving, onChange, onClose, touch }) {
  return (
    <section id={id} className="abq-list abq-drive" role="dialog" aria-label="Driving settings">
      <div className="abq-list-head">
        <p>Driving</p>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
          Close
        </button>
      </div>
      {Object.entries(DRIVING).map(([k, r]) => {
        const v = driving[k];
        return (
          <label key={k} className="abq-drive-row">
            <span className="abq-drive-top">
              <span className="abq-list-name">{r.label}</span>
              <output>{pct(k, v)}</output>
            </span>
            <input
              type="range"
              min={r.min}
              max={r.max}
              step={r.step}
              value={v}
              style={{ '--fill': `${((v - r.min) / (r.max - r.min)) * 100}%` }}
              onChange={(e) => onChange({ ...driving, [k]: Number(e.target.value) })}
              // (dragged with a mouse or a thumb, it lets go of the arrow keys again)
              onPointerUp={(e) => e.currentTarget.blur()}
              aria-describedby={`${id}-${k}`}
            />
            <span id={`${id}-${k}`} className="abq-list-sub">
              {r.hint}
            </span>
          </label>
        );
      })}
      <ul className="abq-drive-moves">
        <li>
          <b>Handbrake turn</b> {touch ? 'Hold Slide and steer' : 'Hold Space and steer'}: the tail swings round. Let go and it grips where it points.
        </li>
        <li>
          <b>Drift</b> A dab of handbrake into a corner, then the throttle. Dirt and sand slide on their own.
        </li>
        <li>
          <b>J-turn</b> Reverse flat out, then the handbrake and the wheel hard over.
        </li>
      </ul>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange({ ...DRIVING_DEFAULTS })}>
        Back to how it came
      </button>
    </section>
  );
}
