import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { RiCloseLine, RiDownloadCloud2Line } from 'react-icons/ri';
import { gpu, Hold3D } from '../../lib/gpu';
import { device, storageFree, worldCheck } from '../../lib/device';
import { local, storage } from '../../lib/hooks';
import { WORLD_MB, worldAt } from './worlds';
import './worldgate.css';

// Before a world downloads its 3D on a device that would feel it (a phone
// and a heavy world, a weak device, Data Saver on, too little room left), it
// asks. Until the visitor says, the 3D is held (lib/gpu's Hold3D): the page
// shows its 2D versions and fetches no models or textures, and a card at the
// bottom says what loading would cost. "Load" lets the 3D in; "Keep it
// light" keeps the 2D for this visit, with a small button to change your
// mind; "Always load" remembers it on this device. A desktop never sees any
// of this. Each world's weight is in worlds.js.

const ALWAYS = 'tp-worlds'; // 'load': never ask on this device
const choiceKey = (to) => `tp-world:${to}`; // 'load' | 'light', this visit

// the device with its graphics chip looked at, so a weak chip or software
// WebGL counts before anything starts downloading
const look = () => {
  gpu();
  return device();
};

const WHY = {
  phone: 'It works a phone’s graphics chip hard, and it’s a big download.',
  weak: 'This device may find it slow going, and it’s a big download.',
  software: 'This browser is drawing without the graphics chip, so it would be slow.',
  data: 'Data Saver is on, so it waits for you.',
  storage: 'This device is short on space, so it waits for you.',
};

export default function WorldGate({ pathname, children }) {
  const world = worldAt(pathname);
  const to = world?.to ?? null;
  const mb = to ? WORLD_MB[to] ?? 1 : 0;
  // the check: at once from what the browser says (so nothing starts
  // downloading first), then again once it says how much room is left
  const [check, setCheck] = useState(() => (to ? worldCheck(mb, look()) : { ask: false }));
  const [choice, setChoice] = useState(() => (to ? (local.get(ALWAYS) === 'load' ? 'load' : storage.get(choiceKey(to))) : null));

  useEffect(() => {
    if (!to) {
      setCheck({ ask: false });
      return undefined;
    }
    let live = true;
    setCheck(worldCheck(mb, look()));
    setChoice(local.get(ALWAYS) === 'load' ? 'load' : storage.get(choiceKey(to)));
    storageFree().then((free) => {
      if (live) setCheck(worldCheck(mb, look(), free));
    });
    return () => {
      live = false;
    };
  }, [to, mb]);

  const load = useCallback(
    (always = false) => {
      if (!to) return;
      storage.set(choiceKey(to), 'load');
      if (always === true) local.set(ALWAYS, 'load');
      setChoice('load');
    },
    [to],
  );
  const light = () => {
    storage.set(choiceKey(to), 'light');
    setChoice('light');
  };

  const held = Boolean(to) && choice !== 'load' && check.ask;
  const hold = useMemo(() => (held ? { held: true, load: () => load(), mb, name: world?.label } : null), [held, load, mb, world?.label]);

  // outside <main>, so it sits over the page's own fixed buttons
  const prompt = !held ? null : choice === 'light' ? (
    <button type="button" className="world-gate-pill" onClick={() => load()}>
      <RiDownloadCloud2Line aria-hidden="true" /> Load 3D · {mb} MB
    </button>
  ) : (
    <aside className="world-gate" role="dialog" aria-modal="false" aria-labelledby="world-gate-title">
      <button type="button" className="world-gate-x" aria-label="Keep it light" onClick={light}>
        <RiCloseLine aria-hidden="true" />
      </button>
      <p id="world-gate-title" className="world-gate-title">
        <RiDownloadCloud2Line aria-hidden="true" /> {world.label} is built in 3D
      </p>
      <p className="world-gate-text">
        About {mb} MB of models and textures. {WHY[check.why] ?? WHY.phone} Until then you’re seeing the light version.
      </p>
      <div className="world-gate-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => load()}>
          Load the 3D
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={light}>
          Keep it light
        </button>
        <button type="button" className="world-gate-always" onClick={() => load(true)}>
          Always load on this device
        </button>
      </div>
    </aside>
  );

  return (
    <Hold3D.Provider value={hold}>
      {children}
      {prompt && createPortal(prompt, document.body)}
    </Hold3D.Provider>
  );
}
