import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Dundie from '../components/office/Dundie';
import FactCheck from '../components/office/FactCheck';
import OfficeFloor from '../components/office/OfficeFloor';
import PaperPlane from '../components/office/PaperPlane';
import PaperToss from '../components/office/PaperToss';
import WorldSwitcher from '../components/worlds/WorldSwitcher';
import ClipBoard from '../components/worlds/ClipBoard';
import WorldPhotos from '../components/worlds/WorldPhotos';
import Scenes from '../components/worlds/Scenes';
import { hasPhotos, hasScenes } from '../components/worlds/media';
import { ACHIEVEMENTS, useAchievements } from '../components/Achievements';
import { useFun } from '../fun/FunProvider';
import { audioContext } from '../lib/audio';
import { useDocumentTitle } from '../lib/hooks';
import '@fontsource/courier-prime/700.css';

const sfx = () => import('../lib/sfx');
// the office to walk about in, as Jim (components/office/world), on top of the page
const OfficeWorld = lazy(() => import('../components/office/world/OfficeWorld'));

const PLACES = [
  { id: 'office-electric-city', title: 'The Electric City sign', note: 'Scranton’s nickname, in lights, as the opening credits show it.' },
  { id: 'office-dunder-mifflin', title: 'Dunder Mifflin, on the street', note: 'The city hung banners for the paper company that never was.' },
  { id: 'office-penn-paper', title: 'Penn Paper', note: 'The clock tower from the opening credits, on a real paper supplier.' },
  { id: 'office-scranton-sign', title: 'Scranton Welcomes You', note: 'The sign the cold opens drive past.' },
  { id: 'office-courthouse', title: 'Lackawanna County Courthouse', note: 'Downtown Scranton, under the Electric City sign.' },
];
// the soundboard: the show's own lines, and the theme
const BOARD = [
  'twss',
  'parkour',
  'thankYou',
  'noGod',
  'whyAreYou',
  'bankruptcy',
  'likeToBeLiked',
  'littleStitious',
  'insideJokes',
  'boomRoasted',
  'beyonceAlways',
  'prisonMike',
  'fireDrill',
  'ignorantSlut',
  'identityTheft',
  'dwightPunish',
  'bearsBeets',
  'didIStutter',
  'undercookOnions',
  'pamGamble',
  ['officeTheme', 'The theme'],
];

const SCENES = ['officeBankruptcy', 'officeDundies', 'officePamDundie', 'officeFalse', 'parkour', 'twss'];

