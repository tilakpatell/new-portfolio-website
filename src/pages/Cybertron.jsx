import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Insignia from '../components/cybertron/Insignia';
import Optimus from '../components/cybertron/Optimus';
import Planet from '../components/cybertron/Planet';
import Visor from '../components/cybertron/Visor';
import AutobotMark from '../components/AutobotMark';
import DecepticonMark from '../components/DecepticonMark';
import { Cybertron as Skyline } from '../components/worlds/Backdrops';
import WorldSwitcher from '../components/worlds/WorldSwitcher';
import WorldPhotos from '../components/worlds/WorldPhotos';
import Scenes from '../components/worlds/Scenes';
import { hasPhotos, hasScenes } from '../components/worlds/media';
import { useFun } from '../fun/FunProvider';
import { useTheme } from '../theme/ThemeProvider';
import { audioContext } from '../lib/audio';
import { prefersReducedMotion, useDocumentTitle } from '../lib/hooks';

const SIDES = {
  autobot: { city: 'Iacon', motto: 'Till all are one.', leader: 'optimus', theme: 'optimus', call: 'Autobots, roll out' },
  decepticon: { city: 'Kaon', motto: 'Peace through tyranny.', leader: 'megatron', theme: 'megatron', call: 'Decepticons, attack' },
};

const ROSTER = [
  { id: 'optimus', name: 'Optimus Prime', side: 'autobot', role: 'Leader of the Autobots', line: 'Freedom is the right of all sentient beings.', color: '#c8102e', trim: '#1f4fa8' },
  { id: 'bumblebee', name: 'Bumblebee', side: 'autobot', role: 'Scout', line: 'Speaks through his radio, a line of a song at a time.', color: '#f7c600', trim: '#151515' },
  { id: 'megatron', name: 'Megatron', side: 'decepticon', role: 'Leader of the Decepticons', line: 'Once a gladiator in Kaon. Peace through tyranny.', color: '#8a8f9c', trim: '#6b2fa0' },
  { id: 'shockwave', name: 'Shockwave', side: 'decepticon', role: 'Scientist', line: 'One optic, no feelings. Only logic.', color: '#7a2fb8', trim: '#d4af37' },
  { id: 'soundwave', name: 'Soundwave', side: 'decepticon', role: 'Communications', line: 'Hears everything, says almost nothing. Superior.', color: '#1b2f55', trim: '#4fd8ff' },
];

const BOARD = [
  ['transform', 'Transform'],
  ['freedom', 'Freedom'],
  ['soUnwise', 'So unwise'],
  ['die', 'Die'],
];

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const ON_EARTH = [
  { id: 'tf-optimus', title: 'Optimus Prime, Orlando', note: 'Standing guard on top of Transformers: The Ride at Universal Studios Florida.' },
  { id: 'tf-bumblebee', title: 'Bumblebee, Singapore', note: 'Crouched over the ride’s entrance at Universal Studios Singapore.' },
  { id: 'tf-g1-optimus', title: 'Optimus Prime, the toy', note: 'The Masterpiece remake of the 1984 truck, trailer and all.' },
];
const SCENES = ['tfTransform', 'tfRollOut', 'tfBumblebee', 'tfBumblebeeWave', 'tfMegatron'];

