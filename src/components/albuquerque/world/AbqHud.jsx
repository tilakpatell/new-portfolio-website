import { useId, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Hud, Menu, MenuItem, Objective, Stick, Toast, TouchButton } from '../../../runtime/hud';
import { wayOut } from '../../worlds/worlds';
import { splitWord } from '../elements';
import { CRYSTALS, DRIVING, DRIVING_DEFAULTS } from './rules';
import GuideCue from '../../guide/GuideCue';

// The world's HUD over the town, on the runtime's HUD kit (src/runtime/hud),
// in the town's own look (world.css: the Georgia title, the mono chips, the
// gold): the title and the objective; the time of day and one Menu (the
// Driving panel, the places to go, the guide, the other drivers and the way
// out); under them the chips, the map and Hank's meter; the delivery's clock
// and the toasts; the door card, the key first; the first hint; and at the
// foot "Run a delivery", which on a phone sits over the handbrake, the stick
// beside them. ./AbqWorld.jsx's frame loop writes the speed straight into
// `speedo` and draws the map on `map` (./map.js). The keys are the site's
// guide's (Controls opens it).

const clockText = (s) => `${Math.floor(s / 60)}:${String(Math.ceil(s) % 60).padStart(2, '0')}`;
const LORE = {
  off: 'Go online, and see everyone else driving Albuquerque as a ghost from another world',
  on: 'Everyone else online in Albuquerque drives about as a ghost Aztek from another world: they can’t touch your career, nor you theirs',
};

