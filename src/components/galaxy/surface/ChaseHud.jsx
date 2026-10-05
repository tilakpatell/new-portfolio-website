import { useState } from 'react';

// What's over a chase (missions/chase.js): the count, then the scouts left,
// the clock and how close the leading one is to where it's going; at the
// end, how it went, with Again, a look round the world on foot, and the
// way back to the system. `view` is the scene's chaseView, with `result`.

const clock = (t) => {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
};

export default function ChaseHud({ view, mission, best, onAgain, onBack }) {
  const [shut, setShut] = useState(false);
  if (!view) return null;
  const { phase, count, t, left, total, lead, result } = view;
  const again = () => {
    setShut(false);
    onAgain();
  };
  return (
    <>
      {phase === 'count' && (
        <p key={count} className="chase-count" aria-live="assertive">
          {count}
        </p>
      )}
      {phase === 'run' && t < 0.9 && (
        <p className="chase-count chase-go" aria-live="assertive">
          Go
        </p>
      )}
      {!result && phase !== 'count' && (
        <div className="chase-hud">
          <p className="chase-name">{mission.name}</p>
          <div className="chase-row">
            <span className="chase-scouts" role="img" aria-label={`${left} of ${total} scouts still riding`}>
              {Array.from({ length: total }, (_, i) => (
                <i key={i} data-down={i >= left || undefined} />
              ))}
            </span>
            <span className="chase-clock">{clock(t)}</span>
          </div>
          <div className="chase-bunker" role="meter" aria-label="How close the leading scout is to the bunker" aria-valuenow={Math.round(lead * 100)} aria-valuemin={0} aria-valuemax={100} data-close={lead > 0.85 || undefined}>
            <span style={{ width: `${Math.min(100, lead * 100).toFixed(1)}%` }} />
          </div>
          <p className="chase-bunker-label">The leading scout, on the way to the bunker</p>
        </div>
      )}
      {result && !shut && (
        <div className="chase-result" role="dialog" aria-label={`${mission.name}: ${result.won ? 'won' : 'lost'}`} data-won={result.won || undefined}>
          <p className="chase-result-kicker">{mission.name}</p>
          <h2 className="chase-result-title">{result.won ? 'Every scout down' : 'One got through'}</h2>
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
                In {clock(result.t)}. {best && best.t < result.t - 0.05 ? `Your best: ${clock(best.t)}.` : 'Your best yet.'} Three stars under {mission.stars[0]} seconds.
              </p>
            </>
          ) : (
            <p className="chase-result-text">A scout reached the bunker and raised the alarm.{best ? ` Your best: ${clock(best.t)}.` : ''}</p>
          )}
          <div className="chase-result-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={again}>
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
