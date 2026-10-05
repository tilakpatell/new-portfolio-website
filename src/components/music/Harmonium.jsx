import { useEffect, useMemo, useRef, useState } from 'react';
import { audioContext } from '../../lib/audio';
import { useMediaQuery } from '../../lib/hooks';
import { capturePointer } from '../../lib/pointer';
import { SA_NOTES, SWARA, bellowsAir, harmoniumAllOff, harmoniumOff, harmoniumOn, onBellows, pumpBellows, ragaOf, setBellowsMode, setHarmoniumSustain, warmHarmonium } from './engine';
import { BELLOWS, REED_NAMES, computerKeyFor, keyForComputer, keyForMidi } from './harmoniumRules';
import SwaraLabel from './SwaraLabel';
import { useTuning } from './useTuning';
import './music.css';
import '../../styles/lazy/music.css';

// A harmonium: a real one's keys (./harmonium.js), labelled in sargam from
// wherever Sa is, the way a player finds their Sa on a fixed keyboard (or in
// Western names). Stops choose its reed banks (bass, male, female); its
// bellows can be left to themselves or pumped by hand, dragging across them.
// Play with the mouse (drag across keys to glide), touch (chords too), a MIDI
// keyboard, or the computer's keys: Z to M the lower octave (S D G H J its
// black keys), Q to U the upper (2 3 5 6 7), on to ] beyond. Space holds
// notes on, as a sustain pedal. Notes in the chosen raga carry a dot.

const CHROMATIC = ['S', 'r', 'R', 'g', 'G', 'm', 'M', 'P', 'd', 'D', 'n', 'N'];
const BLACK = new Set([1, 3, 6, 8, 10]);
const DEFAULTS = { banks: { male: true }, bellows: 'auto', span: 2, labels: 'sargam', octave: 0 };
const mod = (a, n) => ((a % n) + n) % n;

