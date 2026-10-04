import { Link } from 'react-router-dom';
import Cast from '../components/albuquerque/Cast';
import AbqWorld from '../components/albuquerque/world/AbqWorld';
import WorldSwitcher from '../components/worlds/WorldSwitcher';
import Scenes from '../components/worlds/Scenes';
import WorldPhotos from '../components/worlds/WorldPhotos';
import { hasPhotos, hasScenes } from '../components/worlds/media';
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

// Albuquerque: the town to drive round (the places open as Walt's career
// grows, each with its game), then the cast, the scenes and the real places.
export default function Albuquerque() {
  useDocumentTitle('Albuquerque');

  return (
    <div className="abq-page relative">
      <AbqWorld />

      <section className="shell relative z-10 grid gap-6 pb-4 pt-10 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div>
          <p className="eyebrow">Albuquerque · New Mexico</p>
          <p className="lead mt-4 max-w-[62ch]">
            Breaking Bad and Better Call Saul. Drive Walt’s Aztek round town: cook in the RV, see Saul, meet Gus at Los Pollos Hermanos, buy the superlab, and visit Hector at Casa Tranquila. Keep clear of Hank.
          </p>
        </div>
        <Link to="/" className="btn btn-ghost">
          Back to the site
        </Link>
      </section>
      <section className="shell relative z-10 pb-2">
        <WorldSwitcher />
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
