import { useEffect, useRef, useState } from 'react';
import { audioContext } from '../../lib/audio';
import { CLIPS, playClip } from '../../lib/clips';

// A world's soundboard: the films' and shows' own lines (lib/clips.js), a
// button each with the line on it and who says it. One plays at a time;
// pressing the one that's playing stops it. An entry is a clip id, or
// [id, label] for a clip that isn't a line (a sound, a piece of music).
export default function ClipBoard({ clips, className = '' }) {
  const [on, setOn] = useState(null);
  const now = useRef({ n: 0, h: null });
  useEffect(() => () => now.current.h?.stop(), []);

  const play = async (id) => {
    audioContext(); // inside the press, before anything waits
    const was = on;
    now.current.h?.stop();
    const n = ++now.current.n;
    now.current.h = null;
    if (was === id) {
      setOn(null);
      return;
    }
    setOn(id);
    const h = await playClip(id);
    if (n !== now.current.n) {
      h?.stop(); // another was pressed while this one loaded
      return;
    }
    now.current.h = h;
    if (h) await h.ended;
    if (n === now.current.n) setOn(null);
  };

  return (
    <ul className={`clip-board ${className}`}>
      {clips.map((entry) => {
        const [id, label] = Array.isArray(entry) ? entry : [entry];
        const clip = CLIPS[id];
        if (!clip) return null;
        return (
          <li key={id}>
            <button type="button" className="clip-board-btn" aria-pressed={on === id} onClick={() => play(id)}>
              <span className="clip-board-line">{label ?? clip.line}</span>
              {clip.by && <span className="clip-board-by">{clip.by}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
