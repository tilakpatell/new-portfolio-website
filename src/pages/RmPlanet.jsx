import { Suspense, lazy, useCallback } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import RmWorld from '../components/rickmorty/world/RmWorld';
import { planetPage } from '../components/rickmorty/world/planetMode';
import { isBigPlanet } from '../components/rickmorty/world/dimensions/destinations';
import WorldSwitcher from '../components/worlds/WorldSwitcher';
import { useDocumentTitle } from '../lib/hooks';

// (a big planet is the galaxy's surface engine: its code comes only for one)
const RmSurface = lazy(() => import('../components/rickmorty/planets/RmSurface'));

// A planet of the universe map's Rick and Morty sector, landed on. A big one
// (destinations.js's BIG) is a whole world on the galaxy's surface engine
// (../components/rickmorty/planets/RmSurface.jsx): the cruiser sets down,
// and taking off again is the way back to space. The rest go straight into
// C-137's game, started there (../components/rickmorty/world/planetMode.js),
// with the planet's portal back out to the ship. Only the sector's ten
// planets; anything else under /c-137/ (but the Citadel, a route of its own)
// is C-137.
export default function RmPlanet() {
  const { planet } = useParams();
  const page = planetPage(planet);
  useDocumentTitle(page?.name ?? 'Dimension C-137');
  const navigate = useNavigate();
  const space = page?.space;
  // (out to space in the planet's place in the history, so Back from the map doesn't land him on it again)
  const leave = useCallback(() => navigate(space, { replace: true }), [navigate, space]);
  if (!page) return <Navigate to="/c-137" replace />;
  const big = isBigPlanet(page.id);
  return (
    <div className="relative">
      <h1 className="sr-only">{page.name}</h1>
      {big ? (
        <Suspense fallback={null}>
          <RmSurface id={page.id} onLeave={leave} />
        </Suspense>
      ) : (
        <RmWorld start={page.id} onLeave={leave} />
      )}
      <section className="shell relative z-10 py-10 md:py-14" aria-label={`About ${page.name}`}>
        <p className="eyebrow">The Rick and Morty sector</p>
        <p className="lead mt-3 max-w-[62ch]">
          {page.note} {big ? 'Get back in the cruiser and take off, and you’re out in space again, parked by the planet.' : 'Step back through its portal and you’re out in space again, parked by the planet.'}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to={space} replace className="btn btn-primary">
            Back to space
          </Link>
          <Link to="/" className="btn btn-ghost">
            Back to the site
          </Link>
        </div>
        <WorldSwitcher className="mt-8" />
      </section>
    </div>
  );
}
