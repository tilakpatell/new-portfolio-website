import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ThinkMark from '../components/invincible/thinkmark/ThinkMark';
import Viewer from '../components/invincible/viewer/Viewer';
import ModelCredits from '../components/ModelCredits';
import WorldSwitcher from '../components/worlds/WorldSwitcher';
import { audioContext } from '../lib/audio';
import { jumpTo } from '../lib/anchors';
import { prefersReducedMotion, useDocumentTitle } from '../lib/hooks';
import '@fontsource/bebas-neue/400.css';
import '../components/invincible/invincible.css';

const sfx = () => import('../lib/sfx');
const sound = (name) => {
  audioContext(); // inside the press, so the sound may play
  sfx().then((s) => s[name]?.());
};

// The first season's episodes, each named for a line said in it; the title
// card has a worse time of it every week.
const EPISODES = [
  { n: 1, title: 'It’s About Time', bg: '#1d8fd6' },
  { n: 2, title: 'Here Goes Nothing', bg: '#e8452c' },
  { n: 3, title: 'Who You Calling Ugly?', bg: '#2f9e5b' },
  { n: 4, title: 'Neil Armstrong, Eat Your Heart Out', bg: '#7b4bd6' },
  { n: 5, title: 'That Actually Hurt', bg: '#f08a1c' },
  { n: 6, title: 'You Look Kinda Dead', bg: '#13a3a8' },
  { n: 7, title: 'We Need to Talk', bg: '#d6336c' },
  { n: 8, title: 'Where I Really Come From', bg: '#1b2a4a' },
];

// What a Viltrumite would say about each of the things people built to fly, lift and think.
const MIMIC = ['a jumbo jet', 'a Saturn V', 'a forklift', 'a supercomputer', 'the Game Boy emulator on this site', 'a hydraulic press', 'the Hubble Space Telescope', 'a bullet train'];

// Things your father said. Each card does something.
const LINES = [
  { id: 'think', said: 'Think, Mark!', who: 'Omni-Man, to his son, over the city' },
  { id: 'mimic', said: 'Look what they need to mimic a fraction of our power.', who: 'Omni-Man, at a passing plane' },
  { id: 'sure', said: 'Are you sure?', who: 'Omni-Man' },
  { id: 'still', said: 'I’d still have you, Dad.', who: 'Mark, when asked what he’d have left in five hundred years' },
];

