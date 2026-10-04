import { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { splitWord } from '../components/albuquerque/elements';
import Cast from '../components/albuquerque/Cast';
import HectorBell from '../components/albuquerque/HectorBell';
import HectorBoard from '../components/albuquerque/HectorBoard';
import Lab from '../components/albuquerque/Lab.jsx'; // lab.js sits beside it: case-blind disks would take that
import Gif from '../components/Gif';
import WorldSwitcher from '../components/worlds/WorldSwitcher';
import Scenes from '../components/worlds/Scenes';
import WorldPhotos from '../components/worlds/WorldPhotos';
import { useFitTitle } from '../components/ui';
import { hasPhotos, hasScenes } from '../components/worlds/media';
import { audioContext } from '../lib/audio';
import { useDocumentTitle } from '../lib/hooks';

const PLACES = [
  { id: 'bb-albuquerque', title: 'Albuquerque, New Mexico', note: 'Where both shows are set, and where they were filmed.' },
  { id: 'bb-pollos', title: 'Twisters, Isleta Boulevard', note: 'On screen, it is Los Pollos Hermanos.' },
  { id: 'bb-doghouse', title: 'The Dog House', note: 'A drive-in hot dog stand that turns up in Breaking Bad.' },
  { id: 'bb-sandias', title: 'The Sandia Mountains', note: 'They turn pink at sunset. Sandía is Spanish for watermelon.' },
  { id: 'bb-balloons', title: 'The Balloon Fiesta', note: 'Every October, hundreds of hot-air balloons go up over the city.' },
  { id: 'bb-kimo', title: 'The KiMo Theatre', note: 'Pueblo Deco from 1927, on Route 66 downtown.' },
];
const SCENES = ['bbDanger', 'bbKnocks', 'bbJesse', 'bbGusExplain', 'bbGusHand', 'bbHalfMeasures', 'bbBarrel', 'saulExcited', 'bcsNewOffice'];

function Tile({ el }) {
  return (
    <span className="bb-tile">
      <span className="bb-num">{el.n}</span>
      <span className="bb-sym">{el.sym}</span>
      <span className="bb-mass">{el.mass}</span>
      <span className="bb-name">{el.name}</span>
    </span>
  );
}

// The counter at Los Pollos Hermanos: order, and the tray fills up.
const MENU = [
  ['Pollo clásico', '8 pieces'],
  ['Pollo picante', 'with the house spice'],
  ['Spice curls', 'the house recommends'],
  ['Sweet tea', 'Mike’s order'],
];
function Pollos() {
  const [tray, setTray] = useState([]);
  const order = (i) => {
    audioContext(); // in the click, so the bell can be heard
    import('../lib/sfx').then((s) => s.ding());
    setTray((t) => (t.includes(i) ? t : [...t, i]));
  };
  return (
    <div className="pollos card">
      <div className="pollos-inside">
        <Gif name="bcsSpiceCurls" size="medium" />
      </div>
      <div className="pollos-board mt-4">
        <p className="pollos-name">Los Pollos Hermanos</p>
        <p className="pollos-sub">Albuquerque, New Mexico</p>
        <ul className="mt-4 grid gap-2">
          {MENU.map(([item, note], i) => (
            <li key={item}>
              <button type="button" className="pollos-item" aria-pressed={tray.includes(i)} onClick={() => order(i)}>
                <span>{item}</span>
                <span className="pollos-note">{note}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-4 min-h-[1.5em] text-sm text-body" aria-live="polite">
        {tray.length === MENU.length ? 'The manager brings it out himself, and thanks you for your business.' : tray.length ? `${tray.length} on the tray.` : 'Order at the counter.'}
      </p>
    </div>
  );
}

// Albuquerque: any name as a Breaking Bad title card, the cast of both shows,
// Los Pollos Hermanos and Saul's card.
export default function Albuquerque() {
  useDocumentTitle('Albuquerque');
  const fitTitle = useFitTitle();
  const [name, setName] = useState('Tilak Patel');
  const [saul, setSaul] = useState(false);
  const music = useRef(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => () => music.current?.stop(), []);
  const words = name.trim().split(/\s+/).filter(Boolean).slice(0, 3);

  const say = () => {
    audioContext();
    import('../lib/clips').then((c) => c.playClip('sayMyName'));
  };
  const opening = async () => {
    if (!audioContext()) return;
    if (music.current) {
      music.current.stop();
      music.current = null;
      setPlaying(false);
      return;
    }
    const c = await import('../lib/clips');
    const clip = await c.playClip('bbIntro');
    if (!clip) return;
    music.current = clip;
    setPlaying(true);
    clip.ended.then(() => {
      if (music.current !== clip) return;
      music.current = null;
      setPlaying(false);
    });
  };

  return (
    <div className="relative">
      <section className="shell relative z-10 grid items-center gap-10 pb-16 pt-[calc(var(--nav-h)+36px)] md:pb-20 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-16" aria-labelledby="abq-title">
        <figure className="abq-card m-0">
          <span className="bb-smoke bb-smoke-a" aria-hidden="true" />
          <span className="bb-smoke bb-smoke-b" aria-hidden="true" />
          <p className="bb-title abq-title-card" aria-label={name || 'Your name'}>
            {words.length ? (
              words.map((w, i) => {
                const { before, el, after } = splitWord(w);
                return (
                  <span key={`${w}-${i}`} className="bb-line" aria-hidden="true">
                    {before && <span className="bb-rest">{before.toLowerCase()}</span>}
                    {el && <Tile el={el} />}
                    {after && <span className="bb-rest">{after.toLowerCase()}</span>}
                  </span>
                );
              })
            ) : (
              <span className="bb-line" aria-hidden="true">
                <span className="bb-rest">your name</span>
              </span>
            )}
          </p>
        </figure>
        <div>
          <p className="eyebrow">Albuquerque · New Mexico</p>
          <h1 ref={fitTitle} id="abq-title" className="display mt-6 text-[clamp(2.4rem,1.2rem+3.4vw,4.2rem)]">
            Albuquerque
          </h1>
          <p className="lead mt-6 max-w-[46ch]">Breaking Bad and Better Call Saul. Type a name and it becomes a title card, one element from the periodic table at a time.</p>
          <div className="mt-8 max-w-md">
            <label htmlFor="abq-name" className="label">
              A name
            </label>
            <input id="abq-name" className="fun-input mt-2" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} autoComplete="off" />
          </div>
          <div className="mt-7 flex flex-wrap gap-3">
            <button type="button" className="btn btn-primary" onClick={say}>
              Say my name
            </button>
            <button type="button" className="btn btn-ghost" onClick={opening} aria-pressed={playing}>
              {playing ? 'Stop the opening' : 'Play the opening'}
            </button>
            <Link to="/" className="btn btn-ghost">
              Back to the site
            </Link>
          </div>
          <WorldSwitcher className="mt-10" />
        </div>
      </section>

      <section className="shell relative z-10 py-12 md:py-16" aria-labelledby="cast-title">
        <h2 id="cast-title" className="title">
          The cast
        </h2>
        <p className="lead mt-4 max-w-[56ch]">Breaking Bad and Better Call Saul, one card each. Every one of them does something.</p>
        <div className="mt-8">
          <Cast />
        </div>
      </section>

      <section className="shell relative z-10 py-12 md:py-16" aria-labelledby="cook-title">
        <h2 id="cook-title" className="title">
          The superlab
        </h2>
        <p className="lead mt-4 max-w-[60ch]">
          Under the laundry, cooking to order. Jesse, Badger and Skinny Pete are at the door on day one; Tuco, Mike, Gus, Lydia and Declan follow. Mix it, cook it, break it and bag it the way the ticket says. Walt won’t settle for less than 99, and neither will Gus.
        </p>
        <div className="mt-8">
          <Lab />
        </div>
      </section>

      <section className="shell relative z-10 py-12 md:py-16" aria-labelledby="hector-title">
        <HectorBell />
      </section>

      <section className="shell relative z-10 py-12 md:py-16" aria-labelledby="board-title">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:gap-14">
          <HectorBoard />
          <div>
            <h2 id="board-title" className="title">
              The letter board
            </h2>
            <p className="lead mt-4 max-w-[44ch]">
              How Hector talks: someone runs a finger along a letter board and he rings when it reaches the one he wants. Pick the row, then the letter. Three
              words, as fast as you can, and every wrong ring costs you five seconds.
            </p>
          </div>
        </div>
      </section>

      <section className="shell relative z-10 grid items-start gap-10 py-12 md:py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14" aria-labelledby="pollos-title">
        <div>
          <h2 id="pollos-title" className="title">
            Los Pollos Hermanos
          </h2>
          <p className="lead mt-4 max-w-[46ch]">Inside Gus Fring’s chicken restaurant, the cleanest kitchen in New Mexico. Gus is at the counter himself.</p>
          <div className="mt-8">
            <Pollos />
          </div>
        </div>
        <div>
          <h2 className="title">Better call Saul</h2>
          <p className="lead mt-4 max-w-[46ch]">Saul Goodman’s card. Keep it in your wallet, and call: he’s outside the office, under the inflatable Statue of Liberty.</p>
          <div className="saul-card mt-8">
            <p className="saul-big">Better Call Saul!</p>
            <p className="saul-name">Saul Goodman · Attorney at Law</p>
            <p className="saul-small">Injuries · Criminal defense · Whatever you need</p>
          </div>
          <button type="button" className="btn btn-primary mt-6" onClick={() => setSaul((v) => !v)} aria-pressed={saul}>
            {saul ? 'Hang up' : 'Call Saul'}
          </button>
          {saul && (
            <div className="mt-5 max-w-sm">
              <Gif name="bcsBestDecision" size="medium" eager />
            </div>
          )}
        </div>
      </section>

      {hasScenes(SCENES) && (
        <section className="shell relative z-10 py-10" aria-labelledby="abq-scenes-title">
          <h2 id="abq-scenes-title" className="title">
            From the shows
          </h2>
          <div className="mt-8">
            <Scenes names={SCENES} />
          </div>
        </section>
      )}

      {hasPhotos(PLACES) && (
        <section className="shell relative z-10 pb-24 pt-10 md:pb-28" aria-labelledby="abq-places-title">
          <h2 id="abq-places-title" className="title">
            The real Albuquerque
          </h2>
          <div className="mt-8">
            <WorldPhotos items={PLACES} />
          </div>
        </section>
      )}
      <div className="pb-16" />
    </div>
  );
}
