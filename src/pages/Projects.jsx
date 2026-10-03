import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { RiArrowRightLine, RiGithubFill } from 'react-icons/ri';
import RouteLine from '../components/RouteLine';
import ProjectCard from '../components/ProjectCard';
import ProjectThumb from '../components/ProjectThumb';
import { Chips, Reveal, SectionHeading, Waypoint } from '../components/ui';
import { featuredProjects, otherProjects, projectById } from '../data/projects';
import { profile } from '../data/profile';
import { useDocumentTitle } from '../lib/hooks';

export default function Projects() {
  useDocumentTitle('Projects');
  const page = useRef(null);
  const gb = projectById('gameboy-emulator');
  const rest = featuredProjects.filter((p) => p.id !== gb.id);

  return (
    <div ref={page} className="relative">
      <RouteLine containerRef={page} />
      <header className="shell relative z-10 pb-8 pt-[calc(var(--nav-h)+40px)] md:pt-[calc(var(--nav-h)+72px)]">
        <div className="relative">
          <Waypoint top="0.6rem" />
          <p className="eyebrow">Projects</p>
          <h1 className="display mt-6 text-[clamp(3rem,1.6rem+6vw,6rem)]">
            Built to be
            <br />
            played with.
          </h1>
          <p className="lead mt-6 max-w-2xl">
            An emulator you can play, an AI translator for Gujarati scripture, a hackathon-winning cloud IDE and open-source work. Open any of them
            for a live demo of how it works.
          </p>
        </div>
      </header>

      {/* Headline project */}
      <section className="shell relative z-10 py-10" aria-labelledby="gb-card-title">
        <Reveal>
          <Link to={`/projects/${gb.id}`} className="card group grid overflow-hidden md:grid-cols-[1.1fr_1fr]">
            <ProjectThumb stage={gb.stage} className="aspect-[16/10] rounded-none border-0 md:aspect-auto md:min-h-[320px]" />
            <div className="flex flex-col p-6 sm:p-8">
              <p className="eyebrow">Featured · playable</p>
              <h2 id="gb-card-title" className="display mt-3 text-[clamp(2rem,1.4rem+2.4vw,3.2rem)]">
                {gb.title}
              </h2>
              <p className="mt-3 text-lg text-body">{gb.summary}</p>
              <Chips items={gb.stack} className="mt-5" />
              <span className="btn btn-primary mt-auto self-start">
                Play it and see how it works <RiArrowRightLine className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
          </Link>
        </Reveal>
      </section>

      <section className="shell relative z-10 py-10" aria-labelledby="featured-title">
        <SectionHeading eyebrow="Also on my résumé" title="Featured" id="featured-title" />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {rest.map((p, i) => (
            <Reveal key={p.id} delay={i * 60}>
              <ProjectCard project={p} />
            </Reveal>
          ))}
        </div>
      </section>

      <section className="shell relative z-10 pb-24 pt-14" aria-labelledby="more-title">
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
