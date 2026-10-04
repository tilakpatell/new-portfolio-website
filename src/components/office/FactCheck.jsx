import { useState } from 'react';
import { COUNTRY_COUNT } from '../../data/places';
import { countWord } from '../travel/PlacesExplorer';
import { audioContext } from '../../lib/audio';

// Dwight checks the facts. Most are about me; a couple are about bears.
const FACTS = [
  { q: 'Tilak plays the sitar.', fact: true, dwight: 'Fact. Around twenty strings, and most of them ring on their own. I respect an instrument with backup.' },
  { q: 'Tilak’s Game Boy emulator runs games at 30 frames per second.', fact: false, dwight: 'False. Sixty, like the real hardware. Thirty is for amateurs and the Stamford branch.' },
  { q: 'Tilak is interning at Amazon Web Services.', fact: true, dwight: 'Fact. Technical Infrastructure PM intern. Before that RTX, Bose, Pendar and SRC. A strong résumé. Almost as strong as mine.' },
  { q: 'Bears eat beets.', fact: true, dwight: 'Fact. Bears. Beets. Battlestar Galactica.' },
  { q: 'Tilak’s AI translator turns Gujarati scripture into Klingon.', fact: false, dwight: 'False. Into English, verse by verse. Klingon is a hobby, not a career.' },
  { q: `Tilak has been to ${countWord(COUNTRY_COUNT).toLowerCase()} countries.`, fact: true, dwight: `Fact. ${countWord(COUNTRY_COUNT)} countries and the Caribbean. I have been to Pennsylvania, which is all a man needs.` },
  { q: 'Identity theft is a joke.', fact: false, dwight: 'False. Identity theft is not a joke. Millions of families suffer every year.' },
];

const verdict = (score) =>
  score === FACTS.length ? 'Perfect. You would make an excellent assistant to the regional manager.' : score >= 4 ? 'Acceptable. You may keep your desk.' : 'You are no Schrute. Go back to the beginning.';

export default function FactCheck() {
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState(null); // the visitor's pick for this one
  const [score, setScore] = useState(0);
  const done = i >= FACTS.length;
  const f = FACTS[i];

  const pick = (fact) => {
    if (answer !== null) return;
    setAnswer(fact);
    if (fact === f.fact) setScore((n) => n + 1);
  };
  const next = () => {
    audioContext(); // in the click, so the verdict can be heard
    // the last one: Michael takes the score well, or very badly
    if (i === FACTS.length - 1) import('../../lib/clips').then((c) => c.playClip(score >= 4 ? 'thankYou' : 'noGod'));
    setAnswer(null);
    setI((n) => n + 1);
  };
  const again = () => {
    setI(0);
    setScore(0);
    setAnswer(null);
  };

  return (
    <div className="factcheck card">
      <div className="flex items-baseline justify-between gap-4">
        <p className="label">Fact or false</p>
        <p className="mono text-xs text-muted">{done ? `${score} of ${FACTS.length}` : `${i + 1} of ${FACTS.length}`}</p>
      </div>
      {done ? (
        <div className="mt-5" aria-live="polite">
          <p className="factcheck-q">
            {score} of {FACTS.length}.
          </p>
          <p className="mt-3 text-body">{verdict(score)}</p>
          <button type="button" className="btn btn-primary mt-6" onClick={again}>
            Again
          </button>
        </div>
      ) : (
        <>
          <p className="factcheck-q mt-5">{f.q}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" className="btn btn-ghost" aria-pressed={answer === true} disabled={answer !== null} onClick={() => pick(true)}>
              Fact
            </button>
            <button type="button" className="btn btn-ghost" aria-pressed={answer === false} disabled={answer !== null} onClick={() => pick(false)}>
              False
            </button>
          </div>
          <div className="mt-5 min-h-[4.5rem]" aria-live="polite">
            {answer !== null && (
              <>
                <p className="font-semibold text-ink">{answer === f.fact ? 'Correct.' : 'Wrong.'}</p>
                <p className="mt-1 text-body">{f.dwight}</p>
              </>
            )}
          </div>
          <button type="button" className="btn btn-primary mt-2" onClick={next} disabled={answer === null}>
            {i === FACTS.length - 1 ? 'See my score' : 'Next'}
          </button>
        </>
      )}
    </div>
  );
}
