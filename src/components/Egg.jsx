import { useState } from 'react';
import { useAchievements } from './Achievements';
import { useFun } from '../fun/FunProvider';
import { EGGS, EGG_KEY } from '../fun/eggs';
import { audioContext } from '../lib/audio';
import { local } from '../lib/hooks';
import { sayVoiced } from '../lib/voiced';

// A hidden collectible: a small, faint line icon tucked somewhere on a page.
// Find one and it plays its moment; find them all for the Collector badge.

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' };
const ICONS = {
  oneup: (
    <svg viewBox="0 0 24 24" {...S}>
      <path d="M4 13 a8 8 0 0 1 16 0 z" />
      <path d="M8.5 13 v4.5 a1.5 1.5 0 0 0 1.5 1.5 h4 a1.5 1.5 0 0 0 1.5 -1.5 V13" />
      <circle cx="9" cy="9.2" r="1.6" />
      <circle cx="15.2" cy="8.4" r="1.2" />
    </svg>
  ),
  mjolnir: (
    <svg viewBox="0 0 24 24" {...S}>
      <rect x="4.5" y="4" width="15" height="7.5" rx="1.2" />
      <path d="M12 11.5 V20.5" strokeWidth="2.2" />
      <path d="M12 20.5 c-1.6 0.6 -2.6 1.8 -2.2 2.4" />
    </svg>
  ),
  saul: (
    <svg viewBox="0 0 24 24" {...S}>
      <rect x="3" y="6" width="18" height="12" rx="1.2" />
      <path d="M6.5 10 h6 M6.5 13 h8 M6.5 15.6 h4" />
      <path d="M17.5 9.2 v3.2 M16 10.8 h3" />
    </svg>
  ),
  mug: (
    <svg viewBox="0 0 24 24" {...S}>
      <path d="M5 7 h11 v9.5 a3 3 0 0 1 -3 3 h-5 a3 3 0 0 1 -3 -3 z" />
      <path d="M16 9.5 h1.6 a2.4 2.4 0 0 1 0 4.8 H16" />
      <path d="M8 4.5 c0 -1 1 -1 1 -2 M11.5 4.5 c0 -1 1 -1 1 -2" />
    </svg>
  ),
  hologram: (
    <svg viewBox="0 0 24 24" {...S}>
      <path d="M7 10.5 a5 5 0 0 1 10 0" />
      <path d="M7 10.5 h10 v8.5 h-10 z" />
      <circle cx="12" cy="8" r="1" />
      <path d="M9.5 13.5 h5 M9.5 16 h2.5" />
      <path d="M7 19 l-1.5 2.5 M17 19 l1.5 2.5" />
    </svg>
  ),
  reactor: (
    <svg viewBox="0 0 24 24" {...S}>
      <circle cx="12" cy="12" r="8.4" />
      <circle cx="12" cy="12" r="5.2" />
      <path d="M12 8.6 L15 13.8 H9 Z" />
    </svg>
  ),
  cassette: (
    <svg viewBox="0 0 24 24" {...S}>
      <rect x="3" y="6" width="18" height="12" rx="1.4" />
      <circle cx="8.5" cy="11.5" r="1.8" />
      <circle cx="15.5" cy="11.5" r="1.8" />
      <path d="M10.3 11.5 h3.4 M6.5 18 l1.5 -2.6 h8 l1.5 2.6" />
    </svg>
  ),
  lost: (
    <svg viewBox="0 0 24 24" {...S}>
      <path d="M4 5.5 h16 v10 h-9 l-4.5 3.5 v-3.5 H4 z" />
      <path d="M8.5 10.5 h0.01 M12 10.5 h0.01 M15.5 10.5 h0.01" strokeWidth="2.4" />
    </svg>
  ),
};

const found = () => {
  const saved = local.get(EGG_KEY, []);
  return Array.isArray(saved) ? saved.filter((id) => EGGS[id]) : [];
};

export default function Egg({ id, className = '' }) {
  const egg = EGGS[id];
  const { unlock, notify } = useAchievements();
  const { rollOut } = useFun();
  const [have, setHave] = useState(() => found().includes(id));
  const [pop, setPop] = useState(0);
  if (!egg) return null;

  const open = () => {
    audioContext(); // inside the click, so its sound can play
    const list = found();
    const next = list.includes(id) ? list : [...list, id];
    local.set(EGG_KEY, next);
    setHave(true);
    setPop((n) => n + 1);
    const total = Object.keys(EGGS).length;
    // the quote in its speaker's own voice, where it's been made (lib/voiced.js)
    const said = egg.voice ? sayVoiced(egg.voice, egg.quote).then((h) => h?.ended).catch(() => {}) : Promise.resolve();
    // (the cassette's scene plays the sound, and Soundwave's own line: once he's said this one)
    if (id === 'cassette') said.then(() => rollOut('soundwave'));
    else import('../lib/sfx').then((s) => s[egg.sound]?.());
    notify(egg.quote, `${egg.by} · ${egg.from}. Easter egg ${next.length} of ${total}.`, 'note', egg.gif ?? null);
    if (next.length === total) unlock('collector');
  };

  return (
    <button
      type="button"
      className={`egg ${className}`}
      data-egg={id}
      data-found={have || undefined}
      onClick={open}
      aria-label={`Hidden easter egg: ${egg.name}${have ? ', found' : ''}`}
      title={egg.name}
    >
      <span key={pop} className={pop ? 'egg-pop' : undefined}>
        {ICONS[id]}
      </span>
    </button>
  );
}
