import { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { splitWord } from '../components/albuquerque/elements';
import WorldSwitcher from '../components/worlds/WorldSwitcher';
import Scenes from '../components/worlds/Scenes';
import WorldPhotos from '../components/worlds/WorldPhotos';
import { hasPhotos, hasScenes } from '../components/worlds/media';
import { audioContext } from '../lib/audio';
import { useDocumentTitle } from '../lib/hooks';

const PLACES = [
  { id: 'bb-albuquerque', title: 'Albuquerque, New Mexico', note: 'Where both shows were filmed, and where they are set.' },
  { id: 'bb-pollos', title: 'Twisters, Albuquerque', note: 'Los Pollos Hermanos, on screen.' },
  { id: 'bb-sandias', title: 'The Sandia Mountains', note: 'The skyline behind half the show.' },
];
const SCENES = ['bbSayMyName', 'bbKnocks', 'bbScience', 'saulExcited', 'saulGood'];

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

// Albuquerque: any name as a Breaking Bad title card, and the show's sounds.
export default function Albuquerque() {
  useDocumentTitle('Albuquerque');
  const [name, setName] = useState('Tilak Patel');
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
          <h1 id="abq-title" className="display mt-6 text-[clamp(2.8rem,1.6rem+4vw,5rem)]">
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
