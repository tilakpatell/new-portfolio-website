import { useEffect, useRef, useState } from 'react';
import { COUNTRY_COUNT } from '../../data/places';
import { countWord } from '../travel/PlacesExplorer';
import { audioContext } from '../../lib/audio';
import './office.css';
import '../../styles/lazy/office.css';

// Dwight checks the facts: half about me, half about the branch, eight a
// round, shuffled. F says fact, X says false, Enter moves on. Dwight's
// verdicts are his own.

const ABOUT_ME = [
  { q: 'Tilak plays the sitar.', fact: true, dwight: 'Fact. Around twenty strings, and most of them ring on their own. I respect an instrument with backup.' },
  { q: 'Tilak’s Game Boy emulator runs games at 30 frames per second.', fact: false, dwight: 'False. Sixty, like the real hardware. Thirty is for amateurs and the Stamford branch.' },
  { q: 'Tilak is interning at Amazon Web Services.', fact: true, dwight: 'Fact. Technical Infrastructure PM intern. Before that RTX, Bose, Pendar and SRC. A strong résumé. Almost as strong as mine.' },
  { q: 'Tilak’s AI translator turns Gujarati scripture into Klingon.', fact: false, dwight: 'False. Into English, verse by verse. Klingon is a hobby, not a career.' },
  { q: `Tilak has been to ${countWord(COUNTRY_COUNT).toLowerCase()} countries.`, fact: true, dwight: `Fact. ${countWord(COUNTRY_COUNT)} countries and the Caribbean. I have been to Pennsylvania, which is all a man needs.` },
  { q: 'Tilak studies computer science at Northeastern.', fact: true, dwight: 'Fact. Boston. A fine city, if you don’t count the people, the traffic or the Red Sox.' },
  { q: 'Tilak once worked on lasers.', fact: true, dwight: 'Fact. Laser software at Pendar Technologies. I have asked for a laser for my desk. Request denied.' },
  { q: 'Tilak’s Game Boy emulator passes Blargg’s CPU tests.', fact: true, dwight: 'Fact. Every instruction, checked. That is how I do my taxes.' },
  { q: 'Tilak wrote his Unix shell in Python.', fact: false, dwight: 'False. In C. Python is for people who do not fear death.' },
  { q: 'Tilak interned at Dunder Mifflin.', fact: false, dwight: 'False. There is no record of him in the employee files. I checked. Twice. With a flashlight.' },
  { q: 'Tilak’s code was merged into GitHub’s awesome-copilot.', fact: true, dwight: 'Fact. Thirty-nine thousand stars. I have one star. It is gold, and Michael gave it to me.' },
];

const ABOUT_THE_BRANCH = [
  { q: 'Bears eat beets.', fact: true, dwight: 'Fact. Bears. Beets. Battlestar Galactica.', clip: 'bearsBeets' },
  { q: 'Identity theft is a joke.', fact: false, dwight: 'False. Identity theft is not a joke. Millions of families suffer every year.', clip: 'identityTheft' },
  { q: 'Dwight’s middle name is Kurt.', fact: true, dwight: 'Fact. Dwight Kurt Schrute. The Kurt is for my grandfather, who could kill a man with a tuba.' },
  { q: 'Michael bought his own World’s Best Boss mug.', fact: true, dwight: 'Fact. At Spencer Gifts. Which does not make it less true.' },
  { q: 'Dunder Mifflin Scranton is in Pittsburgh.', fact: false, dwight: 'False. The Scranton Business Park, Slough Avenue. Pittsburgh has no Dwight Schrute.' },
  { q: 'Dwight is a volunteer sheriff’s deputy.', fact: true, dwight: 'Fact. Lackawanna County. I have the badge, the hat, and a list.' },
  { q: 'Michael’s screenplay is called Threat Level Midnight.', fact: true, dwight: 'Fact. I play Samuel L. Chang. It is the best role of my career.' },
  { q: 'Schrute Farms grows corn.', fact: false, dwight: 'False. Beets. Also a bed and breakfast. Corn is for the weak.' },
  { q: 'Andy Bernard went to Princeton.', fact: false, dwight: 'False. Cornell. He will tell you. He will tell you again.' },
  { q: 'Michael drove into a lake because his GPS told him to.', fact: true, dwight: 'Fact. The machine knows. That is what he said, as the car sank.' },
  { q: 'The Office Olympics medals were yogurt lids.', fact: true, dwight: 'Fact. I did not win one. The competition was rigged.' },
  { q: 'Ryan started a fire in the kitchen making a cheese pita.', fact: true, dwight: 'Fact. In the toaster oven. I led the evacuation. Nobody thanked me.' },
  { q: 'Toby moved to Costa Rica.', fact: true, dwight: 'Fact. He came back. Like a rash.' },
];

const PER_ROUND = 8;
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
const deal = () => shuffle([...shuffle(ABOUT_ME).slice(0, PER_ROUND / 2), ...shuffle(ABOUT_THE_BRANCH).slice(0, PER_ROUND / 2)]);

const verdict = (score) =>
  score === PER_ROUND
    ? 'Perfect. You would make an excellent assistant to the regional manager.'
    : score >= PER_ROUND - 2
      ? 'Acceptable. You may keep your desk.'
      : score >= PER_ROUND / 2
        ? 'You are no Schrute. But you are not Toby either.'
        : 'You are no Schrute. Go back to the beginning.';

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

  const pick = (fact) => {
    if (answer !== null || done) return;
    setAnswer(fact);
    // the two the show said out loud, as the show said them
    if (f.clip) {
      audioContext();
      import('../../lib/clips').then((c) => c.playClip(f.clip));
    }
    if (fact === f.fact) {
      setScore((n) => n + 1);
      setStreak((n) => n + 1);
    } else setStreak(0);
  };
  const next = () => {
    if (answer === null) return;
    audioContext(); // in the click, so the verdict can be heard
    // the last one: Michael takes the score well, or very badly
    if (i === deck.length - 1) {
      onDone?.(score);
      import('../../lib/clips').then((c) => c.playClip(score >= PER_ROUND - 2 ? 'thankYou' : 'noGod'));
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
