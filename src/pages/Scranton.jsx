import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Dundie from '../components/office/Dundie';
import FactCheck from '../components/office/FactCheck';
import WorldSwitcher from '../components/worlds/WorldSwitcher';
import WorldPhotos from '../components/worlds/WorldPhotos';
import Scenes from '../components/worlds/Scenes';
import { hasPhotos, hasScenes } from '../components/worlds/media';
import { ACHIEVEMENTS, useAchievements } from '../components/Achievements';
import { useFun } from '../fun/FunProvider';
import { audioContext } from '../lib/audio';
import { useDocumentTitle } from '../lib/hooks';
import '@fontsource/courier-prime/700.css';

const sfx = () => import('../lib/sfx');

const PLACES = [
  { id: 'office-sign', title: 'Scranton, Pennsylvania', note: 'The Electric City, as the opening credits show it.' },
  { id: 'office-courthouse', title: 'Lackawanna County Courthouse', note: 'Downtown, a few blocks from where the show put the office.' },
  { id: 'office-steamtown', title: 'Steamtown', note: 'The railroad yards Scranton grew up around.' },
  { id: 'office-mifflin', title: 'Dunder Mifflin', note: 'A Dunder Mifflin sign, out in the world.' },
];
const SCENES = ['officeFalse', 'officeNoGod', 'officeJim', 'officeDundies', 'officeIdentity', 'officeChili', 'officeBankruptcy', 'parkour'];

// Everyone gets one. Michael insists.
const OPENING = { title: 'The “Showed Up” Dundie', desc: 'For coming to the Dundies. Everyone gets one.' };

// Scranton: the Dundies, where every easter egg found on the site is an award,
// and Dwight's fact check. Reachable from the worlds menu, the terminal and the dock.
export default function Scranton() {
  useDocumentTitle('Scranton');
  const { unlocked } = useAchievements();
  const { twss, parkour } = useFun();
  const all = Object.keys(ACHIEVEMENTS);
  const won = all.filter((id) => unlocked.includes(id));
  const [k, setK] = useState(-1);
  const [pop, setPop] = useState(0);
  const theme = useRef(null);
  const [song, setSong] = useState(false);
  useEffect(() => () => theme.current?.stop(), []);
  const onStage = k < 0 || !won.length ? OPENING : { title: `The “${ACHIEVEMENTS[won[k % won.length]].name}” Dundie`, desc: ACHIEVEMENTS[won[k % won.length]].desc };

  const present = () => {
    audioContext(); // in the click, so the room can be heard
    sfx().then((s) => s.applause());
    // Michael thanks the room for the first one, and every fourth after that
    if (pop % 4 === 0) import('../lib/clips').then((c) => c.playClip('thankYou', { when: 0.5 }));
    setK((n) => n + 1);
    setPop((n) => n + 1);
  };
  const playSong = async () => {
    if (!audioContext()) return;
    if (theme.current) {
      theme.current.stop();
      theme.current = null;
      setSong(false);
      return;
    }
    const c = await import('../lib/clips');
    const clip = await c.playClip('officeTheme');
    if (!clip) return;
    theme.current = clip;
    setSong(true);
    clip.ended.then(() => {
      if (theme.current !== clip) return;
      theme.current = null;
      setSong(false);
    });
  };

  return (
    <div className="relative">
      <section className="shell relative z-10 grid items-center gap-10 pb-16 pt-[calc(var(--nav-h)+36px)] md:pb-20 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16" aria-labelledby="dundies-title">
        <figure className="dundie-stage m-0" aria-label={`On stage: ${onStage.title}. ${onStage.desc}`}>
          <div className="dundie-curtain dundie-curtain-l" aria-hidden="true" />
          <div className="dundie-curtain dundie-curtain-r" aria-hidden="true" />
          <div className="dundie-spot" aria-hidden="true" />
          <div className="dundie-floor" aria-hidden="true" />
          <Dundie key={pop} className="dundie-big" />
          <figcaption className="dundie-award" aria-live="polite">
            <span className="dundie-award-title">{onStage.title}</span>
            <span className="dundie-award-desc">{onStage.desc}</span>
          </figcaption>
        </figure>
        <div>
          <p className="eyebrow">Dunder Mifflin · Scranton Branch</p>
          <h1 id="dundies-title" className="display mt-6 text-[clamp(2.8rem,1.6rem+4vw,5rem)]">
            The Dundies
          </h1>
          <p className="lead mt-6 max-w-[46ch]">
            Every easter egg you find on this site wins a Dundie. You have {won.length} of {all.length}. Michael is presenting them now, in order, at length.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button type="button" className="btn btn-primary" onClick={present}>
              Present the next Dundie
            </button>
            <button type="button" className="btn btn-ghost" onClick={playSong} aria-pressed={song}>
              {song ? 'Stop the theme' : 'Play the theme'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => twss()}>
              That’s what she said
            </button>
            <button type="button" className="btn btn-ghost" onClick={parkour}>
              Parkour!
            </button>
            <Link to="/" className="btn btn-ghost">
              Back to the site
            </Link>
          </div>
          <WorldSwitcher className="mt-10" />
        </div>
      </section>

      <section className="shell relative z-10 py-12 md:py-16" aria-labelledby="case-title">
        <h2 id="case-title" className="title">
          The trophy case
        </h2>
        <p className="lead mt-4 max-w-[54ch]">One Dundie for each easter egg. The empty ones are still out there: try the terminal, the Konami code, or typing a few famous words anywhere.</p>
        <ul className="dundie-shelf mt-8">
          {all.map((id) => {
            const has = unlocked.includes(id);
            return (
              <li key={id} data-won={has || undefined}>
                <Dundie won={has} className="w-auto" />
                <span className="mt-2 block text-xs font-semibold text-ink">{has ? ACHIEVEMENTS[id].name : 'Not yet'}</span>
                <span className="sr-only">{has ? `won: ${ACHIEVEMENTS[id].desc}` : 'not won yet'}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="shell relative z-10 grid gap-10 pb-16 pt-10 md:pb-20 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16" aria-labelledby="facts-title">
        <div>
          <h2 id="facts-title" className="title">
            Dwight’s fact check
          </h2>
          <p className="lead mt-4 max-w-[46ch]">Seven statements, mostly about me. Fact, or false? Dwight has strong opinions about each one.</p>
        </div>
        <FactCheck />
      </section>

      {hasScenes(SCENES) && (
        <section className="shell relative z-10 py-10" aria-labelledby="office-scenes-title">
          <h2 id="office-scenes-title" className="title">
            From the show
          </h2>
          <div className="mt-8">
            <Scenes names={SCENES} />
          </div>
        </section>
      )}

      {hasPhotos(PLACES) && (
        <section className="shell relative z-10 pb-24 pt-10 md:pb-28" aria-labelledby="office-places-title">
          <h2 id="office-places-title" className="title">
            The real Scranton
          </h2>
          <p className="lead mt-4 max-w-[54ch]">The show was shot in California, but the city is real.</p>
          <div className="mt-8">
            <WorldPhotos items={PLACES} />
          </div>
        </section>
      )}
    </div>
  );
}
