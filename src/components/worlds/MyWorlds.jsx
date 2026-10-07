import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KIND_NAMES, createRegistry } from './registry';
import { exportFile, formatPlayed, formatSize, newWorldUrl, readImport } from './worldFiles';
import { worldStore } from '../../runtime/local';
import './myworlds.css';

// My worlds on /worlds: the visitor's worlds from the registry, last played
// first, to continue, rename, delete or export; and a new world from a seed,
// or one imported from a file. A new world is only an address: the game adds
// it to the registry when it opens. `initial` is the rows to show before the
// first load (and what a test renders).

function download({ filename, text }) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function Row({ w, now, onRename, onDelete, onExport }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(w.name);
  const input = useRef(null);
  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);
  const save = async () => {
    setEditing(false);
    if (name.trim() && name !== w.name) await onRename(w, name);
    else setName(w.name);
  };
  const keys = (e) => {
    if (e.key === 'Enter') save();
    else if (e.key === 'Escape') {
      setName(w.name);
      setEditing(false);
    }
  };
  return (
    <li className="myworlds-row">
      <div className="myworlds-info">
        {editing ? (
          <input ref={input} className="myworlds-name-input" value={name} maxLength={40} aria-label={`New name for ${w.name}`} onChange={(e) => setName(e.target.value)} onKeyDown={keys} onBlur={save} />
        ) : (
          <p className="myworlds-name">{w.name}</p>
        )}
        <p className="myworlds-meta text-muted">
          <span>{KIND_NAMES[w.kind] ?? w.kind}</span>
          <span>Played {formatPlayed(w.played, now)}</span>
          <span>{formatSize(w.size)}</span>
        </p>
      </div>
      <div className="myworlds-actions">
        <Link to={w.route} className="btn btn-primary btn-sm" aria-label={`Continue ${w.name}`}>
          Continue
        </Link>
        <button type="button" className="btn btn-ghost btn-sm" aria-label={`Rename ${w.name}`} onClick={() => setEditing(true)}>
          Rename
        </button>
        <button type="button" className="btn btn-ghost btn-sm" aria-label={`Export ${w.name}`} onClick={() => onExport(w)}>
          Export
        </button>
        <button type="button" className="btn btn-ghost btn-sm" aria-label={`Delete ${w.name}`} onClick={() => onDelete(w)}>
          Delete
        </button>
      </div>
    </li>
  );
}

export default function MyWorlds({ registry: given, initial = null, now: fixedNow, className = '' }) {
  const registry = useMemo(() => given ?? createRegistry(worldStore()), [given]);
  const navigate = useNavigate();
  const [worlds, setWorlds] = useState(initial);
  const [seed, setSeed] = useState('');
  const [status, setStatus] = useState('');
  const file = useRef(null);
  const now = fixedNow ?? Date.now();

  const refresh = async () => setWorlds(await registry.list());
  useEffect(() => {
    let live = true;
    registry
      .list()
      .then((rows) => live && setWorlds(rows))
      .catch(() => live && setWorlds((w) => w ?? []));
    return () => {
      live = false;
    };
  }, [registry]);

  const act = async (fn, done) => {
    try {
      const out = await fn();
      await refresh();
      setStatus(typeof done === 'function' ? done(out) : done);
    } catch (e) {
      setStatus(e?.message || 'That didn’t work.');
    }
  };
  const create = (e) => {
    e.preventDefault();
    navigate(newWorldUrl(seed));
  };
  const rename = (w, name) => act(() => registry.rename(w.id, name), `Renamed to ${name.trim()}.`);
  const remove = (w) => {
    if (!window.confirm(`Delete ${w.name}? Its save goes too; this can’t be undone.`)) return;
    act(() => registry.remove(w.id), `Deleted ${w.name}.`);
  };
  const exportOne = (w) =>
    act(async () => {
      const out = await registry.exportWorld(w.id);
      if (!out) throw new Error('That world is gone.');
      download(exportFile(out));
    }, `Exported ${w.name}.`);
  const importOne = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    await act(async () => {
      try {
        return await registry.importWorld(readImport(await f.text()));
      } catch (err) {
        // the registry's own words are for code; say it plainly
        throw new Error(err?.message === 'not a world file' ? 'That file isn’t a world file.' : err?.message);
      }
    }, (w) => `Imported ${w.name}.`);
  };

  return (
    <section className={`myworlds ${className}`} aria-labelledby="myworlds-title">
      <h2 id="myworlds-title" className="title">
        My worlds
      </h2>
      <div className="myworlds-tools">
        <form className="myworlds-new" onSubmit={create}>
          <label htmlFor="myworlds-seed" className="eyebrow">
            New world
          </label>
          <div className="myworlds-new-row">
            <input id="myworlds-seed" className="myworlds-seed" value={seed} maxLength={32} placeholder="Seed (blank: random)" autoComplete="off" spellCheck={false} onChange={(e) => setSeed(e.target.value)} />
            <button type="submit" className="btn btn-primary btn-sm">
              Create
            </button>
          </div>
        </form>
        <div className="myworlds-import">
          <input ref={file} id="myworlds-file" type="file" accept="application/json,.json" hidden onChange={importOne} />
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => file.current?.click()}>
            Import a world file
          </button>
        </div>
      </div>
      <p className="myworlds-status text-muted" role="status" aria-live="polite">
        {status}
      </p>
      {worlds == null ? (
        <p className="text-muted">Looking for your worlds…</p>
      ) : worlds.length === 0 ? (
        <p className="myworlds-empty text-muted">No worlds yet. Make one above, or open Minecraft and it will be kept here.</p>
      ) : (
        <ul className="myworlds-list">
          {worlds.map((w) => (
            <Row key={w.id} w={w} now={now} onRename={rename} onDelete={remove} onExport={exportOne} />
          ))}
        </ul>
      )}
    </section>
  );
}
