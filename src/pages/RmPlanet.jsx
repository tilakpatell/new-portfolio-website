import { useCallback } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import RmWorld from '../components/rickmorty/world/RmWorld';
import { planetPage } from '../components/rickmorty/world/planetMode';
import WorldSwitcher from '../components/worlds/WorldSwitcher';
import { useDocumentTitle } from '../lib/hooks';

// A planet of the universe map's Rick and Morty sector, landed on: straight
// into its world (C-137's game, started there: ../components/rickmorty/world/
// planetMode.js), and its portal back out to the ship by it in space. Only the
// sector's ten planets; anything else under /c-137/ (but the Citadel, a route
// of its own) is C-137.
export default function RmPlanet() {
  const { planet } = useParams();
  const page = planetPage(planet);
  useDocumentTitle(page?.name ?? 'Dimension C-137');
  const navigate = useNavigate();
  const space = page?.space;
  // (out to space in the planet's place in the history, so Back from the map doesn't land him on it again)
  const leave = useCallback(() => navigate(space, { replace: true }), [navigate, space]);
  if (!page) return <Navigate to="/c-137" replace />;
  return (
    <div className="relative">
      <h1 className="sr-only">{page.name}</h1>
      <RmWorld start={page.id} onLeave={leave} />
      <section className="shell relative z-10 py-10 md:py-14" aria-label={`About ${page.name}`}>
        <p className="eyebrow">The Rick and Morty sector</p>
        <p className="lead mt-3 max-w-[62ch]">{page.note} Step back through its portal and you’re out in space again, parked by the planet.</p>
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
