import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFun } from '../../fun/FunProvider';
import { audioContext } from '../../lib/audio';
import AutobotMark from '../AutobotMark';
import { BACK, SCRIPTS, scriptFor } from '../../fun/scripts';
import { useTheme } from '../../theme/ThemeProvider';
import '../../styles/lazy/interests.css';

// The "Off the clock" row: one small line icon for each thing I'm into, and
// each one does something. Drawn on a 24-unit grid with one stroke weight so
// they read as a set.

// (the buttons are named by their labels: the icons, Ti's letters and all, are decoration)
const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

const ICONS = {
  sitar: (
    <svg viewBox="0 0 24 24" {...S}>
      <path d="M4 4 L14.2 14.2" />
      <path d="M6.3 7.7 l1.4 -1.4 M8.5 9.9 l1.4 -1.4 M10.7 12.1 l1.4 -1.4" />
      <circle cx="17" cy="17" r="4.3" />
      <path className="dock-string" d="M4.6 3.4 L19.6 18.4" strokeWidth="0.8" />
      <circle cx="3.4" cy="3.4" r="0.9" />
    </svg>
  ),
  saber: (
    <svg viewBox="0 0 24 24" {...S}>
      <path className="dock-blade" d="M10 14 L20.2 3.8" strokeWidth="2.2" />
      <path d="M4.2 19.8 L9.2 14.8" strokeWidth="3.4" />
      <path d="M6.2 15.6 l2.2 2.2" />
    </svg>
  ),
  gauntlet: (
    <svg viewBox="0 0 24 24" {...S}>
      <path d="M8 21 v-4.6 l-2.2 -2.6 v-3.4 a1.2 1.2 0 0 1 2.4 0 v2.4 V5.6 a1.2 1.2 0 0 1 2.4 0 V10 V4.4 a1.2 1.2 0 0 1 2.4 0 V10 V5.6 a1.2 1.2 0 0 1 2.4 0 V13 c0 3 -1.4 5 -3.6 5.6 V21" />
      <circle className="dock-gem" cx="12.2" cy="14.2" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  ),
  ti: (
    <svg viewBox="0 0 24 24" {...S}>
      <rect x="4.5" y="4.5" width="15" height="15" rx="1.2" />
      <text x="12" y="16" textAnchor="middle" fontSize="8.4" fontWeight="700" fill="currentColor" stroke="none" fontFamily="var(--font-sans)">
        Ti
      </text>
      <text x="6.6" y="8.6" fontSize="3.2" fill="currentColor" stroke="none" fontFamily="var(--font-mono)">
        22
      </text>
    </svg>
  ),
  paper: (
    <svg viewBox="0 0 24 24" {...S}>
      <path d="M6.5 3.5 h7.8 l3.7 3.7 v13.3 h-11.5 z" />
      <path d="M14.3 3.5 v3.7 h3.7" />
      <path d="M9 11.2 h6.2 M9 14.2 h6.2 M9 17.2 h4" />
    </svg>
  ),
  gameboy: (
    <svg viewBox="0 0 24 24" {...S}>
      <path d="M6.5 2.5 h11 a1.5 1.5 0 0 1 1.5 1.5 v13.5 a4 4 0 0 1 -4 4 h-8.5 a1.5 1.5 0 0 1 -1.5 -1.5 V4 a1.5 1.5 0 0 1 1.5 -1.5 z" />
      <rect x="7.8" y="5" width="8.4" height="6.2" rx="0.6" />
      <path d="M9.3 14.6 v3 M7.8 16.1 h3" />
      <circle cx="15.4" cy="15.2" r="0.95" />
      <circle cx="13.6" cy="17.3" r="0.95" />
    </svg>
  ),
  globe: (
    <svg viewBox="0 0 24 24" {...S}>
      <circle cx="12" cy="12" r="8.6" />
      <ellipse cx="12" cy="12" rx="3.7" ry="8.6" />
      <path d="M3.4 12 h17.2 M5 7.6 h14 M5 16.4 h14" />
    </svg>
  ),
  temple: (
    <svg viewBox="0 0 24 24" {...S}>
      <path d="M3.5 20.5 h17 M5 18 h14" />
      <path d="M7 18 v-6 h10 v6" />
      <path d="M8.4 12 C9 8.4 10.4 6 12 4.4 C13.6 6 15 8.4 15.6 12" />
      <path d="M12 4.4 V2.2 l2.4 1 l-2.4 1" />
      <path d="M11 18 v-2.6 a1 1 0 0 1 2 0 V18" />
    </svg>
  ),
  robot: <AutobotMark className="dock-autobot" />,
  portal: (
    <svg viewBox="0 0 24 24" {...S}>
      <ellipse cx="12" cy="12" rx="7" ry="8.8" />
      <path className="dock-swirl" d="M12 6.4 c3 0 4.6 2.6 4 5.2 c-0.6 2.6 -3.4 3.8 -5.4 2.6 c-1.8 -1 -1.8 -3.4 -0.4 -4.4 c1.2 -0.8 2.8 -0.2 2.8 1.2" />
    </svg>
  ),
  ring: (
    <svg viewBox="0 0 24 24" {...S}>
      <ellipse cx="12" cy="12.6" rx="8.6" ry="5.4" />
      <ellipse className="dock-ring-glow" cx="12" cy="12.2" rx="6.4" ry="3.5" strokeWidth="0.9" />
    </svg>
  ),
};

