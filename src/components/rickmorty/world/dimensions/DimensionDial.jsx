import { useEffect, useRef, useState } from 'react';

// The portal gun's dial, opened at its stand in Rick's garage: every place
// the garage portal can open on, the one it's set to marked. Arrows to move,
// Enter (or a click) to dial, Esc to close. (The Vindicators' ship asks
// Rick's rooms in it too: `title`, `lead` (the room's question), `foot`.)
export default function DimensionDial({ open, items, value, onPick, onClose, title = 'Pick a dimension', lead = null, foot = '↑ ↓ to turn the dial, Enter to set it, Esc to put the gun down', label = 'The portal gun’s dial' }) {
  const [i, setI] = useState(0);
  const list = useRef(null);
  useEffect(() => {
    if (open) setI(Math.max(0, items.findIndex((d) => d.id === value)));
  }, [open, items, value]);
  useEffect(() => {
    if (!open) return undefined;
    const key = (e) => {
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') setI((n) => (n + 1) % items.length);
      else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') setI((n) => (n - 1 + items.length) % items.length);
      else if (e.key === 'Enter' || e.key === 'e' || e.key === 'E') onPick(items[i].id);
      else if (e.key === 'Escape') onClose();
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [open, items, i, onPick, onClose]);
  useEffect(() => {
    list.current?.children[i]?.scrollIntoView?.({ block: 'nearest' });
  }, [i]);
  if (!open) return null;
  return (
    <div className="rm-dial-box" role="dialog" aria-label={label}>
      <div className="rm-dial-head">
        <span>{title}</span>
        <button type="button" className="rm-dial-x" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      {lead && <p className="rm-dial-lead">{lead}</p>}
      <ul ref={list} className="rm-dial-list">
        {items.map((d, n) => (
          <li key={d.id}>
            <button type="button" className="rm-dial-row" data-on={n === i || undefined} data-set={d.id === value || undefined} onMouseEnter={() => setI(n)} onClick={() => onPick(d.id)}>
              <b>{d.name}</b>
              {d.note && <span>{d.note}</span>}
            </button>
          </li>
        ))}
      </ul>
      <p className="rm-dial-foot">{foot}</p>
    </div>
  );
}
