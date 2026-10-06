import { useEffect } from 'react';
import './battle.css';

// The battle's HUD at the front (front.js runs it, scene.js writes into it):
// Battlefront's bar along the top (each side's name and tickets either side
// of the clock, both flagships' hulls under it), the phase and its
// objectives under that; the choice of side as you arrive; and the card at
// the end: who won, what it did to the war, and the war's line of sectors
// with the front marked.
//
// The bar is written by the scene a few times a second, by class:
// .battle-name-a/-b, .battle-tickets-a/-b, .battle-clock, .battle-hull-a/-b
// (--hp), .battle-phase, .battle-obj (an <i style="--hp"> an objective).
// `ask` ({ battle, war, sector, attacker, sides: [{ name, colour }] }) and
// `over` ({ word, text, sectors: [{ name, owner, front }], colours }) come
// from the scene's events.

export default function BattleHud({ hudRef, ask, onJoin, onStay, over, onClose }) {
  // Esc stays out of the fight
  useEffect(() => {
    if (!ask) return undefined;
    const key = (e) => {
      if (e.key === 'Escape') onStay?.();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [ask, onStay]);

  return (
    <>
      <div ref={hudRef} className="battle-hud" aria-hidden="true">
        <div className="battle-bar">
          <span className="battle-team">
            <b className="battle-name-a" />
            <i className="battle-tickets-a" />
          </span>
          <span className="battle-clock" />
          <span className="battle-team battle-team-b">
            <i className="battle-tickets-b" />
            <b className="battle-name-b" />
          </span>
        </div>
        <div className="battle-hulls">
          <span className="battle-hull battle-hull-a">
            <i />
          </span>
          <span className="battle-hull battle-hull-b">
            <i />
          </span>
        </div>
        <p className="battle-phase" />
        <div className="battle-obj" />
      </div>
      {ask && (
        <div className="battle-ask" role="dialog" aria-label={`${ask.battle}: pick a side`}>
          <p className="battle-ask-war">{ask.war}</p>
          <p className="battle-ask-title">{ask.battle}</p>
          <p className="battle-ask-sub">Pick a side to fly for. Your side’s wins move the front.</p>
          <div className="battle-ask-sides">
            {ask.sides.map((s, i) => (
              <button key={s.name} type="button" className="battle-ask-side" style={{ '--c': s.colour }} onClick={() => onJoin?.(i)}>
                <span>{s.name}</span>
                <small>{i === ask.attacker ? 'Attacking: destroy their flagship' : 'Defending: hold till the clock runs out'}</small>
              </button>
            ))}
          </div>
          <button type="button" className="battle-ask-stay" onClick={() => onStay?.()}>
            Stay out of it <kbd>Esc</kbd>
          </button>
        </div>
      )}
      {over && (
        <div className="battle-over" role="status">
          <p className="battle-over-word" data-word={over.word}>
            {over.word}
          </p>
          <p className="battle-over-text">{over.text}</p>
          <ol className="battle-strip" aria-label="The war’s sectors">
            {over.sectors.map((s) => (
              <li key={s.name} style={{ '--c': over.colours[s.owner] }} data-front={s.front || undefined}>
                <i />
                <span>{s.name}</span>
              </li>
            ))}
          </ol>
          <button type="button" className="battle-over-close" onClick={() => onClose?.()}>
            Fly on
          </button>
        </div>
      )}
    </>
  );
}
