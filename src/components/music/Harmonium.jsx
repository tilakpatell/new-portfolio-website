import { useEffect, useRef, useState } from 'react';
import { audioContext } from '../../lib/audio';
import { useMediaQuery } from '../../lib/hooks';
import { RAGAS, SA_NOTES, SWARA, harmoniumAllOff, harmoniumOff, harmoniumOn } from './engine';
import SwaraLabel from './SwaraLabel';
import { useTuning } from './useTuning';

// A harmonium keyboard from C3, labelled in sargam from wherever Sa is: the way
// a harmonium player finds their Sa on a fixed keyboard. Play with the mouse
// (drag across keys for a glide), touch, or the computer keys A W S E D F T G
// Y H U J K. Notes in the chosen raga carry a dot.

const CHROMATIC = ['S', 'r', 'R', 'g', 'G', 'm', 'M', 'P', 'd', 'D', 'n', 'N'];
const BLACK = new Set([1, 3, 6, 8, 10]);
const COMPUTER = 'awsedftgyhujkolp;';

export default function Harmonium({ onPlay }) {
  const [tuning] = useTuning();
  const phone = useMediaQuery('(max-width: 639px)');
  const [octave, setOctave] = useState(0); // phones show one octave at a time
  const [bass, setBass] = useState(false);
  const [down, setDown] = useState(() => new Set());
  const pointers = useRef(new Map());
  const box = useRef(null);
  const span = phone ? 13 : 25;
  const first = phone ? octave * 12 : 0; // semitones above C3
  const keys = Array.from({ length: span }, (_, k) => first + k);
  const ragaNotes = new Set(RAGAS[tuning.raga].notes);

  const info = (k) => {
    const rel = k - tuning.sa; // semitones above Sa
    const idx = ((rel % 12) + 12) % 12;
    const oct = Math.floor(rel / 12);
    const s = CHROMATIC[idx];
    return { s, oct, ratio: SWARA[s] * 2 ** oct, name: `${SA_NOTES[k % 12]}${3 + Math.floor(k / 12)}` };
  };

  const start = (k) => {
    if (!audioContext()) return;
    harmoniumOn(`k${k}`, info(k).ratio, { bass });
    setDown((d) => new Set(d).add(k));
    onPlay?.('harmonium');
  };
  const stop = (k) => {
    harmoniumOff(`k${k}`);
    setDown((d) => {
      const next = new Set(d);
      next.delete(k);
      return next;
    });
  };

  useEffect(() => () => harmoniumAllOff(), []);
  useEffect(() => {
    harmoniumAllOff();
    setDown(new Set());
  }, [tuning.sa, octave, bass]);

  const keyAt = (x, y) => {
    const el = document.elementFromPoint(x, y)?.closest?.('[data-key]');
    return el && box.current?.contains(el) ? Number(el.dataset.key) : null;
  };
  const onDown = (e) => {
    const k = keyAt(e.clientX, e.clientY);
    if (k == null) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, k);
    start(k);
  };
  const onMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    const k = keyAt(e.clientX, e.clientY);
    const prev = pointers.current.get(e.pointerId);
    if (k == null || k === prev) return;
    stop(prev);
    pointers.current.set(e.pointerId, k);
    start(k);
  };
  const onUp = (e) => {
    const k = pointers.current.get(e.pointerId);
    if (k == null) return;
    pointers.current.delete(e.pointerId);
    stop(k);
  };
  const onKeyDown = (e) => {
    const i = COMPUTER.indexOf(e.key.toLowerCase());
    if (i < 0 || e.repeat || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    start(first + i);
  };
  const onKeyUp = (e) => {
    const i = COMPUTER.indexOf(e.key.toLowerCase());
    if (i >= 0) stop(first + i);
  };

  const whites = keys.filter((k) => !BLACK.has(k % 12));
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        {phone && (
          <div className="seg" role="group" aria-label="Octave">
            {['Lower', 'Upper'].map((label, i) => (
              <button key={label} type="button" aria-pressed={octave === i} onClick={() => setOctave(i)}>
                {label}
              </button>
            ))}
          </div>
        )}
        <label className="check">
          <input type="checkbox" checked={bass} onChange={(e) => setBass(e.target.checked)} />
          Bass reed
        </label>
      </div>
      <div
        ref={box}
        className="harmonium-keys mt-4"
        role="group"
        aria-label="Harmonium keyboard. Computer keys A W S E D F T G Y H U J K play from C; the labels show each note's swara."
        tabIndex={0}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onBlur={() => {
          harmoniumAllOff();
          setDown(new Set());
        }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{ '--whites': whites.length }}
      >
        {keys.map((k) => {
          const { s, oct, name } = info(k);
          const black = BLACK.has(k % 12);
          const whiteIndex = whites.filter((w) => w < k).length;
          return (
            <span
              key={k}
              data-key={k}
              className={black ? 'hk hk-black' : 'hk hk-white'}
              data-down={down.has(k) || undefined}
              data-sa={s === 'S' || undefined}
              data-raga={ragaNotes.has(s) || undefined}
              style={black ? { left: `calc(${whiteIndex} * 100% / var(--whites))` } : undefined}
              title={name}
            >
              <SwaraLabel s={s} oct={oct} />
            </span>
          );
        })}
      </div>
    </div>
  );
}
