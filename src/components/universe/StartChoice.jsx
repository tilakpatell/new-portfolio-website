import { useEffect, useRef, useState } from 'react';
import { RiArrowRightLine, RiHome5Line, RiRocket2Line } from 'react-icons/ri';

// Over the universe on a first arrival: how would you like to look round?
// Fly through it, or go straight to the home page. Remembered unless told
// not to.
export default function StartChoice({ onPick }) {
  const [remember, setRemember] = useState(true);
  const first = useRef(null);
  useEffect(() => first.current?.focus(), []);
  return (
    <div className="start-choice" role="dialog" aria-modal="true" aria-labelledby="start-title" aria-describedby="start-text">
      <div className="start-card">
        <p className="eyebrow">Welcome</p>
        <h2 id="start-title" className="start-title">
          How would you like to look around?
        </h2>
        <p id="start-text" className="start-text">
          My whole site is laid out as a universe: fly a ship to my experience, projects and résumé, and to the worlds I love. Or go straight to the home page.
        </p>
        <div className="start-buttons">
          <button ref={first} type="button" className="btn btn-primary" onClick={() => onPick('universe', remember)}>
            <RiRocket2Line className="h-4 w-4" aria-hidden="true" /> Explore the universe
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => onPick('home', remember)}>
            <RiHome5Line className="h-4 w-4" aria-hidden="true" /> Go to the home page <RiArrowRightLine className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <label className="start-remember">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember my choice
        </label>
      </div>
    </div>
  );
}
