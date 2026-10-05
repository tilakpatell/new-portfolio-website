import { useState } from 'react';
import { audioContext } from '../../lib/audio';
import '../../styles/lazy/albuquerque.css';

const sfx = () => import('../../lib/sfx');
const clip = (id, opts) => import('../../lib/clips').then((c) => c.playClip(id, opts));

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' };

// Simple marks for each of them: a hat, a beanie, the glasses, a bell.
const ICONS = {
  walt: (
    <svg viewBox="0 0 64 64" {...S}>
      <path d="M14 36 h36 M20 36 c0 -10 4 -16 12 -16 s12 6 12 16" fill="currentColor" fillOpacity="0.15" />
      <path d="M22 44 h8 v4 h-8 Z M34 44 h8 v4 h-8 Z M30 46 h4" />
    </svg>
  ),
  jesse: (
    <svg viewBox="0 0 64 64" {...S}>
      <path d="M16 38 c0 -14 8 -22 16 -22 s16 8 16 22 Z" fill="currentColor" fillOpacity="0.15" />
      <path d="M16 38 h32 M18 32 h28" />
      <circle cx="32" cy="14" r="3" />
    </svg>
  ),
  gus: (
    <svg viewBox="0 0 64 64" {...S}>
      <circle cx="22" cy="32" r="8" />
      <circle cx="42" cy="32" r="8" />
      <path d="M30 32 h4 M14 30 l-6 -3 M50 30 l6 -3" />
    </svg>
  ),
  mike: (
    <svg viewBox="0 0 64 64" {...S}>
      <path d="M32 10 a22 22 0 1 0 0.1 0 Z" />
      <path d="M32 10 V54" />
      <path d="M32 10 a22 22 0 0 0 0 44 Z" fill="currentColor" fillOpacity="0.25" />
    </svg>
  ),
  saul: (
    <svg viewBox="0 0 64 64" {...S}>
      <rect x="10" y="18" width="44" height="28" rx="3" fill="currentColor" fillOpacity="0.12" />
      <path d="M16 26 h22 M16 32 h30 M16 38 h14" />
    </svg>
  ),
  lalo: (
    <svg viewBox="0 0 64 64" {...S}>
      <path d="M22 12 l10 14 l10 -14 M32 26 V52 M22 12 c-8 6 -10 16 -8 28 M42 12 c8 6 10 16 8 28" />
      <circle cx="32" cy="34" r="1.6" fill="currentColor" />
      <circle cx="32" cy="42" r="1.6" fill="currentColor" />
    </svg>
  ),
  hector: (
    <svg viewBox="0 0 64 64" {...S}>
      <path d="M20 44 c0 -16 4 -24 12 -24 s12 8 12 24 Z" fill="currentColor" fillOpacity="0.15" />
      <path d="M16 44 h32 M32 20 v-6 M28 14 h8" />
      <circle cx="32" cy="48" r="3" />
    </svg>
  ),
  hank: (
    <svg viewBox="0 0 64 64" {...S}>
      <path d="M14 40 l8 -18 l12 -6 l14 8 l4 14 l-12 10 l-18 0 Z" fill="currentColor" fillOpacity="0.15" />
      <path d="M22 22 l10 10 l16 -8 M32 32 l-4 16" />
    </svg>
  ),
};

const CAST = [
  { id: 'walt', name: 'Walter White', role: 'Chemistry teacher', text: 'A high-school chemistry teacher in Albuquerque who goes by another name in the business he gets into.', action: 'Say my name', done: 'Heisenberg.' },
  { id: 'jesse', name: 'Jesse Pinkman', role: 'His former student', text: 'Walt’s old student and partner, who learns more chemistry than either of them planned.', action: 'Science!', done: 'Yeah, Mr. White! Yeah, science!' },
  { id: 'gus', name: 'Gustavo Fring', role: 'Los Pollos Hermanos', text: 'Owns a chain of chicken restaurants. Calm, polite, meticulous. Hides in plain sight.', action: 'Order the chicken', done: 'Your order is ready. The manager hopes you enjoy it.' },
  { id: 'mike', name: 'Mike Ehrmantraut', role: 'Security', text: 'A retired Philadelphia cop who handles problems quietly, and never halfway.', action: 'Half measures?', done: 'No more half measures.' },
  { id: 'saul', name: 'Saul Goodman', role: 'Attorney at law', text: 'Jimmy McGill, practicing law as Saul Goodman, from an office with an inflatable Statue of Liberty on the roof.', action: 'Better call Saul', done: 'S’all good, man.' },
  { id: 'lalo', name: 'Lalo Salamanca', role: 'The cousin', text: 'The most charming Salamanca, which makes him the most dangerous one in the room.', action: 'Lalo’s back', done: 'He walks in smiling. Nobody else is.' },
  { id: 'hector', name: 'Hector Salamanca', role: 'Tio', text: 'Says everything he needs to with a bell on his wheelchair.', action: 'Ring the bell', done: 'Ding. Ding. Ding.' },
  { id: 'hank', name: 'Hank Schrader', role: 'DEA', text: 'Walt’s brother-in-law, DEA agent, and a serious collector of minerals.', action: 'See the collection', done: 'They’re minerals.' },
];

export default function Cast() {
  const [done, setDone] = useState({});
  const act = (id) => {
    audioContext(); // in the click, so it can be heard
    if (id === 'walt') clip('sayMyName');
    if (id === 'saul') clip('callSaul');
    if (id === 'gus') clip('gusHello');
    if (id === 'hector') for (const when of [0, 0.42, 0.84]) clip('hectorBell', { when });
    if (id === 'jesse') clip('yeahScience').then((h) => h || sfx().then((s) => s.beeps()));
    if (id === 'hank') clip('hankRing');
    if (id === 'mike' || id === 'lalo') sfx().then((s) => s.knock());
    setDone((d) => ({ ...d, [id]: Date.now() }));
  };
  return (
    <ul className="abq-cast">
      {CAST.map((c) => (
        <li key={c.id} className="abq-person card" data-said={done[c.id] ? 'true' : undefined}>
          <span className="abq-icon" aria-hidden="true">
            {ICONS[c.id]}
          </span>
          <h3 className="stretch-semi mt-3 text-lg font-semibold text-ink">{c.name}</h3>
          <p className="text-sm text-muted">{c.role}</p>
          <p className="mt-3 text-sm leading-relaxed text-body">{c.text}</p>
          <button type="button" className="btn btn-ghost btn-sm mt-auto self-start" onClick={() => act(c.id)}>
            {c.action}
          </button>
          <p key={done[c.id]} className="abq-said" aria-live="polite">
            {done[c.id] ? c.done : ''}
          </p>
        </li>
      ))}
    </ul>
  );
}
