import { Link, useLocation } from 'react-router-dom';
import { RiPlayFill } from 'react-icons/ri';
import { useDocumentTitle } from '../lib/hooks';
import { AurebeshLine } from '../components/Wordmark';
import Egg from '../components/Egg';

export default function NotFound() {
  useDocumentTitle('Page not found');
  const { pathname } = useLocation();
  return (
    <div className="shell relative z-10 flex min-h-[100svh] items-center pb-20 pt-[calc(var(--nav-h)+40px)]">
      <div className="max-w-3xl">
        <p className="eyebrow">Error 404</p>
        <h1 className="display mt-6 text-[clamp(2.6rem,1.5rem+4.6vw,5.2rem)]">This isn’t the page you’re looking for.</h1>
        <p className="lead mt-6 max-w-xl">
          Nothing lives at <span className="mono break-all text-ink">{pathname}</span>. It may have moved when the site was rebuilt.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/" className="btn btn-primary">
            Home
          </Link>
          <Egg id="lost" className="order-last self-center" />
          <Link to="/experience" className="btn btn-ghost">
            Experience
          </Link>
          <Link to="/projects" className="btn btn-ghost">
            Projects
          </Link>
        </div>
        <p className="mt-10 text-sm text-muted">
          <AurebeshLine>Move along. Move along.</AurebeshLine>
        </p>
        <button type="button" className="btn btn-ghost btn-sm mt-4" onClick={() => import('../lib/clips').then((c) => c.playClip('notTheDroids'))}>
          <RiPlayFill className="h-4 w-4" aria-hidden="true" />
          Hear it from Obi-Wan
        </button>
      </div>
    </div>
  );
}
