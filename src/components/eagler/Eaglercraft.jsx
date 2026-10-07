import { useCallback, useEffect, useRef, useState } from 'react';
import '@fontsource/press-start-2p/400.css';
import '../minecraft/minecraft.css';
import './eagler.css';
import { canRun } from './clients';
import { open, toBase64 } from './crypt';
import { EAGLER, checkPassword, fetchManifest, fetchSealed, forget, playerUrl, remember, rememberedKeys } from './load';

// Minecraft itself, as Eaglercraft runs it in a browser (the real client,
// compiled to JavaScript), behind the site's password. The game files are
// sealed with it (./crypt.js, scripts/eagler-pack.mjs); the password is
// tried here, and the game runs in the player, a frame on an origin of its
// own (public/eagler-player/, tilakpatell.github.io/minecraft-player), so
// neither the game's code nor its saves share this site's storage. The
// player says when it's ready; it's sent only the stretched key and the
// sealed file's address, opens the file and becomes the game, reporting its
// progress. Cancelling or leaving takes the frame away, and everything in it.
// Leave on a running game asks once, since a world is only safe after Save
// and Quit. Newest first.
//
// <Eaglercraft mode="page" | "overlay" onExit onTribute />

const MB = (n) => `${(n / 1e6).toFixed(0)} MB`;

