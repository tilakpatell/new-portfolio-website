import { useCallback, useEffect, useRef, useState } from 'react';
import { installer } from '../../runtime/install';

// A world's pack as the gate and /worlds see it: its size, whether it's on
// this device, and an install with its progress. The words for its size and
// time are here too, so the card and the list say the same.

export const SMALL = 8 * 1048576; // bytes: a desktop opens a world this light at once
const RATE = 1.5 * 1048576; // bytes a second, a fair connection

export const sizeText = (bytes) => {
  const mb = bytes / 1048576;
  return mb < 10 ? `${Math.max(0.1, Math.round(mb * 10) / 10)} MB` : `${Math.round(mb)} MB`;
};
export const timeText = (bytes) => {
  const min = Math.round(bytes / RATE / 60);
  return min < 1 ? 'under a minute' : `about ${min} min`;
};
export const leftText = (seconds) => (seconds == null ? '' : seconds < 60 ? 'under a minute left' : `about ${Math.round(seconds / 60)} min left`);

// what the card shows: 'none' | 'install' | 'installing' | 'failed' | 'open'
// (held: the 3D waits for the visitor; desktop: no reason to hold it)
export function cardState({ held, pack, installed, busy, error }) {
  if (!pack) return 'none';
  if (busy) return 'installing';
  if (error) return 'failed';
  if (installed) return 'open';
  if (!held && pack.bytes < SMALL) return 'open';
  return 'install';
}

export function usePack(to, inst = installer()) {
  const [pack, setPack] = useState(null);
  const [installed, setInstalled] = useState(null);
  const [progress, setProgress] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const last = useRef(0);

  const look = useCallback(() => {
    if (!to || !inst?.supported) return Promise.resolve();
    return Promise.all([inst.pack(to), inst.installed(to)]).then(([p, i]) => {
      setPack(p);
      setInstalled(i);
    });
  }, [to, inst]);

  useEffect(() => {
    let live = true;
    setPack(null);
    setInstalled(null);
    setProgress(null);
    setError(null);
    if (!to || !inst?.supported) return undefined;
    const again = () => look().catch(() => {});
    Promise.resolve()
      .then(() => live && again())
      .catch(() => {});
    window.addEventListener('tp:packs', again);
    return () => {
      live = false;
      window.removeEventListener('tp:packs', again);
    };
  }, [to, inst, look]);

  const install = useCallback(() => {
    if (!to || !inst?.supported) return Promise.resolve(null);
    setBusy(true);
    setError(null);
    return inst
      .install(to, {
        onProgress: (p) => {
          // (a few times a second is plenty for a bar)
          const t = Date.now();
          if (p.done < p.total && t - last.current < 120) return;
          last.current = t;
          setProgress(p);
        },
      })
      .then((done) => {
        setInstalled(done);
        return done;
      })
      .catch((e) => {
        setError(e?.message ?? 'The install stopped.');
        return null;
      })
      .finally(() => setBusy(false));
  }, [to, inst]);

  const uninstall = useCallback(() => inst?.uninstall(to).then(() => setInstalled(null)), [to, inst]);

  return { pack, installed, progress, busy, error, install, uninstall, supported: Boolean(inst?.supported) };
}
