import { Link, useParams, useSearchParams } from 'react-router-dom';
import ExpanseWorld from '../components/expanse/surface/ExpanseWorld';
import { LAND_TYPES } from '../lib/land/spec';
import { use3D } from '../lib/gpu';
import { useDocumentTitle } from '../lib/hooks';

// A planet of the Expanse, from its seed: /universe/expanse/:seed, its type
// in ?type= (temperate by default). The land is made from the seed; the
// car is driven on it (components/expanse/surface). Without 3D, a line
// saying so.
export const planetName = (seed, type) => `${type[0].toUpperCase()}${type.slice(1)} planet ${seed}`;

export default function Expanse() {
  const { seed = '7' } = useParams();
  const [query] = useSearchParams();
  const asked = query.get('type');
  const type = LAND_TYPES.includes(asked) ? asked : 'temperate';
  const name = planetName(seed, type);
  useDocumentTitle(name);
  const three = use3D();
  return (
    <div className="pt-[var(--nav-h)]">
      {three.on ? (
        <ExpanseWorld seed={seed} type={type} name={name} />
      ) : (
        <section className="shell py-16">
          <h1 className="title">{name}</h1>
          <p className="lead mt-4 max-w-[60ch]">A planet made from its seed, its hills, rivers, lakes and sea, to drive a little car over. It is drawn in 3D, which is {three.can ? 'switched off' : 'not available'} here.</p>
          {three.can && (
            <button type="button" className="btn btn-primary mt-6" onClick={() => three.set('auto')}>
              Turn 3D on
            </button>
          )}
          <p className="mt-6">
            <Link to="/worlds" className="btn btn-ghost">
              Your worlds
            </Link>
          </p>
        </section>
      )}
    </div>
  );
}
