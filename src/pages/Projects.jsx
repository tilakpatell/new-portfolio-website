import { useRef } from 'react';
import PageTitle from '../components/PageTitle';
import { Link } from 'react-router-dom';
import { RiArrowRightLine, RiArrowRightUpLine, RiGithubFill } from 'react-icons/ri';
import RouteLine from '../components/RouteLine';
import ProjectThumb from '../components/ProjectThumb';
import { Breakable, Chips, Reveal, SectionHeading, useFitTitle, Waypoint } from '../components/ui';
import { featuredProjects, otherProjects } from '../data/projects';
import { profile } from '../data/profile';
import { ROUTE_THEMES } from '../theme/themes';
import { useSectionThemes } from '../theme/ThemeProvider';
import { useDocumentTitle } from '../lib/hooks';
import { usePageParams } from '../lib/page';
import PeriodicStack from '../components/projects/PeriodicStack';
import Cartridges from '../components/projects/Cartridges';
import SitarDivider from '../components/SitarDivider';
import Egg from '../components/Egg';
import '../styles/lazy/projects.css';

const CTA = {
  'gameboy-emulator': 'Play it and see how it works',
  'swaminarayan-translator': 'Watch it translate a page',
  devspace: 'See the live editor',
  'awesome-copilot': 'See the contribution',
};

// A featured project tile. `wide` tiles put the demo beside the text; the
// others stack it on top. Each tile carries its project's colours. Only tiles
// in the left column take a stop on the route line (`waypoint`), so the line
// stays in the gutter instead of cutting across the grid.
function Feature({ project, wide, flip, className = '', dim = false, waypoint = true }) {
  const fitTitle = useFitTitle();
  const themeId = ROUTE_THEMES[`/projects/${project.id}`];
  const credit = project.credits?.find((c) => c.role === 'Built with' && c.people[0].name !== 'Claude');
  return (
    <div data-theme-section={themeId} className={`project-item relative ${className}`} data-dim={dim || undefined}>
      {waypoint && <Waypoint top="2.2rem" />}
      <Reveal className="h-full">
        <Link to={`/projects/${project.id}`} className={`card card-lift group grid h-full grid-cols-[minmax(0,1fr)] overflow-hidden ${wide ? 'md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]' : 'grid-rows-[auto_1fr]'}`}>
          <ProjectThumb
            stage={project.stage}
            className={`aspect-[16/10] rounded-none border-0 ${wide ? `md:aspect-auto md:min-h-[360px] ${flip ? 'md:order-2' : ''}` : ''}`}
          />
          <div className={`flex flex-col p-6 ${wide ? 'sm:p-10' : 'sm:p-8'}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-muted">{project.kind}</span>
              {project.award && <span className="chip chip-accent chip-sm">{project.award}</span>}
            </div>
            <h2 ref={fitTitle} id={`${project.id}-row`} data-tour="projects-featured" className={`display mt-3 ${wide ? 'text-[clamp(2.1rem,1.3rem+2.6vw,3.6rem)]' : 'display-3'}`}>
              <Breakable text={project.title} />
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
function ProjectRow({ project, dim = false }) {
  return (
    <li className="project-item border-t border-line first:border-t-0" data-dim={dim || undefined}>
      <Link to={`/projects/${project.id}`} className="group grid items-center gap-5 py-6 sm:grid-cols-[180px_minmax(0,1fr)] lg:grid-cols-[200px_minmax(0,1fr)_minmax(0,0.6fr)] lg:gap-10">
        <ProjectThumb stage={project.stage} className="aspect-[16/10] transition-transform duration-300 group-hover:-translate-y-0.5" />
        <div>
          <p className="text-sm font-medium text-muted">{project.kind}</p>
          <h3 className="stretch-semi mt-1 flex items-center gap-2 text-xl font-semibold text-ink">
            <span className="min-w-0">
              <Breakable text={project.title} />
            </span>
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
  const page = useRef(null);
  useSectionThemes(page);
  const [gameboy, translator, devspace, copilot] = featuredProjects;
  // the technology filter is in the address, so a link can open on it
  const [params, setParams] = usePageParams();
  const tech = params.get('tech');
  const setTech = (t) => {
    const next = new URLSearchParams(params);
    if (t) next.set('tech', t);
    else next.delete('tech');
    setParams(next, { replace: true });
  };
  const dim = (p) => Boolean(tech) && !p.stack.includes(tech);

  return (
    <div ref={page} className="relative">
      <RouteLine containerRef={page} />
      <header data-theme-section="aws" className="shell relative z-10 pb-6 pt-[var(--page-top)] md:pb-10">
        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="relative">
            <Waypoint top="0.6rem" />
            <p className="eyebrow">Projects</p>
            {/* its own size: the title shares the head with the cartridges, and at the
                shared page size it breaks into three lines */}
            <PageTitle className="display mt-6 text-[clamp(3rem,1.4rem+4.6vw,5.4rem)]">
              Built to be
              <br />
              played with.
            </PageTitle>
            <p className="lead mt-7 max-w-2xl">
              An emulator you can play, an AI translator for Gujarati scripture, a hackathon-winning cloud IDE and open-source work. Each opens with live
              demos.
            </p>
          </div>
          <Cartridges />
        </div>
      </header>

      <PeriodicStack active={tech} onPick={setTech} />

      <section className="shell relative z-10 grid grid-cols-[minmax(0,1fr)] gap-5 py-8 md:grid-cols-2 md:gap-6" aria-label="Featured projects">
        <Feature project={gameboy} wide className="md:col-span-2" dim={dim(gameboy)} />
        <Feature project={translator} dim={dim(translator)} />
        <Feature project={devspace} dim={dim(devspace)} waypoint={false} />
        <Feature project={copilot} wide flip className="md:col-span-2" dim={dim(copilot)} />
      </section>

      <div className="shell relative z-10 pt-10">
        <SitarDivider />
      </div>

      <section data-theme-section="aws" className="shell section-last relative z-10 pt-16 md:pt-24" aria-labelledby="more-title">
        <SectionHeading title="Coursework, earlier builds and research" id="more-title" />
        <ul className="mt-8">
          {otherProjects.map((p) => (
            <ProjectRow key={p.id} project={p} dim={dim(p)} />
          ))}
        </ul>
        <a href={profile.github.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost mt-10">
          <RiGithubFill className="h-4 w-4" aria-hidden="true" /> Everything else is on GitHub
        </a>
        <Egg id="saul" className="egg-corner" />
      </section>
    </div>
  );
}
