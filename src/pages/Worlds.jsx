import { useCallback, useEffect, useState } from 'react';
import { WORLDS } from '../components/worlds/worlds';
import InstalledList from '../components/worlds/InstalledList';
import { sizeText } from '../components/worlds/usePack';
import { installer } from '../runtime/install';
import { useDocumentTitle } from '../lib/hooks';

// The worlds on this device: what's installed (each world's pack in the
// Cache API, src/runtime/install.js), how big, Remove; the rest to install
// before going in; and how much room the browser gives the site.

export default function Worlds({ inst = installer() }) {
  useDocumentTitle('Worlds');
  const [rows, setRows] = useState(null);
  const [room, setRoom] = useState(null);
  const [jobs, setJobs] = useState({}); // to → { busy, progress, error }

  const look = useCallback(async () => {
    if (!inst?.supported) return setRows([]);
    const have = await inst.list();
    const all = await Promise.all(WORLDS.map(async (w) => ({ w, p: await inst.pack(w.to) })));
    const next = all
      .filter(({ p }) => p)
      .map(({ w, p }) => {
        const mine = have.find((h) => h.to === w.to && h.current) ?? have.find((h) => h.to === w.to);
        return { to: w.to, label: w.label, bytes: mine?.current ? mine.bytes : p.bytes, installed: Boolean(mine), current: Boolean(mine?.current) };
      });
    setRows(next);
    setRoom(await inst.estimate());
  }, [inst]);

  useEffect(() => {
    look().catch(() => setRows([]));
    const again = () => look().catch(() => {});
    window.addEventListener('tp:packs', again);
    return () => window.removeEventListener('tp:packs', again);
  }, [look]);

  const job = (to, patch) => setJobs((j) => ({ ...j, [to]: { ...j[to], ...patch } }));
  const install = (to) => {
    job(to, { busy: true, error: null, progress: null });
    inst
      .install(to, { onProgress: (progress) => job(to, { progress }) })
      .then(() => job(to, { busy: false }))
      .catch((e) => job(to, { busy: false, error: e?.message ?? 'The install stopped.' }))
      .finally(() => look().catch(() => {}));
  };
  const remove = (to) => inst.uninstall(to).then(() => look().catch(() => {}));

  return (
    <div className="shell pb-24 pt-[calc(var(--nav-h)+40px)] md:pt-[calc(var(--nav-h)+72px)]">
      <p className="eyebrow">Worlds</p>
      <h1 className="display mt-6 text-[clamp(2.6rem,1.6rem+5vw,5.2rem)]">Worlds on this device.</h1>
      <p className="lead mt-6 max-w-2xl">Install a world and it’s fetched whole, once, with a bar; after that it opens from this device without waiting for the network. Remove it to give the room back.</p>
      {room?.quota > 0 && (
        <p className="mt-4 text-sm text-muted">
          The site uses {sizeText(room.used)} of the {sizeText(room.quota)} this browser gives it.
        </p>
      )}
      <div className="mt-10">
        {rows == null ? (
          <p className="text-muted">Looking…</p>
        ) : !inst?.supported || !rows.length ? (
          <p className="max-w-2xl text-muted">Nothing to install here: this browser has no room for it, or this build came without the worlds’ packs.</p>
        ) : (
          <InstalledList rows={rows.map((r) => ({ ...r, ...jobs[r.to] }))} onInstall={install} onRemove={remove} />
        )}
      </div>
    </div>
  );
}
