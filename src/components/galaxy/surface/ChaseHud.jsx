import { useEffect, useRef, useState } from 'react';
import { clockOf } from './missions/chase';

// What's over a mission: for a chase (missions/chase.js), the count, then
// the scouts left, the clock and how close the leading one is to where it's
// going (a quest mission has the quest's own panel instead); at the end,
// how it went (the mission's `ends`), with Again, a look round the world on
// foot, and the way back to the system. `view` is the scene's chaseView, with `result`,
// as the page last drew it; `feed` brings the same ten times a second, for
// the clock and the bar alone, so only this is drawn again for them.

export default function ChaseHud({ view, feed, mission, best, fresh, onAgain, onBack }) {
  const [shut, setShut] = useState(false);
  const [live, setLive] = useState(null);
  const again = useRef(null);
  useEffect(() => {
    const set = feed?.current;
    if (!set) return undefined;
    set.add(setLive);
    return () => set.delete(setLive);
  }, [feed]);
  const result = view?.result ?? null;
  // the card, when it comes: Again to hand for a keyboard
  useEffect(() => {
    if (result && !shut) again.current?.focus({ preventScroll: true });
  }, [result, shut]);
  if (!view) return null;
  const now = live ?? view;
  const { phase, count, left, total } = view;
  const { t, lead } = now;
  const go = phase === 'run' && t < 0.9;
  const restart = () => {
    setShut(false);
    onAgain();
  };
  return (
    <>
      {/* (said once each, for a screen reader: the count, the off, how it ended) */}
      <p className="sr-only" aria-live="assertive">
        {phase === 'count' ? count : go ? 'Go' : result ? (result.won ? mission.ends.won : mission.ends.lost) : ''}
      </p>
      {phase === 'count' && (
        <p key={count} className="chase-count" aria-hidden="true">
          {count}
        </p>
      )}
      {go && (
        <p className="chase-count chase-go" aria-hidden="true">
          Go
        </p>
      )}
      {!result && phase !== 'count' && mission.kind === 'chase' && (
        <div className="chase-hud">
          <p className="chase-name">{mission.name}</p>
          <div className="chase-row">
            <span className="chase-scouts" role="img" aria-label={`${left} of ${total} scouts still riding`}>
              {Array.from({ length: total }, (_, i) => (
                <i key={i} data-down={i >= left || undefined} />
              ))}
            </span>
            <span className="chase-clock">{clockOf(t)}</span>
          </div>
          <div className="chase-bunker" role="meter" aria-label="How close the leading scout is to the bunker" aria-valuenow={Math.round(lead * 100)} aria-valuemin={0} aria-valuemax={100} aria-valuetext={`${Math.round(lead * 100)}% of the way`} data-close={lead > 0.85 || undefined}>
            <span style={{ width: `${Math.min(100, lead * 100).toFixed(1)}%` }} />
          </div>
          <p className="chase-bunker-label">The leading scout, on the way to the bunker</p>
        </div>
      )}
      {result && !shut && (
        <div className="chase-result" role="dialog" aria-label={`${mission.name}: ${result.won ? 'won' : 'lost'}`} data-won={result.won || undefined}>
          <p className="chase-result-kicker">{mission.name}</p>
          <h2 className="chase-result-title">{result.won ? mission.ends.won : mission.ends.lost}</h2>
          {result.won ? (
            <>
              <p className="chase-stars" role="img" aria-label={`${result.stars} of 3 stars`}>
                {[0, 1, 2].map((i) => (
                  <b key={i} data-on={i < result.stars || undefined}>
                    ★
                  </b>
                ))}
              </p>
              <p className="chase-result-text">
                In {clockOf(result.t)}. {fresh ? 'Your best yet.' : best ? `Your best: ${clockOf(best.t)}.` : ''} Three stars under {mission.stars[0]} seconds.
              </p>
            </>
          ) : (
            <p className="chase-result-text">
              {mission.ends.why[result.why ?? 'lost']}
              {best ? ` Your best: ${clockOf(best.t)}.` : ''}
            </p>
          )}
          <div className="chase-result-actions">
            <button ref={again} type="button" className="btn btn-primary btn-sm" onClick={restart}>
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
