import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Doors from '../components/middleearth/Doors';
import Bridge from '../components/middleearth/Bridge';
import Ring from '../components/middleearth/Ring';
import MiddleEarthMap from '../components/middleearth/Map';
import Gorgoroth from '../components/middleearth/Gorgoroth';
import MapBackdrop from '../components/middleearth/MapBackdrop';
import MapHub from '../components/middleearth/MapHub';
import { chapter as findChapter, neighbours } from '../components/middleearth/chapters';
import { shouldOpen } from '../components/middleearth/opening';
import { STOPS } from '../components/middleearth/road';
import WorldPhotos from '../components/worlds/WorldPhotos';
import Scenes from '../components/worlds/Scenes';
import { hasPhotos, hasScenes } from '../components/worlds/media';
import { useAchievements } from '../components/Achievements';
import { useSectionThemes, useTheme } from '../theme/ThemeProvider';
import { audioContext } from '../lib/audio';
import { jumpTo } from '../lib/anchors';
import { prefersReducedMotion, useDocumentTitle } from '../lib/hooks';
import '@fontsource/cinzel/600.css';
import ScriptToggle from '../components/ScriptToggle';

const sfx = () => import('../lib/sfx');

// New Zealand, standing in for Middle-earth.
const LOCATIONS = [
  { id: 'me-bag-end', title: 'Bag End, Hobbiton', note: 'The Shire was built on a sheep farm near Matamata, and Bilbo’s door is still there.' },
  { id: 'me-hobbiton', title: 'Hobbiton, Matamata', note: 'Hobbit holes around the pond, under the Party Tree’s hill.' },
  { id: 'me-doom', title: 'Mount Ngauruhoe, Tongariro', note: 'Mount Doom in the wide shots.' },
  { id: 'me-edoras', title: 'Mount Sunday, Canterbury', note: 'Where Edoras was built for the films, then taken down again.' },
  { id: 'me-pinnacles', title: 'Putangirua Pinnacles, Wairarapa', note: 'The Dimholt Road, on the way to the Paths of the Dead.' },
  { id: 'me-anduin', title: 'Kawarau River, Otago', note: 'The Anduin, where the Argonath stand.' },
];
const SCENES = ['lotrPass', 'lotrPrecious', 'lotrRing'];

// What the doors say back to a wrong word, as the Watcher wakes up.
const WRONG = [
  'Nothing happens.',
  'Still nothing. The lake is very still.',
  'Something is stirring in the water.',
  'The water is moving. Read the arch again: it is a riddle.',
];

// Middle-earth is a map. The page opens on it, as the films do, and the map is
// how you get about: pick a place and the camera flies down to it, and its
// chapter opens over the map. The Shire has the road, Rivendell the films,
// Moria the Doors of Durin and the Bridge of Khazad-dûm, Lothlórien the
// places it was filmed, and Mordor the walk across Gorgoroth and the Ring.
// Each chapter is its own address (#/middle-earth/moria), and the map is
// one button away. Reachable from the worlds menu, the terminal ('moria')
// and the Off the clock dock.
const FLY = 950;