// Invincible: the Grayson family's city. Fly Think, Mark! over it, meet the
// cast in HD on the GDA's turntable, and hear what your father had to say.
export default function Invincible() {
  useDocumentTitle('Invincible');
  const [ep, setEp] = useState(0);
  const [mimic, setMimic] = useState(-1);
  const [sure, setSure] = useState(0);
  const [still, setStill] = useState(false);
  const [shake, setShake] = useState(false);
  const shook = useRef(0);
  useEffect(() => () => clearTimeout(shook.current), []);
  // the page's own look (invincible.css)
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.world = 'invincible';
    return () => delete root.dataset.world;
  }, []);
  const episode = EPISODES[ep];

  const act = {
    think: [
      'Think',
      () => {
        sound('thunk');
        if (prefersReducedMotion()) return;
        setShake(true);
        clearTimeout(shook.current);
        shook.current = setTimeout(() => setShake(false), 520);
      },
    ],
    mimic: [
      mimic < 0 ? 'Look' : 'Look at something else',
      () => {
        sound('flyby');
        setMimic((i) => (i + 1) % MIMIC.length);
      },
    ],
    sure: [
      sure ? 'Yes' : 'I’m sure',
      () => {
        sound('knock');
        setSure((n) => n + 1);
      },
    ],
    still: [
      still ? 'Say it again' : 'Answer him',
      () => {
        sound('ding');
        setStill(true);
      },
    ],
  };
  const reply = {
    think: 'Five hundred years from now, you’ll still be here. Think about it.',
    mimic: mimic < 0 ? null : `Look what they need to mimic a fraction of our power: ${MIMIC[mimic]}.`,
    sure: sure ? `${'Are you sure? '.repeat(Math.min(sure, 4)).trim()}` : null,
    still: still ? 'He stops. Then he leaves, for a long time.' : null,
  };

  return (
    <div className="inv-page relative" data-shake={shake || undefined}>
      <div className="inv-dots" aria-hidden="true" />

      <section className="shell relative z-10 pb-10 pt-[calc(var(--nav-h)+28px)] md:pb-14" aria-labelledby="inv-title">
        <div className="inv-hero">
          <button type="button" className="inv-card" style={{ '--card': episode.bg }} data-ep={episode.n} onClick={() => (sound('drum'), setEp((i) => (i + 1) % EPISODES.length))} aria-label={`The title card, episode ${episode.n}: ${episode.title}. Press for the next episode.`}>
            <span className="inv-card-word" aria-hidden="true">
              INVINCIBLE
            </span>
            <span className="inv-card-ep" aria-hidden="true">
              Episode {episode.n} · {episode.title}
            </span>
            <span className="inv-card-hint" aria-hidden="true">
              Next episode
            </span>
          </button>
          <div>
            <p className="eyebrow">Invincible · the Graysons’ city</p>
            <h1 id="inv-title" className="display inv-display mt-4 text-[clamp(2.6rem,1.4rem+4.6vw,5rem)]">
              Think, Mark.
            </h1>
            <p className="lead mt-5 max-w-[46ch]">You’re Mark Grayson: eighteen, half-Viltrumite, and still learning to fly. Your father is the strongest man on Earth. That’s about to be a problem.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#inv-game" className="btn btn-primary" onClick={(e) => jumpTo(e, 'inv-game')}>
                Fly over the city
              </a>
              <a href="#inv-cast" className="btn btn-ghost" onClick={(e) => jumpTo(e, 'inv-cast')}>
                Meet the cast
              </a>
              <Link to="/" className="btn btn-ghost">
                Back to the site
              </Link>
            </div>
            <WorldSwitcher className="mt-8" />
          </div>
        </div>
      </section>

      <section id="inv-game" className="shell relative z-10 scroll-mt-24 py-10 md:py-14" aria-labelledby="inv-game-title">
        <h2 id="inv-game-title" className="title inv-title">
          Think, Mark!
        </h2>
        <p className="lead mt-4 max-w-[60ch]">Four chapters over the city: a flight lesson with your father, a portal full of Flaxans, your father, and then the Grand Regent of the Viltrum Empire. Dodge as the ring closes on them; hit them while they recover.</p>
        <div className="mt-8">
          <ThinkMark
            fallback={
              <div className="inv-fallback">
                <p className="inv-fallback-word">INVINCIBLE</p>
                <p>Think, Mark! is a 3D game, and this browser has no 3D. The four chapters: a flight lesson through rings over the city, the Flaxans’ portal over the river, Omni-Man, and Thragg.</p>
              </div>
            }
          />
        </div>
      </section>

      <section id="inv-cast" className="shell relative z-10 scroll-mt-24 py-12 md:py-16" aria-labelledby="inv-cast-title">
        <h2 id="inv-cast-title" className="title inv-title">
          The files
        </h2>
        <p className="lead mt-4 max-w-[60ch]">What the Global Defense Agency keeps on the three of them, with each of them on the turntable. Drag to turn him; pick a pose.</p>
        <div className="mt-8">
          <Viewer />
        </div>
      </section>

      <section id="inv-lines" className="shell relative z-10 scroll-mt-24 py-12 md:py-16" aria-labelledby="inv-lines-title">
        <h2 id="inv-lines-title" className="title inv-title">
          Things your father said
        </h2>
        <p className="lead mt-4 max-w-[56ch]">Each one does something.</p>
        <ul className="inv-lines mt-8">
          {LINES.map((l) => (
            <li key={l.id} className="inv-quote">
              <p className="inv-quote-said">“{l.said}”</p>
              <p className="inv-quote-who">{l.who}</p>
              <p className="inv-quote-reply" aria-live="polite">
                {reply[l.id]}
              </p>
              <button type="button" className="inv-quote-act" onClick={act[l.id][1]}>
                {act[l.id][0]}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="shell relative z-10 pb-24 pt-6 md:pb-28">
        <ModelCredits where="invincible" line className="inv-credits" />
        <p className="inv-credits mt-2">Invincible himself was made for this page with Meshy, from a description of the suit; the skies are “Kloofendal 48d Partly Cloudy”, “Kloppenheim 06” and “Kloppenheim 02” from Poly Haven (CC0); the city, the Flaxans and every sound are code. Invincible is Robert Kirkman’s, Cory Walker’s and Ryan Ottley’s, and Amazon’s; this is a fan’s tribute, not affiliated with any of them.</p>
      </section>
    </div>
  );
}
