import { local, useMediaQuery } from '../../lib/hooks';
import GuideCue from '../guide/GuideCue';
import { fmtClock } from './battle';
import { TRENCH } from './trench';

// The trench run's HUD, apart from the frame loop and the canvas drawing in
// TrenchRun.jsx (which was over the house's 800-line limit): the thumbs over
// the screen, the title and end card, and the row of buttons under it. Pure
// markup; every action and number comes in as a prop.

export const LEVEL = 'tp-trench-level';
export const LEVELS = Object.keys(TRENCH.levels);

// The round buttons over the screen while a run is on. Their presses stop at
// the row, so the screen's own drag-to-steer doesn't start under a thumb.
export function TrenchTouch({ computer, torpedoes, onComputer, onFire, holdLasers }) {
  return (
    <div className="trench-touch" onPointerDown={(e) => e.stopPropagation()}>
      <button type="button" data-trench className="trench-touch-btn" onClick={onComputer} aria-pressed={!computer} aria-label={computer ? 'Switch off targeting computer' : 'Targeting computer off'}>
        T<span className="trench-key">Computer</span>
      </button>
      <button type="button" data-trench className="trench-touch-btn trench-touch-laser" aria-label="Fire lasers (hold)" {...holdLasers}>
        Laser<span className="trench-key">Space</span>
      </button>
      <button type="button" data-trench className="trench-touch-btn trench-touch-fire" onClick={onFire} disabled={torpedoes <= 0} aria-label="Fire torpedo">
        Torp<span className="trench-key">F</span>
      </button>
    </div>
  );
}

// Before a run and after one: the brief or the result, the difficulty and the
// button that starts it.
export function TrenchCard({ ui, best, level, setLevel, onStart }) {
  const ended = ui.phase === 'won' || ui.phase === 'lost';
  const bestHere = best[level] ?? 0;
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  return (
    <div className="trench-overlay">
      <p className="stretch-semi text-2xl font-semibold text-white">{ui.phase === 'won' ? 'Direct hit. The Death Star is gone.' : ui.phase === 'lost' ? 'Pull up.' : 'Trench run'}</p>
      <p className="trench-brief mt-2 max-w-md text-sm text-white/80">
        {ui.phase === 'ready'
          ? 'Over the surface first: shoot down the TIE fighters and dodge the towers. Then dive into the trench, thread the catwalks and walls, lose Vader, and put a torpedo in the exhaust port. A torpedo spent in the trench blasts a catwalk, a wall or a turret out of your way, but you only have two. Arrows or W A S D steer (drag on a touch screen), Space or a held click fires the lasers, F or Enter fires a torpedo, T switches off the targeting computer.'
          : ui.message}
        {ui.phase === 'ready' && <GuideCue touch={touch} />}
      </p>
      {ended && (
        <p className="mono mt-3 text-sm text-white">
          Score {ui.score}
          {ui.newBest ? ' · a new best' : bestHere ? ` · best ${bestHere}` : ''}
        </p>
      )}
      <div className="trench-levels mt-4" role="group" aria-label="Difficulty">
        {LEVELS.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={level === id}
            onClick={() => {
              setLevel(id);
              local.set(LEVEL, id);
            }}
          >
            {TRENCH.levels[id].label}
            {best[id] ? <small>{best[id]}</small> : null}
          </button>
        ))}
      </div>
      <button type="button" className="trench-go btn btn-primary mt-4" onClick={onStart}>
        {ui.phase === 'ready' ? 'Start the run' : 'Fly it again'}
      </button>
    </div>
  );
}

// Under the screen: the same three actions as buttons, the readout, the
// crew's line and the 3D switch with why it may be off.
export function TrenchControls({ ui, running, clock, three, glState, holdLasers, onFire, onComputer }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button type="button" data-trench className="btn btn-primary btn-sm hold-btn" disabled={!running} {...holdLasers}>
        Fire lasers
      </button>
      <button type="button" data-trench className="btn btn-primary btn-sm" onClick={onFire} disabled={!running || ui.torpedoes <= 0}>
        Fire torpedo
      </button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onComputer} disabled={!running} aria-pressed={!ui.computer}>
        {ui.computer ? 'Switch off targeting computer' : 'Targeting computer off'}
      </button>
      <span className="mono text-xs text-muted">
        Shields {'■'.repeat(Math.max(0, ui.shields))}
        {'□'.repeat(Math.max(0, ui.maxShields - ui.shields))} · Torpedoes {ui.torpedoes} · Score {ui.score}
        {clock != null && ` · Yavin 4 in range in ${fmtClock(clock)}`}
      </span>
      <span className="mono min-h-[1.2em] w-full text-sm text-accent" role="status">
        {running ? ui.message : ''}
      </span>
      <span className="flex w-full flex-wrap items-center gap-3 text-xs text-muted">
        {three.can ? (
          <button type="button" className="btn btn-ghost btn-sm" aria-pressed={three.on} onClick={() => three.set(three.on ? 'off' : 'on')}>
            3D graphics: {three.on ? 'on' : 'off'}
          </button>
        ) : (
          <span>Playing in 2D: this browser isn’t giving the page WebGL, which usually means hardware acceleration is off. Turn it on for the 3D trench.</span>
        )}
        {glState === 'loading' && <span>Loading the 3D station…</span>}
        {glState === 'lost' && <span>The graphics chip reset, so this is the 2D version now.</span>}
        {glState === 'failed' && <span>3D couldn’t start here, so this is the 2D version.</span>}
      </span>
    </div>
  );
}