export default function Eaglercraft({ mode = 'page', onExit = null, onTribute = null }) {
  const [manifest, setManifest] = useState(null);
  const [keys, setKeys] = useState(null);
  const [stage, setStage] = useState('starting'); // starting | locked | checking | menu | loading | playing | failed
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [game, setGame] = useState(null); // { client, src }
  const [password, setPassword] = useState('');
  const [keep, setKeep] = useState(true);
  const [saving, setSaving] = useState(() => new Set()); // shared worlds being opened
  const [sure, setSure] = useState(false); // Leave pressed once
  const frame = useRef(null);
  const box = useRef(null);
  const field = useRef(null);
  const live = useRef(true);

  const go = (s) => {
    setError('');
    setStage(s);
  };

  const start = useCallback(async () => {
    setStage('starting');
    setError('');
    try {
      const m = await fetchManifest();
      if (!live.current) return;
      setManifest(m);
      const k = await rememberedKeys(m);
      if (!live.current) return;
      if (k) {
        setKeys(k);
        setStage('menu');
      } else setStage('locked');
    } catch (err) {
      if (!live.current) return;
      setError(String(err?.message ?? err));
      setStage('failed');
    }
  }, []);

  useEffect(() => {
    live.current = true;
    start();
    return () => {
      live.current = false;
    };
  }, [start]);

  const unlock = async (e) => {
    e.preventDefault();
    if (!password || !manifest) return;
    go('checking');
    const k = await checkPassword(manifest, password).catch(() => null);
    if (!live.current) return;
    if (!k) {
      setStage('locked');
      setError('That isn’t the password.');
      // (the field was disabled while checking: back to it, its text chosen to type over)
      requestAnimationFrame(() => {
        field.current?.focus();
        field.current?.select();
      });
      return;
    }
    remember(k, toBase64(k.raw), keep);
    setPassword('');
    setKeys(k);
    go('menu');
  };

  // the player's side of the talk: ready (send it the key and the file), progress, started, or an error
  useEffect(() => {
    if (!game) return undefined;
    const origin = new URL(game.src).origin;
    const onMessage = (e) => {
      if (e.origin !== origin || e.source !== frame.current?.contentWindow) return;
      const m = e.data ?? {};
      if (m.type === 'tp-eagler-ready') {
        const url = new URL(`${EAGLER}${game.client.file}`, window.location.href).href;
        frame.current.contentWindow.postMessage({ type: 'tp-eagler-open', key: toBase64(keys.raw), url, bytes: game.client.bytes }, origin);
      } else if (m.type === 'tp-eagler-progress') setProgress(m.p);
      else if (m.type === 'tp-eagler-started') {
        setSure(false);
        setStage('playing');
      } else if (m.type === 'tp-eagler-error') {
        setGame(null);
        setStage('menu');
        setError(`It couldn’t be opened (${String(m.message ?? '').slice(0, 80)}).`);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [game, keys]);

  const play = (client) => {
    if (game) return;
    go('loading');
    setProgress(0);
    setGame({ client, src: playerUrl() });
  };
  const cancel = () => {
    setGame(null);
    go('menu');
  };

  // a shared world: opened and handed over as a file to import in the game
  const fetchWorld = async (w) => {
    setSaving((s) => new Set(s).add(w.id));
    setError('');
    try {
      const gz = await open(keys, await fetchSealed(`${EAGLER}${w.file}`, w.bytes));
      const blob = await new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream('gzip'))).blob();
      if (live.current) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${w.name}.${w.kind}`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      }
    } catch (err) {
      if (live.current) setError(`The world couldn’t be opened (${String(err?.message ?? err).slice(0, 80)}).`);
    }
    if (live.current)
      setSaving((s) => {
        const n = new Set(s);
        n.delete(w.id);
        return n;
      });
  };

  // Leave: once to be sure (the world is only safe after Save and Quit to Title), twice to go
  const leave = () => {
    if (!sure) {
      setSure(true);
      setTimeout(() => live.current && setSure(false), 4000);
      return;
    }
    setGame(null);
    go('menu');
  };
  const lock = () => {
    forget();
    setKeys(null);
    go('locked');
  };
  const full = () => {
    const el = box.current;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else el?.requestFullscreen?.().catch(() => {});
  };

  // the game takes the keyboard while it has focus: give it that at once
  useEffect(() => {
    if (stage === 'playing') frame.current?.focus();
  }, [stage]);

  const playing = stage === 'playing' && game;
  const runnable = manifest?.clients.filter((c) => canRun(c)) ?? [];
  return (
    <div className="mc eg" data-mode={mode} ref={box}>
      {/* the player: there while the game opens (under the loading screen) and while it runs */}
      {game && <iframe ref={frame} className={`eg-frame${playing ? '' : ' eg-hidden'}`} src={game.src} title={game.client.label} allow="fullscreen; gamepad; autoplay; clipboard-read; clipboard-write" />}
      {playing ? (
        <div className="eg-bar">
          <button type="button" className="eg-chip" onClick={full} aria-label="Full screen">
            ⛶
          </button>
          <button type="button" className={`eg-chip${sure ? ' eg-sure' : ''}`} onClick={leave}>
            {sure ? 'Saved? Leave' : 'Leave'}
          </button>
        </div>
      ) : (
        <div className="mc-screen mc-dirt eg-screen">
          <h1 className="mc-logo">Minecraft</h1>
          {stage === 'starting' && <p className="mc-text">Loading…</p>}
          {stage === 'failed' && (
            <div className="mc-menu" role="alert">
              <p className="mc-text">The game couldn’t be reached.</p>
              <p className="mc-text mc-small eg-note">{error}</p>
              <button type="button" className="mc-btn" onClick={start}>
                Try again
              </button>
            </div>
          )}

          {(stage === 'locked' || stage === 'checking') && (
            <form className="mc-menu" onSubmit={unlock}>
              <p className="mc-text mc-small">Members only. The password, please.</p>
              <input ref={field} className="mc-input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" aria-label="Password" autoFocus disabled={stage === 'checking'} />
              <label className="eg-keep mc-small">
                <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} /> Remember on this device
              </label>
              <button type="submit" className="mc-btn" disabled={stage === 'checking' || !password}>
                {stage === 'checking' ? 'Checking…' : 'Unlock'}
              </button>
              {error && (
                <p className="mc-text mc-small eg-error" role="alert">
                  {error}
                </p>
              )}
            </form>
          )}

          {stage === 'menu' && manifest && (
            <div className="mc-menu">
              {manifest.clients.map((c) => {
                const ok = canRun(c);
                const shared = (manifest.worlds ?? []).filter((w) => w.client === c.id);
                return (
                  <div key={c.id} className="eg-client">
                    <button type="button" className="mc-btn" onClick={() => play(c)} autoFocus={c === runnable[0]} disabled={!ok}>
                      Play {c.label}
                    </button>
                    <p className="mc-text mc-small eg-note">{ok ? c.note : `${c.note} This browser can’t run it.`}</p>
                    {shared.map((w) => (
                      <button key={w.id} type="button" className="mc-btn mc-btn-half eg-world" onClick={() => fetchWorld(w)} disabled={saving.has(w.id)}>
                        {saving.has(w.id) ? 'Opening…' : `Get the world “${w.name}”`}
                      </button>
                    ))}
                  </div>
                );
              })}
              {(manifest.worlds ?? []).some((w) => manifest.clients.some((c) => c.id === w.client)) && <p className="mc-text mc-small eg-note">A world you get here imports in the game: Singleplayer, Create New World, then Load EPK File (or Import Vanilla World for a .zip).</p>}
              {error && (
                <p className="mc-text mc-small eg-error" role="alert">
                  {error}
                </p>
              )}
              <button type="button" className="mc-btn mc-btn-half" onClick={lock}>
                Lock
              </button>
            </div>
          )}

          {stage === 'loading' && (
            <div className="mc-menu" role="status">
              <p className="mc-text">Opening the game…</p>
              <div className="eg-progress" aria-hidden="true">
                <span style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
              <p className="mc-text mc-small">{progress < 1 ? `${Math.round(progress * 100)}%` : 'Unpacking…'}</p>
              <button type="button" className="mc-btn mc-btn-half" onClick={cancel}>
                Cancel
              </button>
            </div>
          )}

          {stage !== 'loading' && stage !== 'checking' && (
            <div className="eg-foot">
              {onTribute && stage !== 'starting' && (
                <button type="button" className="mc-btn mc-btn-half" onClick={onTribute}>
                  {stage === 'menu' ? 'Walk the tribute' : 'No password? Walk the tribute'}
                </button>
              )}
              {onExit && (
                <button type="button" className="mc-btn mc-btn-half" onClick={onExit}>
                  Back
                </button>
              )}
            </div>
          )}
          {manifest && stage !== 'loading' && <p className="mc-disclaimer">{manifest.clients.map((c) => `${c.label} ${MB(c.bytes)}`).join(' · ')}</p>}
        </div>
      )}
    </div>
  );
}
