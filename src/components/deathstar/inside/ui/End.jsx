import { STORIES } from '../rules/stories';

// A story run to its end: its title, done, and what next. Walk the station
// on as you are, start another story from the start screen (the one you
// haven't played on this station suggested), or leave for the Death Star's
// page.
//
//   <End id onWalk onAnother onExit />   id: the story's (STORIES' key)

const NEXT = { 'ds1-rebel': 'ds1-imperial', 'ds1-imperial': 'ds2-rebel', 'ds2-rebel': 'ds2-imperial', 'ds2-imperial': 'ds1-rebel' };

export default function End({ id, onWalk, onAnother, onExit }) {
  const story = STORIES[id];
  const next = STORIES[NEXT[id]];
  return (
    <div className="ds-overlay" role="dialog" aria-modal="true" aria-label="Story complete">
      <div className="ds-panel ds-menu ds-end">
        <p className="ds-kicker">
          Story complete
          <span className="aurebesh ds-aurebesh" aria-hidden="true">
            Mission ended
          </span>
        </p>
        <h2 className="ds-end-title">{story?.title ?? 'The story'}</h2>
        <p className="ds-end-line">
          The station is yours to walk as you are.
          {next ? ` Next, try “${next.title}”, from the start screen.` : ''}
        </p>
        <div className="ds-row">
          <button type="button" className="ds-btn" onClick={onWalk} autoFocus>
            Walk on
          </button>
          <button type="button" className="ds-btn ds-btn-ghost" onClick={onAnother}>
            Another story
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
