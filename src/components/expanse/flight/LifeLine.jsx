import { useEffect, useState, useSyncExternalStore } from 'react';
import { listen, news } from './lifeNews';
import './life.css';

// The life's one line on the flight's HUD ("Patrol inbound"), for SHOW_MS
// after the scene says it, on glass under the toast.
const SHOW_MS = 4000;

export default function LifeLine() {
  const line = useSyncExternalStore(listen, news, () => null);
  const [shown, setShown] = useState(null);
  useEffect(() => {
    if (!line) return undefined;
    setShown(line.text);
    const id = setTimeout(() => setShown(null), SHOW_MS);
    return () => clearTimeout(id);
  }, [line]);
  if (!shown) return null;
  return (
    <p className="fly-life" role="status">
      {shown}
    </p>
  );
}
