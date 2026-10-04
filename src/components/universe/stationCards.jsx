/* eslint-disable react-refresh/only-export-components -- the cards and their index live together */
import { Link } from 'react-router-dom';
import { RiDownloadLine, RiGithubLine, RiLinkedinBoxLine, RiMailLine } from 'react-icons/ri';
import { profile } from '../../data/profile';
import { currentRole, roleLink, roles } from '../../data/roles';
import { featuredProjects } from '../../data/projects';

// What each station on the universe map holds, in the panel beside it: a
// taste of the page you'd dock at, from the same data the pages use.

function Station({ title, children }) {
  return (
    <li className="fun-card station-card">
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <h3 className="stretch-semi text-xl font-semibold text-ink">{title}</h3>
        {children}
      </div>
    </li>
  );
}

const Home = () => (
  <Station title={profile.name}>
    <p className="mt-1 text-sm text-muted">{profile.identity}</p>
    <p className="mt-3 text-[0.95rem] leading-relaxed text-body">{profile.lead}</p>
    <p className="mt-2 text-[0.95rem] leading-relaxed text-body">{profile.focus}</p>
  </Station>
);

const Experience = () => (
  <Station title="Experience">
    {currentRole && (
      <p className="mt-2 text-[0.95rem] leading-relaxed text-body">
        Now: {currentRole.title} at {currentRole.company}.
      </p>
    )}
    <ul className="station-list mt-3">
      {roles.map((r) => (
        <li key={r.id}>
          <Link to={roleLink(r.id)}>
            <span className="text-ink">{r.company}</span>
            <span className="text-muted">{r.title}</span>
          </Link>
        </li>
      ))}
    </ul>
  </Station>
);

const Projects = () => (
  <Station title="Projects">
    <ul className="station-list mt-3">
      {featuredProjects.map((p) => (
        <li key={p.id}>
          <Link to={`/projects/${p.id}`}>
            <span className="text-ink">{p.title}</span>
            <span className="text-muted">{p.subtitle}</span>
          </Link>
        </li>
      ))}
    </ul>
  </Station>
);

const Resume = () => (
  <Station title="Résumé">
    <p className="mt-2 text-[0.95rem] leading-relaxed text-body">The one-page version: roles, projects and skills, as a PDF or read right here.</p>
    <div className="mt-4 flex flex-wrap gap-2">
      <a href={profile.resume.href} download={profile.resume.filename} className="btn btn-ghost btn-sm">
        <RiDownloadLine className="h-4 w-4" aria-hidden="true" /> Download the PDF
      </a>
    </div>
  </Station>
);

const Contact = () => (
  <Station title="Contact">
    <p className="mt-2 text-[0.95rem] leading-relaxed text-body">The quickest way to reach me is email. I read everything.</p>
    <div className="mt-4 flex flex-wrap gap-2">
      <a href={`mailto:${profile.email}`} className="btn btn-ghost btn-sm">
        <RiMailLine className="h-4 w-4" aria-hidden="true" /> {profile.email}
      </a>
      <a href={profile.linkedin.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
        <RiLinkedinBoxLine className="h-4 w-4" aria-hidden="true" /> LinkedIn
      </a>
      <a href={profile.github.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
        <RiGithubLine className="h-4 w-4" aria-hidden="true" /> GitHub
      </a>
    </div>
  </Station>
);

const Terminal = () => (
  <Station title="Terminal">
    <p className="mt-2 text-[0.95rem] leading-relaxed text-body">The whole site as a shell. Try help, whoami or ls, and a few commands that aren’t in the help.</p>
    <pre className="station-term mt-4">
      <span>$ whoami</span>
      {'\n'}
      {profile.name.toLowerCase()}
    </pre>
  </Station>
);

export const STATION_CARDS = { home: Home, experience: Experience, projects: Projects, resume: Resume, contact: Contact, terminal: Terminal };
