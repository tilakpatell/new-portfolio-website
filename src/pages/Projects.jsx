import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { RiArrowRightLine, RiArrowRightUpLine, RiGithubFill } from 'react-icons/ri';
import RouteLine from '../components/RouteLine';
import ProjectThumb from '../components/ProjectThumb';
import { Chips, Reveal, SectionHeading, Waypoint } from '../components/ui';
import { featuredProjects, otherProjects } from '../data/projects';
import { profile } from '../data/profile';
import { ROUTE_THEMES } from '../theme/themes';
import { useSectionThemes } from '../theme/ThemeProvider';
import { useDocumentTitle } from '../lib/hooks';

const CTA = {
  'gameboy-emulator': 'Play it and see how it works',
  'swaminarayan-translator': 'Watch it translate a page',
  devspace: 'See the live editor',
  'awesome-copilot': 'See the contribution',
};

// A featured project tile. `wide` tiles put the demo beside the text; the
// others stack it on top. Each tile carries its project's colours.
function Feature({ project, wide, flip, className = '' }) {
  const themeId = ROUTE_THEMES[`/projects/${project.id}`];
  const credit = project.credits?.find((c) => c.role === 'Built with' && c.people[0].name !== 'Claude');
  return (
    <div data-theme-section={themeId} className={`relative ${className}`}>
      <Waypoint top="2.2rem" />
      <Reveal className="h-full">
        <Link to={`/projects/${project.id}`} className={`card card-lift group grid h-full grid-cols-[minmax(0,1fr)] overflow-hidden ${wide ? 'md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]' : 'grid-rows-[auto_1fr]'}`}>
          <ProjectThumb
            stage={project.stage}
            className={`aspect-[16/10] rounded-none border-0 ${wide ? `md:aspect-auto md:min-h-[360px] ${flip ? 'md:order-2' : ''}` : ''}`}
          />
          <div className={`flex flex-col p-6 ${wide ? 'sm:p-10' : 'sm:p-8'}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-muted">{project.kind}</span>
              {project.award && <span className="chip chip-accent !min-h-0 !py-0.5">{project.award}</span>}
            </div>
            <h2 id={`${project.id}-row`} className={`display mt-3 ${wide ? 'text-[clamp(2.1rem,1.3rem+2.6vw,3.6rem)]' : 'text-[clamp(1.8rem,1.3rem+1.6vw,2.6rem)]'}`}>
              {project.title}
            </h2>
            <p className="mt-4 max-w-[52ch] text-[1.05rem] leading-relaxed text-body">{project.summary}</p>
            {credit && <p className="mt-2 text-sm text-muted">Built with {credit.people.map((p) => p.name).join(', ')}</p>}
            <Chips items={project.stack.slice(0, 6)} className="mt-6" />
            <span className="btn btn-primary mt-8 self-start md:mt-auto">
              {CTA[project.id] || 'Open the demo'} <RiArrowRightLine className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
          </div>
        </Link>
      </Reveal>
    </div>
  );
}

// The rest: one row each, thumbnail, what it is, and what it's built with.
function ProjectRow({ project }) {
  return (
    <li className="border-t border-line first:border-t-0">
      <Link to={`/projects/${project.id}`} className="group grid items-center gap-5 py-6 sm:grid-cols-[180px_minmax(0,1fr)] lg:grid-cols-[200px_minmax(0,1fr)_minmax(0,0.6fr)] lg:gap-10">
        <ProjectThumb stage={project.stage} className="aspect-[16/10] transition-transform duration-300 group-hover:-translate-y-0.5" />
        <div>
          <p className="text-sm font-medium text-muted">{project.kind}</p>
          <h3 className="stretch-semi mt-1 flex items-center gap-2 text-xl font-semibold text-ink">
            {project.title}
            <RiArrowRightUpLine className="h-5 w-5 flex-none text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--accent-text)]" aria-hidden="true" />
          </h3>
          <p className="mt-2 max-w-[60ch] leading-relaxed text-body">{project.summary}</p>
        </div>
        <p className="mono text-xs leading-relaxed text-muted sm:col-start-2 lg:col-start-auto lg:text-right">{project.stack.join(', ')}</p>
      </Link>
    </li>
  );
}

export default function Projects() {
  useDocumentTitle('Projects');
  useSectionThemes();
  const page = useRef(null);
  const [gameboy, translator, devspace, copilot] = featuredProjects;

  return (
    <div ref={page} className="relative">
      <RouteLine containerRef={page} />
      <header data-theme-section="aws" className="shell relative z-10 pb-6 pt-[calc(var(--nav-h)+40px)] md:pb-10 md:pt-[calc(var(--nav-h)+72px)]">
        <div className="relative">
          <Waypoint top="0.6rem" />
          <p className="eyebrow">Projects</p>
          <h1 className="display mt-6 text-[clamp(3rem,1.6rem+6vw,6.4rem)]">
            Built to be
            <br />
            played with.
          </h1>
          <p className="lead mt-7 max-w-2xl">
            An emulator you can play, an AI translator for Gujarati scripture, a hackathon-winning cloud IDE and open-source work. Each opens with live
            demos.
          </p>
        </div>
      </header>

      <section className="shell relative z-10 grid grid-cols-[minmax(0,1fr)] gap-5 py-8 md:grid-cols-2 md:gap-6" aria-label="Featured projects">
        <Feature project={gameboy} wide className="md:col-span-2" />
        <Feature project={translator} />
        <Feature project={devspace} />
        <Feature project={copilot} wide flip className="md:col-span-2" />
      </section>

      <section data-theme-section="aws" className="shell relative z-10 pb-24 pt-16 md:pt-24" aria-labelledby="more-title">
        <SectionHeading title="Coursework, earlier builds and research" id="more-title" />
        <ul className="mt-8">
          {otherProjects.map((p) => (
            <ProjectRow key={p.id} project={p} />
          ))}
        </ul>
        <a href={profile.github.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost mt-10">
          <RiGithubFill className="h-4 w-4" aria-hidden="true" /> Everything else is on GitHub
        </a>
      </section>
    </div>
  );
}
