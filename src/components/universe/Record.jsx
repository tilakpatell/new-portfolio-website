import { useEffect, useId, useRef } from 'react';
import { useEconomy } from './EconomyProvider';
import { LEVELS } from './economy';
import { RANKS } from '../galaxy/ranks';
import { SIDES as WAR_SIDES, WARS } from '../galaxy/sides';

// The flight record: what you've become, everywhere at once (economy.js's
// record, and pilotMarks.js's standing and oath through the provider). Your
// credits, your level and title with a bar to the next, the kills, rescues,
// battles won and quests done, then a line for each universe: how its law,
// its ordinary ships and its pirates see you, and for the galaxy, the side
// you swore to and your rank there. A card, from the hangar's header (and
// the roster's), that sits in place of what opened it: Escape or Back puts
// it away.

const UNIVERSES = [
  ['starwars', 'Star Wars'],
  ['rickmorty', 'Rick and Morty'],
  ['breakingbad', 'Breaking Bad'],
];
const AXIS = { law: 'The law', civil: 'Ordinary ships', outlaw: 'Pirates' };
const num = (n) => n.toLocaleString('en-GB');

// how far into this level you are, 0…1 (1 at the cap)
const toNext = (xp, level) => (level >= LEVELS.length ? 1 : (xp - LEVELS[level - 1]) / (LEVELS[level] - LEVELS[level - 1]));

function oathLine(oath) {
  const war = (WARS[oath?.war]?.name ?? 'the war').replace(/^The /, 'the '); // (mid-sentence)
  if (!oath?.side) return `Not sworn in ${war}.`;
  const side = WAR_SIDES[oath.side]?.name ?? oath.side;
  const rank = RANKS[oath.side]?.find((r) => r.id === oath.rank)?.name;
  return rank ? `${rank} of the ${side}, in ${war}.` : `Sworn to the ${side}, in ${war}.`;
}

export default function Record({ open, onClose }) {
  const id = useId();
  const back = useRef(null);
  const { economy, marks } = useEconomy();

  // (its own Escape, before whatever opened it hears one)
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);
  useEffect(() => {
    if (open) back.current?.focus({ preventScroll: true });
  }, [open]);

  if (!open) return null;
  const r = economy?.record();
  const m = marks();
  return (
    <section className="universe-record" aria-labelledby={`${id}-title`}>
      <header className="universe-record-head">
        <h3 id={`${id}-title`}>Flight record</h3>
        <button ref={back} type="button" className="universe-record-back" onClick={onClose}>
          Back
        </button>
      </header>
      {!r ? (
        <p className="universe-record-note">Opening the record…</p>
      ) : (
        <>
          <div className="universe-record-level">
            <p>
              <b>Level {r.level}</b> · {r.title}
            </p>
            <p className="universe-record-credits">{num(r.credits)} ¢</p>
          </div>
          <div className="universe-record-bar" role="img" aria-label={r.level >= LEVELS.length ? 'The top level' : `${num(r.xp)} of ${num(LEVELS[r.level])} experience to level ${r.level + 1}`}>
            <i style={{ '--to': toNext(r.xp, r.level) }} />
          </div>
          <p className="universe-record-note">{r.level >= LEVELS.length ? `${num(r.xp)} xp. There’s nowhere higher.` : `${num(r.xp)} of ${num(LEVELS[r.level])} xp to level ${r.level + 1}.`}</p>
          <dl className="universe-record-tally">
            {[
              ['Kills', r.kills],
              ['Rescues', r.rescues],
              ['Battles won', r.wins],
              ['Quests done', r.quests],
            ].map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{num(v)}</dd>
              </div>
            ))}
          </dl>
          <ul className="universe-record-sides">
            {UNIVERSES.map(([side, name]) => {
              const st = m?.standing?.[side];
              const said = st ? Object.entries(AXIS).filter(([axis]) => st[axis]).map(([axis, who]) => `${who}: ${st[axis]}`) : [];
              return (
                <li key={side}>
                  <b>{name}</b>
                  <span>{said.length ? `${said.join(' · ')}.` : 'Nobody there has an opinion of you yet.'}</span>
                </li>
              );
            })}
            <li>
              <b>The galaxy</b>
              <span>{oathLine(m?.oath)}</span>
            </li>
          </ul>
        </>
      )}
    </section>
  );
}
