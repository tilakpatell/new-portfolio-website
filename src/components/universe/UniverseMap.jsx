import { useCallback, useEffect, useRef, useState } from 'react';
import { useScene } from '../../lib/three/useScene';
import { local } from '../../lib/hooks';
import { CONTROLS_KEY, readControls } from './controls';
import FlightSettings from './FlightSettings';
import Hangar from './Hangar';
import { UNIVERSES } from './universes';
import { ORDER, keyStep } from './layout';
import MiniMap from './MiniMap';
import GuideCue from '../guide/GuideCue';

// The map: the 3D scene (scene.js and planets.js, through useScene) with the
// planets' names as buttons over it. React renders the names once; the
// scene moves them as it draws. The names are one focus group: the arrow
// keys step through the universes, Home and End jump to the ends. With a
// ship picked there's a ring that shows the drag-to-steer stick, a gauge of
// how high it flies, its shields (while there's trouble about), the
// targeting HUD (the gun line, the lock on a hunter with the lead to shoot
// at and, for the tough ones, what they have left, arrows at the edge for
// the ones coming at you that you can't see, and the way to wherever you're
// going; the scene places them), Boost, Fire (held, it keeps firing), View
// (the cockpit or behind the ship) and nose-up and nose-down buttons on touch
// screens, the flight settings (FlightSettings.jsx, kept between visits),
// the hangar (Hangar.jsx: the ship's paint job and parts, which the page
// keeps) and a line on how to fly until you do. While the
// 3D loads the box says so (3D first: never the flat map in the meantime);
// if 3D is off, fails or is lost, the flat MiniMap takes the box. Online,
// the other pilots' callsigns ride over their ships (the scene moves them).
// The map button (and M) opens the nav map (the page's: NavMap.jsx); `drive`
// is the one picked there, how the ship goes anywhere it's sent, and
// `charting` says the nav map's open (the director holds off meanwhile).
const load = () => import('./scene');

