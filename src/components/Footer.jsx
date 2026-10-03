import { Link } from 'react-router-dom';
import { RiGithubFill, RiLinkedinBoxFill, RiMailLine } from 'react-icons/ri';
import { profile } from '../data/profile';
import { Monogram } from './Nav';

export default function Footer() {
  return (
    <footer className="relative z-10 border-t border-line bg-deep">
      <div className="shell flex flex-col gap-10 py-12 md:flex-row md:items-end md:justify-between">
        <div className="max-w-sm">
          <Link to="/" className="inline-flex items-center gap-3" aria-label="Tilak Patel, home">
            <Monogram className="h-8 w-6" />
            <span className="stretch-wide font-bold text-ink">Tilak Patel</span>
          </Link>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Software engineer — infrastructure tooling, AI pipelines and systems. Northeastern University, class of 2027.
          </p>
        </div>

        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm sm:grid-cols-3">
          <Link className="text-body hover:text-ink" to="/experience">Experience</Link>
          <Link className="text-body hover:text-ink" to="/projects">Projects</Link>
          <Link className="text-body hover:text-ink" to="/contact">Contact</Link>
          <Link className="text-body hover:text-ink" to="/terminal">Terminal</Link>
          <a className="text-body hover:text-ink" href={profile.resume.href} download={profile.resume.filename}>Résumé</a>
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
          <p className="mono">May the Force be with you.</p>
        </div>
      </div>
    </footer>
  );
}
