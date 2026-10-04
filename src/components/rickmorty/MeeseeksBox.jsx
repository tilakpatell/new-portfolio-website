import { useEffect, useRef, useState } from 'react';
import { useAchievements } from '../Achievements';
import { useTheme } from '../../theme/ThemeProvider';
import { audioContext } from '../../lib/audio';
import { prefersReducedMotion } from '../../lib/hooks';
import { MeeseeksFace } from './Faces';

// A Meeseeks box: press the button, a Mr. Meeseeks appears, give him a task
// and he does it (to this page) and is gone. Give him one he can't do and he
// summons help, and the help summons help.

const HELLO = ['I’m Mr. Meeseeks! Look at me!', 'Ooh, I’m Mr. Meeseeks! Look at me!', 'Hi, I’m Mr. Meeseeks! Look at meee!'];
const STRESS = [
  'Ooh, a tough one! Let me get some help.',
  'I’m Mr. Meeseeks. We’re working on it.',
  'Two strokes. Just two strokes off his game!',
  'Existence is pain to a Meeseeks, Jerry!',
  'We’ve been at this for HOURS.',
  'Everybody’s a Meeseeks. Nobody can do it!',
];
const cue = (name) => import('../games/gameAudio').then((m) => m[name]?.());
const effect = (name) => import('../../lib/sfx').then((m) => m[name]?.());

export default function MeeseeksBox() {
  const { unlock } = useAchievements();
  const { pin } = useTheme();
  const [crew, setCrew] = useState([]); // Meeseeks out of the box
  const [line, setLine] = useState('Press the button. One wish each.');
  const [done, setDone] = useState(0);
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));

  const summon = () => {
    audioContext();
    cue('portalHop');
    unlock('meeseeks');
    setCrew((c) => (c.length ? c : [{ id: Date.now(), hi: HELLO[Math.floor(Math.random() * HELLO.length)] }]));
    setLine((l) => (crew.length ? l : 'What can I do for you?'));
  };

  // the task's done: he's gone
  const poof = (text) => {
    cue('splat');
    setLine(text);
    setCrew([]);
    setDone((n) => n + 1);
  };

  const tasks = [
    {
      id: 'green',
      label: 'Turn the site portal green',
      run: () => {
        pin('portal');
        unlock('wubba');
        poof('Ooh, can do! *poof*');
      },
    },
    {
      id: 'top',
      label: 'Take me back to the top',
      run: () => {
        window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
        later(() => poof('All done! *poof*'), 400);
      },
    },
    {
      id: 'shake',
      label: 'Shake things up',
      run: () => {
        const root = document.documentElement;
        if (!prefersReducedMotion()) {
          root.classList.remove('meeseeks-shake');
          void root.offsetWidth;
          root.classList.add('meeseeks-shake');
          later(() => root.classList.remove('meeseeks-shake'), 900);
        }
        effect('drum');
        later(() => poof('Shaken! *poof*'), 700);
      },
    },
    {
      id: 'golf',
      label: 'Take two strokes off my golf game',
      run: () => {
        // the impossible task: they multiply
        effect('alarm');
        const n = Math.min(7, crew.length + 1);
        setCrew((c) => (c.length >= 7 ? c : [...c, { id: Date.now() + Math.random() }]));
        setLine(STRESS[Math.min(STRESS.length - 1, n - 1)]);
      },
    },
  ];

  const many = crew.length > 1;
  return (
    <div className="rm-box card">
      <div className="rm-box-stage" data-crowd={many || undefined}>
        <div className="rm-box-crew" aria-live="polite">
          {crew.map((m, i) => (
            <figure key={m.id} className="rm-meeseeks" style={{ '--i': i }} data-stressed={many || undefined}>
              <MeeseeksFace className="rm-meeseeks-face" />
              <span className="rm-meeseeks-body" />
            </figure>
          ))}
        </div>
        <button type="button" className="rm-box-btn" onClick={summon} aria-label="Press the Meeseeks box button">
          <span className="rm-box-top" />
          <span className="rm-box-face">
            <span className="rm-box-knob" />
          </span>
        </button>
      </div>
      <div className="rm-box-talk">
        <p className="rm-box-line" role="status">
          {crew.length ? (many ? line : crew[0].hi) : line}
        </p>
        {crew.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {(many ? tasks.filter((t) => t.id === 'golf') : tasks).map((t) => (
              <button key={t.id} type="button" className="btn btn-ghost btn-sm" onClick={t.run}>
                {many ? 'Keep trying' : t.label}
              </button>
            ))}
            {many && (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => poof('Ok, we’re done. Everybody *poof*.')}>
                Let it go
              </button>
            )}
          </div>
        )}
        <p className="mt-4 text-xs text-muted">{done ? `${done} wish${done === 1 ? '' : 'es'} granted. Meeseeks don’t usually exist this long.` : 'Meeseeks don’t usually exist this long.'}</p>
      </div>
    </div>
  );
}
