import { useEffect, useRef, useState } from 'react';
import { clockOf } from './missions/chase';

// What's over a galactic assault (missions/assault.js): first the choose
// card (which side you fight for), then the deploy card (which of your
// side's posts you come onto the field at, now and whenever you're down);
// on the field, the phase and its posts as chips filling with their
// meters, the reinforcements both sides have left, what's happening at the
// post you're in, the last few things that happened and your kills; at the
// end, how it went. `view` is the scene's battleView as the page last drew
// it; `feed` brings the same ten times a second, for the meters, the
// tickets and the clock alone, so only this is drawn again for them.

const ROLE = { attack: 'Attack', defend: 'Defend' };
const STATE = { taking: 'Taking', holding: 'Holding', losing: 'Losing', contested: 'Contested' };

export default function AssaultHud({ view, feed, mission, best, fresh, onSide, onDeploy, onAgain, onBack }) {
  const [shut, setShut] = useState(false);
  const [live, setLive] = useState(null);
  const first = useRef(null);
  useEffect(() => {
    const set = feed?.current;
    if (!set) return undefined;
    set.add(setLive);
    return () => set.delete(setLive);
  }, [feed]);
  const result = view?.result ?? null;
  // a card up: its first button to hand for a keyboard
  const card = view ? (view.phase === 'choose' ? 'choose' : result && !shut ? 'end' : view.phase === 'run' && !view.you.up ? 'deploy' : null) : null;
  useEffect(() => {
    if (card) first.current?.focus({ preventScroll: true });
  }, [card]);
  if (!view) return null;
  const now = live ?? view;
  const { sides } = mission;
  const me = view.you.side;
  const colourOf = (side) => (side ? sides[side].colour : 'rgba(255, 255, 255, 0.45)');
  const restart = () => {
    setShut(false);
    onAgain();
  };
  const phaseLabel = `Phase ${view.phaseIndex + 1} of ${view.phaseCount} · ${view.phaseName}`;
  return (
    <>
      <p className="sr-only" aria-live="polite">
        {card === 'choose' ? 'Choose your side' : card === 'deploy' ? 'Choose where to deploy' : result ? (result.won ? mission.ends.won : mission.ends.lost) : view.phase === 'run' ? phaseLabel : ''}
      </p>

      {card === 'choose' && (
        <div className="assault-card" role="dialog" aria-label={`${mission.name}: choose your side`}>
          <p className="chase-result-kicker">{mission.name}</p>
          <h2 className="chase-result-title">Choose your side</h2>
          <p className="chase-result-text">{mission.line}</p>
          <div className="assault-sides">
            {['attack', 'defend'].map((side, i) => (
              <button key={side} ref={i === 0 ? first : null} type="button" className="assault-side" style={{ '--side': sides[side].colour }} onClick={() => onSide(side)}>
                <b>{sides[side].name}</b>
                <span>{ROLE[side]}</span>
              </button>
            ))}
          </div>
          <div className="chase-result-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
              Back to the system
            </button>
          </div>
        </div>
      )}

      {card === 'deploy' && (
        <div className="assault-card" role="dialog" aria-label="Deploy">
          <p className="chase-result-kicker" style={{ color: colourOf(me) }}>
            {sides[me].name}
          </p>
          <h2 className="chase-result-title">{view.you.deaths ? 'Deploy again' : 'Deploy'}</h2>
          <p className="chase-result-text">
            {phaseLabel}. Reinforcements: <b style={{ color: colourOf('attack') }}>{now.tickets.attack}</b> {sides.attack.short}, <b style={{ color: colourOf('defend') }}>{now.tickets.defend}</b> {sides.defend.short}.
          </p>
          <ul className="assault-posts">
            {view.posts
              .filter((p) => p.fixed === me || p.owner === me)
              .map((p, i) => (
                <li key={p.id}>
                  <button ref={i === 0 ? first : null} type="button" className="assault-post" disabled={!p.can || now.tickets[me] <= 0} onClick={() => onDeploy(p.id)} style={{ '--side': colourOf(p.owner) }}>
                    <i>{p.letter || '◆'}</i>
                    <b>{p.name}</b>
                    <span>{p.fixed ? 'Yours to hold' : !p.live ? 'Behind the line' : p.can ? 'Held' : 'Under attack'}</span>
                  </button>
                </li>
              ))}
          </ul>
          {now.tickets[me] <= 0 && <p className="chase-result-text">No reinforcements left: the battle goes on without you.</p>}
          <div className="chase-result-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={restart}>
              Start over
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
              Back to the system
            </button>
          </div>
        </div>
      )}

      {view.phase === 'run' && !result && (
        <>
          <div className="assault-strip" aria-hidden="true">
            <p className="assault-phase">{phaseLabel}</p>
            <div className="assault-chips">
              {now.posts
                .filter((p) => !p.fixed)
                .map((p) => (
                  <span key={p.id} className="assault-chip" data-live={p.live || undefined} data-mine={p.owner === me || undefined} style={{ '--side': colourOf(p.owner ?? p.taking) }} title={p.name}>
                    <b>{p.letter}</b>
                    <i style={{ height: `${Math.round((p.owner || p.taking ? p.meter : 0) * 100)}%` }} />
                  </span>
                ))}
            </div>
          </div>
          <div className="assault-tickets" role="status" aria-label="Reinforcements">
            {['attack', 'defend'].map((side) => (
              <p key={side} data-mine={side === me || undefined} style={{ '--side': colourOf(side) }}>
                <b>{now.tickets[side]}</b>
                <span>{sides[side].short}</span>
              </p>
            ))}
            <p className="assault-score">
              <b>{view.you.kills}</b>
              <span>{view.you.kills === 1 ? 'kill' : 'kills'} · {clockOf(now.t)}</span>
            </p>
          </div>
          {view.you.up && now.you.in && (
            <div className="assault-ring" role="status" style={{ '--side': colourOf(now.posts.find((p) => p.id === now.you.in)?.owner ?? now.posts.find((p) => p.id === now.you.in)?.taking) }} data-state={now.you.state}>
              <p>
                {STATE[now.you.state] ?? ''} {now.posts.find((p) => p.id === now.you.in)?.name.replace(/^The /, 'the ')}
              </p>
              <span>
                <i style={{ width: `${Math.round(now.you.meter * 100)}%` }} />
              </span>
            </div>
          )}
          {view.feed.length > 0 && (
            <ul className="assault-feed" aria-live="polite">
              {view.feed.slice(-3).map((f, i) => (
                <li key={`${f.t}-${i}`} data-kind={f.kind}>
                  {f.text}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {card === 'end' && (
        <div className="chase-result" role="dialog" aria-label={`${mission.name}: ${result.won ? 'won' : 'lost'}`} data-won={result.won || undefined}>
          <p className="chase-result-kicker">{mission.name}</p>
          <h2 className="chase-result-title">{result.won ? mission.ends.won : mission.ends.lost}</h2>
          {result.won && (
            <p className="chase-stars" role="img" aria-label={`${result.stars} of 3 stars`}>
              {[0, 1, 2].map((i) => (
                <b key={i} data-on={i < result.stars || undefined}>
                  ★
                </b>
              ))}
            </p>
          )}
          <p className="chase-result-text">
            {result.won ? `Fighting for ${sides[result.side].name.replace(/^The /, 'the ')}, in ${clockOf(result.t)}.` : mission.ends.why[result.why ?? 'tickets']} {result.kills} {result.kills === 1 ? 'kill' : 'kills'}, {result.captures} {result.captures === 1 ? 'post' : 'posts'} taken with you in {result.captures === 1 ? 'it' : 'them'}.
            {result.won ? ` ${fresh ? 'Your best yet.' : best ? `Your best: ${clockOf(best.t)}.` : ''} Three stars under ${Math.round(mission.stars[0] / 60)} minutes.` : best ? ` Your best: ${clockOf(best.t)}.` : ''}
          </p>
          <div className="chase-result-actions">
            <button ref={first} type="button" className="btn btn-primary btn-sm" onClick={restart}>
              Again
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShut(true)}>
              Look round on foot
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
              Back to the system
            </button>
          </div>
        </div>
      )}
    </>
  );
}
