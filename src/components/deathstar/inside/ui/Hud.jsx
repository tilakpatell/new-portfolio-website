import { useState } from 'react';
import { MiniMap } from './Map';
import { gunName, promptLine, sectionName, security } from './state';

// What stands over the station while you walk it, and the pause menu. In
// the Empire’s own manner: black glass panels with thin grey rules, small
// capitals in a clean sans, red only for what is wrong (security up, health
// low, a gun venting), and Aurebesh as decoration a screen reader skips.
// Survival bottom left (health, the gun’s heat), what to do top left (the
// objective), where you are top right (the section, its security, the
// map), and what is said and what E does at the bottom in the middle. The
// objective and the map stay up on the start screen too, so the tour’s
// marks are there from the first moment.
//
//   <Hud ui hud say touch playing onMap onPause onChoose />
//     ui, hud: the world’s last 'ui' and 'hud' events (Inside.jsx lists their shape)
//     say: { who, text } a subtitle, or null
//   <Pause ui touch onResume onSet onQuit onExit />   onSet({ view | sound | subtitles })

const LOW = 30; // health at which the bar goes red

const KEYS = [
  ['W A S D / ← ↑ ↓ →', 'Walk'],
  ['Shift', 'Run'],
  ['Space', 'Jump'],
  ['C', 'Crouch'],
  ['Mouse', 'Look (click the station to hold the pointer)'],
  ['E', 'Use: lifts, consoles, people, coded hatches (doors open as you come near)'],
  ['Click', 'Fire'],
  ['Right-click', 'Aim'],
  ['R', 'Vent the gun'],
  ['V', 'Third or first person'],
  ['H', 'Helmet on or off'],
  ['M / Tab', 'The station’s map'],
  ['1 – 4', 'Choose what to say'],
  ['Esc / P', 'Pause'],
];
const TOUCHES = [
  ['Stick', 'Walk (push it all the way to run)'],
  ['Drag', 'Look'],
  ['Fire', 'Shoot'],
  ['Aim', 'Hold to aim'],
  ['Use', 'Lifts, consoles, people, coded hatches (doors open as you come near)'],
  ['Jump', 'Jump'],
  ['Crouch', 'Crouch, or stand again'],
];

function Bar({ label, value, of = 1, red, readout, segments = 0 }) {
  const k = Math.max(0, Math.min(1, of ? value / of : 0));
  return (
    <div className="ds-meter" data-red={red || undefined}>
      <span className="ds-meter-label">{label}</span>
      <span className="ds-meter-track" data-segments={segments || undefined} style={{ '--k': k, '--n': segments || 1 }}>
        <span className="ds-meter-fill" />
      </span>
      <span className="ds-meter-read">{readout}</span>
    </div>
  );
}

