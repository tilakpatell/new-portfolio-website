import { useEffect, useRef, useState } from 'react';
import { COUNTRY_COUNT } from '../../data/places';
import { countWord } from '../travel/PlacesExplorer';
import { audioContext } from '../../lib/audio';
import { useVoiced } from '../../lib/useVoiced';
import { ABOUT_ME, ABOUT_THE_BRANCH, PER_ROUND, verdict } from './facts';
import './office.css';
import '../../styles/lazy/office.css';

// Dwight checks the facts: half about me, half about the branch, eight a
// round, shuffled. F says fact, X says false, Enter moves on. Dwight's
// verdicts are his own, in his voice where it's been made (lib/voiced.js).

// the facts about me (./facts.js), and how many countries: counted from the
// places, so its words change with them (and it has no voice made)
const MINE = [...ABOUT_ME, { q: `Tilak has been to ${countWord(COUNTRY_COUNT).toLowerCase()} countries.`, fact: true, dwight: `Fact. ${countWord(COUNTRY_COUNT)} countries and the Caribbean. I have been to Pennsylvania, which is all a man needs.` }];
const BEST = 'tp-factcheck-best';

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// four about me, four about the branch, in any order
const deal = () => shuffle([...shuffle(MINE).slice(0, PER_ROUND / 2), ...shuffle(ABOUT_THE_BRANCH).slice(0, PER_ROUND / 2)]);

const readBest = () => {
  try {
    return Number(window.localStorage.getItem(BEST)) || 0;
  } catch {
    return 0;
  }
};

export default function FactCheck({ onDone } = {}) {
  const [deck, setDeck] = useState(deal);
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState(null); // the visitor's pick for this one
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(readBest);
  const box = useRef(null);
  const done = i >= deck.length;
  const f = deck[i];
  // what Dwight's saying (his verdict on this one, then on the round), in his
  // voice where it's been made; it stops when it's gone from the card
  const [said, setSaid] = useState(null);
  useVoiced(said && 'dwight', said);
  const round = useRef(0);

  const pick = (fact) => {
    if (answer !== null || done) return;
    setAnswer(fact);
    audioContext(); // in the click, so he can be heard
    // the two the show said out loud, as the show said them
    if (f.clip) import('../../lib/clips').then((c) => c.playClip(f.clip));
    setSaid(f.clip ? null : f.dwight);
    if (fact === f.fact) {
      setScore((n) => n + 1);
      setStreak((n) => n + 1);
    } else setStreak(0);
  };
  const next = () => {
    if (answer === null) return;
    audioContext(); // in the click, so the verdict can be heard
    setSaid(null);
    // the last one: Michael takes the score well, or very badly, and then Dwight gives his verdict
    if (i === deck.length - 1) {
      onDone?.(score);
      const mine = round.current;
      import('../../lib/clips')
        .then((c) => c.playClip(score >= PER_ROUND - 2 ? 'thankYou' : 'noGod'))
        .then((h) => h?.ended)
        .then(() => mine === round.current && setSaid(verdict(score)))
        .catch(() => null);
      if (score > best) {
        setBest(score);
        try {
          window.localStorage.setItem(BEST, String(score));
        } catch {
          /* storage unavailable */
        }
      }
    }
    setAnswer(null);
    setI((n) => n + 1);
  };
  const again = () => {
    round.current += 1;
    setSaid(null);
    setDeck(deal());
    setI(0);
    setScore(0);
    setStreak(0);
    setAnswer(null);
  };
  // after an answer, the Next button is where the keyboard goes
  useEffect(() => {
    if (answer !== null) box.current?.querySelector('[data-next]')?.focus({ preventScroll: true });
  }, [answer]);

  const onKey = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (!done && answer === null && (k === 'f' || k === 't')) {
      e.preventDefault();
      pick(true);
    } else if (!done && answer === null && (k === 'x' || k === 'n')) {
      e.preventDefault();
      pick(false);
    } else if (done && k === 'enter') {
      e.preventDefault();
      again();
    }
  };

  const right = answer !== null && answer === f?.fact;
  return (
    <div ref={box} className="factcheck card" onKeyDown={onKey}>
      <div className="flex items-baseline justify-between gap-4">
        <p className="label">Fact or false</p>
        <p className="mono text-xs text-muted">
          {done ? `${score} of ${deck.length}` : `${i + 1} of ${deck.length}`}
          {streak > 1 && !done ? `  ·  ${streak} in a row` : ''}
        </p>
      </div>
      <ol className="fc-pips mt-3" aria-hidden="true">
        {deck.map((_, k) => (
          <li key={k} data-now={k === i || undefined} data-done={k < i || undefined} />
        ))}
      </ol>
      {done ? (
        <div className="mt-5" aria-live="polite">
          <p className="factcheck-q">
            {score} of {deck.length}.
          </p>
          <p className="mt-3 text-body">{verdict(score)}</p>
          <p className="mt-2 text-sm text-muted">{score >= best && score > 0 ? 'Your best yet.' : best ? `Your best: ${best} of ${PER_ROUND}.` : ''}</p>
          <button type="button" className="btn btn-primary mt-6" onClick={again}>
            Again
          </button>
        </div>
      ) : (
        <>
          <p className="factcheck-q mt-5">{f.q}</p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button type="button" className="btn btn-ghost" aria-pressed={answer === true} disabled={answer !== null} onClick={() => pick(true)}>
              Fact <kbd className="palette-kbd">F</kbd>
            </button>
            <button type="button" className="btn btn-ghost" aria-pressed={answer === false} disabled={answer !== null} onClick={() => pick(false)}>
              False <kbd className="palette-kbd">X</kbd>
            </button>
          </div>
          <div className="fc-answer mt-5 min-h-[5rem]" aria-live="polite">
            {answer !== null && (
              <>
                <span key={i} className="fc-stamp" data-right={right || undefined} aria-hidden="true">
                  {right ? 'Correct' : 'Wrong'}
                </span>
                <p className="font-semibold text-ink">{right ? 'Correct.' : 'Wrong.'}</p>
                <p className="mt-1 text-body">{f.dwight}</p>
              </>
            )}
          </div>
          <button type="button" data-next className="btn btn-primary mt-2" onClick={next} disabled={answer === null}>
            {i === deck.length - 1 ? 'See my score' : 'Next'}
          </button>
        </>
      )}
    </div>
  );
}