export default function Harmonium({ onPlay }) {
  const [tuning, setTuning] = useTuning();
  const set = { ...DEFAULTS, ...(tuning.harmonium || {}) };
  const banks = set.banks && Object.values(set.banks).some(Boolean) ? set.banks : DEFAULTS.banks;
  const change = (next) => setTuning({ harmonium: { ...set, ...next } });
  const phone = useMediaQuery('(max-width: 639px)');
  const [phoneOct, setPhoneOct] = useState(1); // phones show one octave at a time
  const [down, setDown] = useState(() => new Set());
  const [sustain, setSustain] = useState(false);
  const [latched, setLatched] = useState(false);
  const [air, setAir] = useState(bellowsAir);
  const [midi, setMidi] = useState({ state: 'off' });
  const pointers = useRef(new Map());
  const box = useRef(null);
  const wrap = useRef(null);
  const pumpAt = useRef(null);

  // the keys on show, in semitones above C3
  const octave = Math.max(-1, Math.min(1, Number(set.octave) || 0));
  const base = phone ? 12 * (octave + phoneOct - 1) : 12 * octave - (set.span === 3 ? 12 : 0);
  const span = phone ? 13 : set.span === 3 ? 37 : 25;
  const keys = useMemo(() => Array.from({ length: span }, (_, k) => base + k), [base, span]);
  const ragaNotes = new Set(ragaOf(tuning.raga).notes);

  const info = (k) => {
    const rel = k - tuning.sa; // semitones above Sa
    const s = CHROMATIC[mod(rel, 12)];
    const oct = Math.floor(rel / 12);
    return { s, oct, ratio: SWARA[s] * 2 ** oct, name: `${SA_NOTES[mod(k, 12)]}${3 + Math.floor(k / 12)}` };
  };

  // the latest settings for handlers that outlive a render (MIDI)
  const live = useRef({});
  live.current = { info, banks, onPlay };

  const start = (k, vel = 1) => {
    if (!audioContext()) return;
    harmoniumOn(`k${k}`, live.current.info(k).ratio, { banks: live.current.banks, vel });
    setDown((d) => new Set(d).add(k));
    live.current.onPlay?.('harmonium');
  };
  const stop = (k) => {
    harmoniumOff(`k${k}`);
    setDown((d) => {
      const next = new Set(d);
      next.delete(k);
      return next;
    });
  };
  const sustainTo = (on) => {
    setSustain(on);
    setHarmoniumSustain(on);
  };

  // the recordings, as the harmonium comes into view
  useEffect(() => {
    const el = wrap.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        warmHarmonium();
        io.disconnect();
      },
      { rootMargin: '600px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => onBellows(setAir), []);
  useEffect(() => setBellowsMode(set.bellows), [set.bellows]);
  // leaving: every key up, the pedal up
  useEffect(
    () => () => {
      setHarmoniumSustain(false);
      harmoniumAllOff();
    },
    [],
  );
  // a new Sa or keyboard: let go of whatever was held
  useEffect(() => {
    harmoniumAllOff();
    setDown(new Set());
  }, [tuning.sa, base, span]);

  // ── MIDI ──
  const midiAccess = useRef(null);
  useEffect(
    () => () => {
      const access = midiAccess.current;
      if (!access) return;
      access.onstatechange = null;
      for (const input of access.inputs.values()) input.onmidimessage = null;
    },
    [],
  );
  const onMidiMessage = (e) => {
    const [status, note, vel = 0] = e.data;
    const cmd = status & 0xf0;
    if (cmd === 0x90 && vel > 0) start(keyForMidi(note), vel / 127);
    else if (cmd === 0x80 || (cmd === 0x90 && vel === 0)) stop(keyForMidi(note));
    else if (cmd === 0xb0 && note === 64) sustainTo(vel >= 64); // the sustain pedal
  };
  const connectMidi = async () => {
    audioContext(); // inside the click, so the keyboard can sound
    if (!navigator.requestMIDIAccess) {
      setMidi({ state: 'unsupported' });
      return;
    }
    setMidi({ state: 'asking' });
    // a prompt left unanswered never settles: say what it's waiting for
    const waiting = setTimeout(() => setMidi((m) => (m.state === 'asking' ? { state: 'prompt' } : m)), 8000);
    try {
      const access = await navigator.requestMIDIAccess();
      midiAccess.current = access;
      const attach = () => {
        const inputs = [...access.inputs.values()];
        for (const input of inputs) input.onmidimessage = (e) => onMidiMessageRef.current(e);
        setMidi({ state: inputs.length ? 'on' : 'none', names: inputs.map((i) => i.name).filter(Boolean) });
      };
      access.onstatechange = attach;
      attach();
    } catch {
      setMidi({ state: 'denied' });
    } finally {
      clearTimeout(waiting);
    }
  };
  const onMidiMessageRef = useRef(onMidiMessage);
  onMidiMessageRef.current = onMidiMessage;

  // ── pointer and keys ──
  const keyAt = (x, y) => {
    const el = document.elementFromPoint(x, y)?.closest?.('[data-key]');
    return el && box.current?.contains(el) ? Number(el.dataset.key) : null;
  };
  const onDown = (e) => {
    const k = keyAt(e.clientX, e.clientY);
    if (k == null) return;
    e.preventDefault();
    capturePointer(e);
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
  const first = phone ? base : 12 * octave; // the computer's Z is this key
  const onKeyDown = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === ' ') {
      e.preventDefault();
      if (!e.repeat) sustainTo(true);
      return;
    }
    const i = keyForComputer(e.key);
    if (i < 0) return;
    e.preventDefault();
    if (!e.repeat) start(first + i);
  };
  const onKeyUp = (e) => {
    if (e.key === ' ') {
      if (!latched) sustainTo(false);
      return;
    }
    const i = keyForComputer(e.key);
    if (i >= 0) stop(first + i);
  };
  const letGo = () => {
    for (const k of down) stop(k);
    if (!latched) sustainTo(false);
  };

  // ── the bellows, by hand: drag across them ──
  const onPumpDown = (e) => {
    if (!audioContext()) return;
    capturePointer(e);
    pumpAt.current = { id: e.pointerId, x: e.clientX, w: e.currentTarget.getBoundingClientRect().width || 1 };
  };
  const onPumpMove = (e) => {
    const p = pumpAt.current;
    if (!p || p.id !== e.pointerId) return;
    pumpBellows((e.clientX - p.x) / p.w);
    p.x = e.clientX;
  };
  const onPumpUp = (e) => {
    if (pumpAt.current?.id === e.pointerId) pumpAt.current = null;
  };

  const whites = keys.filter((k) => !BLACK.has(mod(k, 12)));
  const byHand = set.bellows === 'hand';
  const low = byHand && air < BELLOWS.full;
  const midiText = {
    off: null,
    asking: 'Asking the browser…',
    prompt: 'Allow MIDI in the browser’s prompt to play from a keyboard.',
    on: `Playing from ${midi.names?.join(', ') || 'a MIDI keyboard'}.`,
    none: 'No MIDI keyboard found yet: plug one in and it will play.',
    denied: 'The browser didn’t allow MIDI.',
    unsupported: 'This browser has no MIDI; Chrome, Edge and Opera do.',
  }[midi.state];

  return (
    <div ref={wrap}>
      <div className="hm-controls">
        <div className="seg" role="group" aria-label="Reeds">
          {Object.entries(REED_NAMES).map(([b, name]) => (
            <button
              key={b}
              type="button"
              aria-pressed={Boolean(banks[b])}
              // a stop pulled in; the last one stays out
              onClick={() => {
                const next = { ...banks, [b]: !banks[b] };
                if (Object.values(next).some(Boolean)) change({ banks: next });
              }}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="seg" role="group" aria-label="Bellows">
          <button type="button" aria-pressed={!byHand} onClick={() => change({ bellows: 'auto' })}>
            Bellows on their own
          </button>
          <button type="button" aria-pressed={byHand} onClick={() => change({ bellows: 'hand' })}>
            Pump by hand
          </button>
        </div>
        <div className="seg" role="group" aria-label="Octave">
          <button type="button" aria-label="Octave down" disabled={octave <= -1} onClick={() => change({ octave: octave - 1 })}>
            −
          </button>
          <span className="hm-octave" aria-live="polite">
            Octave {octave > 0 ? `+${octave}` : octave}
          </span>
          <button type="button" aria-label="Octave up" disabled={octave >= 1} onClick={() => change({ octave: octave + 1 })}>
            +
          </button>
        </div>
        {phone ? (
          <div className="seg" role="group" aria-label="Which octave of the keyboard">
            {['Lower', 'Middle', 'Upper'].map((label, i) => (
              <button key={label} type="button" aria-pressed={phoneOct === i} onClick={() => setPhoneOct(i)}>
                {label}
              </button>
            ))}
          </div>
        ) : (
          <div className="seg" role="group" aria-label="Keys">
            {[2, 3].map((n) => (
              <button key={n} type="button" aria-pressed={set.span === n} onClick={() => change({ span: n })}>
                {n} octaves
              </button>
            ))}
          </div>
        )}
        <div className="seg" role="group" aria-label="Key names">
          <button type="button" aria-pressed={set.labels !== 'western'} onClick={() => change({ labels: 'sargam' })}>
            Sargam
          </button>
          <button type="button" aria-pressed={set.labels === 'western'} onClick={() => change({ labels: 'western' })}>
            C D E
          </button>
        </div>
        <div className="seg">
          <button
            type="button"
            aria-pressed={sustain}
            onClick={() => {
              setLatched(!sustain);
              sustainTo(!sustain);
            }}
          >
            Sustain
          </button>
          <button type="button" aria-pressed={midi.state === 'on'} onClick={connectMidi}>
            MIDI keyboard
          </button>
        </div>
      </div>
      {midiText && <p className="mt-2 text-sm text-muted">{midiText}</p>}

      {byHand && (
        <div className="hm-bellows-row mt-4">
          <div
            className="hm-bellows"
            role="slider"
            tabIndex={0}
            aria-label="Bellows: drag across them to pump; Enter pumps from the keyboard"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(air * 100)}
            aria-valuetext={`${Math.round(air * 100)}% full`}
            style={{ '--air': air }}
            onPointerDown={onPumpDown}
            onPointerMove={onPumpMove}
            onPointerUp={onPumpUp}
            onPointerCancel={onPumpUp}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              if (audioContext()) pumpBellows(0.35);
            }}
          >
            <span className="hm-bellows-folds" aria-hidden="true" />
          </div>
          <span className="text-sm" data-low={low || undefined}>
            {low ? 'Pump the bellows: the reeds are running out of air.' : `Air ${Math.round(air * 100)}%`}
          </span>
        </div>
      )}

      <div
        ref={box}
        className="harmonium-keys mt-4"
        role="group"
        aria-label={`Harmonium keyboard. Computer keys Z to M play the lower octave, Q to U the upper; Space holds notes on. The ${set.labels === 'western' ? 'labels show each key’s name' : 'labels show each key’s swara'}.`}
        tabIndex={0}
        data-span={span}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onBlur={letGo}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{ '--whites': whites.length }}
      >
        {keys.map((k) => {
          const { s, oct, name } = info(k);
          const black = BLACK.has(mod(k, 12));
          const whiteIndex = whites.filter((w) => w < k).length;
          const hint = computerKeyFor(k - first);
          return (
            <span
              key={k}
              data-key={k}
              className={black ? 'hk hk-black' : 'hk hk-white'}
              data-down={down.has(k) || undefined}
              data-sa={s === 'S' || undefined}
              data-raga={ragaNotes.has(s) || undefined}
              style={black ? { left: `calc(${whiteIndex} * 100% / var(--whites))` } : undefined}
              title={`${name}${hint && k >= first ? ` (key ${hint.toUpperCase()})` : ''}`}
            >
              {set.labels === 'western' ? <span className="hk-name">{name}</span> : <SwaraLabel s={s} oct={oct} />}
            </span>
          );
        })}
      </div>
    </div>
  );
}
