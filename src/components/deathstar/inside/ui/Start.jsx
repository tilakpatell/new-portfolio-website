import { useState } from 'react';
import { MODES, SIDES, STATION_CHOICES, STORIES, heroesFor } from './state';
import './start.css';

// The start screen: which station (the first Death Star now; the second
// shows as coming until it is built), which side, who you are (a Rebel
// picks Luke, Han, Leia or Obi-Wan; an Imperial is a stormtrooper), and
// the story or free roam. Continue picks a saved story up where it was
// left; starting the story again begins it afresh (rooms seen and secrets
// found are kept either way). A black glass console, not a web form: each
// choice a row of keys, the one taken lit. (A touch screen gets no first
// focus: it would scroll a phone down to the buttons.)
//
//   <Start ui initial touch onStart onExit />
//     initial: { station, side, mode, hero } to begin from (the address’s, or the last game’s)
//     ui.saved: { [station]: { rebel, imperial } } whether each has a story to continue
//     onStart({ station, side, hero, mode, fresh })

const SIDE_WORDS = {
  rebel: {
    name: 'Rebel',
    line: 'Come aboard in borrowed armour. The garrison hunts you once you’re found out.',
  },
  imperial: {
    name: 'Imperial',
    line: 'Serve aboard as a stormtrooper, and catch the intruders.',
  },
};
const MODE_WORDS = { story: 'Story', roam: 'Free roam' };

function Choice({ label, children }) {
  return (
    <fieldset className="ds-choice-row">
      <legend className="ds-kicker">{label}</legend>
      <div className="ds-keys">{children}</div>
    </fieldset>
  );
}

function Key({ on, disabled, onClick, title, note, tag }) {
  return (
    <button type="button" className="ds-key" aria-pressed={on} disabled={disabled} onClick={onClick}>
      <span className="ds-key-title">
        {title}
        {tag && <span className="ds-tag">{tag}</span>}
      </span>
      {note && <span className="ds-key-note">{note}</span>}
    </button>
  );
}

export default function Start({ ui, initial = {}, touch = false, onStart, onExit }) {
  const open = STATION_CHOICES.filter((s) => s.open);
  const [station, setStation] = useState(() => (open.some((s) => s.id === initial.station) ? initial.station : open[0].id));
  const [side, setSide] = useState(() => (SIDES.includes(initial.side) ? initial.side : 'rebel'));
  const [mode, setMode] = useState(() => (MODES.includes(initial.mode) ? initial.mode : 'story'));
  const [chosen, setHero] = useState(initial.hero ?? null);
  const heroes = heroesFor(side);
  const hero = heroes.some((h) => h.id === chosen) ? chosen : heroes[0].id;
  const story = STORIES[station]?.[side];
  const saved = Boolean(ui.saved?.[station]?.[side]);
  const go = (fresh, m = mode) => onStart({ station, side, hero, mode: m, fresh });

  return (
    <div className="ds-start">
      <div className="ds-panel ds-start-panel">
        <header className="ds-start-head">
          <p className="ds-kicker">
            Battle station access
            <span className="aurebesh ds-aurebesh" aria-hidden="true">
              Imperial security bureau
            </span>
          </p>
          <h1 className="ds-title">Aboard the Death Star</h1>
        </header>

        <div className="ds-start-cols">
          <Choice label="Station">
            {STATION_CHOICES.map((s) => (
              <Key key={s.id} on={station === s.id} disabled={!s.open} onClick={() => setStation(s.id)} title={s.name} note={s.era} tag={s.open ? null : 'Coming'} />
            ))}
          </Choice>

          <Choice label="Side">
            {SIDES.map((id) => (
              <Key key={id} on={side === id} onClick={() => setSide(id)} title={SIDE_WORDS[id].name} note={SIDE_WORDS[id].line} />
            ))}
          </Choice>

          <Choice label={side === 'rebel' ? 'Who you are' : 'Who you serve as'}>
            {heroes.map((h) => (
              <Key key={h.id} on={hero === h.id} onClick={() => setHero(h.id)} title={h.name} />
            ))}
          </Choice>

          <Choice label="How to play">
            {MODES.map((id) => (
              <Key
                key={id}
                on={mode === id}
                onClick={() => setMode(id)}
                title={MODE_WORDS[id]}
                note={id === 'story' ? (story ? `“${story}”` : null) : 'Walk the station as you like; the story waits for you.'}
              />
            ))}
          </Choice>
        </div>

        <div className="ds-row ds-start-go">
          {saved && (
            <button type="button" className="ds-btn" onClick={() => go(false, 'story')} autoFocus={!touch}>
              Continue the story
            </button>
          )}
          <button type="button" className={saved ? 'ds-btn ds-btn-ghost' : 'ds-btn'} onClick={() => go(true)} autoFocus={!saved && !touch}>
            {mode === 'roam' ? 'Come aboard' : saved ? 'Start the story again' : 'Begin the story'}
          </button>
          {onExit && (
            <button type="button" className="ds-btn ds-btn-ghost" onClick={onExit}>
              Back to the Death Star
            </button>
          )}
        </div>
        <p className="ds-start-foot">
          {touch ? 'The stick walks and a drag looks round.' : 'Click the station to take the pointer; the mouse turns your head.'} Doors open as you come near; {touch ? 'Use' : 'E'} is for lifts,
          consoles, people and coded hatches.
        </p>
      </div>
    </div>
  );
}
