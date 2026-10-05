import { useEffect, useRef, useState } from 'react';
import { QUIZ, grade } from './rules';

// Mr. Goldenfold's pop quiz, on the chalkboard at Harry Herpson High: the ten
// questions in ./rules.js, one at a time, four answers each, marked as soon as
// you pick. Seven right is a pass. onDone(pass) is called once the last one is
// marked, and again after each go if you sit it again.

const LETTERS = ['A', 'B', 'C', 'D'];

export default function Quiz({ onDone }) {
  const [answers, setAnswers] = useState([]); // the option picked for each question so far
  const [at, setAt] = useState(0); // the question on the board (QUIZ.length once it's over)
  const [go, setGo] = useState(0); // which sitting this is
  const next = useRef(null);
  const first = useRef(null);
  const told = useRef(-1);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const over = at >= QUIZ.length;
  const q = QUIZ[at];
  const picked = answers[at];
  const marked = picked !== undefined;
  const result = grade(answers);
  const right = QUIZ.filter((x, i) => answers[i] === x.answer).length;

  const pick = (i) => {
    if (over || marked) return;
    setAnswers((a) => {
      const n = [...a];
      n[at] = i;
      return n;
    });
  };
  const onward = () => setAt((n) => n + 1);
  const again = () => {
    setAnswers([]);
    setAt(0);
    setGo((n) => n + 1);
  };

  // the button that moves on gets the focus once an answer's marked (and on
  // the result), and the first answer when a question comes up
  useEffect(() => {
    if (marked || over) next.current?.focus({ preventScroll: true });
    else first.current?.focus({ preventScroll: true });
  }, [marked, over, at, go]);

  // the result, once a sitting
  useEffect(() => {
    if (!over || told.current === go) return;
    told.current = go;
    doneRef.current?.(grade(answers).pass);
  }, [over, go, answers]);

  // 1 to 4 (or A to D) answer
  useEffect(() => {
    const down = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      const k = e.key.toLowerCase();
      const i = '1234'.indexOf(k) >= 0 ? '1234'.indexOf(k) : 'abcd'.indexOf(k);
      if (i >= 0 && k.length === 1) {
        e.preventDefault();
        pick(i);
      }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  });

  if (over) {
    return (
      <div className="rm-quiz" data-result={result.pass ? 'pass' : 'fail'}>
        <div className="rm-quiz-board">
          <p className="rm-quiz-kicker">Pop quiz, marked</p>
          <p className="rm-quiz-score">
            <b>{result.right}</b>
            <span>out of {result.total}</span>
          </p>
          <p className="rm-quiz-verdict" role="status">
            {result.pass
              ? result.right === result.total
                ? 'Every one right. Mr. Goldenfold checks it twice, then puts a gold star on it.'
                : 'A pass. Mr. Goldenfold puts a gold star on it.'
              : `See me after class. It takes seven to pass, and that was ${result.right}.`}
          </p>
          <Pips answers={answers} at={at} />
          <div className="rm-quiz-row">
            <button ref={next} type="button" className="rm-quiz-next" onClick={again}>
              Sit it again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rm-quiz">
      <div className="rm-quiz-board">
        <div className="rm-quiz-top">
          <p className="rm-quiz-kicker">
            Question {at + 1} of {QUIZ.length}
          </p>
          <p className="rm-quiz-tally">{right} right so far</p>
        </div>
        <Pips answers={answers} at={at} />
        <h3 className="rm-quiz-q" id="rm-quiz-q">
          {q.q}
        </h3>
        <div className="rm-quiz-options" role="group" aria-labelledby="rm-quiz-q">
          {q.options.map((o, i) => {
            const state = !marked ? undefined : i === q.answer ? 'right' : i === picked ? 'wrong' : 'off';
            return (
              <button key={o} ref={i === 0 ? first : undefined} type="button" className="rm-quiz-option" data-state={state} disabled={marked} aria-pressed={i === picked} onClick={() => pick(i)}>
                <span className="rm-quiz-letter" aria-hidden="true">
                  {LETTERS[i]}
                </span>
                <span>{o}</span>
              </button>
            );
          })}
        </div>
        <div className="rm-quiz-row" aria-live="polite">
          {marked && (
            <>
              <p className="rm-quiz-mark" data-right={picked === q.answer || undefined}>
                {picked === q.answer ? 'Right.' : `Not quite. It’s ${q.options[q.answer]}.`}
              </p>
              <button ref={next} type="button" className="rm-quiz-next" onClick={onward}>
                {at + 1 < QUIZ.length ? 'Next question' : 'Hand it in'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// one chalk mark a question: right, wrong, the one on the board, or still to come
function Pips({ answers, at }) {
  return (
    <ol className="rm-quiz-pips" aria-hidden="true">
      {QUIZ.map((x, i) => (
        <li key={x.q} data-state={answers[i] === undefined ? (i === at ? 'now' : undefined) : answers[i] === x.answer ? 'right' : 'wrong'} />
      ))}
    </ol>
  );
}
