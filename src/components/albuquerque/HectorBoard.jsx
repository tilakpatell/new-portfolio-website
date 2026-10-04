import { useEffect, useRef, useState } from 'react';
import { audioContext } from '../../lib/audio';
import { local } from '../../lib/hooks';

// Talking the way Hector does: a nurse holds up a letter board and runs a
// finger along it, and he rings his bell to pick. Here the rows light up in
// turn; ring to pick a row, then ring again as the right letter lights. Spell
// the word, fast, and without ringing for the wrong one.

const sfx = () => import('../../lib/sfx');
const clip = (id) => import('../../lib/clips').then((c) => c.playClip(id));
const ROWS = ['ABCDEF', 'GHIJKL', 'MNOPQR', 'STUVWX', 'YZ'];
const WORDS = ['TIO', 'DING', 'GUS', 'SAUL', 'WALT', 'MIKE', 'LALO', 'HANK'];
const BEST = 'tp-hector-best';
const shuffle = (a) => [...a].sort(() => Math.random() - 0.5);

export default function HectorBoard() {
  const [phase, setPhase] = useState('ready'); // ready | rows | letters | done
  const [words, setWords] = useState([]);
  const [w, setW] = useState(0); // which word
  const [typed, setTyped] = useState('');
  const [row, setRow] = useState(0); // lit row (rows) or picked row (letters)
  const [col, setCol] = useState(0); // lit letter in the picked row
  const [misses, setMisses] = useState(0);
  const [glare, setGlare] = useState(0);
  const [time, setTime] = useState(0);
  const [best, setBest] = useState(() => local.get(BEST, null));
  const started = useRef(0);
  const doneAt = useRef(0);
  const again = useRef(null);
  const target = words[w] ?? '';
  const speed = Math.max(380, 560 - w * 70); // the finger moves faster each word

  // the finger moving along the board
  useEffect(() => {
    if (phase !== 'rows' && phase !== 'letters') return undefined;
    const id = setInterval(() => {
      if (phase === 'rows') setRow((r) => (r + 1) % ROWS.length);
      else setCol((c) => c + 1);
    }, speed);
    return () => clearInterval(id);
  }, [phase, row, speed]);

  // twice along a row with no ring, and the nurse goes back to the rows
  useEffect(() => {
    if (phase === 'letters' && col >= ROWS[row].length * 2) {
      setRow(0);
      setCol(0);
      setPhase('rows');
    }
  }, [phase, row, col]);
  const lit = col % ROWS[row].length;

  // the Ding button goes when the game ends; keep the keyboard on the page
  useEffect(() => {
    if (phase === 'done' && document.activeElement === document.body) again.current?.focus({ preventScroll: true });
  }, [phase]);

  const start = () => {
    // a ring still held from the last letter doesn't start another game
    if (performance.now() - doneAt.current < 350) return;
    audioContext(); // in the click, so the bell can be heard
    setWords(shuffle(WORDS).slice(0, 3));
    setW(0);
    setTyped('');
    setRow(0);
    setCol(0);
    setMisses(0);
    started.current = performance.now();
    setPhase('rows');
  };

  const ring = () => {
    if (phase !== 'rows' && phase !== 'letters') return;
    audioContext();
    clip('hectorBell').then((h) => !h && sfx().then((s) => s.ding()));
    if (phase === 'rows') {
      setCol(0);
      setPhase('letters');
      return;
    }
    const letter = ROWS[row][lit];
    const want = target[typed.length];
    if (letter !== want) {
      setMisses((m) => m + 1);
      setGlare(Date.now());
      sfx().then((s) => s.buzz());
      setRow(0);
      setPhase('rows');
      return;
    }
    const next = typed + letter;
    setRow(0);
    if (next.length < target.length) {
      setTyped(next);
      setPhase('rows');
      return;
    }
    // a word done
    if (w + 1 < words.length) {
      setTyped('');
      setW(w + 1);
      setPhase('rows');
      return;
    }
    const secs = (performance.now() - started.current) / 1000;
    setTyped(next);
    setTime(secs);
    setPhase('done');
    doneAt.current = performance.now();
    sfx().then((s) => s.victory());
    const score = Math.round(secs + misses * 5);
    if (best == null || score < best) {
      setBest(score);
      local.set(BEST, score);
    }
  };

  // Space or Enter rings, while a game is on
  useEffect(() => {
    if (phase !== 'rows' && phase !== 'letters') return undefined;
    const onKey = (e) => {
      const t = e.target;
      if (t instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!e.repeat) ring();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const playing = phase === 'rows' || phase === 'letters';
  const score = Math.round(time + misses * 5);
  return (
    <div className="hb">
      <div className="hb-board" data-glare={glare || undefined} key={glare} onPointerDown={playing ? (e) => (e.preventDefault(), ring()) : undefined}>
        <div className="hb-word" aria-live="polite">
          {playing || phase === 'done' ? (
            <>
              <span className="hb-label">Spell</span>
              {[...target].map((ch, i) => (
                <span key={i} className="hb-slot" data-done={i < typed.length || undefined}>
                  {i < typed.length ? ch : ''}
                </span>
              ))}
              <span className="hb-count">
                {Math.min(w + 1, words.length || 3)} / {words.length || 3}
              </span>
            </>
          ) : (
            <span className="hb-label">The letter board</span>
          )}
        </div>
        <ol className="hb-rows" aria-hidden={!playing || undefined}>
          {ROWS.map((r, ri) => (
            <li key={r} className="hb-row" data-lit={(playing && ri === row) || undefined}>
              {[...r].map((ch, ci) => (
                <span key={ch} className="hb-cell" data-lit={(phase === 'letters' && ri === row && ci === lit) || undefined}>
                  {ch}
                </span>
              ))}
            </li>
          ))}
        </ol>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {playing ? (
          <button key="ding" type="button" className="btn btn-primary hold-btn" onClick={ring}>
            Ding
          </button>
        ) : (
          <button key="start" ref={again} type="button" className="btn btn-primary" onClick={start}>
            {phase === 'done' ? 'Again' : 'Hold up the board'}
          </button>
        )}
        <span className="mono text-sm text-body">
          {playing ? `${phase === 'rows' ? 'Pick the row' : 'Pick the letter'} · misses ${misses}` : best != null ? `Best: ${best} seconds` : 'Space or tap the board rings too'}
        </span>
      </div>
      <p className="mt-3 min-h-[1.5em] text-sm font-semibold text-ink" role="status">
        {phase === 'done' ? `${words.join(', ')} in ${time.toFixed(1)} seconds, ${misses} wrong ${misses === 1 ? 'ring' : 'rings'}: ${score}.` : ''}
      </p>
    </div>
  );
}
