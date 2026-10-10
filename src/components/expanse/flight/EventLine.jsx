import { useEffect, useState, useSyncExternalStore } from 'react';
import { eventNow, listen } from './eventNews';
import './events.css';

// What is happening on the planet now, under its name on the HUD's glass:
// the event's sentence and the time it has left, counted down once a second
// (./eventNews.js, set by the scene). Nothing while nothing is on.
const left = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export default function EventLine() {
  const ev = useSyncExternalStore(listen, eventNow, () => null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!ev) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [ev]);
  if (!ev) return null;
  return (
    <p className="fly-event" role="status">
      <span>{ev.line}</span> <small>{left(ev.ends - now)}</small>
    </p>
  );
}
