import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RiCheckLine, RiArrowRightLine } from 'react-icons/ri';
import { useAchievements } from '../Achievements';
import { isDone, todoFor } from '../../data/todo';
import { GUIDES } from './routes';
import { local } from '../../lib/hooks';
import { VISITED_KEY, storedKey } from '../../lib/visited';
import { worldAt } from '../worlds/worlds';
import { TOUR_KEY, openTour, readProgress } from '../../lib/tour';
import './todo.css';

// The guide's checklist: the catalogue (data/todo.js), for the visitor here
// to hire, to play, or both; each ticked off by an achievement, a page seen
// or something the shell keeps, and each with "Show me", which starts the
// tour at the stop that shows it (or, with none, goes there). A world's
// group is a way into it. Inside a world, a thing elsewhere says it leaves.
// ("Things to do" is a world's own list, under M: one word per thing.)

const FILTERS = [
  ['recruiter', 'Hire'],
  ['player', 'Play'],
  ['mixed', 'Everything'],
];

// the last audience tour under way or taken (the whole one is everything),
// else everything
function lastAudience() {
  const p = readProgress(local.get(TOUR_KEY, null));
  const was = p?.audience ?? p?.done.filter((d) => d !== 'view').at(-1);
  return was === 'recruiter' || was === 'player' ? was : 'mixed';
}

const time = (s) => (s < 60 ? `${s} s` : `${Math.round(s / 60)} min`);

// the guide's own order of areas, and its names for them
const ORDER = Object.keys(GUIDES);
const groups = (rows) => ORDER.map((area) => [area, rows.filter((r) => r.area === area)]).filter(([, rs]) => rs.length);

export default function TodoList({ pathname, onGo }) {
  const { unlocked } = useAchievements();
  const [filter, setFilter] = useState(lastAudience);
  const [visited] = useState(() => local.get(VISITED_KEY, []));
  const rows = todoFor(filter);
  const done = (r) => isDone(r, { unlocked, visited, stored: storedKey });
  const inWorld = worldAt(pathname);
  const count = rows.filter(done).length;
  const navigate = useNavigate();
  // (the tour never goes into a world, so inside one a thing in it is just where it is)
  const show = (r) => {
    onGo();
    if (inWorld && worldAt(r.to)?.to === inWorld.to) navigate(r.to);
    else openTour({ audience: filter, todo: r.id, to: r.to });
  };

  return (
    <>
      <h2 className="guide-title">The checklist</h2>
      <div className="todo-head">
        <div className="seg" role="group" aria-label="The checklist for">
          {FILTERS.map(([id, label]) => (
            <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>
              {label}
            </button>
          ))}
        </div>
        <p className="todo-count" aria-live="polite">
          {count} of {rows.length} done
        </p>
      </div>
      {groups(rows).map(([area, rs]) => {
        const world = worldAt(area);
        return (
          <section key={area} className="todo-group" aria-label={GUIDES[area].title}>
            <p className="guide-group">
              {world && world.to === area ? (
                <Link to={world.to} className="todo-world" onClick={onGo}>
                  {GUIDES[area].title}
                </Link>
              ) : (
                GUIDES[area].title
              )}
            </p>
            <ul className="todo-list">
              {rs.map((r) => {
                const ticked = done(r);
                const leaves = inWorld && worldAt(r.to)?.to !== inWorld.to;
                return (
                  <li key={r.id} className="todo-row" data-done={ticked ? '' : undefined}>
                    <span className="todo-tick" aria-hidden="true">
                      {ticked && <RiCheckLine className="h-3.5 w-3.5" />}
                    </span>
                    <div className="todo-what">
                      <p className="todo-title">
                        {r.title}
                        {ticked && <span className="sr-only"> (done)</span>}
                      </p>
                      <p className="todo-blurb">{r.blurb}</p>
                    </div>
                    <div className="todo-go">
                      <span className="todo-time">{time(r.seconds)}</span>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => show(r)} aria-label={`${leaves ? `Leave ${inWorld.label} and show me` : 'Show me'}: ${r.title}`}>
                        {leaves ? `Leave ${inWorld.label} and show me` : 'Show me'} <RiArrowRightLine className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </>
  );
}
