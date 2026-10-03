import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { RiArrowRightLine, RiGithubFill } from 'react-icons/ri';
import RouteLine from '../components/RouteLine';
import ProjectCard from '../components/ProjectCard';
import ProjectThumb from '../components/ProjectThumb';
import { Chips, Reveal, SectionHeading, Waypoint } from '../components/ui';
import { featuredProjects, otherProjects } from '../data/projects';
import { profile } from '../data/profile';
import { ROUTE_THEMES, THEMES } from '../theme/themes';
import { useSectionThemes } from '../theme/ThemeProvider';
import { useDocumentTitle } from '../lib/hooks';

const CTA = {
  'gameboy-emulator': 'Play it and see how it works',
  'swaminarayan-translator': 'Watch it translate a page',
  devspace: 'See the live editor',
  'awesome-copilot': 'See the contribution',
};

// One full-width row per featured project; each carries its project's colours.
function FeatureRow({ project, flip }) {
  const themeId = ROUTE_THEMES[`/projects/${project.id}`];
  const credit = project.credits?.find((c) => c.role === 'Built with' && c.people[0].name !== 'Claude');
  return (
    <section data-theme-section={themeId} className="shell relative z-10 py-8 md:py-10" aria-labelledby={`${project.id}-row`}>
      <div className="relative">
        <Waypoint top="2.2rem" />
      </div>
      <Reveal>
        <Link to={`/projects/${project.id}`} className="card group grid overflow-hidden md:grid-cols-2">
          <ProjectThumb stage={project.stage} className={`aspect-[16/10] rounded-none border-0 md:aspect-auto md:min-h-[300px] ${flip ? 'md:order-2' : ''}`} />
          <div className="flex flex-col p-6 sm:p-8">
            <p className="eyebrow flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: THEMES[themeId]?.swatch }} aria-hidden="true" />
              {project.kind}
              {project.award ? ` · ${project.award}` : ''}
            </p>
            <h2 id={`${project.id}-row`} className="display mt-3 text-[clamp(1.9rem,1.3rem+2.2vw,3rem)]">
              {project.title}
            </h2>
            <p className="mt-3 text-[1.05rem] leading-relaxed text-body">{project.summary}</p>
            {credit && <p className="mt-2 text-sm text-muted">Built with {credit.people.map((p) => p.name).join(', ')}</p>}
            <Chips items={project.stack.slice(0, 6)} className="mt-5" />
            <span className="btn btn-primary mt-6 self-start md:mt-auto">
              {CTA[project.id] || 'Open the demo'} <RiArrowRightLine className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
          </div>
        </Link>
      </Reveal>
    </section>
  );
}

export default function Projects() {
  useDocumentTitle('Projects');
  useSectionThemes();
  const page = useRef(null);

  return (
    <div ref={page} className="relative">
      <RouteLine containerRef={page} />
      <header data-theme-section="aws" className="shell relative z-10 pb-4 pt-[calc(var(--nav-h)+40px)] md:pt-[calc(var(--nav-h)+64px)]">
        <div className="relative">
          <Waypoint top="0.6rem" />
          <p className="eyebrow">Projects</p>
          <h1 className="display mt-6 text-[clamp(3rem,1.6rem+6vw,6rem)]">
            Built to be
            <br />
            played with.
          </h1>
          <p className="lead mt-6 max-w-2xl">
            An emulator you can play, an AI translator for Gujarati scripture, a hackathon-winning cloud IDE and open-source work. Each one opens in
            its own colors, with live demos of how it works.
          </p>
        </div>
      </header>

      {featuredProjects.map((p, i) => (
        <FeatureRow key={p.id} project={p} flip={i % 2 === 1} />
      ))}

      <section data-theme-section="aws" className="shell relative z-10 pb-24 pt-14" aria-labelledby="more-title">
        <SectionHeading eyebrow="Coursework, earlier builds and research" title="More projects" id="more-title" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {otherProjects.map((p, i) => (
            <Reveal key={p.id} delay={(i % 5) * 50}>
              <ProjectCard project={p} compact />
            </Reveal>
          ))}
        </div>
        <a href={profile.github.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost mt-10">
          <RiGithubFill className="h-4 w-4" aria-hidden="true" /> Everything else is on GitHub
        </a>
      </section>
    </div>
  );
}