// Kevin's way with words: the small ones go.
const SMALL = new Set(['a', 'an', 'the', 'of', 'to', 'at', 'on', 'in', 'is', 'are', 'was', 'were', 'and', 'it', 'its', 'that', 'this', 'with', 'for', 'has', 'have', 'be', 'by', 'from', 'as', 'which', 'who', 'about', 'each', 'every', 'one', 'now', 'there', 'their', 'his', 'her', 'mostly', 'but', 'or', 'so', 'than', 'then', 'into', 'something', 'everyone']);
const fewWord = (text) =>
  text
    .split(/\s+/)
    .filter((w) => !SMALL.has(w.toLowerCase().replace(/[^a-z’']/g, '')))
    .join(' ')
    .replace(/\s+([.,!?])/g, '$1');

// Everyone gets one. Michael insists.
const OPENING = { title: 'The “Showed Up” Dundie', desc: 'For coming to the Dundies. Everyone gets one.' };

// Scranton: the office to walk about in 3D first (a week's jobs as Jim),
// then the office from above (pick a desk), Dwight's fact check, scenes from
// the show, and the Dundies, where every easter egg found is an award.
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
  // Kevin: why waste time say lot word when few word do trick
  const [kevin, setKevin] = useState(false);
  const say = (text) => (kevin ? fewWord(text) : text);
  useEffect(() => () => theme.current?.stop(), []);
  const onStage = k < 0 || !won.length ? OPENING : { title: `The “${ACHIEVEMENTS[won[k % won.length]].name}” Dundie`, desc: ACHIEVEMENTS[won[k % won.length]].desc };

  const present = () => {
    audioContext(); // in the click, so the room can be heard
    sfx().then((s) => s.applause());
    // Michael thanks the room for the first one, and every fourth after that
    if (pop % 4 === 0) import('../lib/clips').then((c) => c.playClip('thankYou', { when: 0.5 }));
    else if (pop % 4 === 2) import('../lib/clips').then((c) => c.playClip('beyonceAlways', { when: 0.5 }));
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
    <div className="relative" data-kevin={kevin || undefined}>
      <div className="pt-[var(--nav-h)]">
        <Suspense fallback={<div style={{ height: 'clamp(30rem, calc(100svh - var(--nav-h, 64px)), 56rem)', background: '#d8d4c8' }} aria-hidden="true" />}>
          <OfficeWorld />
        </Suspense>
      </div>
      <PaperPlane />
      <section className="shell relative z-10 pb-12 pt-12 md:pb-16 md:pt-16" aria-labelledby="office-title">
        <div className="grid items-end gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-12">
          <div>
            <p className="eyebrow">Dunder Mifflin · Scranton Branch</p>
            <h1 id="office-title" className="display mt-5 text-[clamp(2.6rem,1.4rem+4vw,4.8rem)]">
              Dunder Mifflin
            </h1>
            <p className="lead mt-5 max-w-[56ch]">{say('Pick a desk. Everyone at the Scranton branch has something on it and something to do, from Michael’s mug to Kevin’s chili.')}</p>
          </div>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <button type="button" className="btn btn-ghost" onClick={playSong} aria-pressed={song}>
              {song ? 'Stop the theme' : 'Play the theme'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setKevin((k) => !k)} aria-pressed={kevin}>
              {kevin ? 'Back to lot word' : 'Kevin mode'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={parkour}>
              Parkour!
            </button>
          </div>
        </div>
        <div className="mt-8">
          <OfficeFloor say={say} />
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-6">
          <WorldSwitcher />
          <Link to="/" className="btn btn-ghost">
            Back to the site
          </Link>
        </div>
      </section>

      <section className="shell relative z-10 py-12 md:py-16" aria-labelledby="toss-title">
        <h2 id="toss-title" className="title">
          Office Olympics
        </h2>
        <p className="lead mt-4 max-w-[58ch]">{say('Paper toss, from Jim’s desk to the wastebasket. Ten balls. Every basket moves the bin, and after two somebody turns the fan on.')}</p>
        <div className="mt-8">
          <PaperToss />
        </div>
      </section>

      <section className="shell relative z-10 grid gap-10 py-12 md:py-16 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16" aria-labelledby="facts-title">
        <div>
          <h2 id="facts-title" className="title scroll-mt-28">
            Dwight’s fact check
          </h2>
          <p className="lead mt-4 max-w-[46ch]">{say('Eight statements, half about me and half about the branch. Fact, or false? Dwight has strong opinions about each one.')}</p>
        </div>
        <FactCheck />
      </section>

      <section className="shell relative z-10 py-12 md:py-16" aria-labelledby="office-board-title">
        <h2 id="office-board-title" className="title">
          Soundboard
        </h2>
        <p className="lead mt-4 max-w-[56ch]">From the show, a line at a time.</p>
        <ClipBoard className="mt-8" clips={BOARD} />
      </section>

      {hasScenes(SCENES) && (
        <section className="shell relative z-10 py-12 md:py-16" aria-labelledby="office-scenes-title">
          <h2 id="office-scenes-title" className="title">
            From the show
          </h2>
          <div className="mt-8">
            <Scenes names={SCENES} />
          </div>
        </section>
      )}

      <section className="shell relative z-10 grid items-start gap-10 py-12 md:py-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16" aria-labelledby="dundies-title">
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
          <h2 id="dundies-title" className="title">
            The Dundies
          </h2>
          <p className="lead mt-4 max-w-[46ch]">{say(`Every easter egg you find on this site wins a Dundie. You have ${won.length} of ${all.length}. Michael is presenting them now, in order, at length.`)}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button type="button" className="btn btn-primary" onClick={present}>
              Present the next Dundie
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => twss()}>
              That’s what she said
            </button>
          </div>
          {all.some((id) => unlocked.includes(id)) && (
            <>
              <p className="label mt-8">Won</p>
              <ul className="dundie-shelf mt-3">
                {all
                  .filter((id) => unlocked.includes(id))
                  .map((id) => (
                    <li key={id} data-won title={ACHIEVEMENTS[id].desc}>
                      <Dundie won className="w-auto" />
                      <span className="mt-2 block text-xs font-semibold text-ink">{ACHIEVEMENTS[id].name}</span>
                      <span className="sr-only">: {ACHIEVEMENTS[id].desc}</span>
                    </li>
                  ))}
              </ul>
            </>
          )}
          {all.some((id) => !unlocked.includes(id)) && (
            <>
              <p className="label mt-8">Still to find · {all.filter((id) => !unlocked.includes(id)).length}</p>
              <ul className="dundie-shelf dundie-shelf-empty mt-3" aria-label="Dundies not won yet">
                {all
                  .filter((id) => !unlocked.includes(id))
                  .map((id) => (
                    <li key={id}>
                      <Dundie won={false} className="w-auto" />
                      <span className="sr-only">Not won yet</span>
                    </li>
                  ))}
              </ul>
            </>
          )}
        </div>
      </section>

      {hasPhotos(PLACES) && (
        <section className="shell relative z-10 pb-24 pt-12 md:pb-28" aria-labelledby="office-places-title">
          <h2 id="office-places-title" className="title">
            The real Scranton
          </h2>
          <p className="lead mt-4 max-w-[54ch]">{say('The show was shot in California, but the city is real.')}</p>
          <div className="mt-8">
            <WorldPhotos items={PLACES} />
          </div>
        </section>
      )}
    </div>
  );
}