export default function Hud({ ui, hud, say, touch, playing, onMap, onPause, onChoose }) {
  const station = ui.station ?? 'ds1';
  const sec = security(hud?.alert);
  const line = playing ? promptLine(ui.prompt, { touch }) : null;
  const hp = Math.round(hud?.hp ?? 100);
  const objective = ui.mode === 'start' ? 'Choose a station and a side, then come aboard.' : ui.objective || (ui.play === 'roam' ? 'Free roam: walk the station as you like.' : '');
  const talk = playing ? ui.talk : null;
  const vitals = playing && hud && (
    <section className="ds-panel ds-vitals" aria-label="Health and gun">
      <Bar label="Health" value={hp} of={100} red={hp <= LOW} segments={10} readout={<span className="ds-num">{hp}</span>} />
      {hud.gun && <Bar label={gunName(hud.gun)} value={hud.heat ?? 0} red={hud.venting} readout={hud.venting ? 'Venting' : 'Heat'} />}
    </section>
  );
  return (
    <div className="ds-hud" data-touch={touch || undefined} data-start={ui.mode === 'start' || undefined}>
      <div className="ds-top">
        <div className="ds-top-left">
          <section className="ds-panel ds-objective" data-tour="ds-objective" aria-label="Objective">
            <p className="ds-kicker">
              Objective
              {ui.mode !== 'start' && <span className="ds-tag">{ui.play === 'roam' ? 'Free roam' : 'Story'}</span>}
              <span className="aurebesh ds-aurebesh" aria-hidden="true">
                Orders
              </span>
            </p>
            <p className="ds-objective-text" aria-live="polite">
              {objective}
            </p>
          </section>
          {/* (on a phone the stick has the bottom left, so health and heat come up here) */}
          {touch && vitals}
        </div>
        <div className="ds-where">
          {playing && hud && (
            <section className="ds-panel ds-section" aria-label="Section" data-red={sec.red || undefined}>
              <p className="ds-section-name">{sectionName(station, hud.section) || '—'}</p>
              <p className="ds-security" role="status">
                <span className="ds-security-dot" aria-hidden="true" />
                Security: {sec.label}
              </p>
            </section>
          )}
          <MiniMap station={station} seen={ui.map?.seen ?? []} here={ui.mode === 'start' ? null : hud?.room} at={ui.mode === 'start' ? null : hud?.at} onOpen={onMap} />
        </div>
        {playing && (
          <button type="button" className="ds-pause-btn" aria-label="Pause" onClick={onPause}>
            <span aria-hidden="true">❚❚</span>
          </button>
        )}
      </div>

      {!touch && vitals}

      {playing && !touch && !talk && <span className="ds-reticle" data-aim={hud?.aim || undefined} aria-hidden="true" />}

      <div className="ds-lines">
        {say && (
          <p className="ds-subtitle" role="status">
            {say.who && <span className="ds-subtitle-who">{say.who}</span>}
            {say.text}
          </p>
        )}
        {line && !talk && (
          <p className="ds-prompt" data-note={!line.key || undefined}>
            {line.key && (
              <>
                <kbd>{line.key}</kbd>
                <span className="ds-dash"> — </span>
              </>
            )}
            <span>{line.text}</span>
          </p>
        )}
      </div>

      {talk && (
        <section className="ds-panel ds-talk" aria-label={talk.who ? `Talking to ${talk.who}` : 'Conversation'}>
          {talk.who && <p className="ds-kicker">{talk.who}</p>}
          {talk.line && <p className="ds-talk-line">{talk.line}</p>}
          {talk.choices?.length > 0 && (
            <ol className="ds-talk-choices">
              {talk.choices.map((c, i) => (
                <li key={i}>
                  <button type="button" className="ds-choice" onClick={() => onChoose(i)}>
                    {!touch && <kbd>{i + 1}</kbd>}
                    <span>{c}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {hud && playing && hp <= 0 && <div className="ds-down" aria-hidden="true" />}
    </div>
  );
}

function Toggle({ on, onClick, children }) {
  return (
    <button type="button" className="ds-chip" aria-pressed={on} onClick={onClick}>
      {children}
    </button>
  );
}

export function Pause({ ui, touch, onResume, onSet, onQuit, onExit }) {
  const [help, setHelp] = useState(false);
  const s = { view: 'third', sound: true, subtitles: true, ...ui.settings };
  return (
    <div className="ds-overlay" role="dialog" aria-modal="true" aria-label="Paused">
      <div className="ds-panel ds-menu">
        <p className="ds-kicker">
          Paused
          <span className="aurebesh ds-aurebesh" aria-hidden="true">
            Standby
          </span>
        </p>
        <button type="button" className="ds-btn" onClick={onResume} autoFocus>
          Resume
        </button>
        <div className="ds-row" role="group" aria-label="View">
          <Toggle on={s.view === 'third'} onClick={() => onSet({ view: 'third' })}>
            Over the shoulder
          </Toggle>
          <Toggle on={s.view === 'first'} onClick={() => onSet({ view: 'first' })}>
            Through the eyes
          </Toggle>
        </div>
        <div className="ds-row">
          <Toggle on={s.sound} onClick={() => onSet({ sound: !s.sound })}>
            Sound {s.sound ? 'on' : 'off'}
          </Toggle>
          <Toggle on={s.subtitles} onClick={() => onSet({ subtitles: !s.subtitles })}>
            Subtitles {s.subtitles ? 'on' : 'off'}
          </Toggle>
          <Toggle on={help} onClick={() => setHelp((v) => !v)}>
            Controls
          </Toggle>
        </div>
        {help && (
          <dl className="ds-controls">
            {(touch ? TOUCHES : KEYS).map(([k, v]) => (
              <div key={v}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        )}
        <div className="ds-row ds-row-end">
          <button type="button" className="ds-btn ds-btn-ghost" onClick={onQuit}>
            Quit to the start
          </button>
          {onExit && (
            <button type="button" className="ds-btn ds-btn-ghost" onClick={onExit}>
              Back to the Death Star
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