// The letter A in whichever script the theme speaks.
const scriptIcon = (id) => (
  <svg viewBox="0 0 24 24" {...S}>
    <circle cx="12" cy="12" r="8.6" />
    <text x="12" y="15.6" textAnchor="middle" fontSize="10" fill="currentColor" stroke="none" fontFamily={`${SCRIPTS[id].font}, var(--font-mono)`}>
      A
    </text>
  </svg>
);

export default function InterestDock() {
  const navigate = useNavigate();
  const { snap, sayMyName, twss, toggleScript, script, scriptName, rollOut, speakFriend, getSchwifty } = useFun();
  const { active } = useTheme();
  const [say, setSay] = useState('');

  // The sitar: a quick flourish (Sa, Pa, high Sa, then the chikari), then the music room.
  const sitar = async () => {
    if (!audioContext()) return navigate('/music'); // inside the click, so it can sound
    setSay('Tuning up. Opening the music room…');
    const m = await import('../music/engine');
    m.pluck(1, { vel: 0.85 });
    m.pluck(3 / 2, { when: 0.16, vel: 0.8 });
    m.pluck(2, { when: 0.32, vel: 0.9 });
    m.chikari({ when: 0.5, vel: 0.6 });
    setTimeout(() => navigate('/music'), 650);
    return undefined;
  };
  const saber = () => {
    audioContext();
    setSay('Punch it.');
    window.dispatchEvent(new Event('tp:hyperspace'));
    setTimeout(() => navigate('/deathstar'), 1250); // arrive at the flash
  };

  const items = [
    { id: 'saber', label: 'Jump to lightspeed', run: saber },
    { id: 'sitar', label: 'Play the sitar', run: sitar },
    {
      id: 'gauntlet',
      label: 'Snap',
      run: () => {
        setSay('Perfectly balanced.');
        snap();
      },
    },
    {
      id: 'ti',
      label: 'Say my name',
      run: () => {
        setSay('Heisenberg.');
        sayMyName();
      },
    },
    {
      id: 'paper',
      label: 'That’s what she said',
      run: () => {
        setSay('');
        twss();
      },
    },
    {
      id: 'robot',
      label: 'Roll out',
      run: () => {
        setSay('Autobots, roll out!');
        rollOut('optimus');
      },
    },
    {
      id: 'ring',
      label: 'Speak, friend, and enter',
      run: () => {
        setSay('Mellon.');
        speakFriend('shire');
      },
    },
    {
      id: 'portal',
      label: 'Get schwifty',
      run: () => {
        setSay('Wubba lubba dub dub!');
        getSchwifty('portal');
      },
    },
    { id: 'gameboy', label: 'Play the Game Boy', run: () => navigate('/projects/gameboy-emulator') },
    { id: 'globe', label: 'Places I’ve been', run: () => navigate('/travel') },
    { id: 'temple', label: 'Heritage: Akshardham', run: () => navigate('/travel?section=heritage') },
    {
      id: 'script',
      label: script ? BACK : `Read the site in ${scriptName}`,
      keep: Boolean(script),
      run: () => {
        setSay('');
        toggleScript();
      },
    },
  ];

  return (
    <div className="hero-dock">
      <p className="label">Each of these does something</p>
      <ul className="mt-3 flex flex-wrap gap-2" aria-label="Quick tricks">
        {items.map((it) => (
          <li key={it.id}>
            <button type="button" className={`dock-btn${it.keep ? ' ab-keep' : ''}`} data-icon={it.id} data-label={it.label} aria-label={it.label} title={it.label} onClick={it.run}>
              {it.id === 'script' ? scriptIcon(script ?? scriptFor(active)) : ICONS[it.id]}
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 min-h-[1.25rem] text-sm text-muted" role="status">
        {say}
      </p>
    </div>
  );
}
