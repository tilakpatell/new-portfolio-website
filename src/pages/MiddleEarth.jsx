import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Doors from '../components/middleearth/Doors';
import Bridge from '../components/middleearth/Bridge';
import Ring from '../components/middleearth/Ring';
import MiddleEarthMap from '../components/middleearth/Map';
import Gorgoroth from '../components/middleearth/Gorgoroth';
import MapBackdrop from '../components/middleearth/MapBackdrop';
import { shouldOpen } from '../components/middleearth/opening';
import { STOPS } from '../components/middleearth/road';
import WorldSwitcher from '../components/worlds/WorldSwitcher';
import WorldPhotos from '../components/worlds/WorldPhotos';
import Scenes from '../components/worlds/Scenes';
import { hasPhotos, hasScenes } from '../components/worlds/media';
import { MiddleEarth as Mountains } from '../components/worlds/Backdrops';
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

// Middle-earth: the Doors of Durin, the road on the map, the Bridge of Khazad-dûm,
// then Mordor: Gorgoroth under the Eye and the One Ring at Mount Doom. Behind
// it all lies the map, which the page opens on, as the films do.
// Reachable from the worlds menu, the terminal ('moria') and the Off the clock dock.
export default function MiddleEarth() {
  useDocumentTitle('Middle-earth');
  useSectionThemes();
  const [step, setStep] = useState(0);
  const [entering, setEntering] = useState(false);
  const { unlock } = useAchievements();
  const { active } = useTheme();
  const [lit, setLit] = useState(false);
  const [open, setOpen] = useState(false);
  const [tries, setTries] = useState(0);
  const [word, setWord] = useState('');
  const [say, setSay] = useState('');
  const music = useRef(null);
  const [opening, setOpening] = useState(shouldOpen);
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

  const lead = open
    ? 'The Doors of Durin stand open on the dark of Moria. It is a long way through, and something is waiting at the bridge.'
    : lit
      ? 'Ithildin, made by the Elves of Eregion: it shines only by starlight and moonlight. The doors open to a single word.'
      : 'Somewhere on this cliff are the Doors of Durin. They show only by moonlight, and open to a single word. Move your light over the rock, or call the moon.';

  return (
    <div className="me-page relative" data-opening={opening || undefined}>
      <MapBackdrop mordor={active === 'mordor'} opening={opening} onOpened={() => setOpening(false)} />
      <section data-theme-section="shire" className="shell relative z-10 grid items-center gap-10 pb-16 pt-[calc(var(--nav-h)+36px)] md:pb-20 lg:min-h-[100svh] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16" aria-labelledby="me-title">
        <Mountains variant={active === 'mordor' ? 'mordor' : 'shire'} className="hero-backdrop" />
        <figure className="me-scene" data-entering={entering || undefined}>
          <Doors lit={lit} open={open} watcher={tries >= 3 && !open} onMoon={moon} />
          <figcaption className="me-caption">
            On the arch, in Sindarin: <i>Ennyn Durin Aran Moria: pedo mellon a minno.</i> “The Doors of Durin, Lord of Moria. Speak, friend, and enter.”
          </figcaption>
        </figure>
        <div>
          <p className="eyebrow">Middle-earth · The West-gate of Moria</p>
          <h1 id="me-title" className="display mt-6 text-[clamp(2.5rem,1.4rem+3.6vw,4.4rem)]">
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
            <Link to="/" className="btn btn-ghost">
              Back to the site
            </Link>
          </div>
          <WorldSwitcher className="mt-10" />
        </div>
      </section>

      <section id="the-road" data-theme-section="shire" className="shell relative z-10 scroll-mt-24 py-14 md:py-20" aria-labelledby="road-title">
        <h2 id="road-title" className="title">
          There and back again
        </h2>
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
                <a href="#khazad-dum" className="btn btn-ghost btn-sm" onClick={(e) => jumpTo(e, 'khazad-dum')}>
                  To the bridge
                </a>
              )}
              {STOPS[step].id === 'mount-doom' && (
                <a href="#gorgoroth" className="btn btn-ghost btn-sm" onClick={(e) => jumpTo(e, 'gorgoroth')}>
                  Cross Gorgoroth
                </a>
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

      <section id="khazad-dum" data-theme-section="shire" className="shell relative z-10 scroll-mt-24 py-14 md:py-20" aria-labelledby="bridge-title">
        <Bridge />
      </section>

      <div data-theme-section="mordor" className="mordor-band relative z-10">
        <section id="gorgoroth" className="shell relative scroll-mt-24 py-14 md:py-20" aria-labelledby="gorgoroth-title">
          <Gorgoroth onArrive={() => setTimeout(() => jumpTo(null, 'ring'), 1200)} />
        </section>
        <section id="ring" className="shell relative scroll-mt-24 pb-16 pt-10 md:pb-20" aria-labelledby="ring-title">
          <Ring />
        </section>
      </div>

      {hasScenes(SCENES) && (
        <section data-theme-section="shire" className="shell relative z-10 py-10" aria-labelledby="me-scenes-title">
          <h2 id="me-scenes-title" className="title">
            From the films
          </h2>
          <div className="mt-8">
            <Scenes names={SCENES} />
          </div>
        </section>
      )}

      {hasPhotos(LOCATIONS) && (
        <section data-theme-section="shire" className="shell relative z-10 pb-24 pt-10 md:pb-28" aria-labelledby="me-places-title">
          <h2 id="me-places-title" className="title">
            Where it was filmed
          </h2>
          <p className="lead mt-4 max-w-[54ch]">Middle-earth is New Zealand. A few of the places, as they look today.</p>
          <div className="mt-8">
            <WorldPhotos items={LOCATIONS} />
          </div>
        </section>
      )}
    </div>
  );
}
