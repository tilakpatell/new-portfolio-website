import { useEffect, useRef, useState } from 'react';

// The world's HUD over the city: the title (a chip once he's flying), the
// time of day and one Menu, the compass with the objective line under it,
// the gauge, the prompt and the toasts, the map. Laid out by ./hud.js's
// rules; ./InvWorld.jsx's frame loop writes the numbers straight into the
// elements `hud` holds (no re-render a frame), and draws the compass and
// the map on their canvases.

const TIME_NAME = { noon: 'Noon', dusk: 'Dusk', night: 'Night' };

export default function InvHud({ hud, mapRef, time, cycleTime, help, setHelp, chip, trav, found, cards, near, act, toast }) {
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(null);
  // (the menu closes on a click anywhere else, or Escape)
  useEffect(() => {
    if (!menu) return undefined;
    const off = (e) => {
      if (e.type === 'keydown' ? e.key === 'Escape' : !menuRef.current?.contains(e.target)) setMenu(false);
    };
    window.addEventListener('pointerdown', off);
    window.addEventListener('keydown', off);
    return () => {
      window.removeEventListener('pointerdown', off);
      window.removeEventListener('keydown', off);
    };
  }, [menu]);
  const set = (key) => (el) => (hud.current[key] = el);

  return (
    <>
      <div className="iw-hud iw-hud-top">
        <div className="iw-brand" ref={set('brand')} data-chip={chip || undefined}>
          <p className="iw-eyebrow">Invincible · the Graysons’ city</p>
          <h2 id="iw-title" className="iw-title">
            Fly, Mark.
          </h2>
        </div>
        <div className="iw-tools" ref={set('tools')}>
          {/* the time of day: the one place it's read from */}
          <button type="button" className="iw-btn iw-time" onClick={cycleTime} aria-label={`Time of day: ${TIME_NAME[time]}. Change it.`}>
            {TIME_NAME[time]}
          </button>
          <div className="iw-menu" ref={menuRef}>
            <button type="button" className="iw-btn" onClick={() => setMenu((v) => !v)} aria-expanded={menu} aria-haspopup="menu">
              Menu
            </button>
            {menu && (
              <div className="iw-menu-list" role="menu">
                <button type="button" role="menuitem" onClick={cycleTime}>
                  Time of day: <b>{TIME_NAME[time]}</b>
                </button>
                <button type="button" role="menuitem" onClick={() => (setHelp((v) => !v), setMenu(false))} aria-expanded={help}>
                  Controls
                </button>
                <Players trav={trav} />
                <a role="menuitem" href="#inv-game" onClick={() => setMenu(false)}>
                  Think, Mark!
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
      <canvas className="iw-compass" ref={set('compass')} aria-hidden="true" />
      <p className="iw-goal" ref={set('goal')} aria-live="polite" />

      {help && (
        <div className="iw-help" role="dialog" aria-label="Controls">
          <dl>
            <dt>W A S D</dt>
            <dd>Fly the way you’re looking (walk, on the ground)</dd>
            <dt>Space · C</dt>
            <dd>Up (take off) · down (land)</dd>
            <dt>Shift</dt>
            <dd>Flat out. Past Mach 0.35 the air breaks</dd>
            <dt>Drag · arrows</dt>
            <dd>Look round</dd>
            <dt>J · F · click</dt>
            <dd>Punch (a little way off, he lunges)</dd>
            <dt>E</dt>
            <dd>At a place: go in (Cecil’s board, at the GDA, has the season)</dd>
            <dt>Q</dt>
            <dd>Call a mission off</dd>
            <dt>T</dt>
            <dd>Noon, dusk, night</dd>
            <dt>Up, up</dt>
            <dd>Past 9 km you’re out of the air: the Moon and Mars are out there</dd>
          </dl>
          <p>A pad works: left stick flies, right stick looks, A up, B down, RT flat out, X punches, Y goes in.</p>
          <p>
            Things to do: Dad’s rings start over the street outside the house; {found} of {cards} title cards found; rescues come in on their own.
          </p>
        </div>
      )}

      <div className="iw-hud iw-hud-bottom">
        <div className="iw-gauge" aria-hidden="true">
          <p className="iw-speed">
            <span ref={set('speed')}>0</span>
            <small>km/h</small>
            <em className="iw-zone" ref={set('zone')}>
              City
            </em>
          </p>
          <div className="iw-bar">
            <i ref={set('bar')} />
          </div>
          <p className="iw-mach" ref={set('mach')}>
            Standing
          </p>
          <p className="iw-alt">
            <span>Height</span> <b ref={set('alt')}>0 m</b>
          </p>
        </div>
        <div className="iw-mid">
          {near && (
            <button type="button" className="iw-prompt" onClick={act}>
              <kbd>E</kbd> {near.name}
            </button>
          )}
          {toast && (
            <p className="iw-toast" key={toast.key} role="status">
              {toast.text}
            </p>
          )}
        </div>
      </div>
      <canvas className="iw-map" ref={mapRef} aria-hidden="true" />
    </>
  );
}

// Other players online here: how many, or a way to see them (going online
// is the site's own switch, with your callsign, as the universe's map has it).
function Players({ trav }) {
  if (!trav.available) return null;
  if (!trav.on)
    return (
      <button type="button" role="menuitem" onClick={trav.join} title="Go online, and see everyone else flying the city as a pale Mark with their name over him">
        See other players
      </button>
    );
  return (
    <span className="iw-players" role="menuitem" title="Everyone else online here shows as a pale Mark: nothing passes between you but where each of you is">
      <b>{trav.count}</b> {trav.count === 1 ? 'player' : 'players'} here
    </span>
  );
}
