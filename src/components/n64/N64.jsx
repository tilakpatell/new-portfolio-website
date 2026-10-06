import { useCallback, useEffect, useRef, useState } from 'react';
import { forgetRom, loadRom, romInfo, saveRom } from './romStore';
import './n64.css';

// The giant N64 on Dot Matrix island, switched on: a real Nintendo 64
// emulated in the browser (public/n64/play.html: EmulatorJS's mupen64plus
// core), playing the ROM the player gives it from their own device. The
// site hosts no game: the file stays in their browser (./romStore.js) for
// next time, until they forget it. Without one, there's the fan tribute
// (../mario64/) to play instead.
//
// <N64 mode="overlay" | "page" onExit onTribute />

const KEYS = [
  ['W A S D', 'Control Stick'],
  ['Space', 'A (jump)'],
  ['J', 'B (punch)'],
  ['Shift', 'Z (crouch)'],
  ['Arrows', 'C buttons (camera)'],
  ['Enter', 'Start'],
  ['Q · E', 'L · R'],
];

export default function N64({ mode = 'overlay', onExit = null, onTribute = null }) {
  const [phase, setPhase] = useState('checking'); // checking | pick | playing
  const [rom, setRom] = useState(null); // { bytes, name, info }
  const [state, setState] = useState(null); // the emulator's: ready | running | failed
  const [note, setNote] = useState(null);
  const [drag, setDrag] = useState(false);
  const frame = useRef(null);
  const input = useRef(null);

  // a ROM kept from last time plays at once
  useEffect(() => {
    let live = true;
    loadRom().then((got) => {
      if (!live) return;
      if (got) {
        setRom(got);
        setPhase('playing');
      } else setPhase('pick');
    });
    return () => {
      live = false;
    };
  }, []);

  const take = useCallback(async (file) => {
    if (!file) return;
    setNote(null);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const info = romInfo(bytes);
    if (!info) {
      setNote('That isn’t an N64 ROM. It should be a .z64, .n64 or .v64 file (not zipped).');
      return;
    }
    // (kept for next time where the browser lets it; played either way)
    await saveRom(bytes, file.name).catch(() => null);
    setRom({ bytes, name: file.name, info });
    setState(null);
    setPhase('playing');
  }, []);

  // the emulator asks for the game when it's ready, and says how it's going
  useEffect(() => {
    if (phase !== 'playing' || !rom) return undefined;
    const onMessage = (e) => {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow || e.data?.type !== 'n64') return;
      setState(e.data.state);
      if (e.data.state === 'ready') e.source.postMessage({ type: 'n64-rom', bytes: rom.bytes, name: rom.info.title || rom.name }, window.location.origin);
      if (e.data.state === 'running') frame.current?.focus();
      if (e.data.state === 'failed') setNote(e.data.detail ?? 'The emulator couldn’t start.');
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [phase, rom]);

  // Esc leaves, while the keys aren't the game's
  useEffect(() => {
    if (!onExit) return undefined;
    const onKey = (e) => e.key === 'Escape' && onExit();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit]);

  const forget = async () => {
    await forgetRom();
    setRom(null);
    setState(null);
    setPhase('pick');
  };

  const title = rom?.info?.title || 'N64';
  return (
    <div className="n64" data-mode={mode}>
      {phase === 'playing' && rom && (
        <>
          <div className="n64-bar">
            <span className="n64-title">{title}</span>
            {state !== 'running' && <span className="n64-status">{state === 'failed' ? 'Couldn’t start' : 'Switching on…'}</span>}
            <span className="n64-gap" />
            <button type="button" className="n64-chip" onClick={() => setPhase('pick')}>
              Change game
            </button>
            <button type="button" className="n64-chip" onClick={forget}>
              Forget this ROM
            </button>
            {onExit && (
              <button type="button" className="n64-chip n64-chip-main" onClick={onExit}>
                {mode === 'overlay' ? 'Back to the island' : 'Back'}
              </button>
            )}
          </div>
          {/* (a new frame for each game: the emulator keeps its state in its page) */}
          <iframe key={`${rom.name}:${rom.info.size}`} ref={frame} className="n64-frame" src="/n64/play.html" title={`${title}, on an emulated N64`} allow="gamepad; fullscreen; autoplay" />
          {note && state === 'failed' && <p className="n64-note n64-note-float">{note}</p>}
        </>
      )}

      {(phase === 'pick' || phase === 'checking') && (
        <div
          className="n64-pick"
          data-drag={drag || undefined}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            take(e.dataTransfer.files?.[0]);
          }}
        >
          <div className="n64-card">
            <p className="n64-kicker">Nintendo 64, emulated</p>
            <h2>Super Mario 64, the real one</h2>
            <p>
              The giant N64 runs the actual game in your browser. Give it your own copy of Super Mario 64: a <code>.z64</code>, <code>.n64</code> or <code>.v64</code> ROM file from your device. It stays in this browser for next time; nothing is uploaded, and this site doesn’t host any games. (Any N64 game works.)
            </p>
            <div className="n64-actions">
              <button type="button" className="n64-btn" onClick={() => input.current?.click()} disabled={phase === 'checking'} autoFocus>
                Choose a ROM file
              </button>
              {onTribute && (
                <button type="button" className="n64-btn n64-btn-ghost" onClick={onTribute}>
                  Play the fan tribute instead
                </button>
              )}
              {rom && (
                <button type="button" className="n64-btn n64-btn-ghost" onClick={() => setPhase('playing')}>
                  Back to {title}
                </button>
              )}
              {onExit && (
                <button type="button" className="n64-btn n64-btn-ghost" onClick={onExit}>
                  {mode === 'overlay' ? 'Back to the island' : 'Back'}
                </button>
              )}
            </div>
            <p className="n64-drop">or drop the file here</p>
            {note && <p className="n64-note">{note}</p>}
            <dl className="n64-keys" aria-label="Keys">
              {KEYS.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <p className="n64-small">A controller works too. The emulator’s own menu (along its bottom edge) has its controls, save states and full screen. Emulation by EmulatorJS (GPL-3.0).</p>
            <input ref={input} type="file" accept=".z64,.n64,.v64,.rom,.bin" hidden onChange={(e) => take(e.target.files?.[0])} />
          </div>
        </div>
      )}
    </div>
  );
}
