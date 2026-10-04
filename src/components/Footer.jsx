import { Link } from 'react-router-dom';
import { RiGithubFill, RiLinkedinBoxFill, RiMailLine } from 'react-icons/ri';
import { profile } from '../data/profile';
import Wordmark, { AurebeshLine } from './Wordmark';
import { useOnceVisible } from './ui';

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
  return (
    <footer className="relative z-10 border-t border-line bg-deep">
      <div className="shell flex flex-col gap-10 py-12 md:flex-row md:items-end md:justify-between">
        <div className="max-w-sm">
          <Link to="/" className="wordmark" aria-label="Tilak Patel, home">
            <Wordmark />
          </Link>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Software engineer building infrastructure tooling, AI pipelines and systems. Northeastern University, class of 2027.
          </p>
        </div>

        <nav aria-label="Footer" className="grid flex-none grid-cols-[repeat(2,max-content)] gap-x-10 gap-y-2 whitespace-nowrap text-sm sm:grid-cols-[repeat(3,max-content)]">
          <Link className="text-body hover:text-ink" to="/experience">Experience</Link>
          <Link className="text-body hover:text-ink" to="/projects">Projects</Link>
          <Link className="text-body hover:text-ink" to="/travel">Travel</Link>
          <Link className="text-body hover:text-ink" to="/contact">Contact</Link>
          <Link className="text-body hover:text-ink" to="/terminal">Terminal</Link>
          <Link className="text-body hover:text-ink" to="/resume">Résumé</Link>
          <Link className="text-body hover:text-ink" to="/deathstar" title="Classified">DS-1 plans</Link>
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
        <div className="shell flex flex-col gap-2 py-5 text-xs text-muted sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} Tilak Patel</p>
          <p>
            <AurebeshLine className="text-sm">May the Force be with you.</AurebeshLine>
          </p>
        </div>
      </div>
      <PostCredits />
    </footer>
  );
}