// Cybertron: change sides, write in Cybertronian, roll out as anyone on the roster.
export default function Cybertron() {
  useDocumentTitle('Cybertron');
  const { rollOut } = useFun();
  const { setScrollTheme } = useTheme();
  const [side, setSide] = useState('autobot');
  const [phase, setPhase] = useState('idle');
  const [mode, setMode] = useState('truck');
  const [busy, setBusy] = useState(false);
  const [matrix, setMatrix] = useState(false);
  const [text, setText] = useState('Tilak Patel');
  const [shown, setShown] = useState('Tilak Patel');
  const timers = useRef([]);
  const s = SIDES[side];
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Truck to robot and back, with the sound of it.
  const transformBot = () => {
    if (busy) return;
    audioContext(); // in the click, so the transformation can be heard
    import('../lib/clips').then((c) => c.playClip('transform'));
    setMatrix(false);
    setMode((m) => (m === 'truck' ? 'robot' : 'truck'));
    setBusy(true);
    timers.current.push(setTimeout(() => setBusy(false), prefersReducedMotion() ? 100 : 1300));
  };
  const openMatrix = () => {
    audioContext();
    if (!matrix) import('../lib/sfx').then((x) => x.repulsor());
    setMatrix((m) => !m);
  };

  // Changing sides: the slats slide out, the face changes, the slats slide back.
  const transform = () => {
    if (phase !== 'idle') return;
    audioContext(); // in the click, so the transformation can be heard
    import('../lib/clips').then((c) => c.playClip('transform'));
    const next = side === 'autobot' ? 'decepticon' : 'autobot';
    if (prefersReducedMotion()) {
      setSide(next);
      setScrollTheme(SIDES[next].theme);
      return;
    }
    setPhase('out');
    timers.current.push(
      setTimeout(() => {
        setSide(next);
        setScrollTheme(SIDES[next].theme);
        setPhase('in');
      }, 380),
      setTimeout(() => setPhase('idle'), 900),
    );
  };

  // The translation decodes left to right, as if Teletraan were working on it.
  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(text);
      return undefined;
    }
    let step = 0;
    const id = setInterval(() => {
      step += 1;
      const done = Math.floor((step / 10) * text.length);
      setShown(
        [...text]
          .map((ch, i) => (i < done || !/[a-z]/i.test(ch) ? ch : ALPHABET[Math.floor(Math.random() * 26)]))
          .join(''),
      );
      if (step >= 10) clearInterval(id);
    }, 35);
    return () => clearInterval(id);
  }, [text]);

  const play = (id) => {
    audioContext();
    import('../lib/clips').then((c) => c.playClip(id));
  };

  return (
    <div className="relative">
      <section className="shell relative z-10 grid items-center gap-10 pb-16 pt-[calc(var(--nav-h)+36px)] md:pb-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16" aria-labelledby="cy-title">
        <figure className="cy-planet m-0" data-side={side}>
          <Planet side={side} className="cy-planet-canvas" />
          <Insignia side={side} phase={phase} className="cy-planet-mark" />
        </figure>
        <div>
          <p className="eyebrow">Cybertron · {s.city}</p>
          <h1 id="cy-title" className="display mt-6 text-[clamp(2.4rem,1.4rem+3.6vw,4.4rem)]">
            {s.motto}
          </h1>
          <p className="lead mt-6 max-w-[48ch]">
            The Aligned continuity first: War for Cybertron, Fall of Cybertron and Prime. And a soft spot for the Bay films. Pick a side, then transform.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button type="button" className="btn btn-primary" onClick={transform} disabled={phase !== 'idle'}>
              {side === 'autobot' ? 'Join the Decepticons' : 'Join the Autobots'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => rollOut(s.leader)}>
              {s.call}
            </button>
            <Link to="/" className="btn btn-ghost">
              Back to the site
            </Link>
          </div>
          <WorldSwitcher className="mt-10" />
        </div>
      </section>

      <section className="shell relative z-10 py-14 md:py-20" aria-labelledby="transform-title">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
          <figure className="cy-stage m-0" data-side={side}>
            <Skyline faction={side} className="cy-stage-skyline" />
            <Optimus mode={mode} side={side} matrix={matrix && mode === 'robot'} className="cy-bot" />
          </figure>
          <div>
            <h2 id="transform-title" className="title">
              {side === 'autobot' ? 'More than meets the eye' : 'Robots in disguise'}
            </h2>
            <p className="lead mt-4 max-w-[46ch]">
              {mode === 'truck'
                ? 'A cab-over truck, parked on Cybertron. Press Transform.'
                : side === 'autobot'
                  ? 'Optimus Prime, leader of the Autobots. Inside his chest he carries the Matrix of Leadership.'
                  : 'In Decepticon colors now. The chest is just a chest.'}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button type="button" className="btn btn-primary" onClick={transformBot} disabled={busy}>
                Transform
              </button>
              {mode === 'robot' && side === 'autobot' && (
                <button type="button" className="btn btn-ghost" onClick={openMatrix} aria-pressed={matrix} disabled={busy}>
                  {matrix ? 'Close the Matrix' : 'Open the Matrix'}
                </button>
              )}
            </div>
            <p className="mt-4 min-h-[1.5em] text-sm text-muted" role="status">
              {matrix && mode === 'robot' ? 'The Matrix of Leadership: light our darkest hour.' : ''}
            </p>
          </div>
        </div>
      </section>

      <section className="shell relative z-10 py-14 md:py-20" aria-labelledby="glyphs-title">
        <h2 id="glyphs-title" className="title">
          Write in Cybertronian
        </h2>
        <p className="lead mt-4 max-w-[54ch]">The alphabet from War for Cybertron, letter for letter. Type anything.</p>
        <div className="cy-translator card mt-8">
          <label htmlFor="cy-text" className="label">
            English
          </label>
          <input id="cy-text" className="fun-input mt-2" value={text} maxLength={60} onChange={(e) => setText(e.target.value)} autoComplete="off" />
          <p className="cy-glyphs mt-6" aria-hidden="true">
            {shown || ' '}
          </p>
        </div>
      </section>

      <section className="shell relative z-10 py-10 md:py-14" aria-labelledby="roster-title">
        <h2 id="roster-title" className="title">
          The roster
        </h2>
        <p className="lead mt-4 max-w-[54ch]">Each of them is a color scheme for this site. Roll out as one, and everything changes to match.</p>
        <ul className="cy-roster mt-8">
          {ROSTER.map((bot) => (
            <li key={bot.id} className="cy-bot card" style={{ '--bot': bot.color, '--trim': bot.trim }}>
              <span className="cy-bot-mark" aria-hidden="true">
                {bot.side === 'autobot' ? <AutobotMark /> : <DecepticonMark />}
              </span>
              <h3 className="stretch-semi mt-4 text-lg font-semibold text-ink">{bot.name}</h3>
              <p className="text-sm text-muted">{bot.role}</p>
              {bot.id === 'soundwave' ? <Visor className="cy-visor mt-4" /> : <p className="mt-3 text-sm leading-relaxed text-body">{bot.line}</p>}
              {bot.id === 'soundwave' && <p className="mt-3 text-sm leading-relaxed text-body">{bot.line} His visor shows whatever this site is playing.</p>}
              <button type="button" className="btn btn-ghost btn-sm mt-5 self-start" onClick={() => rollOut(bot.id)} aria-label={`Roll out as ${bot.name}`}>
                Roll out
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="shell relative z-10 pb-16 pt-8 md:pb-20" aria-labelledby="board-title">
        <h2 id="board-title" className="title">
          Soundboard
        </h2>
        <p className="lead mt-4 max-w-[54ch]">Four clips. Soundwave is listening.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          {BOARD.map(([id, label]) => (
            <button key={id} type="button" className="btn btn-ghost" onClick={() => play(id)}>
              {label}
            </button>
          ))}
        </div>
      </section>

      {hasScenes(SCENES) && (
        <section className="shell relative z-10 py-10" aria-labelledby="tf-scenes-title">
          <h2 id="tf-scenes-title" className="title">
            From the films
          </h2>
          <div className="mt-8">
            <Scenes names={SCENES} />
          </div>
        </section>
      )}

      {hasPhotos(ON_EARTH) && (
        <section className="shell relative z-10 pb-24 pt-10 md:pb-28" aria-labelledby="tf-earth-title">
          <h2 id="tf-earth-title" className="title">
            On Earth
          </h2>
          <p className="lead mt-4 max-w-[54ch]">They are out here too, if you know where to look.</p>
          <div className="mt-8">
            <WorldPhotos items={ON_EARTH} />
          </div>
        </section>
      )}
    </div>
  );
}
