import { Link, useLocation } from 'react-router-dom';
import { RiGithubFill, RiLinkedinBoxFill, RiMailLine } from 'react-icons/ri';
import { profile } from '../data/profile';
import { restartSite } from '../lib/restart';
import Wordmark, { AurebeshLine } from './Wordmark';
import { useOnceVisible } from './ui';
import { byPath } from './universe/universes';

// Marvel rules: there's always a scene after the credits.
function PostCredits() {
  const ref = useOnceVisible('seen');
  return (
    <div ref={ref} className="post-credits shell">
      <p className="pc-hint">Stay for the post-credits scene</p>
      <div className="pc-scene">
        <p className="pc-big">Tilak Patel will return</p>
        <p className="pc-small">Graduating from Northeastern in May 2027</p>
      </div>
    </div>
  );
}

export default function Footer() {
  // this page's place on the universe map (a station for the site's own pages, a planet for a world)
  const here = byPath(useLocation().pathname);
  return (
    <footer className="relative z-10 border-t border-line bg-deep">
      <div className="shell flex flex-col gap-10 py-12 md:flex-row md:items-end md:justify-between">
        <div className="max-w-sm">
          <Link to="/" className="wordmark" aria-label="Tilak Patel, home">
            <Wordmark />
          </Link>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Technical program manager and software engineer: roadmaps, capacity planning, infrastructure tooling and AI pipelines. Northeastern University, class of 2027.
          </p>
        </div>

        <nav aria-label="Footer" className="footer-links grid flex-none grid-cols-[repeat(2,max-content)] gap-x-10 gap-y-2 whitespace-nowrap text-sm sm:grid-cols-[repeat(3,max-content)]">
          <Link className="link-quiet" to="/experience">Experience</Link>
          <Link className="link-quiet" to="/projects">Projects</Link>
          <Link className="link-quiet" to="/travel">Travel</Link>
          <Link className="link-quiet" to="/contact">Contact</Link>
          <Link className="link-quiet" to="/terminal">Terminal</Link>
          <Link className="link-quiet" to="/resume">Résumé</Link>
          <Link className="link-quiet" to="/deathstar" title="Classified: the Death Star">DS-1 plans</Link>
          {here && (
            <Link className="link-quiet" to={`/universe/${here.id}`} title={`${here.world ?? here.label} in the universe`}>
              This page on the map
            </Link>
          )}
          <Link className="link-quiet" to="/changes" title="The ship’s log: what the site’s autopilot changed">What’s changed</Link>
          <button type="button" className="link-quiet text-left" onClick={restartSite} title="The welcome, the crawl and the cockpit again">
            Start over
          </button>
        </nav>

        <div className="flex gap-2">
          <a className="btn btn-ghost w-11 px-0" href={`mailto:${profile.email}`} aria-label="Email">
            <RiMailLine className="h-5 w-5" />
          </a>
          <a className="btn btn-ghost w-11 px-0" href={profile.github.url} target="_blank" rel="noopener noreferrer" aria-label="GitHub">
            <RiGithubFill className="h-5 w-5" />
          </a>
          <a className="btn btn-ghost w-11 px-0" href={profile.linkedin.url} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
            <RiLinkedinBoxFill className="h-5 w-5" />
          </a>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="shell text-fine flex flex-col gap-2 py-5 text-muted sm:flex-row sm:items-start sm:justify-between sm:gap-8">
          <p className="max-w-[var(--measure)] leading-relaxed">
            © {new Date().getFullYear()} Tilak Patel. A personal, fan-made tribute: the films and shows it borrows from belong to their creators and studios, and it isn’t affiliated with or endorsed by any of them.
          </p>
          <p className="flex-none">
            <AurebeshLine className="text-sm">May the Force be with you.</AurebeshLine>
          </p>
        </div>
      </div>
      <PostCredits />
    </footer>
  );
}