export default function MiddleEarth() {
  const { place } = useParams();
  const here = findChapter(place);
  const navigate = useNavigate();
  useDocumentTitle(here ? `${here.name} · Middle-earth` : 'Middle-earth');
  useSectionThemes();
  const api = useRef(null);
  const frame = useRef(null);
  const [hover, setHover] = useState(null);
  const [flying, setFlying] = useState(null);
  const flight = useRef(0);
  useEffect(() => () => clearTimeout(flight.current), []);
  const [step, setStep] = useState(0);
  const [entering, setEntering] = useState(false);
  const { unlock } = useAchievements();
  const { active, mode } = useTheme();
  const [lit, setLit] = useState(false);
  const [open, setOpen] = useState(false);
  const [tries, setTries] = useState(0);
  const [word, setWord] = useState('');
  const [say, setSay] = useState('');
  const music = useRef(null);
  const [opening, setOpening] = useState(() => !place && shouldOpen());
  useEffect(() => () => music.current?.stop(), []);

  const moon = () => {
    if (lit) return;
    setLit(true);
    setSay('The moon comes out, and lines of silver begin to shine on the rock.');
  };

  const speak = (e) => {
    e.preventDefault();
    const w = word.toLowerCase().replace(/[^a-z]/g, '');
    if (!w || open) return;
    audioContext(); // in the submit, so the doors can be heard
    if (w === 'mellon') {
      setLit(true);
      setOpen(true);
      setTries(0);
      setSay('Mellon. The doors swing slowly open.');
      unlock('mellon');
      sfx().then((s) => s.stone());
      import('../lib/clips').then(async (c) => {
        music.current = await c.playClip('lotr', { when: 1.2, duration: 18 });
      });
      return;
    }
    if (w === 'friend') return setSay('Close. Now say it in Elvish.');
    if (w.startsWith('speakfriend')) return setSay('That is the riddle, not the answer.');
    if (w === 'opensesame') return setSay('Wrong story.');
    if (/annon|edro|edhellen/.test(w)) return setSay('Gandalf tried that one too. It didn’t work for him either.');
    const n = tries + 1;
    setTries(n);
    setSay(WRONG[Math.min(n, WRONG.length) - 1]);
  };

  const enter = (e) => {
    e.preventDefault();
    if (entering) return;
    audioContext();
    sfx().then((x) => x.drum());
    setEntering(true);
    const still = prefersReducedMotion();
    setTimeout(
      () => {
        jumpTo(null, 'khazad-dum');
        setTimeout(() => setEntering(false), 600);
      },
      still ? 50 : 1300,
    );
  };

  // fly down to a place, then open its chapter
  const go = (id) => {
    if (flying) return;
    audioContext();
    setFlying(id);
    setHover(null);
    clearTimeout(flight.current);
    flight.current = setTimeout(
      () => {
        navigate(`/middle-earth/${id}`);
        window.scrollTo(0, 0);
        setFlying(null);
      },
      prefersReducedMotion() ? 0 : FLY,
    );
  };
  const toMap = () => {
    navigate('/middle-earth');
    window.scrollTo(0, 0);
  };
  // a place in the address that isn't on the map: the map itself
  useEffect(() => {
    if (place && !here) navigate('/middle-earth', { replace: true });
  }, [place, here, navigate]);

  const lead = open
    ? 'The Doors of Durin stand open on the dark of Moria. It is a long way through, and something is waiting at the bridge.'
    : lit
      ? 'Ithildin, made by the Elves of Eregion: it shines only by starlight and moonlight. The doors open to a single word.'
      : 'Somewhere on this cliff are the Doors of Durin. They show only by moonlight, and open to a single word. Move your light over the rock, or call the moon.';

  const spotAt = flying ? findChapter(flying).at : here?.at ?? null;
  const { prev, next } = neighbours(here?.id);

  return (
    <div className="me-page relative" data-opening={opening || undefined} data-chapter={here?.id} data-flying={flying || undefined}>
      <MapBackdrop
        api={api}
        onFrame={() => frame.current?.()}
        spot={spotAt}
        zoom={flying ? 0.6 : null}
        hover={!here && hover ? findChapter(hover).at : null}
        mordor={here ? active === 'mordor' : hover === 'mordor' || flying === 'mordor'}
        dark={mode === 'dark'}
        hub={!here}
        opening={opening}
        onOpened={() => setOpening(false)}
      />

      {!here && (
        <section data-theme-section="shire" className="me-hub-section relative z-10" aria-labelledby="me-title">
          <MapHub api={api} frameRef={frame} hover={hover} onHover={setHover} onGo={go} leaving={Boolean(flying)} hidden={opening} />
        </section>
      )}

      {here && (
        <div className="me-bar shell relative z-20">
          <button type="button" className="btn btn-ghost btn-sm me-bar-back" onClick={toMap}>
            <span aria-hidden="true">←</span> The map
          </button>
          <p className="me-bar-where">
            <span className="eyebrow">Middle-earth</span> <b>{here.name}</b>
          </p>
          {next && (
            <button type="button" className="btn btn-ghost btn-sm me-bar-next" onClick={() => go(next.id)}>
              On to {next.name} <span aria-hidden="true">→</span>
            </button>
          )}
        </div>
      )}

      {here?.id === 'moria' && (
        <>
          <section data-theme-section="shire" className="shell relative z-10 grid items-center gap-10 pb-16 pt-10 md:pb-20 lg:min-h-[86svh] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16" aria-labelledby="doors-title">
            <figure className="me-scene" data-entering={entering || undefined}>
              <Doors lit={lit} open={open} watcher={tries >= 3 && !open} onMoon={moon} />
              <figcaption className="me-caption">
                On the arch, in Sindarin: <i>Ennyn Durin Aran Moria: pedo mellon a minno.</i> “The Doors of Durin, Lord of Moria. Speak, friend, and enter.”
              </figcaption>
            </figure>
            <div>
              <p className="eyebrow">Moria · The West-gate</p>
              <h1 id="doors-title" className="display mt-6 text-[clamp(2.5rem,1.4rem+3.6vw,4.4rem)]">
                {open ? 'Mellon.' : 'Speak, friend, and enter.'}
              </h1>
              <p className="lead mt-6 max-w-[48ch]">{lead}</p>
              <form className="mt-8 flex max-w-md gap-2" onSubmit={speak}>
                <label htmlFor="me-word" className="sr-only">
                  Say the word
                </label>
                <input id="me-word" className="fun-input" placeholder="Say the word" value={word} maxLength={32} onChange={(e) => setWord(e.target.value)} disabled={open} autoComplete="off" />
                <button type="submit" className="btn btn-primary flex-none" disabled={open}>
                  Speak
                </button>
              </form>
              <p className="mt-3 min-h-[1.5em] text-sm text-muted" role="status">
                {say}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                {!lit && (
                  <button type="button" className="btn btn-ghost" onClick={moon}>
                    Call the moon
                  </button>
                )}
                {open && (
                  <a href="#khazad-dum" className="btn btn-primary" onClick={enter}>
                    Enter Moria
                  </a>
                )}
                <ScriptToggle id="runes" />
              </div>
            </div>
          </section>
          <section id="khazad-dum" data-theme-section="shire" className="shell relative z-10 scroll-mt-24 py-14 md:py-20" aria-labelledby="bridge-title">
            <Bridge />
          </section>
        </>
      )}

      {here?.id === 'shire' && (
        <section id="the-road" data-theme-section="shire" className="shell relative z-10 scroll-mt-24 pb-14 pt-10 md:pb-20" aria-labelledby="road-title">
          <h1 id="road-title" className="title">
            There and back again
          </h1>
          <p className="lead mt-4 max-w-[56ch]">The road the Ring took, from a party in Hobbiton to the fire it was made in. Step along it.</p>
          <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)] lg:gap-12">
            <figure className="me-map-frame m-0">
              <MiddleEarthMap step={step} />
            </figure>
            <div className="me-road card">
              <p className="mono text-xs text-muted">
                {step + 1} of {STOPS.length}
              </p>
              <h3 className="stretch-semi mt-2 text-xl font-semibold text-ink">{STOPS[step].name}</h3>
              <p className="mt-2 leading-relaxed text-body" aria-live="polite">
                {STOPS[step].text}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep((n) => Math.max(0, n - 1))} disabled={step === 0}>
                  Back
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setStep((n) => Math.min(STOPS.length - 1, n + 1))} disabled={step === STOPS.length - 1}>
                  On to {STOPS[Math.min(STOPS.length - 1, step + 1)].name}
                </button>
                {STOPS[step].id === 'moria' && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => go('moria')}>
                    Go to Moria
                  </button>
                )}
                {STOPS[step].id === 'mount-doom' && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => go('mordor')}>
                    Go to Mordor
                  </button>
                )}
              </div>
              <ol className="me-stops mt-6">
                {STOPS.map((st, i) => (
                  <li key={st.id}>
                    <button type="button" aria-current={i === step ? 'step' : undefined} onClick={() => setStep(i)}>
                      {st.name}
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>
      )}

      {here?.id === 'mordor' && (
        <div data-theme-section="mordor" className="mordor-band relative z-10">
          <section id="gorgoroth" className="shell relative scroll-mt-24 pb-14 pt-10 md:pb-20" aria-labelledby="gorgoroth-title">
            <Gorgoroth onArrive={() => setTimeout(() => jumpTo(null, 'ring'), 1200)} />
          </section>
          <section id="ring" className="shell relative scroll-mt-24 pb-16 pt-10 md:pb-20" aria-labelledby="ring-title">
            <Ring />
          </section>
        </div>
      )}

      {here?.id === 'rivendell' && (
        <section data-theme-section="shire" className="shell relative z-10 pb-14 pt-10" aria-labelledby="me-scenes-title">
          <h1 id="me-scenes-title" className="title">
            From the films
          </h1>
          <p className="lead mt-4 max-w-[54ch]">Elrond’s house keeps the old tales. A few of them, as the films told them.</p>
          {hasScenes(SCENES) && (
            <div className="mt-8">
              <Scenes names={SCENES} />
            </div>
          )}
        </section>
      )}

      {here?.id === 'lorien' && (
        <section data-theme-section="shire" className="shell relative z-10 pb-14 pt-10" aria-labelledby="me-places-title">
          <h1 id="me-places-title" className="title">
            The Mirror of Galadriel
          </h1>
          <p className="lead mt-4 max-w-[54ch]">It shows things that were, and things that are. Look in, and Middle-earth is New Zealand: a few of the places it was filmed, as they look today.</p>
          {hasPhotos(LOCATIONS) && (
            <div className="mt-8">
              <WorldPhotos items={LOCATIONS} />
            </div>
          )}
        </section>
      )}

      {here && (
        <nav className="me-onward shell relative z-10 pb-24 md:pb-28" aria-label="Where next">
          <div className="me-onward-card">
            <p className="eyebrow">The road goes ever on</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {next ? (
                <button type="button" className="btn btn-primary" onClick={() => go(next.id)}>
                  On to {next.name}
                </button>
              ) : (
                <button type="button" className="btn btn-primary" onClick={toMap}>
                  Back to the whole map
                </button>
              )}
              {prev && (
                <button type="button" className="btn btn-ghost" onClick={() => go(prev.id)}>
                  Back to {prev.name}
                </button>
              )}
              {next && (
                <button type="button" className="btn btn-ghost" onClick={toMap}>
                  The map
                </button>
              )}
            </div>
          </div>
        </nav>
      )}
    </div>
  );
}
