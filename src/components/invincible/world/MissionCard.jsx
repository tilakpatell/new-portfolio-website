import { useEffect, useRef } from 'react';
import { MISSIONS, STORY, missionOf } from './missions';

// The missions' cards over the city (./InvWorld.jsx runs the missions;
// this only shows them): the episode's title card as one starts, in its
// colour, gone in 2.5 s; the end card with the time, the best and the next
// episode; why one failed, with Again; the question before abandoning one;
// and Cecil's board at the GDA, the season listed with what's done and
// what's next. Escape closes any of them; the buttons do the rest.

const clock = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
const WHY = { time: 'Out of time.', late: 'Too late.', lost: 'The hangar fell.', left: 'You lost him.', abandoned: 'Called off.' };

export default function MissionCard({ card, story, onClose, onAgain, onStart, onAbandon }) {
  const first = useRef(null);
  // (a panel takes the focus, so Enter and Escape go to it, and gives it back)
  useEffect(() => {
    if (!card || card.kind === 'start') return undefined;
    const was = document.activeElement;
    first.current?.focus?.();
    return () => was?.focus?.();
  }, [card]);
  if (!card) return null;
  const m = missionOf(card.id);
  if (card.kind === 'start')
    return (
      <div className="iw-mcard" style={{ '--mc': m?.colour ?? '#1d8fd6' }} aria-live="polite" onAnimationEnd={onClose}>
        <span className="iw-mcard-ep">{m?.ep ? `Episode ${m.ep}` : 'The radio'}</span>
        <span className="iw-mcard-title">{m?.title}</span>
      </div>
    );
  if (card.kind === 'board') {
    const next = STORY.find((id) => !story.done.includes(id));
    return (
      <div className="iw-panel iw-board" role="dialog" aria-label="Cecil’s board">
        <p className="iw-eyebrow">The GDA · Cecil’s board</p>
        <ol>
          {MISSIONS.filter((q) => !q.side).map((q, i) => {
            const done = story.done.includes(q.id);
            const isNext = q.id === next;
            const locked = !done && !isNext;
            // (the last is Dad's, from the porch at dusk: Cecil only lists it)
            const dads = q.id === 'ep7';
            return (
              <li key={q.id} data-done={done || undefined} data-next={isNext || undefined} style={{ '--mc': q.colour }}>
                <b>{q.ep}</b>
                <span>
                  {q.title}
                  <small>{done ? `Done · best ${clock(story.best[q.id] ?? 0)}` : isNext ? (dads ? 'Dad gives this one, on the porch at dusk' : 'Next') : 'Locked'}</small>
                </span>
                {!locked && !dads && (
                  <button type="button" ref={isNext ? first : i === 0 ? first : null} className="iw-btn" onClick={() => onStart(q.id)}>
                    {done ? 'Again' : 'Go'}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
        <div className="iw-panel-row">
          <button type="button" className="iw-btn iw-btn-quiet" onClick={onClose}>
            Close <kbd>Esc</kbd>
          </button>
        </div>
      </div>
    );
  }
  if (card.kind === 'abandon')
    return (
      <div className="iw-panel" role="dialog" aria-label="Abandon the mission?">
        <p className="iw-eyebrow">{m?.title}</p>
        <p className="iw-panel-big">Call it off?</p>
        <div className="iw-panel-row">
          <button type="button" ref={first} className="iw-btn" onClick={onAbandon}>
            Abandon <kbd>Q</kbd>
          </button>
          <button type="button" className="iw-btn iw-btn-quiet" onClick={onClose}>
            Keep going <kbd>Esc</kbd>
          </button>
        </div>
      </div>
    );
  if (card.kind === 'fail')
    return (
      <div className="iw-panel" role="dialog" aria-label="Mission failed" style={{ '--mc': m?.colour }}>
        <p className="iw-eyebrow">{m?.title}</p>
        <p className="iw-panel-big">{WHY[card.why] ?? 'Not this time.'}</p>
        <div className="iw-panel-row">
          <button type="button" ref={first} className="iw-btn" onClick={onAgain}>
            Again
          </button>
          <button type="button" className="iw-btn iw-btn-quiet" onClick={onClose}>
            Close <kbd>Esc</kbd>
          </button>
        </div>
      </div>
    );
  // done
  const nextM = card.next ? missionOf(card.next) : null;
  return (
    <div className="iw-panel" role="dialog" aria-label="Mission done" style={{ '--mc': m?.colour }}>
      <p className="iw-eyebrow">{m?.ep ? `Episode ${m.ep} · ` : ''}{m?.title}</p>
      <p className="iw-panel-big">{clock(card.time)}</p>
      <p className="iw-panel-sub">{card.best != null && card.best < card.time ? `Best ${clock(card.best)}` : 'A best'}{nextM ? ` · Next: ${nextM.ep ? `episode ${nextM.ep}, ` : ''}${nextM.title}` : m?.side ? '' : ' · That’s the season'}</p>
      <div className="iw-panel-row">
        {nextM && nextM.giver === 'cecil' && (
          <button type="button" ref={first} className="iw-btn" onClick={() => onStart(nextM.id)}>
            Next episode
          </button>
        )}
        <button type="button" ref={nextM?.giver === 'cecil' ? null : first} className="iw-btn iw-btn-quiet" onClick={onAgain}>
          Again
        </button>
        <button type="button" className="iw-btn iw-btn-quiet" onClick={onClose}>
          Close <kbd>Esc</kbd>
        </button>
      </div>
    </div>
  );
}