export default function UniverseMap({ selected, onSelect, onOpen, handle, frozen, ship, shipName = '', loadout, build = null, lastBuild = null, dropped = null, onBuild, onCrew = null, onFit, hangar = false, onHangar, net = null, onEvent, onLand, onCrash, drive = 'super', charting = false, onMap, startAt = null }) {
  const labels = useRef({});
  const tags = useRef(null);
  const stick = useRef(null);
  const alt = useRef(null);
  const shield = useRef(null);
  const hud = useRef(null);
  const arms = useRef(null); // the weapon readout (weapons.js)
  const siegeEl = useRef(null); // the Citadel's siege (siege.js)
  const prompt = useRef(null);
  const enterBtn = useRef(null); // into the world you're down on (landings/wayin.js): the scene shows it
  const [flown, setFlown] = useState(false);
  // out of the ship on a planet (the controls change), and where you could land
  const [onFoot, setOnFoot] = useState(false);
  const [landable, setLandable] = useState(null);
  const [phoneNear, setPhoneNear] = useState(false); // at the phone out past the belt (phone.js): a touch button to pick it up
  const [footHint, setFootHint] = useState(false);
  // the place's name as you come down on a planet (landings.js)
  const [arrive, setArrive] = useState(null);
  const [controls, setControlsState] = useState(() => readControls(local.get(CONTROLS_KEY)));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const setControls = (c) => {
    const next = readControls(c);
    setControlsState(next);
    local.set(CONTROLS_KEY, next);
  };
  // (the settings and the hangar sit in the same place: one at a time)
  const openSettings = useCallback(
    (on) => {
      setSettingsOpen(on);
      if (on) onHangar?.(false);
    },
    [onHangar],
  );
  const openHangar = useCallback(
    (on) => {
      onHangar?.(on);
      if (on) setSettingsOpen(false);
    },
    [onHangar],
  );
  const events = useRef(onEvent);
  events.current = onEvent;
  const { wrap, on, meant, view } = useScene(load, {
    id: 'universe',
    near: '0px',
    props: {
      selected,
      ship,
      loadout,
      build,
      controls,
      labels,
      stick,
      alt,
      shield,
      hud,
      arms,
      siege: siegeEl,
      net,
      tags,
      prompt,
      enter: enterBtn,
      frozen,
      drive,
      charting,
      startAt,
      onPick: onSelect,
      onOpen,
      onLand,
      onCrash,
      onEvent: (e) => {
        if (e.type === 'launch') setFlown(true);
        if (e.type === 'landable') setLandable(e.id);
        if (e.type === 'phone' && e.what !== 'open') setPhoneNear(e.what === 'near');
        if (e.type === 'foot' && e.id === 'arrive') setArrive({ title: e.title, sub: e.sub, at: Date.now() });
        if (e.type === 'foot' && e.id === 'out') {
          setOnFoot(true);
          setFootHint(true);
        }
        if (e.type === 'foot' && (e.id === 'off' || e.id === 'in')) {
          setOnFoot(false);
          setArrive(null);
        }
        events.current?.(e);
      },
    },
  });

  useEffect(() => {
    setFlown(false);
    setOnFoot(false);
  }, [ship]);
  useEffect(() => {
    if (!arrive) return undefined;
    const t = setTimeout(() => setArrive(null), 6500);
    return () => clearTimeout(t);
  }, [arrive]);
  // the keys on foot, for a while after stepping out
  useEffect(() => {
    if (!footHint) return undefined;
    const t = setTimeout(() => setFootHint(false), 16000);
    return () => clearTimeout(t);
  }, [footHint]);

  // what the page needs from the map: whether it's drawing, the dive in,
  // and Escape and the whole map while flying
  useEffect(() => {
    if (!handle) return;
    handle.current = {
      live: on,
      dive: (id) => view.current?.dive?.(id) ?? 0,
      escape: () => view.current?.escape?.() ?? false,
      whole: () => view.current?.whole?.() ?? false,
      travel: (id, d) => view.current?.travel?.(id, d) ?? false,
      where: () => view.current?.where?.() ?? null,
    };
  }, [handle, on, view]);

  const focusable = selected ?? ORDER[0];
  const onKeyDown = (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const to = keyStep(e.key, selected);
    if (to === undefined) return;
    e.preventDefault();
    onSelect(to);
    labels.current[to]?.focus();
  };

  const hold = (down) => (e) => {
    e.preventDefault();
    view.current?.boost?.(down);
  };
  const trigger = (down) => (e) => {
    e.preventDefault();
    view.current?.fire?.(down);
  };
  const climb = (way) => (e) => {
    e.preventDefault();
    view.current?.climb?.(way);
  };
  const climbButton = (way, label) => (
    <button
      type="button"
      className="universe-climb"
      aria-label={label}
      onPointerDown={climb(way)}
      onPointerUp={climb(0)}
      onPointerCancel={climb(0)}
      onPointerLeave={climb(0)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path d={way > 0 ? 'M5 15l7-7 7 7' : 'M5 9l7 7 7-7'} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );

  return (
    <div ref={wrap} className="universe-map" data-ship={ship || undefined} data-foot={onFoot || undefined}>
      {meant ? (
        <>
          {!on && (
            <p className="universe-loading" role="status">
              Charting the universe…
            </p>
          )}
          <ul className="universe-labels" aria-label="Universes" onKeyDown={onKeyDown}>
            {UNIVERSES.map((u) => (
              <li key={u.id}>
                <button
                  ref={(el) => {
                    labels.current[u.id] = el;
                  }}
                  type="button"
                  className="universe-label"
                  data-station={u.kind === 'core' || undefined}
                  style={{ '--swatch': u.swatch }}
                  aria-pressed={selected === u.id}
                  tabIndex={u.id === focusable ? 0 : -1}
                  onClick={() => onSelect(u.id)}
                  onPointerEnter={() => view.current?.hover?.(u.id)}
                  onPointerLeave={() => view.current?.hover?.(null)}
                  onFocus={() => view.current?.hover?.(u.id)}
                  onBlur={() => view.current?.hover?.(null)}
                >
                  {u.label}
                </button>
              </li>
            ))}
          </ul>
          <div ref={tags} className="universe-tags" aria-hidden="true" />
          {on && onMap && (
            <button type="button" className="universe-navmap-btn" data-ship={ship ? '' : undefined} onClick={onMap} aria-label="Nav map" title="Nav map (M)">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.6" />
                <path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                <path d="M15.5 8.5l-2.2 4.8-4.8 2.2 2.2-4.8z" fill="currentColor" />
              </svg>
            </button>
          )}
          {ship && on && (
            <>
              <div ref={stick} className="universe-stick" aria-hidden="true">
                <span />
              </div>
              <div ref={alt} className="universe-alt" aria-hidden="true">
                <span className="universe-alt-mark" />
              </div>
              <div ref={shield} className="universe-shield" aria-hidden="true">
                <span className="universe-shield-label">{onFoot ? 'Health' : 'Shields'}</span>
                <span className="universe-shield-bar">
                  <span />
                </span>
              </div>
              <div ref={hud} className="universe-hud" aria-hidden="true">
                <span className="universe-reticle" />
                <span className="universe-lock">
                  <i />
                  <i />
                  <i />
                  <i />
                  <b className="universe-lock-name" />
                  <b className="universe-lock-dist" />
                  <b className="universe-lock-hp" />
                </span>
                <span className="universe-threat" />
                <span className="universe-threat" />
                <span className="universe-threat" />
                <span className="universe-lead" />
                <span className="universe-nav">
                  <i />
                  <b className="universe-nav-name" />
                  <b className="universe-nav-dist" />
                </span>
              </div>
              <div ref={arms} className="universe-arms" aria-hidden="true">
                <span className="universe-arms-name" />
                <span className="universe-arms-rack">
                  <i className="universe-arms-pip" />
                  <i className="universe-arms-pip" />
                  <i className="universe-arms-pip" />
                  <i className="universe-arms-pip" />
                </span>
                <span className="universe-arms-keys">
                  <kbd>R</kbd> or <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd>
                </span>
              </div>
              <div ref={siegeEl} className="universe-siege" role="status">
                <b>The Citadel</b>
                <span className="universe-siege-state" />
              </div>
              <p ref={prompt} className="universe-prompt" aria-live="polite" />
              {/* (hidden until the crew are down on a planet with a world: the scene says when, and what it's called) */}
              <button ref={enterBtn} type="button" className="universe-wayin" hidden onClick={() => view.current?.enter?.()}>
                <span className="universe-wayin-label" />
                <kbd className="universe-wayin-key" aria-hidden="true">
                  Enter
                </kbd>
              </button>
              <div className="universe-climbs">
                {climbButton(1, onFoot ? 'Jump' : 'Nose up')}
                {!onFoot && climbButton(-1, 'Nose down')}
              </div>
              {onFoot ? (
                <button type="button" className="universe-view" onPointerDown={(e) => (e.preventDefault(), view.current?.swap?.())} onContextMenu={(e) => e.preventDefault()}>
                  Switch
                </button>
              ) : (
                <button type="button" className="universe-view" onPointerDown={(e) => (e.preventDefault(), view.current?.seat?.())} onContextMenu={(e) => e.preventDefault()}>
                  View
                </button>
              )}
              {onFoot && (
                <button type="button" className="universe-out" onPointerDown={(e) => (e.preventDefault(), view.current?.out?.())} onContextMenu={(e) => e.preventDefault()}>
                  Ship
                </button>
              )}
              {!onFoot && !landable && phoneNear && (
                <button type="button" className="universe-out" onClick={() => events.current?.({ type: 'phone', what: 'open' })}>
                  Phone
                </button>
              )}
              {!onFoot && (
                <button type="button" className="universe-weapon" onPointerDown={(e) => (e.preventDefault(), view.current?.weapon?.())} onContextMenu={(e) => e.preventDefault()}>
                  Weapon
                </button>
              )}
              <button
                type="button"
                className="universe-fire"
                onPointerDown={trigger(true)}
                onPointerUp={trigger(false)}
                onPointerCancel={trigger(false)}
                onPointerLeave={trigger(false)}
                onLostPointerCapture={trigger(false)}
                onContextMenu={(e) => e.preventDefault()}
              >
                Fire
              </button>
              <button
                type="button"
                className="universe-boost"
                onPointerDown={hold(true)}
                onPointerUp={hold(false)}
                onPointerCancel={hold(false)}
                onPointerLeave={hold(false)}
                onContextMenu={(e) => e.preventDefault()}
              >
                {onFoot ? 'Run' : 'Boost'}
              </button>
              {!onFoot && <FlightSettings controls={controls} onChange={setControls} open={settingsOpen} onOpen={openSettings} />}
              {!onFoot && onFit && <Hangar ship={ship} shipName={shipName} loadout={loadout} build={build} lastBuild={lastBuild} dropped={dropped} onBuild={onBuild} onCrew={onCrew} onFit={onFit} open={hangar} onOpen={openHangar} />}
              {arrive && (
                <div className="universe-arrive" key={arrive.at} role="status">
                  <p className="universe-arrive-title">{arrive.title}</p>
                  {arrive.sub && <p className="universe-arrive-sub">{arrive.sub}</p>}
                </div>
              )}
              {onFoot && footHint && (
                <p className="universe-hint">
                  <span className="universe-hint-keys">
                    <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> to walk, <kbd>Q</kbd> <kbd>E</kbd> to step aside, <kbd>Shift</kbd> to run, <kbd>Space</kbd> to jump, <kbd>F</kbd> or a click to fire, drag to look, <kbd>X</kbd> to switch, <kbd>V</kbd> their eyes, <kbd>G</kbd> back in, <kbd>Enter</kbd> into the world
                    <GuideCue />
                  </span>
                  <span className="universe-hint-touch">Drag to walk, Jump, Run, Fire, Switch to play the other one, Ship to get back in, Enter to go into the world<GuideCue touch /></span>
                </p>
              )}
              {!flown && !onFoot && (
                <p className="universe-hint">
                  <span className="universe-hint-keys">
                    <kbd>W</kbd> <kbd>S</kbd> throttle, <kbd>A</kbd> <kbd>D</kbd> roll, arrows to steer (loop right over), <kbd>Space</kbd> boost, hold <kbd>F</kbd> to fire, <kbd>R</kbd> weapons, <kbd>T</kbd> target, <kbd>V</kbd> cockpit, fly down into a planet’s air to land, <kbd>H</kbd> hangar, <kbd>O</kbd> settings
                    <GuideCue />
                  </span>
                  <span className="universe-hint-touch">Drag anywhere to fly, the arrows to pull the nose up and down, hold Boost to go fast and Fire to shoot, View for the cockpit, and fly down into a planet’s air to land on it<GuideCue touch /></span>
                </p>
              )}
            </>
          )}
        </>
      ) : (
        <div className="universe-flat">
          <MiniMap selected={selected} onSelect={onSelect} />
        </div>
      )}
    </div>
  );
}