export default function AbqHud({ touch, gl, prog, snap, rank, blue, speedo, map, trav, hud, toast, here, inside, enter, throwPizza, washCar, runDelivery, nextTime, clock, tuning, setTuning, list, setList, onStick, wake, hand, driving, changeDriving, travel }) {
  const tuneId = useId();
  const { pathname } = useLocation();
  // the bottom of the whole top row, the title and its line too (the kit
  // measures only the buttons): on a phone the panels open under it, not
  // over the objective (world.css)
  const side = useRef(null);
  useLayoutEffect(() => {
    const hud = side.current?.closest('.hud');
    const row = hud?.querySelector('.hud-top');
    if (!row) return undefined;
    const fit = () => hud.style.setProperty('--abq-row', `${Math.round(row.getBoundingClientRect().bottom - hud.getBoundingClientRect().top)}px`);
    fit();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
    ro?.observe(row);
    return () => ro?.disconnect();
  }, []);
  const toDrive = () => {
    setTuning((v) => !v);
    setList(false);
  };
  const toList = () => {
    setList((v) => !v);
    setTuning(false);
  };
  // the places as things to do: seen once you've been in
  const places = prog.places.map((p) => ({ ...p, done: p.visited }));
  const seen = places.filter((p) => p.done).length;
  // the one thing to do that isn't a place: on a phone over the handbrake, at the foot otherwise
  const run = (
    <button type="button" className="btn btn-ghost abq-places-btn" onClick={runDelivery} disabled={!!hud.run}>
      {hud.run ? 'On a run' : 'Run a delivery'} {!touch && !hud.run && <kbd>R</kbd>}
    </button>
  );
  return (
    <Hud
      className="abq-hud"
      touch={touch}
      brand={
        <>
          <Title />
          <Objective className="abq-hud-objective" glyph="◆" text={prog.objective} />
        </>
      }
      tools={
        <>
          <button type="button" className="btn btn-ghost abq-places-btn" onClick={nextTime} aria-label={`Time of day: ${clock.name}. Change it`}>
            {clock.name} {!touch && <kbd>T</kbd>}
          </button>
          <Menu className="abq-menu" players={{ available: trav.available, on: trav.on, count: trav.count, onJoin: trav.join }} noun="drivers" lore={LORE} way={wayOut(pathname)}>
            <MenuItem onClick={toDrive} aria-expanded={tuning} aria-controls={tuneId}>
              Driving {!touch && <kbd>O</kbd>}
            </MenuItem>
            <MenuItem onClick={toList} aria-expanded={list}>
              Things to do · {seen}/{places.length} {!touch && <kbd>M</kbd>}
            </MenuItem>
          </Menu>
        </>
      }
      foot={!touch && run}
      thumbs={
        <>
          <Stick className="abq-stick" onMove={onStick} onStart={wake} reach={50} label="Drive" />
          <div className="hud-buttons">
            {run}
            <TouchButton size={76} className="abq-hand" {...hand} aria-label="Handbrake: hold it into a corner to slide">
              Slide
            </TouchButton>
          </div>
        </>
      }
    >
      {/* under the time and the Menu, on the right: what you've got, where you are, who's on you */}
      <div className="abq-hud-side" ref={side}>
        <p className="abq-hud-chip">
          <b>${snap.money}</b>
          <span aria-hidden="true">·</span>
          <span className="abq-chip-words">{rank.title}</span>
        </p>
        <p className="abq-hud-chip abq-hud-speed" aria-hidden="true">
          <b ref={speedo}>0</b>
          <span>mph</span>
        </p>
        <p className="abq-hud-chip abq-hud-blue" title="Blue Sky crystals found in the desert">
          <span className="abq-chip-glyph" aria-hidden="true">
            ◆
          </span>
          <span className="abq-chip-words">Blue Sky</span>
          <span>
            <b>{blue}</b>/{CRYSTALS.length}
          </span>
        </p>
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

      {hud.run && (
        <p className="abq-run" role="timer" aria-label={`Delivery to ${hud.run.name}`}>
          <span aria-hidden="true">▣</span> {hud.run.name} · <b>{clockText(hud.run.left)}</b> · {hud.run.away} m
        </p>
      )}

      <Toast className="abq-toast" toast={toast && { key: toast.at, text: toast.text, bad: toast.bad }} />

      {/* the door: its name and line, then what you can do there, the key first ("E Go in") */}
      {here && !inside && (
        <div className="abq-door" data-open={here.open || undefined}>
          <p className="abq-door-name">{here.name}</p>
          <p className="abq-door-sub">{here.open ? here.sub : here.hint}</p>
          {here.open && (
            <div className="abq-door-acts">
              <button type="button" className="btn btn-primary" onClick={() => enter(here.id)}>
                {!touch && <kbd>E</kbd>} Go in
              </button>
              {here.id === 'home' && (
                <button type="button" className="btn btn-ghost abq-door-alt" onClick={throwPizza}>
                  {!touch && <kbd>P</kbd>} Throw a pizza
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
            {!touch && <kbd>E</kbd>} Wash the Aztek
          </button>
        </div>
      )}

      {/* the first hint: how to move, and the one rule; the rest is the guide's */}
      {gl === 'on' && !hud.moved && !here && (
        <p className="abq-hint">
          {touch ? 'Stick to drive, hold Slide into a turn. The flashing dot is Hank: don’t race past him.' : 'W A S D to drive, Space to slide. The flashing dot is Hank: don’t race past him.'}
          <GuideCue touch={touch} />
        </p>
      )}

      {tuning && <Driving id={tuneId} driving={driving} onChange={changeDriving} onClose={() => setTuning(false)} touch={touch} />}

      {list && <Places places={places} next={prog.next} onClose={() => setList(false)} onGo={travel} />}
    </Hud>
  );
}

// The title, as the title cards have it: Al, aluminium.
export function Title() {
  const { before, el, after } = splitWord('Albuquerque');
  return (
    <h1 id="abq-title" className="abq-world-title" data-tour="hud" aria-label="Albuquerque">
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

// The things to do: the places, drawn as the kit's list (runtime/hud
// QuestList: its classes, so its seals and its skin) but in the town's own
// words, which the kit's list can't say: "Drive there" to an open place
// (the kit hardcodes "Go there"), and a closed one "Locked", with how it
// opens. Closes with Close, M or Esc (./AbqWorld.jsx's keys).
function Places({ places, next, onClose, onGo }) {
  return (
    <div className="hud-list abq-list" role="dialog" aria-label="Things to do in Albuquerque">
      <div className="hud-list-head">
        <p>Things to do</p>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="hud-list-flavour">The places in town, as each one opens</p>
      <ul>
        {places.map((p) => (
          <li key={p.id} data-done={p.done || undefined} data-open={p.open || undefined} data-next={p.id === next || undefined}>
            <span className="hud-seal" aria-hidden="true">
              {p.done ? '✓' : ''}
            </span>
            <div>
              <p className="hud-list-name">{p.name}</p>
              <p className="hud-list-sub">{p.open ? p.sub : p.hint}</p>
            </div>
            {p.open ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onGo(p)}>
                Drive there
              </button>
            ) : (
              <span className="abq-lock">Locked</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// The driving settings (rules.js's DRIVING), from the Menu's Driving (or O):
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
