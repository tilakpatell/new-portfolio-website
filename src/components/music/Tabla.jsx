import { useEffect, useState } from 'react';
import { RiPauseFill, RiPlayFill } from 'react-icons/ri';
import { audioContext } from '../../lib/audio';
import { TAALS, playBol, setThekaTempo, startTheka, stopTheka, thekaPlaying } from './engine';

// The tabla: strike the drums yourself, or let it keep a taal. The dayan
// (right) is tuned to Sa; the bayan (left) is the bass.
// Keys: J Na, K Tin, L Tu, ; Ti, F Ge, D Ke, G Dha, H Dhin.

const PADS = [
  { bol: 'Dha', key: 'g', hint: 'Na and Ge together' },
  { bol: 'Dhin', key: 'h', hint: 'Tin and Ge together' },
  { bol: 'Na', key: 'j', hint: 'the rim of the dayan' },
  { bol: 'Tin', key: 'k', hint: 'between the rim and the black' },
  { bol: 'Tu', key: 'l', hint: 'the center, left to ring' },
  { bol: 'Ti', key: ';', hint: 'the center, closed' },
  { bol: 'Ge', key: 'f', hint: 'the bayan, open' },
  { bol: 'Ke', key: 'd', hint: 'the bayan, closed' },
];

export default function Tabla({ onPlay }) {
  const [taal, setTaal] = useState('teentaal');
  const [bpm, setBpm] = useState(TAALS.teentaal.bpm);
  const [playing, setPlaying] = useState(false);
  const [beat, setBeat] = useState(-1);
  const [hit, setHit] = useState(null);
  const t = TAALS[taal];

  useEffect(() => () => stopTheka(), []);

  const strike = (bol) => {
    if (!audioContext()) return;
    playBol(bol);
    setHit({ bol, n: Math.random() });
    onPlay?.('tabla');
  };
  const toggle = () => {
    if (!audioContext()) return;
    if (thekaPlaying()) {
      stopTheka();
      setPlaying(false);
      setBeat(-1);
      return;
    }
    startTheka(taal, bpm, setBeat);
    setPlaying(true);
    onPlay?.('tabla');
  };
  const pickTaal = (id) => {
    setTaal(id);
    setBpm(TAALS[id].bpm);
    setBeat(-1);
    if (thekaPlaying()) startTheka(id, TAALS[id].bpm, setBeat);
  };
  const onKey = (e) => {
    const pad = PADS.find((p) => p.key === e.key.toLowerCase());
    if (!pad || e.repeat || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    strike(pad.bol);
  };

  // where each vibhag starts, for the clap marks
  const starts = [];
  t.vibhag.reduce((at, len) => {
    starts.push(at);
    return at + len;
  }, 0);
  const dayanHit = hit && ['Na', 'Tin', 'Tu', 'Ti', 'Dha', 'Dhin'].includes(hit.bol);
  const bayanHit = hit && ['Ge', 'Ke', 'Dha', 'Dhin'].includes(hit.bol);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-12">
      <div onKeyDown={onKey} role="group" aria-label="Tabla. Keys: G Dha, H Dhin, J Na, K Tin, L Tu, semicolon Ti, F Ge, D Ke." tabIndex={0} className="tabla-play">
        <svg viewBox="0 0 400 230" className="tabla-svg" aria-hidden="true">
          <defs>
            <radialGradient id="tb-bayan" cx="40%" cy="35%" r="70%">
              <stop offset="0" stopColor="#c58a5a" />
              <stop offset="1" stopColor="#5a3418" />
            </radialGradient>
            <radialGradient id="tb-skin" cx="45%" cy="40%" r="65%">
              <stop offset="0" stopColor="#f3e6c8" />
              <stop offset="1" stopColor="#d8c39b" />
            </radialGradient>
          </defs>
          {/* bayan, left */}
          <g key={bayanHit ? `b${hit.n}` : 'b'} className={bayanHit ? 'tb-struck' : undefined}>
            <circle cx="118" cy="118" r="96" fill="url(#tb-bayan)" />
            <circle cx="118" cy="118" r="82" fill="url(#tb-skin)" />
            <circle cx="102" cy="112" r="30" fill="#1d1b1a" />
          </g>
          {/* dayan, right: tuned to Sa */}
          <g key={dayanHit ? `d${hit.n}` : 'd'} className={dayanHit ? 'tb-struck' : undefined}>
            <circle cx="296" cy="122" r="74" fill="#6b3f22" />
            <circle cx="296" cy="122" r="64" fill="url(#tb-skin)" />
            <circle cx="296" cy="122" r="58" fill="none" stroke="#b8a079" strokeWidth="1.2" />
            <circle cx="296" cy="122" r="26" fill="#1d1b1a" />
          </g>
        </svg>
        <div className="tabla-pads mt-4" role="group" aria-label="Bols">
          {PADS.map((p) => (
            <button
              key={p.bol}
              type="button"
              className="tabla-pad"
              title={p.hint}
              onPointerDown={(e) => {
                e.preventDefault();
                strike(p.bol);
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                strike(p.bol);
              }}
            >
              <span className="text-base font-semibold text-ink">{p.bol}</span>
              <kbd className="palette-kbd">{p.key.toUpperCase()}</kbd>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="seg flex-wrap" role="group" aria-label="Taal">
          {Object.entries(TAALS).map(([id, tl]) => (
            <button key={id} type="button" aria-pressed={taal === id} onClick={() => pickTaal(id)}>
              {tl.name} <span className="text-muted">{tl.theka.length}</span>
            </button>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button type="button" className="btn btn-primary" onClick={toggle} aria-pressed={playing}>
            {playing ? <RiPauseFill className="h-4 w-4" aria-hidden="true" /> : <RiPlayFill className="h-4 w-4" aria-hidden="true" />}
            {playing ? 'Stop' : `Play ${t.name}`}
          </button>
          <label className="flex min-w-[14rem] flex-1 items-center gap-3 text-sm text-body">
            <span className="whitespace-nowrap">Tempo</span>
            <input
              type="range"
              min="40"
              max="320"
              step="1"
              value={bpm}
              onChange={(e) => {
                const v = Number(e.target.value);
                setBpm(v);
                setThekaTempo(v);
              }}
              className="flex-1"
              aria-valuetext={`${bpm} beats a minute`}
            />
            <span className="mono w-16 text-right tabular-nums">{bpm} bpm</span>
          </label>
        </div>
        <ol className="taal-grid mt-6" aria-label={`${t.name}: ${t.theka.length} beats`} style={{ '--beats': Math.min(t.theka.length, 8) }}>
          {t.theka.map((cell, i) => {
            const v = starts.indexOf(i);
            return (
              <li key={i} className="taal-beat" data-now={beat === i || undefined} data-sam={i === 0 || undefined} data-vibhag={v >= 0 || undefined}>
                <span className="taal-mark" aria-hidden="true">
                  {v >= 0 ? t.marks[v] : ''}
                </span>
                <span className="taal-bol">{Array.isArray(cell) ? cell.join(' ') : cell}</span>
                <span className="taal-n" aria-hidden="true">
                  {i + 1}
                </span>
              </li>
            );
          })}
        </ol>
        <p className="mt-4 text-sm text-muted">
          X is sam, the first beat, where the cycle lands. 0 is khali, the empty section, played without the bass. The numbers are claps.
        </p>
      </div>
    </div>
  );
}
